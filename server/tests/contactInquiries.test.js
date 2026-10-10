import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import express from 'express';
import jwt from 'jsonwebtoken';

process.env.JWT_SECRET = 'contact-inquiry-tests-secret';

const [
  { default: User },
  { default: ContactInquiry },
  { submitContactInquiry, listContactInquiries, updateContactInquiryStatus },
  { default: contactRoutes },
  { default: adminRoutes },
  { errorHandler }
] = await Promise.all([
  import('../models/User.js'),
  import('../models/ContactInquiry.js'),
  import('../controllers/contactInquiryController.js'),
  import('../routes/contactRoutes.js'),
  import('../routes/adminRoutes.js'),
  import('../middleware/errorMiddleware.js')
]);

let savedInquiries = [];
let adminUsers = new Map();
let server;
let baseUrl;
const originalCreate = ContactInquiry.create;
const originalFind = ContactInquiry.find;
const originalCountDocuments = ContactInquiry.countDocuments;
const originalFindById = ContactInquiry.findById;
const originalUserFindById = User.findById;

const responseMock = () => ({
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

const requestJson = async (path, { method = 'GET', body, userId } = {}) => {
  const headers = {};
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (userId) headers.authorization = `Bearer ${jwt.sign({ id: userId }, process.env.JWT_SECRET)}`;
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  return { status: response.status, body: await response.json() };
};

before(async () => {
  ContactInquiry.create = async (data) => {
    const id = String(savedInquiries.length + 1).padStart(24, '0');
    const inquiry = { _id: id, ...data, status: 'New', createdAt: new Date() };
    savedInquiries.push(inquiry);
    return inquiry;
  };
  ContactInquiry.find = (filter) => {
    const matching = filter.status ? savedInquiries.filter((item) => item.status === filter.status) : [...savedInquiries];
    return {
      sort() { return this; },
      skip(amount) { this.offset = amount; return this; },
      limit(amount) { return Promise.resolve(matching.slice(this.offset || 0, (this.offset || 0) + amount)); }
    };
  };
  ContactInquiry.countDocuments = async (filter) => filter.status
    ? savedInquiries.filter((item) => item.status === filter.status).length
    : savedInquiries.length;
  ContactInquiry.findById = async (id) => {
    const inquiry = savedInquiries.find((item) => item._id === id);
    return inquiry ? {
      ...inquiry,
      async save() {
        inquiry.status = this.status;
      }
    } : null;
  };
  User.findById = (id) => ({
    select: async () => adminUsers.get(String(id)) || null
  });

  const app = express();
  app.use(express.json());
  app.use('/api/contact', contactRoutes);
  app.use('/api/admin', adminRoutes);
  app.use(errorHandler);
  server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  ContactInquiry.create = originalCreate;
  ContactInquiry.find = originalFind;
  ContactInquiry.countDocuments = originalCountDocuments;
  ContactInquiry.findById = originalFindById;
  User.findById = originalUserFindById;
  if (server) await new Promise((resolve) => server.close(resolve));
});

test('public contact submission validates and stores sanitized fields without account identity', async () => {
  const invalidResponse = responseMock();
  await submitContactInquiry({ body: { name: 'A', email: 'not-an-email', category: 'Other', message: 'Hello' } }, invalidResponse);
  assert.equal(invalidResponse.statusCode, 400);
  assert.equal(savedInquiries.length, 0);

  const invalidCategoryResponse = responseMock();
  await submitContactInquiry({ body: { name: 'A', email: 'a@example.test', category: 'Unknown', message: 'Hello' } }, invalidCategoryResponse);
  assert.equal(invalidCategoryResponse.statusCode, 400);

  const oversizedMessageResponse = responseMock();
  await submitContactInquiry({ body: { name: 'A', email: 'a@example.test', category: 'Other', message: 'x'.repeat(5001) } }, oversizedMessageResponse);
  assert.equal(oversizedMessageResponse.statusCode, 400);
  assert.equal(savedInquiries.length, 0);

  const spamResponse = responseMock();
  await submitContactInquiry({ body: { website: 'spam-bot' } }, spamResponse);
  assert.equal(spamResponse.statusCode, 202);
  assert.equal(savedInquiries.length, 0);

  const response = responseMock();
  await submitContactInquiry({
    body: {
      name: '  Ada Lovelace\n',
      email: ' ADA@example.test ',
      category: 'Accommodation Inquiry',
      message: '  Please share listing information.  ',
      role: 'admin',
      accountId: 'spoofed-account'
    },
    user: { role: 'admin', _id: 'untrusted' }
  }, response);

  assert.equal(response.statusCode, 201);
  assert.equal(savedInquiries.length, 1);
  assert.deepEqual(savedInquiries[0], {
    _id: '000000000000000000000001',
    name: 'Ada Lovelace',
    email: 'ada@example.test',
    category: 'Accommodation Inquiry',
    message: 'Please share listing information.',
    status: 'New',
    createdAt: savedInquiries[0].createdAt
  });
});

test('public submission rate limiter caps requests at five within its window', async () => {
  const payload = {
    name: 'Rate Limit User',
    email: 'rate-limit@example.test',
    category: 'Other',
    message: 'Test inquiry'
  };
  for (let count = 0; count < 5; count += 1) {
    const result = await requestJson('/api/contact', { method: 'POST', body: payload });
    assert.equal(result.status, 201);
  }
  const limited = await requestJson('/api/contact', { method: 'POST', body: payload });
  assert.equal(limited.status, 429);
});

test('contact inquiry administration is restricted to Super Admin and supports status updates', async () => {
  adminUsers = new Map([
    ['student-id', { _id: 'student-id', role: 'student' }],
    ['location-admin-id', { _id: 'location-admin-id', role: 'admin', adminRole: 'location_admin' }],
    ['super-admin-id', { _id: 'super-admin-id', role: 'admin', adminRole: 'super_admin' }]
  ]);

  assert.equal((await requestJson('/api/admin/contact-inquiries')).status, 401);
  assert.equal((await requestJson('/api/admin/contact-inquiries', { userId: 'student-id' })).status, 403);
  assert.equal((await requestJson('/api/admin/contact-inquiries', { userId: 'location-admin-id' })).status, 403);

  const listing = await requestJson('/api/admin/contact-inquiries?page=1&limit=1&status=New', { userId: 'super-admin-id' });
  assert.equal(listing.status, 200);
  assert.equal(listing.body.data.inquiries.length, 1);
  assert.equal(listing.body.data.pagination.totalPages, 6);

  const inquiry = listing.body.data.inquiries[0];
  const updated = await requestJson(`/api/admin/contact-inquiries/${inquiry._id}/status`, {
    method: 'PATCH',
    body: { status: 'In Progress' },
    userId: 'super-admin-id'
  });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.data.status, 'In Progress');

  const invalidStatusResponse = responseMock();
  await updateContactInquiryStatus({ params: { id: '507f1f77bcf86cd799439011' }, body: { status: 'Closed' } }, invalidStatusResponse);
  assert.equal(invalidStatusResponse.statusCode, 400);

  const invalidFilterResponse = responseMock();
  await listContactInquiries({ query: { status: 'Closed' } }, invalidFilterResponse);
  assert.equal(invalidFilterResponse.statusCode, 400);
});
