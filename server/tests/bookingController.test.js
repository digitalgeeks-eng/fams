import assert from 'node:assert/strict';
import { test } from 'node:test';
import Booking from '../models/Booking.js';
import Property from '../models/Property.js';
import Room from '../models/Room.js';
import { createBooking } from '../controllers/bookingController.js';

const propertyId = '65d123456789012345678901';
const roomId = '65d123456789012345678902';
const studentId = '65d123456789012345678903';

const makeResponse = () => ({
  statusCode: 200,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(body) {
    this.body = body;
    return this;
  }
});

const approvedProperty = (managementMode = 'single_unit') => ({
  _id: propertyId,
  managementMode,
  approvalStatus: 'approved',
  isUnavailable: false,
  availabilityStatus: 'available'
});

const availableRoom = (overrides = {}) => ({
  _id: roomId,
  propertyId,
  status: 'available',
  isActive: true,
  ...overrides
});

const futureDates = () => {
  const checkIn = new Date();
  checkIn.setDate(checkIn.getDate() + 1);
  const checkOut = new Date(checkIn);
  checkOut.setDate(checkOut.getDate() + 7);
  return {
    checkInDate: checkIn.toISOString().slice(0, 10),
    checkOutDate: checkOut.toISOString().slice(0, 10)
  };
};

const withBookingMocks = async ({ property, room, run }) => {
  const originals = {
    propertyFindById: Property.findById,
    roomFindOne: Room.findOne,
    bookingFindOne: Booking.findOne,
    bookingCreate: Booking.create
  };
  const filters = [];
  let createdBooking;
  Property.findById = async () => property;
  Room.findOne = async (filter) => filter._id === room?._id && filter.propertyId === property._id ? room : null;
  Booking.findOne = async (filter) => {
    filters.push(filter);
    return null;
  };
  Booking.create = async (data) => {
    createdBooking = data;
    return { _id: 'booking-1', ...data };
  };
  try {
    return await run({ filters, get createdBooking() { return createdBooking; } });
  } finally {
    Property.findById = originals.propertyFindById;
    Room.findOne = originals.roomFindOne;
    Booking.findOne = originals.bookingFindOne;
    Booking.create = originals.bookingCreate;
  }
};

test('creates a booking for an available single-unit property without requiring payment', async () => {
  await withBookingMocks({
    property: approvedProperty(),
    run: async (context) => {
      const response = makeResponse();
      await createBooking({
        body: { propertyId, ...futureDates() },
        user: { _id: studentId, role: 'student' }
      }, response);
      assert.equal(response.statusCode, 201);
      assert.equal(response.body.data.propertyId, propertyId);
      assert.equal(context.createdBooking.roomId, undefined);
      assert.equal(context.createdBooking.paymentStatus, undefined);
      assert.equal(context.filters[1].propertyId, propertyId);
    }
  });
});

test('creates a booking for the selected available room in a multi-room property', async () => {
  await withBookingMocks({
    property: approvedProperty('multi_room'),
    room: availableRoom(),
    run: async (context) => {
      const response = makeResponse();
      await createBooking({
        body: { propertyId, roomId, ...futureDates() },
        user: { _id: studentId, role: 'student' }
      }, response);
      assert.equal(response.statusCode, 201);
      assert.equal(context.createdBooking.propertyId, propertyId);
      assert.equal(context.createdBooking.roomId, roomId);
      assert.equal(context.filters[1].roomId, roomId);
    }
  });
});

test('rejects room bookings for occupied, reserved, inactive, or unavailable rooms', async () => {
  for (const room of [
    availableRoom({ status: 'occupied' }),
    availableRoom({ status: 'reserved' }),
    availableRoom({ status: 'unavailable' }),
    availableRoom({ isActive: false })
  ]) {
    await withBookingMocks({
      property: approvedProperty('multi_room'),
      room,
      run: async () => {
        const response = makeResponse();
        await createBooking({
          body: { propertyId, roomId, ...futureDates() },
          user: { _id: studentId, role: 'student' }
        }, response);
        assert.equal(response.statusCode, 409);
        assert.match(response.body.message, /room is not available/i);
      }
    });
  }
});

test('requires an exact room selection for multi-room properties', async () => {
  await withBookingMocks({
    property: approvedProperty('multi_room'),
    run: async () => {
      const response = makeResponse();
      await createBooking({
        body: { propertyId, ...futureDates() },
        user: { _id: studentId, role: 'student' }
      }, response);
      assert.equal(response.statusCode, 400);
      assert.match(response.body.message, /select a specific room/i);
    }
  });
});

test('keeps existing booking records valid when they have no room reference', () => {
  const legacyBooking = new Booking({
    studentId,
    propertyId,
    checkInDate: new Date('2025-01-01'),
    checkOutDate: new Date('2025-01-08')
  });
  assert.equal(legacyBooking.validateSync(), undefined);
  assert.equal(legacyBooking.bookingStatus, 'pending');
  assert.equal(legacyBooking.paymentStatus, 'pending');
});
