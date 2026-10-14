import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Writable } from 'node:stream';

process.env.CLOUDINARY_CLOUD_NAME = 'test-cloud';
process.env.CLOUDINARY_API_KEY = 'test-key';
process.env.CLOUDINARY_API_SECRET = 'test-secret';

const [
  { v2: cloudinary },
  { default: Property },
  { default: PropertyEditHistory },
  { createProperty, updateProperty }
] = await Promise.all([
  import('cloudinary'),
  import('../models/Property.js'),
  import('../models/PropertyEditHistory.js'),
  import('../controllers/propertyController.js')
]);

const agent = { _id: 'agent-1', role: 'agent' };
const basePropertyData = {
  title: 'Synthetic Test Property',
  description: 'A property created with synthetic test data.',
  location: 'Gandu',
  type: 'Single Room',
  price: '120000'
};

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

test('property schema accepts a fee, free inspection, and older records without a fee', () => {
  const required = {
    ...basePropertyData,
    agentId: '507f1f77bcf86cd799439011',
    images: ['https://images.example.test/property.jpg']
  };

  const paidProperty = new Property({ ...required, inspectionFee: 3000 });
  assert.equal(paidProperty.validateSync(), undefined);
  assert.equal(paidProperty.inspectionFee, 3000);

  const freeProperty = new Property({ ...required, inspectionFee: 0 });
  assert.equal(freeProperty.validateSync(), undefined);
  assert.equal(freeProperty.inspectionFee, 0);

  const olderProperty = new Property(required);
  assert.equal(olderProperty.inspectionFee, null);
  assert.equal(olderProperty.validateSync(), undefined);

  const negativeProperty = new Property({ ...required, inspectionFee: -1 });
  assert.ok(negativeProperty.validateSync().errors.inspectionFee);
});

test('property creation accepts an omitted fee and stores paid or free fees per property', async () => {
  const originalCreate = Property.create;
  const originalUploadStream = cloudinary.uploader.upload_stream;
  const createdProperties = [];
  Property.create = async (data) => {
    const property = { _id: `property-${createdProperties.length + 1}`, ...data };
    createdProperties.push(property);
    return property;
  };
  cloudinary.uploader.upload_stream = (options, callback) => new Writable({
    write(chunk, encoding, done) {
      done();
    },
    final(done) {
      callback(null, {
        public_id: 'synthetic-property-image',
        secure_url: 'https://images.example.test/property.jpg'
      });
      done();
    }
  });

  try {
    const withoutFeeResponse = makeResponse();
    await createProperty({
      body: { ...basePropertyData },
      files: { images: [{ mimetype: 'image/jpeg', buffer: Buffer.from('synthetic image') }] },
      user: agent
    }, withoutFeeResponse);
    assert.equal(withoutFeeResponse.statusCode, 201);
    assert.equal(withoutFeeResponse.body.data.inspectionFee, null);
    assert.equal(withoutFeeResponse.body.data.commissionEstimate.studentNestCommission, 3600);
    assert.equal(withoutFeeResponse.body.data.commissionEstimate.agentAmount, 116400);
    assert.equal(Object.hasOwn(createdProperties[0], 'commissionEstimate'), false);

    for (const inspectionFee of ['3000', '0']) {
      const response = makeResponse();
      await createProperty({
        body: { ...basePropertyData, inspectionFee },
        files: { images: [{ mimetype: 'image/jpeg', buffer: Buffer.from('synthetic image') }] },
        user: agent
      }, response);
      assert.equal(response.statusCode, 201);
      assert.equal(response.body.data.inspectionFee, Number(inspectionFee));
      assert.equal(response.body.data.commissionEstimate.studentNestCommission, 3600);
      assert.equal(createdProperties.at(-1).agentId, agent._id);
      assert.equal(Object.hasOwn(createdProperties.at(-1), 'commissionEstimate'), false);
    }
    assert.notEqual(createdProperties[0]._id, createdProperties[1]._id);
    assert.notEqual(createdProperties[1]._id, createdProperties[2]._id);
  } finally {
    Property.create = originalCreate;
    cloudinary.uploader.upload_stream = originalUploadStream;
  }
});

test('property creation rejects negative and invalid inspection fees', async () => {
  const originalCreate = Property.create;
  Property.create = async () => {
    throw new Error('Property.create must not be called for an invalid fee.');
  };

  try {
    for (const inspectionFee of ['-1', 'NaN', 'Infinity', 'not-a-number']) {
      const response = makeResponse();
      const body = { ...basePropertyData, inspectionFee };
      await createProperty({ body, user: agent }, response);
      assert.equal(response.statusCode, 400);
      assert.match(response.body.message, /inspection fee/i);
    }
  } finally {
    Property.create = originalCreate;
  }
});

test('blank inspection fee is unspecified on creation and clears explicitly on update', async () => {
  const originalCreate = Property.create;
  const originalFindById = Property.findById;
  const originalFindByIdAndUpdate = Property.findByIdAndUpdate;
  const originalHistoryCreate = PropertyEditHistory.create;
  const originalUploadStream = cloudinary.uploader.upload_stream;
  let createdProperty;
  let update;
  Property.create = async (data) => {
    createdProperty = data;
    return { _id: 'property-blank-fee', ...data };
  };
  cloudinary.uploader.upload_stream = (options, callback) => new Writable({
    write(chunk, encoding, done) {
      done();
    },
    final(done) {
      callback(null, {
        public_id: 'synthetic-property-image',
        secure_url: 'https://images.example.test/property.jpg'
      });
      done();
    }
  });
  const existingProperty = {
    _id: 'property-1',
    agentId: { toString: () => agent._id },
    location: 'Gandu',
    locationCategory: 'Gandu',
    inspectionFee: 4200,
    images: [{ url: 'https://images.example.test/property.jpg' }],
    videos: []
  };
  Property.findById = async () => existingProperty;
  Property.findByIdAndUpdate = async (id, data) => {
    update = data;
    return { ...existingProperty, ...data };
  };
  PropertyEditHistory.create = async () => {};

  try {
    const createResponse = makeResponse();
    await createProperty({
      body: { ...basePropertyData, inspectionFee: '' },
      files: { images: [{ mimetype: 'image/jpeg', buffer: Buffer.from('synthetic image') }] },
      user: agent
    }, createResponse);
    assert.equal(createResponse.statusCode, 201);
    assert.equal(createdProperty.inspectionFee, null);

    const updateResponse = makeResponse();
    await updateProperty({
      params: { id: existingProperty._id },
      body: { inspectionFee: '' },
      user: agent
    }, updateResponse);
    assert.equal(updateResponse.statusCode, 200);
    assert.equal(update.inspectionFee, null);
  } finally {
    Property.create = originalCreate;
    Property.findById = originalFindById;
    Property.findByIdAndUpdate = originalFindByIdAndUpdate;
    PropertyEditHistory.create = originalHistoryCreate;
    cloudinary.uploader.upload_stream = originalUploadStream;
  }
});

test('property update changes inspection fee and records it in edit history', async () => {
  const originalFindById = Property.findById;
  const originalFindByIdAndUpdate = Property.findByIdAndUpdate;
  const originalHistoryCreate = PropertyEditHistory.create;
  const originalProperty = {
    _id: 'property-1',
    agentId: { toString: () => agent._id },
    location: 'Gandu',
    locationCategory: 'Gandu',
    inspectionFee: 2000,
    images: [{ url: 'https://images.example.test/property.jpg' }],
    videos: []
  };
  let updates;
  let historyEntry;
  Property.findById = async () => originalProperty;
  Property.findByIdAndUpdate = async (id, update) => {
    updates = update;
    return { ...originalProperty, ...update };
  };
  PropertyEditHistory.create = async (entry) => {
    historyEntry = entry;
  };

  try {
    const response = makeResponse();
    await updateProperty({
      params: { id: originalProperty._id },
      body: { inspectionFee: '3500' },
      user: agent
    }, response);
    assert.equal(response.statusCode, 200);
    assert.equal(updates.inspectionFee, 3500);
    assert.equal(response.body.data.inspectionFee, 3500);
    assert.ok(historyEntry.changes.some((change) => (
      change.field === 'inspectionFee' && change.oldValue === 2000 && change.newValue === 3500
    )));
  } finally {
    Property.findById = originalFindById;
    Property.findByIdAndUpdate = originalFindByIdAndUpdate;
    PropertyEditHistory.create = originalHistoryCreate;
  }
});

test('unrelated property updates preserve fees and unauthorized agents cannot edit', async () => {
  const originalFindById = Property.findById;
  const originalFindByIdAndUpdate = Property.findByIdAndUpdate;
  const originalHistoryCreate = PropertyEditHistory.create;
  const existingProperty = {
    _id: 'property-1',
    agentId: { toString: () => agent._id },
    location: 'Gandu',
    locationCategory: 'Gandu',
    inspectionFee: 4200,
    images: [{ url: 'https://images.example.test/property.jpg' }],
    videos: []
  };
  let updates;
  Property.findById = async () => existingProperty;
  Property.findByIdAndUpdate = async (id, update) => {
    updates = update;
    return { ...existingProperty, ...update };
  };
  PropertyEditHistory.create = async () => {};

  try {
    const response = makeResponse();
    await updateProperty({
      params: { id: existingProperty._id },
      body: { title: 'Updated title' },
      user: agent
    }, response);
    assert.equal(response.statusCode, 200);
    assert.equal(updates.inspectionFee, undefined);
    assert.equal(response.body.data.inspectionFee, 4200);

    const unauthorizedResponse = makeResponse();
    await updateProperty({
      params: { id: existingProperty._id },
      body: { inspectionFee: '1' },
      user: { _id: 'different-agent', role: 'agent' }
    }, unauthorizedResponse);
    assert.equal(unauthorizedResponse.statusCode, 403);
    assert.equal(updates.inspectionFee, undefined);
  } finally {
    Property.findById = originalFindById;
    Property.findByIdAndUpdate = originalFindByIdAndUpdate;
    PropertyEditHistory.create = originalHistoryCreate;
  }
});
