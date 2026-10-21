import assert from 'node:assert/strict';
import { test } from 'node:test';
import Booking from '../models/Booking.js';
import Property from '../models/Property.js';
import Room from '../models/Room.js';
import RoomInspectionRequest from '../models/RoomInspectionRequest.js';
import {
  createPropertyInspectionRequest,
  createRoomInspectionRequest,
  listRoomInspectionRequests
} from '../controllers/roomController.js';

const propertyId = '65d123456789012345678901';
const otherPropertyId = '65d123456789012345678911';
const roomId = '65d123456789012345678902';
const otherRoomId = '65d123456789012345678912';
const studentId = '65d123456789012345678903';
const otherStudentId = '65d123456789012345678913';
const bookingId = '65d123456789012345678904';

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

const propertyRecord = (managementMode = 'multi_room') => ({
  _id: propertyId,
  managementMode,
  approvalStatus: 'approved',
  isDeleted: false,
  isUnavailable: false,
  availabilityStatus: 'available'
});

const roomRecord = () => ({
  _id: roomId,
  propertyId,
  status: 'available',
  isActive: true
});

const bookingRecord = (overrides = {}) => ({
  _id: bookingId,
  studentId,
  propertyId,
  roomId,
  bookingStatus: 'pending',
  paymentStatus: 'pending',
  ...overrides
});

const withInspectionMocks = async ({ property = propertyRecord(), booking = bookingRecord(), duplicate = false, run }) => {
  const originals = {
    propertyFindById: Property.findById,
    roomFindOne: Room.findOne,
    bookingFindById: Booking.findById,
    requestExists: RoomInspectionRequest.exists,
    requestCreate: RoomInspectionRequest.create
  };
  let createdRequest;
  Property.findById = async () => property;
  Room.findOne = async (filter) => filter._id === roomId && filter.propertyId === propertyId ? roomRecord() : null;
  Booking.findById = async () => booking;
  RoomInspectionRequest.exists = async () => duplicate;
  RoomInspectionRequest.create = async (data) => {
    createdRequest = { _id: 'request-1', status: 'pending', ...data };
    return createdRequest;
  };
  try {
    return await run({ get createdRequest() { return createdRequest; } });
  } finally {
    Property.findById = originals.propertyFindById;
    Room.findOne = originals.roomFindOne;
    Booking.findById = originals.bookingFindById;
    RoomInspectionRequest.exists = originals.requestExists;
    RoomInspectionRequest.create = originals.requestCreate;
  }
};

const roomRequest = (body = { bookingId }) => ({
  params: { propertyId, roomId },
  body,
  user: { _id: studentId, role: 'student' }
});

test('rejects inspection requests before booking', async () => {
  await withInspectionMocks({
    run: async () => {
      const response = makeResponse();
      await createRoomInspectionRequest(roomRequest({}), response);
      assert.equal(response.statusCode, 400);
      assert.match(response.body.message, /booking id is required/i);
    }
  });
});

test('accepts inspection after an eligible room booking without requiring payment or changing room availability', async () => {
  const room = roomRecord();
  await withInspectionMocks({
    run: async (context) => {
      const response = makeResponse();
      await createRoomInspectionRequest(roomRequest(), response);
      assert.equal(response.statusCode, 201);
      assert.equal(context.createdRequest.bookingId, bookingId);
      assert.equal(context.createdRequest.activeBookingId, bookingId);
      assert.equal(context.createdRequest.roomId, roomId);
      assert.equal(context.createdRequest.paymentStatus, undefined);
      assert.equal(room.status, 'available');
      assert.match(response.body.message, /availability status have not changed/i);
    }
  });
});

test('rejects inspection requests using another student’s booking', async () => {
  await withInspectionMocks({
    booking: bookingRecord({ studentId: otherStudentId }),
    run: async () => {
      const response = makeResponse();
      await createRoomInspectionRequest(roomRequest(), response);
      assert.equal(response.statusCode, 403);
      assert.match(response.body.message, /own booking/i);
    }
  });
});

test('rejects inspection requests when the booking belongs to another property', async () => {
  await withInspectionMocks({
    booking: bookingRecord({ propertyId: otherPropertyId }),
    run: async () => {
      const response = makeResponse();
      await createRoomInspectionRequest(roomRequest(), response);
      assert.equal(response.statusCode, 409);
      assert.match(response.body.message, /does not belong to this property/i);
    }
  });
});

test('rejects inspection requests when the booking belongs to a different room', async () => {
  await withInspectionMocks({
    booking: bookingRecord({ roomId: otherRoomId }),
    run: async () => {
      const response = makeResponse();
      await createRoomInspectionRequest(roomRequest(), response);
      assert.equal(response.statusCode, 409);
      assert.match(response.body.message, /does not match/i);
    }
  });
});

test('rejects a second active inspection request for the same booking', async () => {
  await withInspectionMocks({
    duplicate: true,
    run: async () => {
      const response = makeResponse();
      await createRoomInspectionRequest(roomRequest(), response);
      assert.equal(response.statusCode, 409);
      assert.match(response.body.message, /active inspection request/i);
    }
  });
});

test('accepts inspection after a single-unit property booking', async () => {
  await withInspectionMocks({
    property: propertyRecord('single_unit'),
    booking: bookingRecord({ roomId: undefined }),
    run: async (context) => {
      const response = makeResponse();
      await createPropertyInspectionRequest({
        params: { propertyId },
        body: { bookingId },
        user: { _id: studentId, role: 'student' }
      }, response);
      assert.equal(response.statusCode, 201);
      assert.equal(context.createdRequest.propertyId, propertyId);
      assert.equal(context.createdRequest.roomId, undefined);
      assert.equal(context.createdRequest.bookingId, bookingId);
    }
  });
});

test('rejects property inspection requests for room bookings', async () => {
  await withInspectionMocks({
    property: propertyRecord('single_unit'),
    booking: bookingRecord(),
    run: async () => {
      const response = makeResponse();
      await createPropertyInspectionRequest({
        params: { propertyId },
        body: { bookingId },
        user: { _id: studentId, role: 'student' }
      }, response);
      assert.equal(response.statusCode, 409);
      assert.match(response.body.message, /does not match/i);
    }
  });
});

test('keeps legacy inspection requests valid without room or booking references', () => {
  const legacyRequest = new RoomInspectionRequest({
    studentId,
    propertyId,
    status: 'completed'
  });
  assert.equal(legacyRequest.validateSync(), undefined);
});

test('Location Admin inspection access remains limited to assigned locations', async () => {
  await withInspectionMocks({
    property: { ...propertyRecord(), location: 'Gandu', locationCategory: 'Gandu' },
    run: async () => {
      const response = makeResponse();
      await listRoomInspectionRequests({
        params: { propertyId },
        user: {
          _id: studentId,
          role: 'admin',
          adminRole: 'location_admin',
          assignedLocation: 'Maraba'
        }
      }, response);
      assert.equal(response.statusCode, 403);
      assert.match(response.body.message, /assigned location/i);
    }
  });
});
