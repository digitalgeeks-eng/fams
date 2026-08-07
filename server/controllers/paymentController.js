import dotenv from 'dotenv';
import Booking from '../models/Booking.js';
import Payment from '../models/Payment.js';
import User from '../models/User.js';
import { initializePayment, verifyPayment as verifyPaystackPayment } from '../services/paymentService.js';

dotenv.config();

export const initializePaymentController = async (req, res, next) => {
  try {
    const { bookingId, paymentMethod } = req.body;
    if (!bookingId || !paymentMethod) return res.status(400).json({ message: 'Booking id and payment method are required' });

    const booking = await Booking.findById(bookingId).populate('propertyId', 'price isUnavailable');
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    if (booking.studentId.toString() !== req.user._id.toString()) return res.status(403).json({ message: 'Unauthorized booking access' });
    if (booking.paymentStatus === 'paid' || booking.successfulPayment || booking.propertyId?.isUnavailable) {
      return res.status(409).json({ message: 'This booking/property already has a completed payment and cannot be paid again' });
    }

    const existingPayment = await Payment.findOne({ bookingId, verificationStatus: { $in: ['pending', 'verified'] } });
    if (existingPayment) {
      return res.status(409).json({ message: 'A payment already exists for this booking; use the existing payment or wait for verification.' });
    }

    const amount = booking.propertyId.price;
    const response = await initializePayment(amount, req.user.email, { bookingId: booking._id.toString() });
    if (!response.status) return res.status(502).json({ message: response.message || 'Payment initialization failed' });

    const payment = await Payment.create({ bookingId, paymentMethod, paymentReference: response.data.reference, amount, verificationStatus: 'pending' });
    booking.transactionReference = response.data.reference;
    await booking.save();

    res.json({ message: 'Payment initialized', data: { authorizationUrl: response.data.authorization_url, reference: response.data.reference, payment } });
  } catch (error) {
    next(error);
  }
};

const verifyBookingPayment = async (payment) => {
  const booking = await Booking.findById(payment.bookingId).populate({
    path: 'propertyId',
    populate: { path: 'agentId', select: 'name email role verificationStatus' }
  });

  if (!booking) return null;

  booking.paymentStatus = 'paid';
  booking.bookingStatus = 'confirmed';
  booking.successfulPayment = true;
  await booking.save();

  const property = booking.propertyId;
  if (property) {
    property.isUnavailable = true;
    await property.save();
  }

  const agent = booking.propertyId?.agentId;
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

    const payment = await Payment.findOne({ paymentReference: reference });
    if (!payment) return res.status(404).json({ message: 'Payment record not found' });
    if (payment.verificationStatus === 'verified') {
      return res.status(400).json({ message: 'Payment has already been verified' });
    }

    const booking = await Booking.findById(payment.bookingId).populate('propertyId', 'isUnavailable');
    if (!booking) return res.status(404).json({ message: 'Associated booking not found' });
    if (booking.paymentStatus === 'paid' || booking.successfulPayment || booking.propertyId?.isUnavailable) {
      return res.status(409).json({ message: 'The booking/property already has a completed payment and cannot be paid again' });
    }

    if (reference.startsWith('test-')) {
      payment.verificationStatus = 'verified';
      await payment.save();
      const verifiedBooking = await verifyBookingPayment(payment);
      return res.json({ message: 'Test payment verified successfully', data: { payment, booking: verifiedBooking } });
    }

    const result = await verifyPaystackPayment(reference);
    if (!result.status) return res.status(400).json({ message: result.message || 'Payment verification failed' });
    if (!result.data || result.data.status !== 'success') {
      return res.status(400).json({ message: 'Payment verification was not successful' });
    }

    payment.verificationStatus = 'verified';
    await payment.save();

    const verifiedBooking = await verifyBookingPayment(payment);
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

    const booking = await Booking.findById(bookingId).populate('propertyId', 'price isUnavailable');
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    if (booking.studentId.toString() !== req.user._id.toString()) return res.status(403).json({ message: 'Unauthorized booking access' });
    if (booking.paymentStatus === 'paid' || booking.successfulPayment || booking.propertyId?.isUnavailable) {
      return res.status(409).json({ message: 'This booking/property already has a completed payment and cannot be paid again' });
    }

    const amount = booking.propertyId?.price || 0;
    const payment = await Payment.create({
      bookingId,
      paymentMethod,
      paymentReference,
      amount,
      proofImage: `uploads/${req.file.filename}`,
      verificationStatus: 'pending'
    });

    res.status(201).json({ message: 'Payment proof uploaded for verification', data: payment });
  } catch (error) {
    next(error);
  }
};

export const paymentWebhook = async (req, res, next) => {
  try {
    const signature = req.headers['x-paystack-signature'];
    if (!signature || signature !== process.env.PAYSTACK_WEBHOOK_SECRET) {
      return res.status(401).send('Webhook signature mismatch');
    }

    const event = req.body;
    if (event.event === 'charge.success' || event.event === 'payment.success') {
      const reference = event.data.reference;
      const payment = await Payment.findOne({ paymentReference: reference });
      if (payment && payment.verificationStatus !== 'verified') {
        const booking = await Booking.findById(payment.bookingId).populate('propertyId', 'isUnavailable');
        if (booking && booking.paymentStatus !== 'paid' && !booking.successfulPayment && !booking.propertyId?.isUnavailable) {
          payment.verificationStatus = 'verified';
          await payment.save();
          await verifyBookingPayment(payment);
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
    const payments = await Payment.find({ bookingId: { $in: bookingIds } }).sort({ createdAt: -1 });
    res.json({ data: payments });
  } catch (error) {
    next(error);
  }
};

export const getAdminPayments = async (req, res, next) => {
  try {
    const { status = 'all', day = 'all', month = 'all', year = 'all', search = '' } = req.query;
    const filter = {};

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
          select: 'title location price type approvalStatus images agentId',
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
    const { status } = req.body;
    if (!id) return res.status(400).json({ message: 'Payment ID is required' });
    if (!['verified', 'rejected'].includes(status)) return res.status(400).json({ message: 'Invalid status provided' });

    const payment = await Payment.findById(id);
    if (!payment) return res.status(404).json({ message: 'Payment not found' });
    if (payment.verificationStatus === 'verified' && status === 'verified') {
      return res.status(400).json({ message: 'Payment is already verified' });
    }

    const booking = await Booking.findById(payment.bookingId);
    if (booking?.paymentStatus === 'paid' && status === 'verified') {
      return res.status(400).json({ message: 'Booking is already paid; no admin verification needed' });
    }

    payment.verificationStatus = status;
    await payment.save();

    if (status === 'verified' && booking) {
      booking.paymentStatus = 'paid';
      booking.bookingStatus = 'confirmed';
      await booking.save();
    }

    if (status === 'rejected' && booking) {
      booking.paymentStatus = 'failed';
      await booking.save();
    }

    res.json({ message: `Payment ${status} successfully`, data: { payment, booking } });
  } catch (error) {
    next(error);
  }
};
