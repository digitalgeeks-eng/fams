import assert from 'node:assert/strict';
import test from 'node:test';
import EmailVerification from '../models/EmailVerification.js';

test('declares one TTL index for expiresAt', () => {
  const expiresAtIndexes = EmailVerification.schema.indexes()
    .filter(([keys]) => keys.expiresAt === 1);

  assert.equal(expiresAtIndexes.length, 1);
  assert.deepEqual(expiresAtIndexes[0][0], { expiresAt: 1 });
  assert.equal(expiresAtIndexes[0][1].expireAfterSeconds, 0);
});
