import assert from 'node:assert/strict';
import { test } from 'node:test';
import bookingRoutes from '../routes/bookingRoutes.js';
import propertyRoutes from '../routes/propertyRoutes.js';

const getRoute = (router, method, path) => router.stack
  .find((layer) => layer.route?.path === path && layer.route.methods[method])
  ?.route;

const assertRoleAccess = (middleware, role, allowed) => {
  let statusCode = 200;
  let nextCalled = false;
  const response = {
    status(code) {
      statusCode = code;
      return this;
    }
  };
  try {
    middleware({ user: { role } }, response, () => { nextCalled = true; });
  } catch (error) {
    assert.match(error.message, /insufficient privileges/i);
  }
  assert.equal(nextCalled, allowed);
  assert.equal(statusCode, allowed ? 200 : 403);
};

const roleMiddleware = (router, method, path) => {
  const route = getRoute(router, method, path);
  assert.ok(route, `Expected ${method.toUpperCase()} ${path} route`);
  return route.stack[1].handle;
};

test('booking creation and student history require student role', () => {
  for (const path of ['/', '/student']) {
    const middleware = roleMiddleware(bookingRoutes, path === '/' ? 'post' : 'get', path);
    assertRoleAccess(middleware, 'student', true);
    assertRoleAccess(middleware, 'agent', false);
    assertRoleAccess(middleware, 'admin', false);
  }
});

test('agent booking access and booking management preserve agent/admin roles', () => {
  const agentOnly = roleMiddleware(bookingRoutes, 'get', '/agent');
  assertRoleAccess(agentOnly, 'agent', true);
  assertRoleAccess(agentOnly, 'student', false);
  assertRoleAccess(agentOnly, 'admin', false);

  const managers = roleMiddleware(bookingRoutes, 'put', '/:id/approve');
  assertRoleAccess(managers, 'agent', true);
  assertRoleAccess(managers, 'admin', true);
  assertRoleAccess(managers, 'student', false);
});

test('both property and room inspection creation remain student-only', () => {
  for (const path of [
    '/:propertyId/inspection-requests',
    '/:propertyId/rooms/:roomId/inspection-requests'
  ]) {
    const middleware = roleMiddleware(propertyRoutes, 'post', path);
    assertRoleAccess(middleware, 'student', true);
    assertRoleAccess(middleware, 'agent', false);
    assertRoleAccess(middleware, 'admin', false);
  }
});
