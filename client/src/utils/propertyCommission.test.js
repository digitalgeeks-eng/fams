import assert from 'node:assert/strict';
import { test } from 'node:test';
import { calculatePropertyCommission, formatNairaAmount } from './propertyCommission.js';

test('formats the live commission breakdown in Naira without adding commission to rent', () => {
  const result = calculatePropertyCommission('100000');
  assert.equal(formatNairaAmount(result.propertyPrice), '₦100,000.00');
  assert.equal(formatNairaAmount(result.studentNestCommission), '₦3,000.00');
  assert.equal(formatNairaAmount(result.agentAmount), '₦97,000.00');
  assert.equal(result.propertyPrice, 100000);
});

test('handles editing to a new price and rejects invalid values', () => {
  assert.equal(calculatePropertyCommission('250000').studentNestCommission, 7500);
  assert.equal(calculatePropertyCommission('1e3').propertyPrice, 1000);
  assert.equal(calculatePropertyCommission('-1'), null);
  assert.equal(calculatePropertyCommission('invalid'), null);
});

test('keeps inspection fees separate from rental commission', () => {
  const property = { price: '100000', inspectionFee: 2500 };
  const estimate = calculatePropertyCommission(property.price);
  assert.equal(estimate.studentNestCommission, 3000);
  assert.equal(estimate.propertyPrice, 100000);
  assert.equal(property.inspectionFee, 2500);
});
