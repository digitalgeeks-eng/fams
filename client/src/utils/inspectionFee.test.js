import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatInspectionFee } from './inspectionFee.js';

test('inspection fee display covers paid, free, and unspecified properties', () => {
  assert.equal(formatInspectionFee(3000), '₦3,000');
  assert.equal(formatInspectionFee(0), 'Free Inspection');
  assert.equal(formatInspectionFee(null), null);
  assert.equal(formatInspectionFee(undefined), null);
  assert.equal(formatInspectionFee(''), null);
});
