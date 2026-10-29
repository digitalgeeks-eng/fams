import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getBookingHistory, getBookingHistoryError } from './bookingHistory.js';

test('reads the booking history response without filtering booking statuses or room links', () => {
  const bookings = [
    { _id: 'single-unit', bookingStatus: 'pending', roomId: null },
    { _id: 'room-booking', bookingStatus: 'confirmed', roomId: { roomNumber: 'A1' } },
    { _id: 'cancelled-legacy', bookingStatus: 'cancelled' }
  ];

  assert.deepEqual(getBookingHistory({ data: { data: bookings } }), bookings);
  assert.deepEqual(getBookingHistory({ data: { data: [] } }), []);
});

test('rejects invalid booking history response shapes', () => {
  assert.throws(
    () => getBookingHistory({ data: { data: null } }),
    /invalid response/i
  );
});

test('returns API and connectivity errors instead of interpreting them as empty history', () => {
  assert.equal(
    getBookingHistoryError({ response: { data: { message: 'Login required' } } }),
    'Login required'
  );
  assert.equal(
    getBookingHistoryError({ response: { status: 503, data: {} } }),
    'Unable to load your bookings. Please try again.'
  );
  assert.equal(
    getBookingHistoryError({ message: 'Network Error' }),
    'Unable to connect to the booking service. Please try again.'
  );
});
