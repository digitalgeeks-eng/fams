import assert from 'node:assert/strict';
import { test } from 'node:test';
import Booking from '../models/Booking.js';
import Property from '../models/Property.js';
import Room from '../models/Room.js';
import RoomInspectionRequest from '../models/RoomInspectionRequest.js';
import { createBooking, getStudentBookings } from '../controllers/bookingController.js';

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

const withBookingMocks = async ({ property, room, existingBooking = null, run }) => {
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
    return existingBooking;
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

test('returns every booking status for only the authenticated student, including after creation and refresh', async () => {
  const originals = {
    propertyFindById: Property.findById,
    roomFindOne: Room.findOne,
    bookingFindOne: Booking.findOne,
    bookingCreate: Booking.create,
    bookingFind: Booking.find,
    inspectionFind: RoomInspectionRequest.find
  };
  const persistedBookings = [];
  const inspectionRecords = [];
  const makeBookingRecord = (data) => {
    const booking = { ...data };
    Object.defineProperty(booking, 'toObject', {
      value() {
        const { toObject, ...record } = this;
        return record;
      }
    });
    return booking;
  };
  const makeQuery = (records) => ({
    populate() { return this; },
    sort() { return Promise.resolve(records); }
  });
  persistedBookings.push(
    makeBookingRecord({
      _id: 'confirmed-room-booking',
      studentId,
      propertyId,
      roomId,
      bookingStatus: 'confirmed',
      paymentStatus: 'paid',
      createdAt: new Date('2025-01-01')
    }),
    makeBookingRecord({
      _id: 'cancelled-legacy-booking',
      studentId,
      propertyId,
      bookingStatus: 'cancelled',
      paymentStatus: 'failed',
      createdAt: new Date('2024-01-01')
    }),
    makeBookingRecord({
      _id: 'completed-legacy-booking',
      studentId,
      propertyId,
      bookingStatus: 'completed',
      paymentStatus: 'paid',
      createdAt: new Date('2023-01-01')
    })
  );
  Property.findById = async () => approvedProperty();
  Room.findOne = async () => null;
  Booking.findOne = async () => null;
  Booking.create = async (data) => {
    const booking = makeBookingRecord({
      _id: `booking-${persistedBookings.length + 1}`,
      bookingStatus: 'pending',
      paymentStatus: 'pending',
      ...data,
      createdAt: new Date(),
    });
    persistedBookings.push(booking);
    return booking;
  };
  Booking.find = (filter) => {
    assert.deepEqual(filter, { studentId });
    return makeQuery(persistedBookings);
  };
  RoomInspectionRequest.find = (filter) => {
    assert.deepEqual(filter, { studentId });
    return makeQuery(inspectionRecords);
  };
  try {
    const createResponse = makeResponse();
    await createBooking({
      body: { propertyId, ...futureDates() },
      user: { _id: studentId, role: 'student' }
    }, createResponse);
    assert.equal(createResponse.statusCode, 201);
    inspectionRecords.push({
      _id: 'inspection-1',
      bookingId: createResponse.body.data._id,
      propertyId,
      roomId,
      status: 'pending'
    });

    for (let refresh = 0; refresh < 2; refresh += 1) {
      const historyResponse = makeResponse();
      await getStudentBookings({ user: { _id: studentId, role: 'student' } }, historyResponse);
      assert.equal(historyResponse.body.data.length, 4);
      assert.deepEqual(
        historyResponse.body.data.map((booking) => booking.bookingStatus),
        ['confirmed', 'cancelled', 'completed', 'pending']
      );
      const createdBooking = historyResponse.body.data.find((booking) => booking._id === createResponse.body.data._id);
      assert.equal(createdBooking.bookingStatus, 'pending');
      assert.equal(createdBooking.paymentStatus, 'pending');
      assert.equal(createdBooking.roomId, undefined);
      assert.equal(createdBooking.inspectionRequests[0]._id, 'inspection-1');
      assert.ok(createdBooking.createdAt);
      assert.equal(historyResponse.body.data[0].roomId, roomId);
    }
  } finally {
    Property.findById = originals.propertyFindById;
    Room.findOne = originals.roomFindOne;
    Booking.findOne = originals.bookingFindOne;
    Booking.create = originals.bookingCreate;
    Booking.find = originals.bookingFind;
    RoomInspectionRequest.find = originals.inspectionFind;
  }
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

test('rejects a duplicate active booking for overlapping dates', async () => {
  await withBookingMocks({
    property: approvedProperty(),
    existingBooking: { _id: 'existing-booking' },
    run: async (context) => {
      const response = makeResponse();
      await createBooking({
        body: { propertyId, ...futureDates() },
        user: { _id: studentId, role: 'student' }
      }, response);
      assert.equal(response.statusCode, 409);
      assert.match(response.body.message, /already have an active booking/i);
      assert.equal(context.createdBooking, undefined);
      assert.equal(context.filters.length, 1);
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
