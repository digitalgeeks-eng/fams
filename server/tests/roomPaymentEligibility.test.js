import assert from 'node:assert/strict';
import { test } from 'node:test';
import Booking from '../models/Booking.js';
import Payment from '../models/Payment.js';
import Property from '../models/Property.js';
import Room from '../models/Room.js';
process.env.NODE_ENV = 'test';
process.env.ALLOW_SYNTHETIC_PAYMENTS = 'true';
process.env.PAYSTACK_SECRET_KEY = '';
const {
  getBookingAmount,
  getEligibleBookingPaymentContext,
  initializePaymentController,
  uploadPaymentProof,
  submitManualPaymentProof,
  verifyBookingPayment
} = await import('../controllers/paymentController.js');

const propertyId = '65d123456789012345678901';
const roomId = '65d123456789012345678902';
const bookingId = '65d123456789012345678903';
const studentId = '65d123456789012345678904';
const anotherPropertyId = '65d123456789012345678905';

const propertyRecord = (overrides = {}) => ({
  _id: propertyId,
  managementMode: 'multi_room',
  approvalStatus: 'approved',
  isDeleted: false,
  isUnavailable: false,
  availabilityStatus: 'available',
  price: 400000,
  ...overrides
});

const roomRecord = (overrides = {}) => ({
  _id: roomId,
  propertyId,
  status: 'available',
  isActive: true,
  price: 85000,
  ...overrides
});

const bookingRecord = (overrides = {}) => ({
  _id: bookingId,
  studentId,
  propertyId,
  roomId,
  bookingStatus: 'pending',
  paymentStatus: 'pending',
  successfulPayment: false,
  save: async function save() {},
  ...overrides
});

const response = () => ({
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

const withPaymentModels = async ({ booking = bookingRecord(), property = propertyRecord(), room = roomRecord(), run }) => {
  const originals = {
    bookingFindById: Booking.findById,
    propertyFindById: Property.findById,
    propertyUpdate: Property.findOneAndUpdate,
    roomFindById: Room.findById,
    paymentFindOne: Payment.findOne,
    paymentCreate: Payment.create
  };
  Booking.findById = async (id) => id?.toString() === bookingId ? booking : null;
  Property.findById = async (id) => id?.toString() === propertyId ? property : null;
  Property.findOneAndUpdate = async () => ({ _id: propertyId });
  Room.findById = async (id) => id?.toString() === roomId ? room : null;
  Payment.findOne = async () => null;
  Payment.create = async (value) => value;
  try {
    return await run();
  } finally {
    Booking.findById = originals.bookingFindById;
    Property.findById = originals.propertyFindById;
    Property.findOneAndUpdate = originals.propertyUpdate;
    Room.findById = originals.roomFindById;
    Payment.findOne = originals.paymentFindOne;
    Payment.create = originals.paymentCreate;
  }
};

test('eligible room booking uses the room rent and permits payment without changing room state', async () => {
  await withPaymentModels({
    run: async () => {
      const context = await getEligibleBookingPaymentContext(bookingId, studentId);
      assert.equal(context.status, undefined);
      assert.equal(context.amount, 85000);
      assert.equal(context.room.status, 'available');
      assert.equal(context.booking.paymentStatus, 'pending');
    }
  });
});

test('payment initiation sends the available room rent and leaves room availability unchanged', async () => {
  const booking = bookingRecord();
  const room = roomRecord();
  await withPaymentModels({
    booking,
    room,
    run: async () => {
      let createdPayment;
      const originalPaymentCreate = Payment.create;
      Payment.create = async (payment) => {
        createdPayment = payment;
        return payment;
      };
      try {
        const res = response();
        await initializePaymentController({
          body: { bookingId, paymentMethod: 'card' },
          user: { _id: studentId, email: 'student@example.test' }
        }, res, (error) => { throw error; });
        assert.equal(res.statusCode, 200);
        assert.equal(createdPayment.amount, room.price);
        assert.equal(booking.transactionReference, res.body.data.reference);
        assert.equal(room.status, 'available');
        assert.equal(room.isActive, true);
        assert.equal(booking.paymentStatus, 'pending');
      } finally {
        Payment.create = originalPaymentCreate;
      }
    }
  });
});

test('single-unit payment initiation continues to use the property rent', async () => {
  const booking = bookingRecord({ roomId: undefined });
  await withPaymentModels({
    booking,
    property: propertyRecord({ managementMode: 'single_unit' }),
    room: null,
    run: async () => {
      let createdPayment;
      const originalPaymentCreate = Payment.create;
      Payment.create = async (payment) => {
        createdPayment = payment;
        return payment;
      };
      try {
        const res = response();
        await initializePaymentController({
          body: { bookingId, paymentMethod: 'card' },
          user: { _id: studentId, email: 'student@example.test' }
        }, res, (error) => { throw error; });
        assert.equal(res.statusCode, 200);
        assert.equal(createdPayment.amount, 400000);
      } finally {
        Payment.create = originalPaymentCreate;
      }
    }
  });
});

test('rejects payments for unavailable, occupied, reserved, or inactive rooms', async () => {
  for (const room of [
    roomRecord({ status: 'unavailable' }),
    roomRecord({ status: 'occupied' }),
    roomRecord({ status: 'reserved' }),
    roomRecord({ isActive: false })
  ]) {
    await withPaymentModels({
      room,
      run: async () => {
        const context = await getEligibleBookingPaymentContext(bookingId, studentId);
        assert.equal(context.status, 409);
        assert.match(context.message, /room associated with this booking is no longer available/i);
      }
    });
  }
});

test('rejects room payment when the room is missing or belongs to another property', async () => {
  await withPaymentModels({
    room: null,
    run: async () => {
      const context = await getEligibleBookingPaymentContext(bookingId, studentId);
      assert.equal(context.status, 409);
      assert.match(context.message, /room associated with this booking no longer exists/i);
    }
  });

  await withPaymentModels({
    room: roomRecord({ propertyId: anotherPropertyId }),
    run: async () => {
      const context = await getEligibleBookingPaymentContext(bookingId, studentId);
      assert.equal(context.status, 409);
      assert.match(context.message, /does not belong to the booking property/i);
    }
  });
});

test('does not fall back to property rent when a room rent is missing', () => {
  assert.equal(getBookingAmount(bookingRecord(), propertyRecord(), roomRecord({ price: undefined })), null);
  assert.equal(getBookingAmount(bookingRecord({ roomId: undefined }), propertyRecord(), null), 400000);
});

test('retains property rent for eligible single-unit bookings', async () => {
  await withPaymentModels({
    booking: bookingRecord({ roomId: undefined }),
    property: propertyRecord({ managementMode: 'single_unit' }),
    room: null,
    run: async () => {
      const context = await getEligibleBookingPaymentContext(bookingId, studentId);
      assert.equal(context.status, undefined);
      assert.equal(context.amount, 400000);
    }
  });
});

test('payment initiation rejects another student and unavailable rooms before contacting payment provider', async () => {
  await withPaymentModels({
    booking: bookingRecord({ studentId: anotherPropertyId }),
    run: async () => {
      const res = response();
      await initializePaymentController({
        body: { bookingId, paymentMethod: 'card' },
        user: { _id: studentId, email: 'student@example.test' }
      }, res, (error) => { throw error; });
      assert.equal(res.statusCode, 403);
      assert.match(res.body.message, /unauthorized booking access/i);
    }
  });

  await withPaymentModels({
    room: roomRecord({ status: 'occupied' }),
    run: async () => {
      const res = response();
      await initializePaymentController({
        body: { bookingId, paymentMethod: 'card' },
        user: { _id: studentId, email: 'student@example.test' }
      }, res, (error) => { throw error; });
      assert.equal(res.statusCode, 409);
      assert.match(res.body.message, /room associated with this booking is no longer available/i);
    }
  });
});

test('manual payment proof rejects unavailable rooms before uploading proof', async () => {
  await withPaymentModels({
    room: roomRecord({ isActive: false }),
    run: async () => {
      const res = response();
      await submitManualPaymentProof({
        body: { bookingId },
        file: { buffer: Buffer.from('test') },
        user: { _id: studentId }
      }, res, (error) => { throw error; });
      assert.equal(res.statusCode, 409);
      assert.match(res.body.message, /room associated with this booking is no longer available/i);
    }
  });

  await withPaymentModels({
    room: null,
    run: async () => {
      const res = response();
      await uploadPaymentProof({
        body: { bookingId, paymentMethod: 'manual', paymentReference: 'test-reference' },
        file: { buffer: Buffer.from('test') },
        user: { _id: studentId }
      }, res, (error) => { throw error; });
      assert.equal(res.statusCode, 409);
      assert.match(res.body.message, /room associated with this booking no longer exists/i);
    }
  });
});

test('manual payment proof preserves booking ownership and rejects cancelled bookings', async () => {
  await withPaymentModels({
    booking: bookingRecord({ studentId: anotherPropertyId }),
    run: async () => {
      const res = response();
      await submitManualPaymentProof({
        body: { bookingId },
        file: { buffer: Buffer.from('test') },
        user: { _id: studentId }
      }, res, (error) => { throw error; });
      assert.equal(res.statusCode, 403);
      assert.match(res.body.message, /unauthorized booking access/i);
    }
  });

  await withPaymentModels({
    booking: bookingRecord({ bookingStatus: 'cancelled' }),
    run: async () => {
      const res = response();
      await submitManualPaymentProof({
        body: { bookingId },
        file: { buffer: Buffer.from('test') },
        user: { _id: studentId }
      }, res, (error) => { throw error; });
      assert.equal(res.statusCode, 409);
      assert.match(res.body.message, /only active bookings can be paid/i);
    }
  });
});

test('payment retries retain the existing pending-payment guard', async () => {
  await withPaymentModels({
    run: async () => {
      const originalFindOne = Payment.findOne;
      let paymentFilter;
      Payment.findOne = async (filter) => {
        paymentFilter = filter;
        return { _id: 'existing-payment' };
      };
      try {
        const res = response();
        await initializePaymentController({
          body: { bookingId, paymentMethod: 'card' },
          user: { _id: studentId, email: 'student@example.test' }
        }, res, (error) => { throw error; });
        assert.equal(res.statusCode, 409);
        assert.equal(paymentFilter.bookingId, bookingId);
        assert.deepEqual(paymentFilter.verificationStatus.$in, ['pending', 'proof_submitted', 'verified']);
      } finally {
        Payment.findOne = originalFindOne;
      }
    }
  });
});

test('room payment verification confirms only its booking and leaves all room availability unchanged', async () => {
  const booking = bookingRecord();
  const room = roomRecord();
  let propertyAvailabilityUpdate = false;
  await withPaymentModels({
    booking,
    room,
    run: async () => {
      const originalUpdate = Property.findOneAndUpdate;
      Property.findOneAndUpdate = async () => {
        propertyAvailabilityUpdate = true;
        return null;
      };
      try {
        const verifiedBooking = await verifyBookingPayment({ bookingId, userId: studentId });
        assert.equal(verifiedBooking.paymentStatus, 'paid');
        assert.equal(verifiedBooking.bookingStatus, 'confirmed');
        assert.equal(room.status, 'available');
        assert.equal(room.isActive, true);
        assert.equal(propertyAvailabilityUpdate, false);
      } finally {
        Property.findOneAndUpdate = originalUpdate;
      }
    }
  });
});
