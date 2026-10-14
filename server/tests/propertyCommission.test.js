import assert from 'node:assert/strict';
import { test } from 'node:test';
import { calculatePropertyCommission } from '../utils/propertyCommission.js';
import Property from '../models/Property.js';
import PropertyEditHistory from '../models/PropertyEditHistory.js';
import { updateProperty } from '../controllers/propertyController.js';
import { listPropertiesAdmin } from '../controllers/adminController.js';

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

test('calculates the 3% commission and remaining agent amount from total price', () => {
  const result = calculatePropertyCommission('100000');
  assert.deepEqual(result, {
    propertyPrice: 100000,
    commissionRate: 0.03,
    studentNestCommission: 3000,
    agentAmount: 97000
  });
  assert.equal(result.studentNestCommission + result.agentAmount, result.propertyPrice);
});

test('calculates other prices and rounds monetary amounts to two decimal places', () => {
  assert.deepEqual(calculatePropertyCommission('12345.67'), {
    propertyPrice: 12345.67,
    commissionRate: 0.03,
    studentNestCommission: 370.37,
    agentAmount: 11975.3
  });
  assert.deepEqual(calculatePropertyCommission('0.50'), {
    propertyPrice: 0.5,
    commissionRate: 0.03,
    studentNestCommission: 0.02,
    agentAmount: 0.48
  });
  assert.deepEqual(calculatePropertyCommission('100.005'), {
    propertyPrice: 100.01,
    commissionRate: 0.03,
    studentNestCommission: 3,
    agentAmount: 97.01
  });
});

test('rejects invalid or negative property prices', () => {
  for (const price of [-1, '-1', 'NaN', 'Infinity', '1e99999999', '', '1.2.3', null, undefined]) {
    assert.equal(calculatePropertyCommission(price), null);
  }
});

test('supports historical properties without stored commission fields and adjustable transaction rates', () => {
  const oldProperty = { price: 250000 };
  assert.deepEqual(calculatePropertyCommission(oldProperty.price), {
    propertyPrice: 250000,
    commissionRate: 0.03,
    studentNestCommission: 7500,
    agentAmount: 242500
  });
  assert.equal(calculatePropertyCommission(oldProperty.price, 400).commissionRate, 0.04);
});

test('agent price edits return a fresh estimate without persisting commission fields', async () => {
  const originals = {
    findById: Property.findById,
    findByIdAndUpdate: Property.findByIdAndUpdate,
    historyCreate: PropertyEditHistory.create
  };
  const property = {
    _id: 'property-1',
    agentId: { toString: () => 'agent-1' },
    price: 100000,
    inspectionFee: 2500,
    location: 'Gandu',
    locationCategory: 'Gandu',
    images: [{ url: 'https://images.example.test/property.jpg' }],
    videos: []
  };
  let update;
  Property.findById = async () => property;
  Property.findByIdAndUpdate = async (id, changes) => {
    update = changes;
    return { ...property, ...changes };
  };
  PropertyEditHistory.create = async () => {};

  try {
    const response = makeResponse();
    await updateProperty({
      params: { id: property._id },
      body: { price: '200000' },
      user: { _id: 'agent-1', role: 'agent' }
    }, response);
    assert.equal(response.statusCode, 200);
    assert.equal(update.price, 200000);
    assert.equal(update.inspectionFee, undefined);
    assert.equal(update.studentNestCommission, undefined);
    assert.equal(response.body.data.commissionEstimate.studentNestCommission, 6000);
    assert.equal(response.body.data.commissionEstimate.agentAmount, 194000);
    assert.equal(response.body.data.inspectionFee, 2500);
  } finally {
    Property.findById = originals.findById;
    Property.findByIdAndUpdate = originals.findByIdAndUpdate;
    PropertyEditHistory.create = originals.historyCreate;
  }
});

test('rejects invalid prices and prevents Location Admin access outside assigned scope', async () => {
  const originalFindById = Property.findById;
  const originalFind = Property.find;
  const property = {
    _id: 'property-1',
    agentId: { toString: () => 'agent-1' },
    price: 100000,
    location: 'Gandu',
    locationCategory: 'Gandu',
    images: [{ url: 'https://images.example.test/property.jpg' }],
    videos: []
  };
  Property.findById = async () => property;

  try {
    const invalidResponse = makeResponse();
    await updateProperty({
      params: { id: property._id },
      body: { price: '-1' },
      user: { _id: 'agent-1', role: 'agent' }
    }, invalidResponse);
    assert.equal(invalidResponse.statusCode, 400);

    Property.find = (filter) => {
      const isLocationScoped = Boolean(filter.$or);
      if (isLocationScoped) assert.ok(JSON.stringify(filter).includes('Maraba'));
      const results = isLocationScoped ? [] : [property];
      const query = {
        populate() { return this; },
        sort: async () => results
      };
      return query;
    };
    const locationAdminResponse = makeResponse();
    await listPropertiesAdmin({
      user: { _id: 'admin-1', role: 'admin', adminRole: 'location_admin', assignedLocation: 'Maraba' }
    }, locationAdminResponse);
    assert.deepEqual(locationAdminResponse.body.data, []);
    const superAdminResponse = makeResponse();
    await listPropertiesAdmin({
      user: { _id: 'admin-2', role: 'admin', adminRole: 'super_admin' }
    }, superAdminResponse);
    assert.equal(superAdminResponse.body.data[0].commissionEstimate.studentNestCommission, 3000);
  } finally {
    Property.findById = originalFindById;
    Property.find = originalFind;
  }
});
