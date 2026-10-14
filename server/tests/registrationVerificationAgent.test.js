import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { Writable } from 'node:stream';
import { test } from 'node:test';
import { deserialize, serialize } from 'bson';

process.env.JWT_SECRET = 'registration-verification-test-secret';
process.env.CLOUDINARY_CLOUD_NAME = 'test-cloud';
process.env.CLOUDINARY_API_KEY = 'test-key';
process.env.CLOUDINARY_API_SECRET = 'test-secret';

const [
  { default: mongoose },
  { v2: cloudinary },
  { default: User },
  { default: EmailVerification },
  { verifyRegistrationCode }
] = await Promise.all([
  import('mongoose'),
  import('cloudinary'),
  import('../models/User.js'),
  import('../models/EmailVerification.js'),
  import('../controllers/authController.js')
]);

test('agent verification uploads BSON image data and consumes the code once', async () => {
  const email = 'agent@example.test';
  const code = '123456';
  const imageBytes = Buffer.from('synthetic-agent-id-image');
  const codeHash = crypto.createHmac('sha256', process.env.JWT_SECRET)
    .update(`${email}:${code}`)
    .digest('hex');
  const pending = EmailVerification.hydrate(deserialize(serialize({
    _id: new mongoose.Types.ObjectId(),
    email,
    verificationCodeHash: codeHash,
    verificationCodeExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
    verificationAttempts: 0,
    registrationStatus: 'pending',
    registrationData: {
      name: 'Synthetic Agent',
      email,
      passwordHash: 'synthetic-password-hash',
      role: 'agent',
      verificationStatus: 'pending',
      idImageBuffer: imageBytes
    },
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    createdAt: new Date(),
    updatedAt: new Date()
  })));

  assert.equal(pending.registrationData.idImageBuffer._bsontype, 'Binary');
  assert.equal(Buffer.isBuffer(pending.registrationData.idImageBuffer), false);

  const originals = {
    userFindOne: User.findOne,
    userCreate: User.create,
    verificationFindOne: EmailVerification.findOne,
    verificationFindOneAndUpdate: EmailVerification.findOneAndUpdate,
    verificationExists: EmailVerification.exists,
    verificationUpdateOne: EmailVerification.updateOne,
    startSession: mongoose.startSession,
    uploadStream: cloudinary.uploader.upload_stream
  };
  let createdUsers = 0;
  let createdUserData;
  let uploadedBytes;
  User.findOne = () => ({ session: async () => null });
  User.create = async ([data]) => {
    createdUsers += 1;
    createdUserData = data;
    return [{ ...data, _id: new mongoose.Types.ObjectId() }];
  };
  EmailVerification.findOne = (filter) => {
    if (filter._id) {
      return { select: () => ({ session: async () => pending.registrationStatus === 'pending' ? pending : null }) };
    }
    return { select: async () => pending.registrationStatus === 'pending' ? pending : null };
  };
  EmailVerification.findOneAndUpdate = async (filter, update) => {
    pending.verificationAttempts += update.$inc.verificationAttempts;
    return { verificationAttempts: pending.verificationAttempts };
  };
  EmailVerification.exists = async () => pending.registrationStatus === 'completed';
  EmailVerification.updateOne = async () => {
    pending.registrationStatus = 'completed';
    return { modifiedCount: 1 };
  };
  mongoose.startSession = async () => ({
    withTransaction: async (operation) => operation(),
    endSession: async () => {}
  });
  cloudinary.uploader.upload_stream = (options, callback) => new Writable({
    write(chunk, encoding, done) {
      uploadedBytes = Buffer.concat([uploadedBytes || Buffer.alloc(0), chunk]);
      done();
    },
    final(done) {
      callback(null, { public_id: 'synthetic-agent-id', secure_url: 'https://images.example.test/agent-id.png' });
      done();
    }
  });

  const invoke = async (submittedCode = code) => {
    const response = {
      statusCode: 200,
      status(codeValue) {
        this.statusCode = codeValue;
        return this;
      },
      json(body) {
        this.body = body;
        return this;
      }
    };
    await verifyRegistrationCode({ body: { email, code: submittedCode } }, response);
    return response;
  };

  try {
    pending.verificationCodeExpiresAt = new Date(Date.now() - 1);
    const expiredResponse = await invoke();
    assert.equal(expiredResponse.statusCode, 400);
    assert.match(expiredResponse.body.message, /expired/i);
    pending.verificationCodeExpiresAt = new Date(Date.now() + 10 * 60 * 1000);

    const incorrectResponse = await invoke('654321');
    assert.equal(incorrectResponse.statusCode, 400);
    assert.match(incorrectResponse.body.message, /incorrect/i);

    const firstResponse = await invoke();
    assert.equal(firstResponse.statusCode, 201);
    assert.equal(firstResponse.body.data.user.role, 'agent');
    assert.equal(firstResponse.body.data.user.verificationStatus, 'pending');
    assert.equal(createdUserData.idImage, 'https://images.example.test/agent-id.png');
    assert.deepEqual(uploadedBytes, imageBytes);
    assert.equal(createdUsers, 1);

    const reuseResponse = await invoke();
    assert.equal(reuseResponse.statusCode, 409);
    assert.equal(createdUsers, 1);
  } finally {
    User.findOne = originals.userFindOne;
    User.create = originals.userCreate;
    EmailVerification.findOne = originals.verificationFindOne;
    EmailVerification.findOneAndUpdate = originals.verificationFindOneAndUpdate;
    EmailVerification.exists = originals.verificationExists;
    EmailVerification.updateOne = originals.verificationUpdateOne;
    mongoose.startSession = originals.startSession;
    cloudinary.uploader.upload_stream = originals.uploadStream;
  }
});
