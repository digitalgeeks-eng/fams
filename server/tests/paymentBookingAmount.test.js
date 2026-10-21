import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getBookingAmount } from '../controllers/paymentController.js';

test('uses a selected room rent for room bookings and retains property rent for legacy bookings', () => {
  assert.equal(getBookingAmount({ roomId: 'room-1' }, { price: 500000 }, { price: 85000 }), 85000);
  assert.equal(getBookingAmount({ propertyId: 'property-1' }, { price: 500000 }, null), 500000);
  assert.equal(getBookingAmount({ roomId: 'room-1' }, { price: 500000 }, { price: 0 }), 0);
  assert.equal(getBookingAmount({ roomId: 'missing-room' }, { price: 500000 }, null), null);
});
