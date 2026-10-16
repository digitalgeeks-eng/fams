import assert from 'node:assert/strict';
import test from 'node:test';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { createLaunchModeMiddleware } from '../middleware/launchModeMiddleware.js';
import { getLaunchConfig } from '../utils/launchConfig.js';

const launchConfig = getLaunchConfig({
  LAUNCH_MODE_ENABLED: 'true',
  LAUNCH_AT: '2026-10-21T00:00:00+01:00'
});
const beforeLaunch = () => new Date('2026-10-20T22:59:59.000Z');

const invokeMiddleware = async (middleware, { method = 'GET', path = '/properties', token } = {}) => {
  const response = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    }
  };
  let nextCalled = false;
  await middleware(
    { method, path, headers: { authorization: token ? `Bearer ${token}` : undefined } },
    response,
    () => { nextCalled = true; }
  );
  return { response, nextCalled };
};

test('blocks unauthenticated ordinary API requests before launch', async () => {
  const middleware = createLaunchModeMiddleware(launchConfig, beforeLaunch);
  const { response, nextCalled } = await invokeMiddleware(middleware);
  assert.equal(response.statusCode, 423);
  assert.equal(response.body.code, 'PRE_LAUNCH');
  assert.equal(nextCalled, false);
});

test('permits login and current-user validation endpoints to reach role checks', async () => {
  const middleware = createLaunchModeMiddleware(launchConfig, beforeLaunch);
  const loginResult = await invokeMiddleware(middleware, { method: 'POST', path: '/auth/login' });
  const googleResult = await invokeMiddleware(middleware, { method: 'POST', path: '/auth/google' });
  const currentUserResult = await invokeMiddleware(middleware, { method: 'GET', path: '/auth/me' });
  assert.equal(loginResult.nextCalled, true);
  assert.equal(googleResult.nextCalled, true);
  assert.equal(currentUserResult.nextCalled, true);
});

test('allows a valid Super Admin token and blocks other roles', async () => {
  const originalFindById = User.findById;
  const originalSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'launch-middleware-test-secret';
  try {
    const middleware = createLaunchModeMiddleware(launchConfig, beforeLaunch);
    const adminToken = jwt.sign({ id: '507f1f77bcf86cd799439011' }, process.env.JWT_SECRET);
    const studentToken = jwt.sign({ id: '507f1f77bcf86cd799439012' }, process.env.JWT_SECRET);
    const locationAdminToken = jwt.sign({ id: '507f1f77bcf86cd799439013' }, process.env.JWT_SECRET);

    User.findById = (id) => ({
      select: async () => ({
        role: id.endsWith('11') || id.endsWith('13') ? 'admin' : 'student',
        adminRole: id.endsWith('13') ? 'location_admin' : undefined,
        status: 'active'
      })
    });

    const adminResult = await invokeMiddleware(middleware, { token: adminToken });
    const studentResult = await invokeMiddleware(middleware, { token: studentToken });
    const locationAdminResult = await invokeMiddleware(middleware, { token: locationAdminToken });
    assert.equal(adminResult.nextCalled, true);
    assert.equal(studentResult.response.statusCode, 423);
    assert.equal(locationAdminResult.response.statusCode, 423);
  } finally {
    User.findById = originalFindById;
    if (originalSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originalSecret;
  }
});

test('opens protected API access at the exact launch instant', async () => {
  const middleware = createLaunchModeMiddleware(
    launchConfig,
    () => new Date('2026-10-20T23:00:00.000Z')
  );
  const { nextCalled } = await invokeMiddleware(middleware);
  assert.equal(nextCalled, true);
});
