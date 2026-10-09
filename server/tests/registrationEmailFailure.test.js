import assert from 'node:assert/strict';
import { test } from 'node:test';

process.env.EMAIL_PROVIDER = 'brevo';
process.env.BREVO_API_KEY = 'test-api-key';
process.env.EMAIL_FROM = 'verified@example.test';
process.env.JWT_SECRET = 'test-secret';

const [{ default: axios }, { default: User }, { default: EmailVerification }, { register }] = await Promise.all([
  import('axios'),
  import('../models/User.js'),
  import('../models/EmailVerification.js'),
  import('../controllers/authController.js')
]);

test('failed verification email releases its code allowance so registration can retry', async () => {
  const originalUserFindOne = User.findOne;
  const originalDeleteOne = EmailVerification.deleteOne;
  const originalFindOneAndUpdate = EmailVerification.findOneAndUpdate;
  const originalUpdateOne = EmailVerification.updateOne;
  const originalAdapter = axios.defaults.adapter;
  const originalConsoleError = console.error;
  let pending = null;
  let sendCount = 0;
  const callsToUpdate = [];

  User.findOne = async () => null;
  EmailVerification.deleteOne = async () => ({ deletedCount: 0 });
  EmailVerification.findOneAndUpdate = async (filter, update) => {
    assert.ok(!pending || pending.resendCount < 5);
    assert.ok(!pending || !pending.lastCodeSentAt);

    pending ||= {
      _id: 'pending-registration',
      registrationStatus: 'pending',
      resendCount: 0
    };
    Object.assign(pending, update.$set);
    for (const [key, amount] of Object.entries(update.$inc || {})) {
      pending[key] = (pending[key] || 0) + amount;
    }
    return { ...pending };
  };
  EmailVerification.updateOne = async (filter, update) => {
    callsToUpdate.push({ filter, update });
    if (pending?._id === filter._id
      && pending.registrationStatus === filter.registrationStatus
      && pending.verificationCodeHash === filter.verificationCodeHash
      && pending.resendCount > 0) {
      for (const key of Object.keys(update.$unset || {})) delete pending[key];
      for (const [key, amount] of Object.entries(update.$inc || {})) {
        pending[key] = (pending[key] || 0) + amount;
      }
    }
    return { modifiedCount: 1 };
  };
  axios.defaults.adapter = async (config) => {
    sendCount += 1;
    return {
      status: sendCount === 1 ? 401 : 201,
      statusText: sendCount === 1 ? 'Unauthorized' : 'Created',
      data: {},
      headers: {},
      config
    };
  };
  console.error = () => {};

  const request = {
    body: {
      name: 'Test Student',
      email: 'student@example.test',
      password: 'secure-password',
      role: 'student'
    }
  };
  const invokeRegistration = async () => {
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
    await register(request, response);
    return response;
  };

  try {
    const failedResponse = await invokeRegistration();
    assert.equal(failedResponse.statusCode, 503);
    assert.equal(failedResponse.body.message, 'Unable to send the verification email. Please try again.');
    assert.equal(pending.resendCount, 0);
    assert.equal(pending.registrationStatus, 'pending');
    assert.ok(pending.registrationData);
    assert.equal(pending.verificationCodeHash, undefined);
    assert.equal(pending.lastCodeSentAt, undefined);
    assert.equal(callsToUpdate[0].update.$inc.resendCount, -1);
    assert.equal(callsToUpdate[0].filter.resendCount.$gt, 0);

    const retryResponse = await invokeRegistration();
    assert.equal(retryResponse.statusCode, 202);
    assert.equal(pending.resendCount, 1);
    assert.equal(sendCount, 2);
  } finally {
    User.findOne = originalUserFindOne;
    EmailVerification.deleteOne = originalDeleteOne;
    EmailVerification.findOneAndUpdate = originalFindOneAndUpdate;
    EmailVerification.updateOne = originalUpdateOne;
    axios.defaults.adapter = originalAdapter;
    console.error = originalConsoleError;
  }
});
