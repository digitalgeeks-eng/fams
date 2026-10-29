import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getAuthenticatedHomePath, persistAuthSession } from './authSession.js';

test('persists Google authentication token and updates frontend user state', () => {
  const values = new Map();
  const calls = [];
  const user = { id: 'user-1', role: 'student' };

  persistAuthSession({ token: 'signed-test-token', user }, {
    storage: { setItem: (key, value) => values.set(key, value) },
    setAuthToken: (token) => calls.push(['token', token]),
    setUser: (value) => calls.push(['user', value])
  });

  assert.equal(values.get('amsToken'), 'signed-test-token');
  assert.deepEqual(calls, [['token', 'signed-test-token'], ['user', user]]);
});

test('routes authenticated users to their role dashboard and preserves student booking return paths', () => {
  assert.equal(getAuthenticatedHomePath('admin'), '/admin');
  assert.equal(getAuthenticatedHomePath('agent'), '/agent');
  assert.equal(getAuthenticatedHomePath('student'), '/student');
  assert.equal(getAuthenticatedHomePath('student', '/properties/property-1'), '/properties/property-1');
  assert.equal(getAuthenticatedHomePath('agent', '/properties/property-1'), '/agent');
  assert.equal(getAuthenticatedHomePath('student', '//external.example'), '/student');
});
