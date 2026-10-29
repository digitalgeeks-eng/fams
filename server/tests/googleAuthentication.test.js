import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { test } from 'node:test';

process.env.JWT_SECRET = 'google-auth-test-secret';
process.env.GOOGLE_CLIENT_ID = 'studentnest-test-client.apps.googleusercontent.com';

const [{ OAuth2Client }, { default: User }, { googleLogin }] = await Promise.all([
  import('google-auth-library'),
  import('../models/User.js'),
  import('../controllers/authController.js')
]);

const originalVerifyIdToken = OAuth2Client.prototype.verifyIdToken;
const originalFindOne = User.findOne;
const originalCreate = User.create;
const originalGoogleClientId = process.env.GOOGLE_CLIENT_ID;
const originalJwtSecret = process.env.JWT_SECRET;

test.beforeEach(() => {
  process.env.GOOGLE_CLIENT_ID = originalGoogleClientId;
  process.env.JWT_SECRET = originalJwtSecret;
});

const makeResponse = () => ({
  statusCode: 200,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(body) {
    this.body = body;
    return this;
  }
});

const makeUser = (overrides = {}) => ({
  _id: 'google-test-user',
  name: 'Existing Student',
  email: 'student@example.test',
  role: 'student',
  verificationStatus: 'verified',
  authProvider: 'google',
  status: 'active',
  async save() {},
  ...overrides
});

const validPayload = {
  sub: 'google-subject-123',
  email: 'student@example.test',
  email_verified: true,
  name: 'Google Student',
  picture: 'https://images.example.test/google-profile.png'
};

const invoke = async (credential = 'valid-test-credential') => {
  const response = makeResponse();
  await googleLogin({ body: { credential } }, response);
  return response;
};

test.after(() => {
  OAuth2Client.prototype.verifyIdToken = originalVerifyIdToken;
  User.findOne = originalFindOne;
  User.create = originalCreate;
  if (originalGoogleClientId === undefined) delete process.env.GOOGLE_CLIENT_ID;
  else process.env.GOOGLE_CLIENT_ID = originalGoogleClientId;
  if (originalJwtSecret === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = originalJwtSecret;
});

test('registers a new Google user as a verified student and returns a valid JWT', async () => {
  let createdUser;
  let createCalls = 0;
  OAuth2Client.prototype.verifyIdToken = async ({ idToken, audience }) => {
    assert.equal(idToken, 'valid-test-credential');
    assert.equal(audience, originalGoogleClientId);
    return { getPayload: () => validPayload };
  };
  User.findOne = () => ({ select: async () => null });
  User.create = async (data) => {
    createCalls += 1;
    createdUser = makeUser({ ...data, _id: 'new-google-student' });
    return createdUser;
  };

  const response = await invoke();

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.data.user.id, 'new-google-student');
  assert.equal(response.body.data.user.role, 'student');
  assert.equal(response.body.data.user.verificationStatus, 'verified');
  assert.equal(createdUser.googleId, validPayload.sub);
  assert.equal(createdUser.email, validPayload.email);
  assert.equal(createCalls, 1);
  assert.equal(jwt.verify(response.body.data.token, process.env.JWT_SECRET).id, 'new-google-student');
});

test('logs in an existing Google user without changing their role or creating a duplicate', async () => {
  const existingUser = makeUser({
    _id: 'existing-agent-user',
    role: 'agent',
    verificationStatus: 'verified',
    googleId: validPayload.sub
  });
  let lookups = 0;
  let createCalls = 0;
  OAuth2Client.prototype.verifyIdToken = async () => ({ getPayload: () => validPayload });
  User.findOne = () => ({
    select: async () => {
      lookups += 1;
      return existingUser;
    }
  });
  User.create = async () => {
    createCalls += 1;
    throw new Error('Should not create an existing Google account');
  };

  const response = await invoke();

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.data.user.id, 'existing-agent-user');
  assert.equal(response.body.data.user.role, 'agent');
  assert.equal(lookups, 1);
  assert.equal(createCalls, 0);
});

test('links a verified Google identity to an existing email account instead of duplicating it', async () => {
  const existingUser = makeUser({
    _id: 'existing-local-user',
    password: 'existing-password-hash',
    authProvider: 'local'
  });
  const filters = [];
  let createCalls = 0;
  OAuth2Client.prototype.verifyIdToken = async () => ({ getPayload: () => validPayload });
  User.findOne = (filter) => ({
    select: async () => {
      filters.push(filter);
      return filters.length === 1 ? null : existingUser;
    }
  });
  User.create = async () => {
    createCalls += 1;
    throw new Error('Should link the existing account');
  };

  const response = await invoke();

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.data.user.id, 'existing-local-user');
  assert.equal(existingUser.googleId, validPayload.sub);
  assert.equal(existingUser.authProvider, 'both');
  assert.equal(existingUser.role, 'student');
  assert.deepEqual(filters, [{ googleId: validPayload.sub }, { email: validPayload.email }]);
  assert.equal(createCalls, 0);
});

test('rejects invalid or expired Google credentials without looking up or creating users', async () => {
  let databaseCalls = 0;
  OAuth2Client.prototype.verifyIdToken = async () => {
    throw new Error('Invalid or expired Google credential');
  };
  User.findOne = () => {
    databaseCalls += 1;
    throw new Error('Should not query users for invalid credentials');
  };
  User.create = async () => {
    databaseCalls += 1;
    throw new Error('Should not create users for invalid credentials');
  };

  const response = await invoke('invalid-or-expired-credential');

  assert.equal(response.statusCode, 401);
  assert.equal(response.body.message, 'Google authentication failed. Please try again.');
  assert.equal(databaseCalls, 0);
});

test('returns service unavailable when the backend Google client ID is missing', async () => {
  let verificationCalls = 0;
  process.env.GOOGLE_CLIENT_ID = '';
  OAuth2Client.prototype.verifyIdToken = async () => {
    verificationCalls += 1;
    throw new Error('Should not verify without an audience');
  };

  const response = await invoke();

  assert.equal(response.statusCode, 503);
  assert.equal(response.body.message, 'Google authentication is not configured');
  assert.equal(verificationCalls, 0);
});

test('rejects suspended Google-linked accounts without changing or creating users', async () => {
  const suspendedUser = makeUser({ status: 'suspended', googleId: validPayload.sub });
  let createCalls = 0;
  OAuth2Client.prototype.verifyIdToken = async () => ({ getPayload: () => validPayload });
  User.findOne = () => ({ select: async () => suspendedUser });
  User.create = async () => {
    createCalls += 1;
    throw new Error('Should not create a replacement account');
  };

  const response = await invoke();

  assert.equal(response.statusCode, 403);
  assert.match(response.body.message, /suspended/i);
  assert.equal(createCalls, 0);
});
