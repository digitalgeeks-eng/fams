import mongoose from 'mongoose';
import Property from '../models/Property.js';
import Room from '../models/Room.js';
import Booking from '../models/Booking.js';
import RoomInspectionRequest from '../models/RoomInspectionRequest.js';
import { deleteCloudinaryAsset, uploadBufferToCloudinary } from '../services/cloudinaryService.js';
import { adminAccessMessage, assertAdminPropertyAccess } from '../utils/adminScope.js';
import { getCloudinaryPublicId, PROPERTY_MEDIA_LIMITS, resolvePropertyMediaOrder } from '../utils/propertyMedia.js';
import { calculatePropertyCommission } from '../utils/propertyCommission.js';
import { isRoomInspectionEligible, validateRoomInput } from '../utils/roomRules.js';

const MEDIA_FOLDERS = {
  image: 'fulafia-ams/properties/rooms/images',
  video: 'fulafia-ams/properties/rooms/videos'
};

const sendNotFound = (res) => res.status(404).json({ message: 'Property not found' });

const getPropertyForRoomAccess = async (propertyId, req, res, { modify = false } = {}) => {
  if (!mongoose.isValidObjectId(propertyId)) {
    res.status(400).json({ message: 'A valid property id is required.' });
    return null;
  }
  const property = await Property.findById(propertyId);
  if (!property || property.isDeleted) {
    sendNotFound(res);
    return null;
  }
  if (req.user?.role === 'agent' && property.agentId?.toString() !== req.user._id.toString()) {
    res.status(403).json({ message: 'Unauthorized to manage rooms for this property.' });
    return null;
  }
  if (req.user?.role === 'admin' && !assertAdminPropertyAccess(req.user, property)) {
    res.status(403).json({ message: adminAccessMessage });
    return null;
  }
  if (modify && req.user?.role === 'admin' && !assertAdminPropertyAccess(req.user, property)) {
    res.status(403).json({ message: adminAccessMessage });
    return null;
  }
  if (modify && req.user?.role !== 'agent' && req.user?.role !== 'admin') {
    res.status(403).json({ message: 'Only the property manager can change rooms.' });
    return null;
  }
  return property;
};

const parseRooms = (value) => {
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }
  return value;
};

const parseRoomField = (field, value) => {
  if (field === 'facilities' && typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }
  if (['waterAvailable', 'electricity'].includes(field) && typeof value === 'string') {
    if (value === '') return null;
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  }
  return value;
};

const normalizeRoom = (input, propertyId, createdBy) => ({
  propertyId,
  roomNumber: String(input.roomNumber).trim().toUpperCase(),
  title: String(input.title || '').trim(),
  description: String(input.description || '').trim(),
  type: input.type,
  price: Number(input.price),
  billingPeriod: input.billingPeriod || 'yearly',
  status: input.status || 'available',
  statusReason: String(input.statusReason || '').trim(),
  toilet: input.toilet || 'unknown',
  shower: input.shower || 'unknown',
  kitchen: input.kitchen || 'unknown',
  waterSource: input.waterSource || 'unknown',
  waterAvailable: input.waterAvailable ?? null,
  electricity: input.electricity ?? null,
  facilities: (input.facilities || []).map((item) => String(item).trim()).filter(Boolean).slice(0, 30),
  floorSection: String(input.floorSection || '').trim(),
  images: [],
  videos: [],
  statusHistory: [{
    to: input.status || 'available',
    reason: String(input.statusReason || '').trim(),
    changedBy: createdBy
  }]
});

const uploadRoomMedia = async (files = []) => {
  const uploaded = [];
  try {
    for (const file of files) {
      const resourceType = file.mimetype.startsWith('video/') ? 'video' : 'image';
      const result = await uploadBufferToCloudinary(file.buffer, {
        folder: MEDIA_FOLDERS[resourceType],
        resourceType
      });
      uploaded.push({ url: result.secure_url, publicId: result.public_id, resourceType });
    }
    return uploaded;
  } catch (error) {
    await Promise.all(uploaded.map((item) => deleteCloudinaryAsset(item.publicId, item.resourceType)));
    throw error;
  }
};

const cleanupUploadedRoomMedia = async (media) => {
  await Promise.all(media.map((item) => deleteCloudinaryAsset(item.publicId, item.resourceType)));
};

const getMediaForOrder = (order, uploaded) => order.map((entry) => (
  uploaded[Number(entry.slice('upload:'.length))]
));

export const getPropertyRooms = async (req, res) => {
  const property = await getPropertyForRoomAccess(req.params.propertyId, req, res);
  if (!property) return;

  const isManager = req.user?.role === 'admin'
    || (req.user?.role === 'agent' && property.agentId?.toString() === req.user._id.toString());
  const publiclyVisible = property.approvalStatus === 'approved'
    && !property.isDeleted
    && !property.isUnavailable
    && property.availabilityStatus !== 'not_available'
    && (!property.visibleUntil || property.visibleUntil > new Date());
  if (!isManager && !publiclyVisible) return sendNotFound(res);

  const filter = { propertyId: property._id };
  if (!isManager) {
    filter.status = 'available';
    filter.isActive = true;
  }
  const rooms = await Room.find(filter).sort({ roomNumber: 1 });
  const data = rooms.map((room) => {
    const serialized = typeof room.toObject === 'function' ? room.toObject() : room;
    if (!isManager) delete serialized.statusHistory;
    if (isManager && property.ownerType !== 'admin') {
      serialized.commissionEstimate = calculatePropertyCommission(room.price);
    }
    return serialized;
  });
  const counts = { total: 0, available: 0, reserved: 0, occupied: 0, unavailable: 0 };
  if (isManager) {
    for (const room of data.filter((item) => item.isActive)) {
      counts.total += 1;
      if (counts[room.status] !== undefined) counts[room.status] += 1;
    }
  } else {
    const [summary] = await Room.aggregate([
      { $match: { propertyId: property._id, isActive: true } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          available: { $sum: { $cond: [{ $eq: ['$status', 'available'] }, 1, 0] } },
          reserved: { $sum: { $cond: [{ $eq: ['$status', 'reserved'] }, 1, 0] } },
          occupied: { $sum: { $cond: [{ $eq: ['$status', 'occupied'] }, 1, 0] } },
          unavailable: { $sum: { $cond: [{ $eq: ['$status', 'unavailable'] }, 1, 0] } }
        }
      }
    ]);
    if (summary) {
      counts.total = summary.total;
      counts.available = summary.available;
      counts.reserved = summary.reserved;
      counts.occupied = summary.occupied;
      counts.unavailable = summary.unavailable;
    }
  }
  const availablePrices = data
    .filter((room) => room.isActive && room.status === 'available')
    .map((room) => room.price);
  res.json({
    data: {
      rooms: data,
      counts,
      priceRange: availablePrices.length
        ? { minimum: Math.min(...availablePrices), maximum: Math.max(...availablePrices) }
        : null
    }
  });
};

export const createPropertyRooms = async (req, res) => {
  const property = await getPropertyForRoomAccess(req.params.propertyId, req, res, { modify: true });
  if (!property) return;
  if (property.managementMode !== 'multi_room') {
    return res.status(409).json({ message: 'Enable multi-room management for this property before adding rooms.' });
  }

  const input = parseRooms(req.body.rooms);
  let roomInputs;
  if (Array.isArray(input)) {
    roomInputs = input;
  } else if (input && typeof input === 'object' && Number.isInteger(Number(input.count))) {
    const count = Number(input.count);
    if (count < 1 || count > 100) return res.status(400).json({ message: 'Generate between 1 and 100 rooms per request.' });
    const prefix = String(input.roomNumberPrefix || 'Room ').trim();
    roomInputs = Array.from({ length: count }, (_, index) => ({
      ...input.template,
      roomNumber: `${prefix}${index + 1}`
    }));
  } else {
    return res.status(400).json({ message: 'Submit a room list or a room template and count.' });
  }
  if (!roomInputs.length || roomInputs.length > 100) {
    return res.status(400).json({ message: 'Add between 1 and 100 rooms per request.' });
  }
  const invalidRoom = roomInputs.map(validateRoomInput).find(Boolean);
  if (invalidRoom) return res.status(400).json({ message: invalidRoom });

  const normalizedLabels = roomInputs.map((room) => String(room.roomNumber).trim().toUpperCase());
  if (new Set(normalizedLabels).size !== normalizedLabels.length) {
    return res.status(409).json({ message: 'Room labels must be unique within this property.' });
  }
  const existing = await Room.find({ propertyId: property._id }).select('roomNumber');
  const existingLabels = new Set(existing.map((room) => room.roomNumber.toUpperCase()));
  if (normalizedLabels.some((label) => existingLabels.has(label))) {
    return res.status(409).json({ message: 'A room with one of those labels already exists in this property.' });
  }

  const imageFiles = req.files?.images || [];
  const videoFiles = req.files?.videos || [];
  if (imageFiles.length > PROPERTY_MEDIA_LIMITS.images || videoFiles.length > PROPERTY_MEDIA_LIMITS.videos) {
    return res.status(400).json({ message: 'The room media exceeds the per-request image or video limit.' });
  }
  if (roomInputs.length > 1 && (imageFiles.length || videoFiles.length)) {
    return res.status(400).json({ message: 'Upload room-specific media after creating the batch, using each room’s edit form.' });
  }
  const imageOrder = resolvePropertyMediaOrder(req.body.imageOrder, 0, imageFiles.length);
  const videoOrder = resolvePropertyMediaOrder(req.body.videoOrder, 0, videoFiles.length);
  if (!imageOrder || !videoOrder || imageOrder.length > PROPERTY_MEDIA_LIMITS.images || videoOrder.length > PROPERTY_MEDIA_LIMITS.videos) {
    return res.status(400).json({ message: 'The selected room media order is invalid or exceeds the per-room media limit.' });
  }

  let uploadedImages = [];
  let uploadedVideos = [];
  try {
    uploadedImages = await uploadRoomMedia(imageFiles);
    uploadedVideos = await uploadRoomMedia(videoFiles);
  } catch (error) {
    await cleanupUploadedRoomMedia(uploadedImages);
    throw error;
  }
  const sharedImages = getMediaForOrder(imageOrder, uploadedImages);
  const sharedVideos = getMediaForOrder(videoOrder, uploadedVideos);
  const documents = roomInputs.map((inputRoom) => ({
    ...normalizeRoom(inputRoom, property._id, req.user._id),
    images: sharedImages,
    videos: sharedVideos
  }));
  const documentIds = documents.map(() => new mongoose.Types.ObjectId());
  documents.forEach((document, index) => { document._id = documentIds[index]; });

  try {
    const created = await Room.insertMany(documents, { ordered: true });
    return res.status(201).json({ message: `${created.length} room${created.length === 1 ? '' : 's'} added.`, data: created });
  } catch (error) {
    await Room.deleteMany({ _id: { $in: documentIds } });
    await cleanupUploadedRoomMedia([...uploadedImages, ...uploadedVideos]);
    if (error.code === 11000) {
      return res.status(409).json({ message: 'A room with one of those labels already exists in this property. No rooms from this batch were kept.' });
    }
    throw error;
  }
};

const getRoomAndProperty = async (propertyId, roomId, req, res, options) => {
  if (!mongoose.isValidObjectId(roomId)) {
    res.status(400).json({ message: 'A valid room id is required.' });
    return null;
  }
  const property = await getPropertyForRoomAccess(propertyId, req, res, options);
  if (!property) return null;
  const room = await Room.findOne({ _id: roomId, propertyId: property._id });
  if (!room) {
    res.status(404).json({ message: 'Room not found.' });
    return null;
  }
  return { property, room };
};

export const updatePropertyRoom = async (req, res) => {
  const access = await getRoomAndProperty(req.params.propertyId, req.params.roomId, req, res, { modify: true });
  if (!access) return;
  const { property, room } = access;
  const acceptedFields = [
    'roomNumber', 'title', 'description', 'type', 'price', 'billingPeriod',
    'toilet', 'shower', 'kitchen', 'waterSource', 'waterAvailable',
    'electricity', 'facilities', 'floorSection'
  ];
  const next = { ...room.toObject() };
  for (const field of acceptedFields) {
    if (req.body[field] === undefined) continue;
    next[field] = parseRoomField(field, req.body[field]);
  }
  const validationError = validateRoomInput(next);
  if (validationError) return res.status(400).json({ message: validationError });
  const normalizedLabel = String(next.roomNumber).trim().toUpperCase();
  if (normalizedLabel !== room.roomNumber) {
    const duplicate = await Room.exists({ propertyId: property._id, roomNumber: normalizedLabel, _id: { $ne: room._id } });
    if (duplicate) return res.status(409).json({ message: 'A room with that label already exists in this property.' });
  }

  const updates = Object.fromEntries(acceptedFields
    .filter((field) => req.body[field] !== undefined)
    .map((field) => [field, field === 'roomNumber' ? normalizedLabel : parseRoomField(field, req.body[field])]));
  const statusChanged = req.body.status !== undefined && req.body.status !== room.status;
  if (req.body.status !== undefined && !['available', 'reserved', 'occupied', 'unavailable'].includes(req.body.status)) {
    return res.status(400).json({ message: 'Select a valid room status.' });
  }
  const statusReason = String(req.body.statusReason || '').trim();
  if (statusReason.length > 500) return res.status(400).json({ message: 'The status reason cannot exceed 500 characters.' });
  if (statusChanged) {
    updates.status = req.body.status;
    updates.statusReason = statusReason;
  }
  if (req.body.isActive !== undefined) {
    if (req.body.isActive !== true && req.body.isActive !== false && req.body.isActive !== 'true' && req.body.isActive !== 'false') {
      return res.status(400).json({ message: 'Room activity must be true or false.' });
    }
    const isActive = req.body.isActive === true || req.body.isActive === 'true';
    if (!isActive && ['occupied', 'reserved'].includes(req.body.status || room.status)) {
      return res.status(409).json({ message: 'Occupied or reserved rooms cannot be deactivated.' });
    }
    if (isActive && req.body.status === undefined && room.status === 'unavailable') {
      return res.status(400).json({ message: 'Choose the new room availability status before reactivating it.' });
    }
    if (!isActive && await RoomInspectionRequest.exists({
      roomId: room._id,
      status: { $in: ['pending', 'accepted'] }
    })) {
      return res.status(409).json({ message: 'Resolve active inspection requests before deactivating this room.' });
    }
    updates.isActive = isActive;
  }
  let nextImages = room.images || [];
  let nextVideos = room.videos || [];
  const imageFiles = req.files?.images || [];
  const videoFiles = req.files?.videos || [];
  if (imageFiles.length > PROPERTY_MEDIA_LIMITS.images || videoFiles.length > PROPERTY_MEDIA_LIMITS.videos) {
    return res.status(400).json({ message: 'The room media exceeds the per-request image or video limit.' });
  }
  const imageOrder = resolvePropertyMediaOrder(req.body.imageOrder, nextImages.length, imageFiles.length);
  const videoOrder = resolvePropertyMediaOrder(req.body.videoOrder, nextVideos.length, videoFiles.length);
  if (!imageOrder || !videoOrder || imageOrder.length > PROPERTY_MEDIA_LIMITS.images || videoOrder.length > PROPERTY_MEDIA_LIMITS.videos) {
    return res.status(400).json({ message: 'The selected room media order is invalid or exceeds the per-room media limit.' });
  }

  let uploadedImages = [];
  let uploadedVideos = [];
  try {
    uploadedImages = await uploadRoomMedia(imageFiles);
    uploadedVideos = await uploadRoomMedia(videoFiles);
  } catch (error) {
    await cleanupUploadedRoomMedia(uploadedImages);
    throw error;
  }
  const arrange = (order, existing, uploaded) => order.map((entry) => {
    const [source, index] = entry.split(':');
    return source === 'existing' ? existing[Number(index)] : uploaded[Number(index)];
  });
  nextImages = arrange(imageOrder, nextImages, uploadedImages);
  nextVideos = arrange(videoOrder, nextVideos, uploadedVideos);
  if (req.body.imageOrder !== undefined || imageFiles.length) updates.images = nextImages;
  if (req.body.videoOrder !== undefined || videoFiles.length) updates.videos = nextVideos;

  const query = { _id: room._id, propertyId: property._id, status: room.status, isActive: room.isActive };
  const update = { $set: updates };
  if (statusChanged) {
    update.$push = {
      statusHistory: {
        from: room.status,
        to: req.body.status,
        reason: updates.statusReason,
        changedBy: req.user._id
      }
    };
  }
  let updatedRoom;
  try {
    updatedRoom = await Room.findOneAndUpdate(query, update, { new: true, runValidators: true });
  } catch (error) {
    await cleanupUploadedRoomMedia([...uploadedImages, ...uploadedVideos]);
    if (error.code === 11000) return res.status(409).json({ message: 'A room with that label already exists in this property.' });
    throw error;
  }
  if (!updatedRoom) {
    await cleanupUploadedRoomMedia([...uploadedImages, ...uploadedVideos]);
    return res.status(409).json({ message: 'Room status changed while you were editing it. Reload and try again.' });
  }

  const retainedIds = new Set([...nextImages, ...nextVideos].map(getCloudinaryPublicId).filter(Boolean));
  const removedMedia = [...(room.images || []), ...(room.videos || [])]
    .filter((item) => getCloudinaryPublicId(item) && !retainedIds.has(getCloudinaryPublicId(item)));
  const removedIds = new Set();
  for (const item of removedMedia) {
    const publicId = getCloudinaryPublicId(item);
    if (removedIds.has(publicId)) continue;
    removedIds.add(publicId);
    const isReferenced = await Promise.all([
      Property.exists({
        $or: [
          { 'images.publicId': publicId }, { 'images.public_id': publicId },
          { 'videos.publicId': publicId }, { 'videos.public_id': publicId },
          { 'image.publicId': publicId }, { 'image.public_id': publicId },
          { 'video.publicId': publicId }, { 'video.public_id': publicId }
        ]
      }),
      Room.exists({ _id: { $ne: room._id }, $or: [
        { 'images.publicId': publicId }, { 'images.public_id': publicId },
        { 'videos.publicId': publicId }, { 'videos.public_id': publicId }
      ] })
    ]);
    const resourceType = item.resourceType || item.resource_type || 'image';
    if (!isReferenced.some(Boolean) && publicId.startsWith(`${MEDIA_FOLDERS[resourceType]}/`)) {
      await deleteCloudinaryAsset(publicId, resourceType);
    }
  }

  if (property.ownerType !== 'admin') updatedRoom.commissionEstimate = calculatePropertyCommission(updatedRoom.price);
  return res.json({ message: 'Room updated successfully.', data: updatedRoom });
};

export const deactivatePropertyRoom = async (req, res) => {
  const access = await getRoomAndProperty(req.params.propertyId, req.params.roomId, req, res, { modify: true });
  if (!access) return;
  const { property, room } = access;
  if (room.status === 'occupied' || room.status === 'reserved') {
    return res.status(409).json({ message: 'Occupied or reserved rooms cannot be deactivated.' });
  }
  const reason = String(req.body?.reason || 'Room deactivated').trim();
  if (reason.length > 500) return res.status(400).json({ message: 'The deactivation reason cannot exceed 500 characters.' });
  const activeRequest = await RoomInspectionRequest.exists({
    roomId: room._id,
    status: { $in: ['pending', 'accepted'] }
  });
  if (activeRequest) return res.status(409).json({ message: 'Resolve active inspection requests before deactivating this room.' });
  const updatedRoom = await Room.findOneAndUpdate(
    { _id: room._id, propertyId: property._id, status: room.status, isActive: true },
    {
      $set: { isActive: false, status: 'unavailable', statusReason: reason },
      $push: { statusHistory: { from: room.status, to: 'unavailable', reason, changedBy: req.user._id } }
    },
    { new: true }
  );
  if (!updatedRoom) return res.status(409).json({ message: 'Room changed while being deactivated. Reload and try again.' });
  return res.json({ message: 'Room deactivated.', data: updatedRoom });
};

const createInspectionRequestForBooking = async (req, res, roomAccess = null) => {
  const property = roomAccess?.property || await getPropertyForRoomAccess(req.params.propertyId, req, res);
  if (!property) return;
  const room = roomAccess?.room || null;
  if (req.user.role !== 'student') return res.status(403).json({ message: 'Only students can request a room inspection.' });
  if (room && !isRoomInspectionEligible(property, room)) {
    return res.status(409).json({ message: 'This room is no longer available for inspection.' });
  }
  if (!room && (
    property.managementMode === 'multi_room'
    || property.approvalStatus !== 'approved'
    || property.isDeleted
    || property.isUnavailable
    || property.availabilityStatus === 'not_available'
    || (property.visibleUntil && property.visibleUntil <= new Date())
  )) {
    return res.status(409).json({ message: 'This property is no longer available for inspection.' });
  }
  const { bookingId } = req.body;
  if (!mongoose.isValidObjectId(bookingId)) {
    return res.status(400).json({ message: 'A valid booking id is required before requesting an inspection.' });
  }
  const booking = await Booking.findById(bookingId);
  if (!booking) return res.status(404).json({ message: 'Booking not found.' });
  if (booking.studentId.toString() !== req.user._id.toString()) {
    return res.status(403).json({ message: 'You can only request an inspection for your own booking.' });
  }
  if (booking.propertyId.toString() !== property._id.toString()) {
    return res.status(409).json({ message: 'The booking does not belong to this property.' });
  }
  if (!['pending', 'confirmed'].includes(booking.bookingStatus)) {
    return res.status(409).json({ message: 'Only an active booking can be used to request an inspection.' });
  }
  if (room
    ? booking.roomId?.toString() !== room._id.toString()
    : Boolean(booking.roomId)) {
    return res.status(409).json({ message: 'The booking does not match the requested room or property.' });
  }

  const message = String(req.body.message || '').trim();
  if (message.length > 1000) return res.status(400).json({ message: 'Inspection notes cannot exceed 1000 characters.' });
  const duplicate = await RoomInspectionRequest.exists({
    bookingId: booking._id,
    status: { $in: ['pending', 'accepted'] }
  });
  if (duplicate) return res.status(409).json({ message: 'You already have an active inspection request for this booking.' });
  const legacyDuplicate = await RoomInspectionRequest.exists({
    studentId: req.user._id,
    propertyId: property._id,
    ...(room ? { roomId: room._id } : { roomId: null }),
    bookingId: { $exists: false },
    status: { $in: ['pending', 'accepted'] }
  });
  if (legacyDuplicate) {
    return res.status(409).json({ message: 'You already have an active inspection request for this property or room.' });
  }
  let request;
  try {
    request = await RoomInspectionRequest.create({
      studentId: req.user._id,
      propertyId: property._id,
      ...(room ? { roomId: room._id } : {}),
      bookingId: booking._id,
      activeBookingId: booking._id,
      message
    });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: 'You already have an active inspection request for this booking.' });
    throw error;
  }
  return res.status(201).json({
    message: 'Inspection request submitted. Booking and availability status have not changed.',
    data: request
  });
};

export const createRoomInspectionRequest = async (req, res) => {
  const access = await getRoomAndProperty(req.params.propertyId, req.params.roomId, req, res);
  if (!access) return;
  return createInspectionRequestForBooking(req, res, access);
};

export const createPropertyInspectionRequest = async (req, res) => createInspectionRequestForBooking(req, res);

export const listRoomInspectionRequests = async (req, res) => {
  const property = await getPropertyForRoomAccess(req.params.propertyId, req, res);
  if (!property) return;
  if (req.user?.role !== 'admin'
    && !(req.user?.role === 'agent' && property.agentId?.toString() === req.user._id.toString())) {
    return res.status(403).json({ message: 'Only authorized property managers can review inspection requests.' });
  }
  const requests = await RoomInspectionRequest.find({ propertyId: property._id })
    .populate('studentId', 'name email')
    .populate('roomId', 'roomNumber title price billingPeriod status')
    .populate('bookingId', 'bookingStatus paymentStatus roomId createdAt')
    .sort({ createdAt: -1 });
  return res.json({ data: requests });
};

export const listStudentRoomInspectionRequests = async (req, res) => {
  if (req.user?.role !== 'student') {
    return res.status(403).json({ message: 'Only students can view their own inspection requests.' });
  }
  if (!mongoose.isValidObjectId(req.params.propertyId)) {
    return res.status(400).json({ message: 'A valid property id is required.' });
  }
  const requests = await RoomInspectionRequest.find({
    propertyId: req.params.propertyId,
    studentId: req.user._id
  })
    .populate('roomId', 'roomNumber type price billingPeriod status')
    .populate('bookingId', 'bookingStatus paymentStatus roomId createdAt')
    .sort({ createdAt: -1 });
  return res.json({ data: requests });
};

export const updateRoomInspectionRequest = async (req, res) => {
  const { requestId } = req.params;
  if (!mongoose.isValidObjectId(requestId)) return res.status(400).json({ message: 'A valid inspection request id is required.' });
  const request = await RoomInspectionRequest.findById(requestId);
  if (!request) return res.status(404).json({ message: 'Inspection request not found.' });
  const property = await getPropertyForRoomAccess(request.propertyId, req, res, { modify: true });
  if (!property) return;
  if (!['accepted', 'declined', 'completed'].includes(req.body.status)) {
    return res.status(400).json({ message: 'Select accepted, declined, or completed.' });
  }
  const allowedTransition = request.status === 'pending'
    ? ['accepted', 'declined'].includes(req.body.status)
    : request.status === 'accepted' && req.body.status === 'completed';
  if (!allowedTransition) {
    return res.status(409).json({ message: 'That inspection request status transition is not allowed.' });
  }
  const updated = await RoomInspectionRequest.findOneAndUpdate({
    _id: request._id,
    status: request.status
  }, {
    $set: {
      status: req.body.status,
      responseNote: String(req.body.responseNote || '').trim(),
      reviewedBy: req.user._id,
      reviewedAt: new Date()
    },
    ...(req.body.status === 'declined' || req.body.status === 'completed'
      ? { $unset: { activeBookingId: 1 } }
      : {})
  }, { new: true, runValidators: true });
  if (!updated) return res.status(409).json({ message: 'Inspection request changed while being reviewed.' });
  return res.json({ message: 'Inspection request updated. Room availability was not changed.', data: updated });
};
