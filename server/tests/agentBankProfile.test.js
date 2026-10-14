import assert from 'node:assert/strict';
import { test } from 'node:test';

const [{ default: User }, { updateProfile }, { validateBankDetails }] = await Promise.all([
  import('../models/User.js'),
  import('../controllers/userController.js'),
  import('../utils/validators.js')
]);

test('bank details are optional and blank values remain empty strings', () => {
  const result = validateBankDetails({
    accountNumber: '',
    bankName: '',
    accountName: ''
  });

  assert.equal(result.valid, true);
  assert.deepEqual(result.normalized, {
    accountNumber: '',
    bankName: '',
    accountName: ''
  });
});

test('authenticated profile updates preserve leading zeros and target only the current user', async () => {
  const originalFindByIdAndUpdate = User.findByIdAndUpdate;
  const userId = 'authenticated-agent-id';
  const existingUser = {
    _id: userId,
    role: 'agent',
    accountNumber: '0098765432',
    bankName: 'Existing Bank',
    accountName: 'Existing Agent'
  };
  let updatedUserId;
  let submittedUpdates;
  User.findByIdAndUpdate = (id, updates) => {
    updatedUserId = id;
    submittedUpdates = updates;
    const updatedUser = { ...existingUser, ...updates };
    return { select: async () => updatedUser };
  };

  try {
    const response = {
      statusCode: 200,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(body) {
        this.body = body;
        return this;
      }
    };
    await updateProfile({
      user: { _id: userId, role: 'agent' },
      body: {
        accountNumber: '0012345678',
        bankName: 'New Bank',
        accountName: 'Current Agent'
      }
    }, response);

    assert.equal(response.statusCode, 200);
    assert.equal(updatedUserId, userId);
    assert.equal(submittedUpdates.accountNumber, '0012345678');
    assert.equal(typeof submittedUpdates.accountNumber, 'string');
    assert.equal(response.body.data.accountNumber, '0012345678');
  } finally {
    User.findByIdAndUpdate = originalFindByIdAndUpdate;
  }
});

test('profile updates that omit bank details do not overwrite previously saved details', async () => {
  const originalFindByIdAndUpdate = User.findByIdAndUpdate;
  const existingUser = {
    _id: 'authenticated-agent-id',
    role: 'agent',
    accountNumber: '0001234567',
    bankName: 'Saved Bank',
    accountName: 'Saved Agent'
  };
  let submittedUpdates;
  User.findByIdAndUpdate = (id, updates) => {
    submittedUpdates = updates;
    return { select: async () => ({ ...existingUser, ...updates }) };
  };

  try {
    const response = {
      statusCode: 200,
      json(body) {
        this.body = body;
        return this;
      }
    };
    await updateProfile({
      user: { _id: existingUser._id, role: 'agent' },
      body: { name: 'Updated Agent Name' }
    }, response);

    assert.equal(submittedUpdates.accountNumber, undefined);
    assert.equal(submittedUpdates.bankName, undefined);
    assert.equal(submittedUpdates.accountName, undefined);
    assert.equal(response.body.data.accountNumber, existingUser.accountNumber);
    assert.equal(response.body.data.bankName, existingUser.bankName);
    assert.equal(response.body.data.accountName, existingUser.accountName);
  } finally {
    User.findByIdAndUpdate = originalFindByIdAndUpdate;
  }
});
