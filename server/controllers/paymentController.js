import dotenv from 'dotenv';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import Booking from '../models/Booking.js';
import Payment from '../models/Payment.js';
import { adminAccessMessage, assertAdminPropertyAccess, getAdminPropertyFilter, isSuperAdmin } from '../utils/adminScope.js';
import { recordAdminActivity } from '../utils/adminActivity.js';
import Property from '../models/Property.js';
import Room from '../models/Room.js';
import User from '../models/User.js';
import { initializePayment, verifyPayment as verifyPaystackPayment } from '../services/paymentService.js';
import { uploadBufferToCloudinary } from '../services/cloudinaryService.js';
import { isRoomInspectionEligible } from '../utils/roomRules.js';

dotenv.config();

export const getBookingAmount = (booking, property, room) => {
  const amount = booking.roomId ? room?.price : property?.price;
  return Number.isFinite(amount) && amount >= 0 ? amount : null;
};

export const getEligibleBookingPaymentContext = async (bookingId, studentId) => {
  const booking = await Booking.findById(bookingId);
  if (!booking) return { status: 404, message: 'Booking not found.' };
  if (studentId && booking.studentId.toString() !== studentId.toString()) {
    return { status: 403, message: 'Unauthorized booking access.' };
  }
  if (!['pending', 'confirmed'].includes(booking.bookingStatus)) {
    return { status: 409, message: 'Only active bookings can be paid.' };
  }
  if (booking.paymentStatus === 'paid' || booking.successfulPayment) {
    return { status: 409, message: 'This booking has already been paid.' };
  }

  const property = await Property.findById(booking.propertyId);
  if (!property) return { status: 404, message: 'The booking property was not found.' };
  if (property.isUnavailable || property.availabilityStatus === 'not_available') {
    return { status: 409, message: 'This property is no longer available for payment.' };
  }

  let room = null;
  if (booking.roomId) {
    room = await Room.findById(booking.roomId);
    if (!room) return { status: 409, message: 'The room associated with this booking no longer exists.' };
    if (!room.propertyId || room.propertyId.toString() !== booking.propertyId.toString()) {
      return { status: 409, message: 'The booked room does not belong to the booking property.' };
    }
    if (!isRoomInspectionEligible(property, room)) {
      return { status: 409, message: 'The room associated with this booking is no longer available for payment.' };
    }
  } else if (
    property.approvalStatus !== 'approved'
    || property.isDeleted
    || (property.visibleUntil && property.visibleUntil <= new Date())
  ) {
    return { status: 409, message: 'This property is no longer eligible for payment.' };
  }

  const amount = getBookingAmount(booking, property, room);
  if (amount === null) return { status: 409, message: 'The rent for this booking is unavailable.' };
  return { booking, property, room, amount };
};

const sendPaymentContextError = (res, context) => res.status(context.status).json({ message: context.message });

export const initializePaymentController = async (req, res, next) => {
  try {
    const { bookingId, paymentMethod } = req.body;
    if (!bookingId || !paymentMethod) return res.status(400).json({ message: 'Booking id and payment method are required' });

    const context = await getEligibleBookingPaymentContext(bookingId, req.user._id);
    if (context.status) return sendPaymentContextError(res, context);
    const { booking, amount } = context;

    const existingPayment = await Payment.findOne({ bookingId, verificationStatus: { $in: ['pending', 'proof_submitted', 'verified'] } });
    if (existingPayment) {
      return res.status(409).json({ message: 'A payment already exists for this booking; use the existing payment or wait for verification.' });
    }

    const response = await initializePayment(amount, req.user.email, { bookingId: booking._id.toString() });
    if (!response.status) return res.status(502).json({ message: response.message || 'Payment initialization failed' });

    const payment = await Payment.create({ bookingId, userId: req.user._id, paymentMethod, paymentReference: response.data.reference, amount, isSyntheticTest: response.isTestMode === true, verificationStatus: 'pending' });
    booking.transactionReference = response.data.reference;
    await booking.save();

    res.json({ message: 'Payment initialized', data: { authorizationUrl: response.data.authorization_url, reference: response.data.reference, payment } });
  } catch (error) {
    next(error);
  }
};

export const verifyBookingPayment = async (payment) => {
  const context = await getEligibleBookingPaymentContext(payment.bookingId, payment.userId);
  if (context.status) throw new Error(context.message);
  const { booking, property, room } = context;

  if (!room) {
    const updatedProperty = await Property.findOneAndUpdate(
      { _id: property._id, isUnavailable: { $ne: true }, availabilityStatus: { $ne: 'not_available' } },
      {
        $set: {
          isUnavailable: true,
          availabilityStatus: 'not_available',
          availabilityReason: 'payment_verified'
        }
      },
      { new: true }
    );

    if (!updatedProperty) {
      throw new Error('Property is already unavailable');
    }
  }

  if (booking.paymentStatus !== 'paid' || !booking.successfulPayment) {
    booking.paymentStatus = 'paid';
    booking.bookingStatus = 'confirmed';
    booking.successfulPayment = true;
    await booking.save();
  }

  const agent = property.agentId ? await User.findById(property.agentId) : null;
  if (agent && agent.role === 'agent' && agent.verificationStatus === 'pending') {
    agent.verificationStatus = 'verified';
    await agent.save();
  }

  return booking;
};

export const verifyPaymentController = async (req, res, next) => {
  try {
    const { reference } = req.params;
    if (!reference) return res.status(400).json({ message: 'Reference is required' });

    const payment = await Payment.findOne({ paymentReference: reference }).select('+isSyntheticTest');
    if (!payment) return res.status(404).json({ message: 'Payment record not found' });
    if (payment.verificationStatus === 'verified') {
      return res.status(400).json({ message: 'Payment has already been verified' });
    }
    const context = await getEligibleBookingPaymentContext(payment.bookingId, req.user._id);
    if (context.status) return sendPaymentContextError(res, context);
    const { booking } = context;
    if (payment.userId && payment.userId.toString() !== req.user._id.toString()) return res.status(403).json({ message: 'Unauthorized payment access' });
    if (payment.bookingId.toString() !== booking._id.toString()) return res.status(403).json({ message: 'Unauthorized payment access' });

    if (payment.isSyntheticTest && process.env.NODE_ENV !== 'production' && process.env.ALLOW_SYNTHETIC_PAYMENTS === 'true') {
      const verifiedBooking = await verifyBookingPayment(payment);
      payment.verificationStatus = 'verified';
      payment.status = 'verified';
      payment.verifiedAt = new Date();
      await payment.save();
      return res.json({ message: 'Test payment verified successfully', data: { payment, booking: verifiedBooking } });
    }

    const result = await verifyPaystackPayment(reference);
    if (!result.status) return res.status(400).json({ message: result.message || 'Payment verification failed' });
    if (!result.data || result.data.status !== 'success') {
      return res.status(400).json({ message: 'Payment verification was not successful' });
    }
    if (result.data.reference && result.data.reference !== reference) return res.status(400).json({ message: 'Payment reference mismatch' });
    if (Number(result.data.amount) !== Math.round(payment.amount * 100)) return res.status(400).json({ message: 'Payment amount mismatch' });
    if (result.data.currency && result.data.currency !== 'NGN') return res.status(400).json({ message: 'Unsupported payment currency' });
    if (result.data.metadata?.bookingId && String(result.data.metadata.bookingId) !== String(booking._id)) return res.status(400).json({ message: 'Payment booking mismatch' });

    let verifiedBooking;
    try {
      verifiedBooking = await verifyBookingPayment(payment);
    } catch (err) {
      return res.status(409).json({ message: err.message || 'Unable to confirm payment because the property is unavailable' });
    }

    payment.verificationStatus = 'verified';
    payment.status = 'verified';
    payment.verifiedAt = new Date();
    await payment.save();
    res.json({ message: 'Payment verified successfully', data: { payment, booking: verifiedBooking } });
  } catch (error) {
    next(error);
  }
};

export const uploadPaymentProof = async (req, res, next) => {
  try {
    const { bookingId, paymentMethod, paymentReference } = req.body;
    if (!bookingId || !paymentMethod || !paymentReference) return res.status(400).json({ message: 'bookingId, paymentMethod and paymentReference are required' });
    if (!req.file) return res.status(400).json({ message: 'Payment proof image is required' });

    const context = await getEligibleBookingPaymentContext(bookingId, req.user._id);
    if (context.status) return sendPaymentContextError(res, context);
    const { booking, amount } = context;
    const proof = await uploadBufferToCloudinary(req.file.buffer, {
      folder: 'fulafia-ams/payments/proofs',
      resourceType: 'auto'
    });
    const payment = await Payment.create({
      bookingId,
      paymentMethod,
      paymentReference,
      amount,
      proofImage: proof.secure_url,
      verificationStatus: 'pending'
    });

    res.status(201).json({ message: 'Payment proof uploaded for verification', data: payment });
  } catch (error) {
    next(error);
  }
};

export const submitManualPaymentProof = async (req, res, next) => {
  try {
    const { bookingId } = req.body;
    if (!bookingId) return res.status(400).json({ message: 'Booking id is required' });
    if (!req.file) return res.status(400).json({ message: 'Payment proof is required' });

    const context = await getEligibleBookingPaymentContext(bookingId, req.user._id);
    if (context.status) return sendPaymentContextError(res, context);
    const { booking, amount } = context;
    const existingPayment = await Payment.findOne({ bookingId, paymentMethod: 'manual' }).sort({ createdAt: -1 });
    if (existingPayment?.verificationStatus === 'verified') {
      return res.status(409).json({ message: 'This booking already has a verified payment' });
    }
    if (existingPayment && ['pending', 'proof_submitted'].includes(existingPayment.verificationStatus)) {
      return res.status(409).json({ message: 'Payment proof is already awaiting verification' });
    }

    const proof = await uploadBufferToCloudinary(req.file.buffer, {
      folder: 'fulafia-ams/payments/proofs',
      resourceType: 'auto'
    });
    const paymentReference = `MANUAL-${booking._id}-${Date.now()}`;
    const paymentData = {
      bookingId,
      userId: req.user._id,
      paymentMethod: 'manual',
      paymentProvider: 'OPay',
      accountName: process.env.BANK_ACCOUNT_NAME,
      accountNumber: process.env.BANK_ACCOUNT_NUMBER,
      bankName: process.env.BANK_NAME,
      paymentReference,
      transactionReference: paymentReference,
      amount,
      proofImage: proof.secure_url,
      proofPath: proof.secure_url,
      proofFilename: req.file.originalname,
      verificationStatus: 'proof_submitted',
      status: 'proof_submitted',
      submittedAt: new Date(),
      adminNote: undefined
    };

    const payment = existingPayment
      ? await Payment.findByIdAndUpdate(existingPayment._id, paymentData, { new: true, runValidators: true })
      : await Payment.create(paymentData);

    res.status(201).json({
      success: true,
      message: 'Payment proof submitted successfully. Your payment is awaiting verification.',
      status: payment.verificationStatus,
      data: payment
    });
  } catch (error) {
    next(error);
  }
};

export const paymentWebhook = async (req, res, next) => {
  try {
    const signature = req.headers['x-paystack-signature'];
    const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body || {}));
    const webhookSecret = process.env.PAYSTACK_SECRET_KEY;
    if (!signature || !webhookSecret) return res.status(401).send('Webhook signature mismatch');
    const expectedSignature = crypto.createHmac('sha512', webhookSecret).update(rawBody).digest('hex');
    const received = Buffer.from(String(signature));
    const expected = Buffer.from(expectedSignature);
    if (received.length !== expected.length || !crypto.timingSafeEqual(received, expected)) {
      return res.status(401).send('Webhook signature mismatch');
    }

    let event;
    try {
      event = JSON.parse(rawBody.toString('utf8'));
    } catch (error) {
      return res.status(400).send('Invalid webhook payload');
    }
    if (event.event === 'charge.success' || event.event === 'payment.success') {
      const reference = event.data?.reference;
      if (!reference) return res.status(400).send('Webhook reference missing');
      const payment = await Payment.findOne({ paymentReference: reference });
      if (payment && payment.verificationStatus !== 'verified') {
        if (event.data.amount !== undefined && Number(event.data.amount) !== Math.round(payment.amount * 100)) return res.status(400).send('Webhook amount mismatch');
        if (event.data.currency && event.data.currency !== 'NGN') return res.status(400).send('Webhook currency mismatch');
        if (event.data.metadata?.bookingId && String(event.data.metadata.bookingId) !== String(payment.bookingId)) return res.status(400).send('Webhook booking mismatch');
        const booking = await Booking.findById(payment.bookingId)
          .populate('propertyId', 'isUnavailable availabilityStatus')
          .populate('roomId', 'status isActive');
        if (booking && booking.paymentStatus !== 'paid' && !booking.successfulPayment && !booking.propertyId?.isUnavailable && booking.propertyId?.availabilityStatus !== 'not_available') {
          try {
            await verifyBookingPayment(payment);
            payment.verificationStatus = 'verified';
            payment.status = 'verified';
            payment.verifiedAt = new Date();
            await payment.save();
          } catch (err) {
            console.warn('Payment webhook verification skipped:', err.message);
          }
        }
      }
    }

    res.json({ status: 'success' });
  } catch (error) {
    next(error);
  }
};

export const getStudentPayments = async (req, res, next) => {
  try {
    const bookings = await Booking.find({ studentId: req.user._id });
    const bookingIds = bookings.map((booking) => booking._id);

    const payments = await Payment.find({ bookingId: { $in: bookingIds } })
      .populate({
        path: 'bookingId',
        select: 'studentId propertyId paymentStatus bookingStatus transactionReference',
        populate: [
          { path: 'studentId', select: 'name email' },
          {
            path: 'propertyId',
            select: 'title location price images type agentId',
            populate: { path: 'agentId', select: 'name email' }
          }
        ]
      })
      .sort({ createdAt: -1 });

    res.json({ data: payments });
  } catch (error) {
    next(error);
  }
};

export const getAdminPayments = async (req, res, next) => {
  try {
    const { status = 'all', day = 'all', month = 'all', year = 'all', search = '' } = req.query;
    const filter = {};
    if (!isSuperAdmin(req.user)) {
      const propertyIds = await Property.find(getAdminPropertyFilter(req.user)).distinct('_id');
      const bookingIds = await Booking.find({ propertyId: { $in: propertyIds } }).distinct('_id');
      filter.bookingId = { $in: bookingIds };
    }

    if (status !== 'all') {
      filter.verificationStatus = status;
    }

    if (year !== 'all') {
      const selectedYear = Number(year);
      if (!Number.isNaN(selectedYear)) {
        if (month !== 'all') {
          const selectedMonth = Number(month) - 1;
          if (!Number.isNaN(selectedMonth)) {
            if (day !== 'all') {
              const selectedDay = Number(day);
              if (!Number.isNaN(selectedDay)) {
                filter.createdAt = {
                  $gte: new Date(selectedYear, selectedMonth, selectedDay, 0, 0, 0),
                  $lte: new Date(selectedYear, selectedMonth, selectedDay, 23, 59, 59, 999)
                };
              }
            } else {
              filter.createdAt = {
                $gte: new Date(selectedYear, selectedMonth, 1, 0, 0, 0),
                $lte: new Date(selectedYear, selectedMonth + 1, 0, 23, 59, 59, 999)
              };
            }
          }
        } else {
          filter.createdAt = {
            $gte: new Date(selectedYear, 0, 1, 0, 0, 0),
            $lte: new Date(selectedYear + 1, 0, 1, 0, 0, 0, 0)
          };
        }
      }
    }

    const payments = await Payment.find(filter).sort({ createdAt: -1 }).populate({
      path: 'bookingId',
      populate: [
        { path: 'studentId', select: 'name email' },
        {
          path: 'propertyId',
          select: 'title location price type approvalStatus images agentId isUnavailable availabilityStatus availabilityReason',
          populate: { path: 'agentId', select: 'name email' }
        }
      ]
    });

    if (search.trim()) {
      const searchQuery = search.trim().toLowerCase();
      const filtered = payments.filter((payment) => {
        const student = payment.bookingId?.studentId;
        const property = payment.bookingId?.propertyId;
        const agent = property?.agentId;
        return [
          payment.paymentReference,
          student?.name,
          student?.email,
          property?.title,
          property?.location,
          agent?.name,
          agent?.email
        ].some((value) => value?.toLowerCase().includes(searchQuery));
      });
      return res.json({ data: filtered });
    }

    res.json({ data: payments });
  } catch (error) {
    next(error);
  }
};

export const verifyPaymentAdmin = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, adminNote } = req.body;
    if (!id) return res.status(400).json({ message: 'Payment ID is required' });
    if (!['verified', 'rejected'].includes(status)) return res.status(400).json({ message: 'Invalid status provided' });

    const payment = await Payment.findById(id);
    if (!payment) return res.status(404).json({ message: 'Payment not found' });
    const paymentScopeBooking = await Booking.findById(payment.bookingId).populate('propertyId', 'location locationCategory');
    if (!paymentScopeBooking?.propertyId) return res.status(404).json({ message: 'Payment property not found' });
    if (!isSuperAdmin(req.user) && !assertAdminPropertyAccess(req.user, paymentScopeBooking.propertyId)) return res.status(403).json({ message: adminAccessMessage });
    if (payment.verificationStatus === 'verified' && status === 'verified') {
      return res.status(400).json({ message: 'Payment is already verified' });
    }
    if (status === 'verified' && !['pending', 'proof_submitted'].includes(payment.verificationStatus)) {
      return res.status(400).json({ message: 'Only pending payment submissions can be verified' });
    }

    const booking = await Booking.findById(payment.bookingId)
      .populate('propertyId', 'isUnavailable availabilityStatus availabilityReason')
      .populate('roomId', 'price status isActive');
    if (booking?.paymentStatus === 'paid' && status === 'verified') {
      return res.status(400).json({ message: 'Booking is already paid; no admin verification needed' });
    }

    let processedBooking = booking;
    if (status === 'verified' && booking) {
      try {
        processedBooking = await verifyBookingPayment(payment);
      } catch (err) {
        return res.status(409).json({ message: err.message || 'Unable to verify payment because the property is unavailable' });
      }
      payment.verificationStatus = 'verified';
      payment.status = 'verified';
      payment.verifiedAt = new Date();
      payment.verifiedBy = req.user._id;
      await payment.save();
    }

    if (status === 'rejected' && booking) {
      booking.paymentStatus = 'failed';
      await booking.save();
      payment.verificationStatus = 'rejected';
      payment.status = 'rejected';
      payment.adminNote = adminNote?.trim() || undefined;
      payment.verifiedAt = undefined;
      payment.verifiedBy = undefined;
      await payment.save();
    }

    await recordAdminActivity(req.user, status === 'verified' ? 'payment_verified' : 'payment_rejected', `Payment ${payment._id} was ${status}.`, {
      propertyId: paymentScopeBooking.propertyId._id,
      propertyLocation: paymentScopeBooking.propertyId.location
    });

    res.json({
      success: true,
      message: status === 'verified'
        ? booking?.roomId
          ? 'Payment verified successfully. Room availability and the rest of the property were not changed.'
          : 'Payment verified successfully. The property has been marked as unavailable.'
        : 'Payment rejected successfully. The property remains available.',
      paymentStatus: payment.verificationStatus,
      availabilityStatus: processedBooking?.propertyId?.availabilityStatus || (status === 'verified' && !processedBooking?.roomId ? 'not_available' : 'available'),
      data: { payment, booking: processedBooking }
    });
  } catch (error) {
    next(error);
  }
};
