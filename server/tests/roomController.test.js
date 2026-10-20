import assert from 'node:assert/strict';
import { test } from 'node:test';
import Property from '../models/Property.js';
import Room from '../models/Room.js';
import RoomInspectionRequest from '../models/RoomInspectionRequest.js';
import { listProperties } from '../controllers/propertyController.js';
import {
  createPropertyRooms,
  createRoomInspectionRequest,
  getPropertyRooms,
  updatePropertyRoom
} from '../controllers/roomController.js';

const propertyId = '65d123456789012345678901';
const roomId = '65d123456789012345678902';

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

const approvedProperty = (overrides = {}) => ({
  _id: propertyId,
  agentId: '65d123456789012345678903',
  ownerType: 'agent',
  managementMode: 'multi_room',
  approvalStatus: 'approved',
  location: 'Gandu',
  locationCategory: 'Gandu',
  ...overrides
});

const roomRecord = (overrides = {}) => ({
  _id: roomId,
  propertyId,
  roomNumber: 'A1',
  type: 'Single Room',
  price: 45000,
  billingPeriod: 'yearly',
  status: 'available',
  isActive: true,
  images: [],
  videos: [],
  toObject() { return { ...this }; },
  ...overrides
});

test('creates multi-room inventory with unique normalized room labels', async () => {
  const originals = {
    propertyFindById: Property.findById,
    roomFind: Room.find,
    roomInsertMany: Room.insertMany
  };
  const property = approvedProperty();
  let inserted;
  Property.findById = async () => property;
  Room.find = () => ({ select: async () => [] });
  Room.insertMany = async (documents) => {
    inserted = documents;
    return documents;
  };

  try {
    const response = makeResponse();
    await createPropertyRooms({
      params: { propertyId },
      body: {
        rooms: [
          { roomNumber: 'a1', type: 'Single Room', price: 45000 },
          { roomNumber: 'b1', type: 'Self-Contain', price: 75000 }
        ]
      },
      user: { _id: property.agentId, role: 'agent' }
    }, response);
    assert.equal(response.statusCode, 201);
    assert.deepEqual(inserted.map((room) => room.roomNumber), ['A1', 'B1']);
    assert.ok(inserted.every((room) => room.propertyId === propertyId));
    assert.equal(inserted[0].statusHistory[0].to, 'available');
  } finally {
    Property.findById = originals.propertyFindById;
    Room.find = originals.roomFind;
    Room.insertMany = originals.roomInsertMany;
  }
});

test('rolls back a partially inserted room batch after a concurrent duplicate-label conflict', async () => {
  const originals = {
    propertyFindById: Property.findById,
    roomFind: Room.find,
    roomInsertMany: Room.insertMany,
    roomDeleteMany: Room.deleteMany
  };
  const property = approvedProperty();
  let insertedIds;
  let deletedFilter;
  Property.findById = async () => property;
  Room.find = () => ({ select: async () => [] });
  Room.insertMany = async (documents) => {
    insertedIds = documents.map((document) => document._id);
    const error = new Error('Duplicate room label');
    error.code = 11000;
    throw error;
  };
  Room.deleteMany = async (filter) => {
    deletedFilter = filter;
    return { deletedCount: 1 };
  };

  try {
    const response = makeResponse();
    await createPropertyRooms({
      params: { propertyId },
      body: { rooms: [{ roomNumber: 'A1', type: 'Single Room', price: 45000 }] },
      user: { _id: property.agentId, role: 'agent' }
    }, response);
    assert.equal(response.statusCode, 409);
    assert.match(response.body.message, /No rooms from this batch were kept/);
    assert.deepEqual(deletedFilter._id.$in, insertedIds);
    assert.equal(insertedIds.length, 1);
  } finally {
    Property.findById = originals.propertyFindById;
    Room.find = originals.roomFind;
    Room.insertMany = originals.roomInsertMany;
    Room.deleteMany = originals.roomDeleteMany;
  }
});

test('creates a nine-room batch with mixed prices, room types, and facilities', async () => {
  const originals = {
    propertyFindById: Property.findById,
    roomFind: Room.find,
    roomInsertMany: Room.insertMany
  };
  const property = approvedProperty();
  let inserted;
  Property.findById = async () => property;
  Room.find = () => ({ select: async () => [] });
  Room.insertMany = async (documents) => {
    inserted = documents;
    return documents;
  };
  const rooms = Array.from({ length: 9 }, (_, index) => ({
    roomNumber: `Room ${index + 1}`,
    type: index < 5 ? 'Self-Contain' : 'Single Room',
    price: index < 5 ? 100000 : 80000,
    toilet: index < 5 ? 'private' : 'shared',
    shower: index < 5 ? 'private' : 'shared',
    kitchen: 'none',
    waterSource: 'tap'
  }));

  try {
    const response = makeResponse();
    await createPropertyRooms({
      params: { propertyId },
      body: { rooms },
      user: { _id: property.agentId, role: 'agent' }
    }, response);
    assert.equal(response.statusCode, 201);
    assert.equal(inserted.length, 9);
    assert.equal(inserted[0].price, 100000);
    assert.equal(inserted[8].price, 80000);
    assert.equal(inserted[0].toilet, 'private');
    assert.equal(inserted[8].toilet, 'shared');
  } finally {
    Property.findById = originals.propertyFindById;
    Room.find = originals.roomFind;
    Room.insertMany = originals.roomInsertMany;
  }
});

test('combines multi-room price, type, and facility filters on the same eligible room', async () => {
  const originals = {
    propertyFind: Property.find,
    propertyCount: Property.countDocuments,
    roomDistinct: Room.distinct,
    roomAggregate: Room.aggregate
  };
  let roomFilter;
  Property.find = () => ({
    select() { return this; },
    sort() { return this; },
    skip() { return this; },
    limit: async () => []
  });
  Property.countDocuments = async () => 0;
  Room.distinct = async (field, filter) => {
    assert.equal(field, 'propertyId');
    roomFilter = filter;
    return [];
  };
  Room.aggregate = async () => [];

  try {
    await listProperties({
      query: {
        type: 'Single Room',
        priceRange: '80000-120000',
        toilet: 'private'
      }
    }, makeResponse());
    assert.deepEqual(roomFilter, {
      isActive: true,
      status: 'available',
      type: 'Single Room',
      toilet: 'private',
      price: { $gte: 80000, $lte: 120000 }
    });
  } finally {
    Property.find = originals.propertyFind;
    Property.countDocuments = originals.propertyCount;
    Room.distinct = originals.roomDistinct;
    Room.aggregate = originals.roomAggregate;
  }
});

test('inspection requests do not reserve or change the room', async () => {
  const originals = {
    propertyFindById: Property.findById,
    roomFindOne: Room.findOne,
    requestExists: RoomInspectionRequest.exists,
    requestCreate: RoomInspectionRequest.create,
    roomUpdate: Room.findOneAndUpdate
  };
  const property = approvedProperty();
  const room = roomRecord();
  let createdRequest;
  let roomUpdateCalled = false;
  Property.findById = async () => property;
  Room.findOne = async () => room;
  RoomInspectionRequest.exists = async () => false;
  RoomInspectionRequest.create = async (data) => {
    createdRequest = data;
    return { _id: 'request-1', ...data };
  };
  Room.findOneAndUpdate = async () => { roomUpdateCalled = true; };

  try {
    const response = makeResponse();
    await createRoomInspectionRequest({
      params: { propertyId, roomId },
      body: { message: 'Please arrange a viewing.' },
      user: { _id: '65d123456789012345678905', role: 'student' }
    }, response);
    assert.equal(response.statusCode, 201);
    assert.equal(createdRequest.roomId, roomId);
    assert.equal(room.status, 'available');
    assert.equal(roomUpdateCalled, false);
  } finally {
    Property.findById = originals.propertyFindById;
    Room.findOne = originals.roomFindOne;
    RoomInspectionRequest.exists = originals.requestExists;
    RoomInspectionRequest.create = originals.requestCreate;
    Room.findOneAndUpdate = originals.roomUpdate;
  }
});

test('public room responses include only active available rooms and omit status history', async () => {
  const originals = { propertyFindById: Property.findById, roomFind: Room.find, roomAggregate: Room.aggregate };
  const property = approvedProperty();
  const publicRoom = roomRecord({ statusHistory: [{ changedBy: 'private-user-id' }] });
  Property.findById = async () => property;
  Room.find = (filter) => {
    assert.equal(filter.status, 'available');
    assert.equal(filter.isActive, true);
    return { sort: async () => [publicRoom] };
  };
  Room.aggregate = async () => [{
    total: 9,
    available: 5,
    reserved: 1,
    occupied: 2,
    unavailable: 1
  }];

  try {
    const response = makeResponse();
    await getPropertyRooms({ params: { propertyId }, user: { role: 'student' } }, response);
    assert.equal(response.statusCode, 200);
    assert.equal(response.body.data.rooms.length, 1);
    assert.equal(response.body.data.rooms[0].statusHistory, undefined);
    assert.deepEqual(response.body.data.counts, {
      total: 9,
      available: 5,
      reserved: 1,
      occupied: 2,
      unavailable: 1
    });
  } finally {
    Property.findById = originals.propertyFindById;
    Room.find = originals.roomFind;
    Room.aggregate = originals.roomAggregate;
  }
});

test('Location Admin cannot read rooms outside their assigned location', async () => {
  const originals = { propertyFindById: Property.findById, roomFind: Room.find };
  Property.findById = async () => approvedProperty();
  let roomLookupCalled = false;
  Room.find = () => {
    roomLookupCalled = true;
    return { sort: async () => [] };
  };

  try {
    const response = makeResponse();
    await getPropertyRooms({
      params: { propertyId },
      user: { _id: '65d123456789012345678906', role: 'admin', adminRole: 'location_admin', assignedLocation: 'Maraba' }
    }, response);
    assert.equal(response.statusCode, 403);
    assert.equal(roomLookupCalled, false);
  } finally {
    Property.findById = originals.propertyFindById;
    Room.find = originals.roomFind;
  }
});

test('room status changes use a conditional atomic update and append history', async () => {
  const originals = {
    propertyFindById: Property.findById,
    roomFindOne: Room.findOne,
    roomExists: Room.exists,
    roomFindOneAndUpdate: Room.findOneAndUpdate
  };
  const property = approvedProperty();
  const room = roomRecord();
  let query;
  let update;
  Property.findById = async () => property;
  Room.findOne = async () => room;
  Room.exists = async () => false;
  Room.findOneAndUpdate = async (filter, changes) => {
    query = filter;
    update = changes;
    return roomRecord({ status: 'occupied' });
  };

  try {
    const response = makeResponse();
    await updatePropertyRoom({
      params: { propertyId, roomId },
      body: { status: 'occupied', statusReason: 'Tenant moved in.' },
      user: { _id: property.agentId, role: 'agent' }
    }, response);
    assert.equal(response.statusCode, 200);
    assert.equal(query.status, 'available');
    assert.equal(query.isActive, true);
    assert.equal(update.$set.status, 'occupied');
    assert.equal(update.$push.statusHistory.to, 'occupied');
  } finally {
    Property.findById = originals.propertyFindById;
    Room.findOne = originals.roomFindOne;
    Room.exists = originals.roomExists;
    Room.findOneAndUpdate = originals.roomFindOneAndUpdate;
  }
});

test('room information updates leave status and existing media untouched', async () => {
  const originals = {
    propertyFindById: Property.findById,
    roomFindOne: Room.findOne,
    roomFindOneAndUpdate: Room.findOneAndUpdate
  };
  const property = approvedProperty();
  const room = roomRecord({
    images: [{ url: 'https://cdn.example.test/room.jpg', publicId: 'room-image' }],
    videos: [{ url: 'https://cdn.example.test/room.mp4', publicId: 'room-video' }],
    statusHistory: [{ to: 'available' }]
  });
  let update;
  Property.findById = async () => property;
  Room.findOne = async () => room;
  Room.findOneAndUpdate = async (_filter, changes) => {
    update = changes;
    return roomRecord({
      ...room,
      description: changes.$set.description,
      price: changes.$set.price
    });
  };

  try {
    const response = makeResponse();
    await updatePropertyRoom({
      params: { propertyId, roomId },
      body: { description: 'Shared clean description', price: 99000 },
      user: { _id: property.agentId, role: 'agent' }
    }, response);

    assert.equal(response.statusCode, 200);
    assert.equal(update.$set.description, 'Shared clean description');
    assert.equal(update.$set.price, 99000);
    assert.equal(update.$set.status, undefined);
    assert.equal(update.$set.images, undefined);
    assert.equal(update.$set.videos, undefined);
    assert.deepEqual(response.body.data.images, room.images);
    assert.deepEqual(response.body.data.videos, room.videos);
    assert.equal(response.body.data.status, 'available');
    assert.deepEqual(response.body.data.statusHistory, room.statusHistory);
  } finally {
    Property.findById = originals.propertyFindById;
    Room.findOne = originals.roomFindOne;
    Room.findOneAndUpdate = originals.roomFindOneAndUpdate;
  }
});
