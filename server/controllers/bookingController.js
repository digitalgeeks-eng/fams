import Booking from '../models/Booking.js';
import Property from '../models/Property.js';
import Room from '../models/Room.js';
import RoomInspectionRequest from '../models/RoomInspectionRequest.js';
import mongoose from 'mongoose';
import { isRoomInspectionEligible } from '../utils/roomRules.js';
import { adminAccessMessage, assertAdminPropertyAccess, getAdminPropertyFilter, isSuperAdmin } from '../utils/adminScope.js';

export const createBooking = async (req, res) => {
  const { propertyId, roomId, checkInDate, checkOutDate, guestCount = 1 } = req.body;
  if (!propertyId || !checkInDate || !checkOutDate) {
    return res.status(400).json({ message: 'Property id, check-in date and check-out date are required' });
  }
  if (!mongoose.isValidObjectId(propertyId) || (roomId && !mongoose.isValidObjectId(roomId))) {
    return res.status(400).json({ message: 'A valid property and room id are required' });
  }

  const property = await Property.findById(propertyId);
  if (!property || property.isDeleted || property.approvalStatus !== 'approved' || property.isUnavailable || property.availabilityStatus === 'not_available' || (property.visibleUntil && property.visibleUntil <= new Date())) {
    return res.status(404).json({ message: 'Property not available for booking' });
  }

  let room = null;
  if (property.managementMode === 'multi_room') {
    if (!roomId) return res.status(400).json({ message: 'Select a specific room before booking this property' });
    room = await Room.findOne({ _id: roomId, propertyId: property._id });
    if (!isRoomInspectionEligible(property, room)) {
      return res.status(409).json({ message: 'This room is not available for booking' });
    }
  } else if (roomId) {
    return res.status(400).json({ message: 'A room can only be selected for a multi-room property' });
  }

  const checkIn = new Date(checkInDate);
  const checkOut = new Date(checkOutDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (isNaN(checkIn) || isNaN(checkOut) || checkIn >= checkOut) {
    return res.status(400).json({ message: 'Invalid check-in or check-out dates' });
  }
  if (checkIn <= today) {
    return res.status(400).json({ message: 'Check-in date must be in the future' });
  }

  const existingBooking = await Booking.findOne({
    studentId: req.user._id,
    propertyId,
    ...(roomId ? { roomId } : { roomId: null }),
    bookingStatus: { $in: ['pending', 'confirmed'] },
    checkInDate: { $lt: checkOut },
    checkOutDate: { $gt: checkIn }
  });
  if (existingBooking) {
    return res.status(409).json({ message: 'You already have an active booking for these dates' });
  }

  const overlappingBooking = await Booking.findOne({
    ...(roomId ? { roomId } : { propertyId, roomId: null }),
    bookingStatus: { $in: ['pending', 'confirmed'] },
    checkInDate: { $lt: checkOut },
    checkOutDate: { $gt: checkIn }
  });
  if (overlappingBooking) {
    return res.status(409).json({ message: 'The property is already reserved for the selected dates' });
  }

  const booking = await Booking.create({
    studentId: req.user._id,
    propertyId,
    ...(roomId ? { roomId } : {}),
    transactionReference: `FULAFIA-${Date.now()}`,
    checkInDate: checkIn,
    checkOutDate: checkOut,
    guestCount: Number(guestCount)
  });
  res.status(201).json({ message: 'Booking created successfully and is awaiting approval', data: booking });
};

export const getStudentBookings = async (req, res) => {
  const bookings = await Booking.find({ studentId: req.user._id })
    .populate('propertyId', 'title location price images approvalStatus isUnavailable availabilityStatus availabilityReason')
    .populate('roomId', 'roomNumber type price billingPeriod status')
    .sort({ createdAt: -1 });
  const inspectionRequests = bookings.length
    ? await RoomInspectionRequest.find({ studentId: req.user._id })
      .populate('roomId', 'roomNumber type')
      .sort({ createdAt: -1 })
    : [];
  res.json({
    data: bookings.map((booking) => ({
      ...booking.toObject(),
      inspectionRequests: inspectionRequests.filter((request) => {
        if (request.bookingId) return request.bookingId.toString() === booking._id.toString();
        const requestRoomId = request.roomId?._id || request.roomId;
        const bookingRoomId = booking.roomId?._id || booking.roomId;
        return request.propertyId.toString() === (booking.propertyId?._id || booking.propertyId).toString()
          && (requestRoomId
            ? requestRoomId.toString() === bookingRoomId?.toString()
            : !bookingRoomId);
      })
    }))
  });
};

export const getAgentBookings = async (req, res) => {
  const properties = await Property.find({ agentId: req.user._id }).select('_id');
  const propertyIds = properties.map((property) => property._id);
  const bookings = await Booking.find({ propertyId: { $in: propertyIds } })
    .populate('studentId', 'name email')
    .populate('propertyId', 'title location price')
    .populate('roomId', 'roomNumber type')
    .sort({ createdAt: -1 });
  res.json({ data: bookings });
};

export const getAdminBookings = async (req, res) => {
  const propertyIds = await Property.find(getAdminPropertyFilter(req.user)).distinct('_id');
  const bookings = await Booking.find(isSuperAdmin(req.user) ? {} : { propertyId: { $in: propertyIds } })
    .populate('studentId', 'name email')
    .populate({
      path: 'propertyId',
      select: 'title location price type approvalStatus images agentId isUnavailable availabilityStatus availabilityReason',
      populate: { path: 'agentId', select: 'name email' }
    })
    .populate('roomId', 'roomNumber type')
    .sort({ createdAt: -1 });
  res.json({ data: bookings });
};

export const getBooking = async (req, res) => {
  const booking = await Booking.findById(req.params.id)
    .populate('studentId', 'name email')
    .populate('propertyId', 'title location price')
    .populate('roomId', 'roomNumber type');
  if (!booking) return res.status(404).json({ message: 'Booking not found' });
  if (booking.studentId._id.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Unauthorized access to booking' });
  }
  if (req.user.role === 'admin' && !assertAdminPropertyAccess(req.user, booking.propertyId)) return res.status(403).json({ message: adminAccessMessage });
  res.json({ data: booking });
};

export const cancelBooking = async (req, res) => {
  const booking = await Booking.findById(req.params.id);
  if (!booking) return res.status(404).json({ message: 'Booking not found' });
  if (booking.studentId.toString() !== req.user._id.toString()) {
    return res.status(403).json({ message: 'Unauthorized to cancel this booking' });
  }
  if (booking.bookingStatus === 'cancelled') {
    return res.status(400).json({ message: 'Booking is already cancelled' });
  }
  booking.bookingStatus = 'cancelled';
  booking.cancellationReason = req.body.reason || booking.cancellationReason;
  if (booking.paymentStatus === 'paid') {
    booking.refundStatus = 'requested';
  }
  await booking.save();
  res.json({ message: 'Booking cancelled successfully', data: booking });
};

export const approveBooking = async (req, res) => {
  const booking = await Booking.findById(req.params.id).populate('propertyId', 'agentId');
  if (!booking) return res.status(404).json({ message: 'Booking not found' });
  if (req.user.role === 'admin' && !assertAdminPropertyAccess(req.user, booking.propertyId)) return res.status(403).json({ message: adminAccessMessage });
  if (req.user.role === 'agent' && booking.propertyId.agentId.toString() !== req.user._id.toString()) {
    return res.status(403).json({ message: 'Unauthorized to approve this booking' });
  }
  if (booking.bookingStatus !== 'pending') {
    return res.status(400).json({ message: 'Only pending bookings can be approved' });
  }
  booking.bookingStatus = 'confirmed';
  await booking.save();
  res.json({ message: 'Booking approved successfully', data: booking });
};

export const rejectBooking = async (req, res) => {
  const booking = await Booking.findById(req.params.id).populate('propertyId', 'agentId');
  if (!booking) return res.status(404).json({ message: 'Booking not found' });
  if (req.user.role === 'admin' && !assertAdminPropertyAccess(req.user, booking.propertyId)) return res.status(403).json({ message: adminAccessMessage });
  if (req.user.role === 'agent' && booking.propertyId.agentId.toString() !== req.user._id.toString()) {
    return res.status(403).json({ message: 'Unauthorized to reject this booking' });
  }
  if (booking.bookingStatus !== 'pending') {
    return res.status(400).json({ message: 'Only pending bookings can be rejected' });
  }
  booking.bookingStatus = 'cancelled';
  booking.cancellationReason = req.body.reason || 'Booking rejected by agent';
  if (booking.paymentStatus === 'paid') {
    booking.refundStatus = 'requested';
  }
  await booking.save();
  res.json({ message: 'Booking rejected successfully', data: booking });
};
