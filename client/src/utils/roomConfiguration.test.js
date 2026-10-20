import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyRoomConfiguration,
  getRoomConfiguration,
  hasRoomConfigurationChanges,
  ROOM_CONFIGURATION_FIELDS
} from './roomConfiguration.js';

test('selectively applies shared room fields without changing unselected or protected data', () => {
  const room = {
    _id: 'room-1',
    propertyId: 'property-1',
    roomNumber: 'A1',
    status: 'occupied',
    statusHistory: [{ to: 'occupied' }],
    images: [{ url: 'image-a' }],
    inspectionRequests: ['request-1'],
    price: 100000,
    description: 'Room-specific description',
    toilet: 'private'
  };
  const result = applyRoomConfiguration(room, {
    _id: 'source-room',
    roomNumber: 'source',
    status: 'available',
    images: [],
    price: 150000,
    description: 'Shared description',
    toilet: 'shared'
  }, ['price', 'description', 'status', '_id', 'images']);

  assert.equal(result.price, 150000);
  assert.equal(result.description, 'Shared description');
  assert.equal(result.status, 'occupied');
  assert.equal(result._id, 'room-1');
  assert.equal(result.roomNumber, 'A1');
  assert.equal(result.propertyId, 'property-1');
  assert.deepEqual(result.images, [{ url: 'image-a' }]);
  assert.deepEqual(result.statusHistory, [{ to: 'occupied' }]);
  assert.deepEqual(result.inspectionRequests, ['request-1']);
  assert.equal(result.toilet, 'private');
});

test('room configuration allowlist excludes identity, status, and media fields', () => {
  assert.deepEqual(ROOM_CONFIGURATION_FIELDS, [
    'title', 'type', 'description', 'price', 'billingPeriod', 'toilet', 'shower',
    'kitchen', 'waterSource', 'waterAvailable', 'electricity', 'facilities', 'floorSection'
  ]);
  assert.deepEqual(getRoomConfiguration({
    _id: 'room-1',
    roomNumber: 'A1',
    status: 'available',
    images: [],
    price: 90000,
    facilities: ['wardrobe']
  }), { price: 90000, facilities: ['wardrobe'] });
});

test('detects whether selected values would replace different room information', () => {
  const room = { price: 80000, description: 'Current', toilet: 'shared' };
  assert.equal(hasRoomConfigurationChanges(room, { price: 80000, description: 'New' }, ['price', 'description']), true);
  assert.equal(hasRoomConfigurationChanges(room, { price: 80000 }, ['price']), false);
});

test('configures nine rooms in bulk while retaining individual overrides and room-specific state', () => {
  const common = {
    description: 'Renovated rooms with secure access',
    price: 95000,
    toilet: 'shared',
    facilities: ['wardrobe', 'fan']
  };
  const initialRooms = Array.from({ length: 9 }, (_, index) => ({
    _id: `room-${index + 1}`,
    roomNumber: `Room ${index + 1}`,
    status: index === 0 ? 'occupied' : 'available',
    statusHistory: [{ to: index === 0 ? 'occupied' : 'available' }],
    images: [{ url: `image-${index + 1}` }],
    inspectionRequests: [`request-${index + 1}`],
    description: `Old ${index + 1}`,
    price: 70000 + index,
    toilet: 'unknown',
    facilities: []
  }));
  const fields = ['description', 'price', 'toilet', 'facilities'];
  const applied = initialRooms.map((room) => applyRoomConfiguration(room, common, fields));
  const customized = applyRoomConfiguration(applied[0], { price: 125000, toilet: 'private' }, ['price', 'toilet']);
  const selective = applyRoomConfiguration(customized, { description: 'Updated only' }, ['description']);

  assert.equal(applied.length, 9);
  assert.ok(applied.every((room) => room.description === common.description && room.price === 95000));
  assert.equal(customized.price, 125000);
  assert.equal(customized.toilet, 'private');
  assert.equal(applied[1].price, 95000);
  assert.equal(applied[1].toilet, 'shared');
  assert.equal(selective.price, 125000);
  assert.equal(selective.toilet, 'private');
  assert.equal(selective.description, 'Updated only');
  assert.equal(selective.status, 'occupied');
  assert.deepEqual(selective.statusHistory, [{ to: 'occupied' }]);
  assert.deepEqual(selective.images, [{ url: 'image-1' }]);
  assert.deepEqual(selective.inspectionRequests, ['request-1']);
});
