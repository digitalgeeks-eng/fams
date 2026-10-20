import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isRoomInspectionEligible, validateRoomInput } from '../utils/roomRules.js';

const validRoom = {
  roomNumber: 'A1',
  type: 'Single Room',
  price: 45000,
  billingPeriod: 'yearly',
  status: 'available',
  isActive: true,
  toilet: 'shared',
  shower: 'private',
  kitchen: 'none',
  waterSource: 'borehole',
  waterAvailable: true,
  electricity: false,
  facilities: ['wardrobe']
};

test('accepts valid room details including zero rent and optional unknown facilities', () => {
  assert.equal(validateRoomInput({ ...validRoom, price: 0 }), null);
  assert.equal(validateRoomInput({ ...validRoom, waterAvailable: null, electricity: null }), null);
});

test('rejects missing, negative, non-finite, and unsafe room rents', () => {
  for (const price of [undefined, null, '', -1, 'NaN', 'Infinity', Number.MAX_SAFE_INTEGER + 1]) {
    assert.notEqual(validateRoomInput({ ...validRoom, price }), null);
  }
});

test('rejects unsupported room types, statuses, facilities, and non-boolean availability values', () => {
  assert.notEqual(validateRoomInput({ ...validRoom, type: 'Penthouse' }), null);
  assert.notEqual(validateRoomInput({ ...validRoom, status: 'booked' }), null);
  assert.notEqual(validateRoomInput({ ...validRoom, toilet: 'exclusive' }), null);
  assert.notEqual(validateRoomInput({ ...validRoom, waterAvailable: 'yes' }), null);
  assert.notEqual(validateRoomInput({ ...validRoom, facilities: 'wardrobe' }), null);
});

test('allows inspection requests only for approved, visible, available active rooms', () => {
  const property = {
    managementMode: 'multi_room',
    approvalStatus: 'approved',
    visibleUntil: new Date('2026-10-21T00:00:00.000Z'),
    availabilityStatus: 'available'
  };
  const now = new Date('2026-10-20T23:59:59.000Z');
  assert.equal(isRoomInspectionEligible(property, validRoom, now), true);
  assert.equal(isRoomInspectionEligible(property, validRoom, new Date('2026-10-21T00:00:00.000Z')), false);
  assert.equal(isRoomInspectionEligible({ ...property, approvalStatus: 'pending' }, validRoom, now), false);
  assert.equal(isRoomInspectionEligible(property, { ...validRoom, status: 'occupied' }, now), false);
  assert.equal(isRoomInspectionEligible(property, { ...validRoom, isActive: false }, now), false);
  assert.equal(isRoomInspectionEligible({ ...property, isUnavailable: true }, validRoom, now), false);
});
