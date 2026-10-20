import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Writable } from 'node:stream';
import { v2 as cloudinary } from 'cloudinary';
import Property from '../models/Property.js';
import Room from '../models/Room.js';
import Booking from '../models/Booking.js';
import Recommendation from '../models/Recommendation.js';
import {
  createProperty,
  getProperty,
  listProperties,
  rateProperty,
  updateProperty
} from '../controllers/propertyController.js';
import {
  getPropertyContactNumber,
  hasConflictingLegacyContactNumbers,
  normalizeNigerianPhoneNumber
} from '../utils/propertyContact.js';

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

const makeProperty = () => ({
  _id: 'property-1',
  title: 'Private Contact Test',
  approvalStatus: 'approved',
  price: 100000,
  location: 'Maraba',
  locationCategory: 'Maraba',
  agentId: {
    _id: 'agent-1',
    email: 'private-agent@example.test',
    phone: '08011112222',
    toString: () => 'agent-1'
  },
  adminContact: {
    contactPhone: '08106083399',
    phone: '08011112222',
    whatsapp: '08106083399',
    facebook: 'https://social.example.test/legacy'
  },
  images: [{ url: 'https://images.example.test/property.jpg' }],
  videos: [],
  ratings: [],
  toObject() {
    return {
      _id: this._id,
      title: this.title,
      price: this.price,
      location: this.location,
      locationCategory: this.locationCategory,
      agentId: this.agentId,
      adminContact: this.adminContact,
      images: this.images,
      videos: this.videos,
      ratings: this.ratings
    };
  }
});

test('accepts Nigerian phone numbers as strings and resolves legacy conflicts without discarding values', () => {
  assert.equal(normalizeNigerianPhoneNumber('08106083399'), '08106083399');
  assert.equal(normalizeNigerianPhoneNumber('+2348106083399'), '+2348106083399');
  assert.equal(normalizeNigerianPhoneNumber('8106083399'), null);
  assert.equal(normalizeNigerianPhoneNumber('0810608339'), null);

  const property = { adminContact: { phone: '08011112222', whatsapp: '08106083399' } };
  assert.equal(getPropertyContactNumber(property), '08106083399');
  assert.equal(hasConflictingLegacyContactNumbers(property), true);
  assert.equal(property.adminContact.phone, '08011112222');
  assert.equal(property.adminContact.whatsapp, '08106083399');
});

test('public property details and student ratings omit private contact data', async () => {
  const originals = {
    findById: Property.findById,
    find: Property.find,
    countDocuments: Property.countDocuments,
    findOne: Booking.findOne,
    recommendationFindOne: Recommendation.findOne,
    recommendationUpdate: Recommendation.findOneAndUpdate
  };
  const property = makeProperty();
  Property.findById = () => ({ populate: async () => property });

  try {
    Recommendation.findOne = async () => null;
    Recommendation.findOneAndUpdate = async () => null;
    for (const user of [undefined, { _id: '507f1f77bcf86cd799439011', role: 'student' }, { _id: 'agent-2', role: 'agent' }]) {
      const response = makeResponse();
      await getProperty({ params: { id: property._id }, user }, response);
      assert.equal(response.statusCode, 200);
      assert.equal(response.body.data.adminContact, undefined);
      assert.equal(response.body.data.agentId.email, undefined);
      assert.equal(response.body.data.agentId.phone, undefined);
    }

    const ownerResponse = makeResponse();
    await getProperty({
      params: { id: property._id },
      user: { _id: 'agent-1', role: 'agent' }
    }, ownerResponse);
    assert.equal(ownerResponse.body.data.adminContact.contactPhone, '08106083399');
    assert.equal(ownerResponse.body.data.agentId.email, 'private-agent@example.test');

    let selectedFields;
    Property.find = () => {
      const query = {
        select(fields) {
          selectedFields = fields;
          return this;
        },
        sort() { return this; },
        skip() { return this; },
        async limit() {
          const publicProperty = property.toObject();
          if (selectedFields === '-adminContact') delete publicProperty.adminContact;
          return [publicProperty];
        }
      };
      return query;
    };
    Property.countDocuments = async () => 1;
    const listResponse = makeResponse();
    await listProperties({ query: {} }, listResponse);
    assert.equal(selectedFields, '-adminContact');
    assert.equal(listResponse.body.data.properties[0].adminContact, undefined);

    Property.findById = async () => property;
    property.save = async () => {};
    Booking.findOne = async () => ({ _id: 'paid-booking' });
    const ratingResponse = makeResponse();
    await rateProperty({
      params: { id: property._id },
      body: { rating: 5, comment: 'Synthetic test' },
      user: { _id: '507f1f77bcf86cd799439011', role: 'student', name: 'Synthetic Student' }
    }, ratingResponse);
    assert.equal(ratingResponse.body.data.adminContact, undefined);
  } finally {
    Property.findById = originals.findById;
    Property.find = originals.find;
    Property.countDocuments = originals.countDocuments;
    Booking.findOne = originals.findOne;
    Recommendation.findOne = originals.recommendationFindOne;
    Recommendation.findOneAndUpdate = originals.recommendationUpdate;
  }
});

test('public property details do not reveal pending or expired listings by direct id', async () => {
  const originalFindById = Property.findById;
  const property = makeProperty();
  Property.findById = () => ({ populate: async () => property });
  try {
    for (const overrides of [
      { approvalStatus: 'pending' },
      { visibleUntil: new Date(Date.now() - 60_000) }
    ]) {
      Object.assign(property, overrides);
      const response = makeResponse();
      await getProperty({ params: { id: property._id } }, response);
      assert.equal(response.statusCode, 404);
      assert.equal(response.body.data, undefined);
    }
  } finally {
    Property.findById = originalFindById;
  }
});

test('admin detail access respects location scope and agents may edit only their own contact', async () => {
  const originals = {
    findById: Property.findById,
    findByIdAndUpdate: Property.findByIdAndUpdate,
    historyCreate: (await import('../models/PropertyEditHistory.js')).default.create
  };
  const PropertyEditHistory = (await import('../models/PropertyEditHistory.js')).default;
  const property = makeProperty();
  Property.findById = () => ({ populate: async () => property });

  try {
    const wrongLocationResponse = makeResponse();
    await getProperty({
      params: { id: property._id },
      user: { _id: 'admin-1', role: 'admin', adminRole: 'location_admin', assignedLocation: 'Gandu' }
    }, wrongLocationResponse);
    assert.equal(wrongLocationResponse.statusCode, 403);

    const locationAdminResponse = makeResponse();
    await getProperty({
      params: { id: property._id },
      user: { _id: 'admin-1', role: 'admin', adminRole: 'location_admin', assignedLocation: 'Maraba' }
    }, locationAdminResponse);
    assert.equal(locationAdminResponse.body.data.adminContact.contactPhone, '08106083399');

    const superAdminResponse = makeResponse();
    await getProperty({
      params: { id: property._id },
      user: { _id: 'admin-2', role: 'admin', adminRole: 'super_admin' }
    }, superAdminResponse);
    assert.equal(superAdminResponse.body.data.adminContact.contactPhone, '08106083399');

    Property.findById = async () => property;
    const unauthorizedEditResponse = makeResponse();
    await updateProperty({
      params: { id: property._id },
      body: { contactPhone: '08012345678' },
      user: { _id: 'agent-2', role: 'agent' }
    }, unauthorizedEditResponse);
    assert.equal(unauthorizedEditResponse.statusCode, 403);

    let updates;
    Property.findByIdAndUpdate = async (id, value) => {
      updates = value;
      return { ...property, ...value, toObject: property.toObject };
    };
    PropertyEditHistory.create = async () => {};
    const ownerResponse = makeResponse();
    await updateProperty({
      params: { id: property._id },
      body: { contactPhone: '08012345678' },
      user: { _id: 'agent-1', role: 'agent' }
    }, ownerResponse);
    assert.equal(ownerResponse.statusCode, 200);
    assert.equal(updates.adminContact.contactPhone, '08012345678');
    assert.equal(updates.adminContact.phone, '08011112222');
    assert.equal(updates.adminContact.whatsapp, '08106083399');
    assert.equal(updates.adminContact.facebook, 'https://social.example.test/legacy');
    assert.equal(ownerResponse.body.data.adminContact.contactPhone, '08012345678');
  } finally {
    Property.findById = originals.findById;
    Property.findByIdAndUpdate = originals.findByIdAndUpdate;
    PropertyEditHistory.create = originals.historyCreate;
  }
});

test('property creation stores optional visibility and preserves Nigerian contact numbers as strings', async () => {
  const originals = {
    create: Property.create,
    roomInsertMany: Room.insertMany,
    uploadStream: cloudinary.uploader.upload_stream
  };
  process.env.CLOUDINARY_CLOUD_NAME = 'test-cloud';
  process.env.CLOUDINARY_API_KEY = 'test-key';
  process.env.CLOUDINARY_API_SECRET = 'test-secret';
  const created = [];
  let insertedInitialRooms;
  Property.create = async (data) => {
    created.push(data);
    return { ...data, _id: '65d123456789012345678901', toObject() { return { ...this }; } };
  };
  Room.insertMany = async (documents) => {
    insertedInitialRooms = documents;
    return documents;
  };
  cloudinary.uploader.upload_stream = (options, callback) => new Writable({
    write(chunk, encoding, done) {
      done();
    },
    final(done) {
      callback(null, { public_id: 'synthetic-image', secure_url: 'https://images.example.test/property.jpg' });
      done();
    }
  });

  try {
    for (const visibleUntil of ['', '2027-01-15T12:00']) {
      const response = makeResponse();
      await createProperty({
        body: {
          title: 'Synthetic Contact Property',
          description: 'Synthetic test property.',
          location: 'Gandu',
          type: 'Single Room',
          price: '120000',
          visibleUntil,
          contactPhone: '08106083399'
        },
        files: { images: [{ mimetype: 'image/jpeg', buffer: Buffer.from('synthetic image') }] },
        user: { _id: 'agent-1', role: 'agent' }
      }, response);
      assert.equal(response.statusCode, 201);
      assert.equal(created.at(-1).visibleUntil instanceof Date, Boolean(visibleUntil));
      assert.equal(created.at(-1).visibleUntil, visibleUntil ? created.at(-1).visibleUntil : null);
      assert.equal(created.at(-1).adminContact.contactPhone, '08106083399');
      assert.equal(typeof created.at(-1).adminContact.contactPhone, 'string');
    }

    const invalidPhoneResponse = makeResponse();
    await createProperty({
      body: {
        title: 'Synthetic Contact Property',
        description: 'Synthetic test property.',
        location: 'Gandu',
        type: 'Single Room',
        price: '120000',
        contactPhone: '12345'
      },
      files: { images: [{ mimetype: 'image/jpeg', buffer: Buffer.from('synthetic image') }] },
      user: { _id: 'agent-1', role: 'agent' }
    }, invalidPhoneResponse);
    assert.equal(invalidPhoneResponse.statusCode, 400);

    const invalidDateResponse = makeResponse();
    await createProperty({
      body: {
        title: 'Synthetic Contact Property',
        description: 'Synthetic test property.',
        location: 'Gandu',
        type: 'Single Room',
        price: '120000',
        visibleUntil: 'not-a-date'
      },
      user: { _id: 'agent-1', role: 'agent' }
    }, invalidDateResponse);
    assert.equal(invalidDateResponse.statusCode, 400);

    const missingRoomsResponse = makeResponse();
    await createProperty({
      body: {
        title: 'Synthetic Multi-Room Property',
        description: 'Synthetic test property.',
        location: 'Gandu',
        type: 'Single Room',
        price: '120000',
        managementMode: 'multi_room'
      },
      user: { _id: 'agent-1', role: 'agent' }
    }, missingRoomsResponse);
    assert.equal(missingRoomsResponse.statusCode, 400);
    assert.match(missingRoomsResponse.body.message, /must include/);

    const multiRoomResponse = makeResponse();
    await createProperty({
      body: {
        title: 'Synthetic Multi-Room Property',
        description: 'Synthetic test property.',
        location: 'Gandu',
        type: 'Single Room',
        price: '120000',
        managementMode: 'multi_room',
        initialRooms: JSON.stringify([
          { roomNumber: 'A1', type: 'Single Room', price: 80000, toilet: 'private', facilities: ['Wardrobe'] },
          { roomNumber: 'A2', type: 'Self-Contain', price: 120000, toilet: 'shared', facilities: [] }
        ])
      },
      files: { images: [{ mimetype: 'image/jpeg', buffer: Buffer.from('synthetic image') }] },
      user: { _id: 'agent-1', role: 'agent' }
    }, multiRoomResponse);
    assert.equal(multiRoomResponse.statusCode, 201);
    assert.deepEqual(insertedInitialRooms.map((room) => room.roomNumber), ['A1', 'A2']);
    assert.deepEqual(insertedInitialRooms.map((room) => room.price), [80000, 120000]);
    assert.deepEqual(insertedInitialRooms[0].facilities, ['Wardrobe']);
  } finally {
    Property.create = originals.create;
    Room.insertMany = originals.roomInsertMany;
    cloudinary.uploader.upload_stream = originals.uploadStream;
  }
});

test('visibility updates preserve omitted dates and explicitly clear selected dates', async () => {
  const originals = {
    findById: Property.findById,
    findByIdAndUpdate: Property.findByIdAndUpdate,
    historyCreate: (await import('../models/PropertyEditHistory.js')).default.create
  };
  const PropertyEditHistory = (await import('../models/PropertyEditHistory.js')).default;
  const expiration = new Date('2027-01-15T12:00:00.000Z');
  const property = { ...makeProperty(), visibleUntil: expiration };
  let updates;
  Property.findById = async () => property;
  Property.findByIdAndUpdate = async (id, value) => {
    updates = value;
    return { ...property, ...value, toObject: property.toObject };
  };
  PropertyEditHistory.create = async () => {};

  try {
    const omittedResponse = makeResponse();
    await updateProperty({
      params: { id: property._id },
      body: { title: 'Updated title' },
      user: { _id: 'agent-1', role: 'agent' }
    }, omittedResponse);
    assert.equal(updates.visibleUntil, undefined);

    const clearedResponse = makeResponse();
    await updateProperty({
      params: { id: property._id },
      body: { visibleUntil: '' },
      user: { _id: 'agent-1', role: 'agent' }
    }, clearedResponse);
    assert.equal(updates.visibleUntil, null);

    const validResponse = makeResponse();
    await updateProperty({
      params: { id: property._id },
      body: { visibleUntil: '2027-01-20T10:30' },
      user: { _id: 'agent-1', role: 'agent' }
    }, validResponse);
    assert.ok(updates.visibleUntil instanceof Date);

    const invalidResponse = makeResponse();
    await updateProperty({
      params: { id: property._id },
      body: { visibleUntil: 'not-a-date' },
      user: { _id: 'agent-1', role: 'agent' }
    }, invalidResponse);
    assert.equal(invalidResponse.statusCode, 400);
  } finally {
    Property.findById = originals.findById;
    Property.findByIdAndUpdate = originals.findByIdAndUpdate;
    PropertyEditHistory.create = originals.historyCreate;
  }
});
