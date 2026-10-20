import mongoose from 'mongoose';
import Property from '../models/Property.js';
import Room from '../models/Room.js';
import Booking from '../models/Booking.js';
import Payment from '../models/Payment.js';
import PropertyEditHistory from '../models/PropertyEditHistory.js';
import { updateRecommendationData } from '../services/recommendationService.js';
import { deleteCloudinaryAsset, uploadBufferToCloudinary } from '../services/cloudinaryService.js';
import { normalizePropertyLocation } from '../utils/locations.js';
import { parseInspectionFee } from '../utils/inspectionFee.js';
import { calculatePropertyCommission } from '../utils/propertyCommission.js';
import { getPropertyContactNumber, normalizeNigerianPhoneNumber } from '../utils/propertyContact.js';
import { adminAccessMessage, assertAdminPropertyAccess, getAdminPropertyFilter, isSuperAdmin } from '../utils/adminScope.js';
import { recordAdminActivity } from '../utils/adminActivity.js';
import {
  getCloudinaryPublicId,
  getStoredPropertyMedia,
  PROPERTY_MEDIA_LIMITS,
  resolvePropertyMediaOrder
} from '../utils/propertyMedia.js';
import { validateRoomInput } from '../utils/roomRules.js';

const uploadPropertyMediaToCloudinary = async (files = []) => {
  const uploaded = [];
  try {
    for (const file of files) {
      const resourceType = file.mimetype.startsWith('video/') ? 'video' : 'image';
      const result = await uploadBufferToCloudinary(file.buffer, {
        folder: resourceType === 'video' ? 'fulafia-ams/properties/videos' : 'fulafia-ams/properties/images',
        resourceType
      });
      uploaded.push({ url: result.secure_url, publicId: result.public_id, resourceType });
    }
    return uploaded;
  } catch (error) {
    await Promise.all(uploaded.map((media) => deleteCloudinaryAsset(media.publicId, media.resourceType)));
    throw error;
  }
};

const parseBuildingFacilities = (value) => {
  if (value === undefined || value === null || value === '') return [];
  let facilities = value;
  if (typeof facilities === 'string') {
    try {
      facilities = JSON.parse(facilities);
    } catch {
      facilities = facilities.split(',');
    }
  }
  if (!Array.isArray(facilities)) return null;
  return facilities.map((item) => String(item).trim()).filter(Boolean).slice(0, 30);
};

export const listProperties = async (req, res) => {
  const { search, location, type, priceRange, toilet, page = 1, limit = 12 } = req.query;
  const filter = {
    approvalStatus: 'approved',
    isDeleted: { $ne: true },
    $or: [
      { visibleUntil: { $exists: false } },
      { visibleUntil: null },
      { visibleUntil: '' },
      { visibleUntil: { $gt: new Date() } }
    ]
  };
  if (search) filter.$and = [
    { $or: [
      { title: { $regex: search, $options: 'i' } },
      { location: { $regex: search, $options: 'i' } }
    ] }
  ];
  if (location) {
    filter.location = location.toLowerCase() === 'other'
      ? { $nin: ['Gandu', 'Maraba', 'Mararaba', 'Gimare', 'Bukan Kota', 'Bukan Koto', 'Akunza', 'Tudun Kauri'] }
      : { $regex: location, $options: 'i' };
  }
  const roomFilter = { isActive: true, status: 'available' };
  if (type) roomFilter.type = type;
  const validToiletFilter = ['private', 'shared', 'none', 'unknown'].includes(toilet) ? toilet : null;
  if (validToiletFilter) roomFilter.toilet = validToiletFilter;
  let singleUnitPriceFilter;
  if (priceRange) {
    const [minPrice, maxPrice] = priceRange.split('-').map(Number);
    const roomPriceFilter = {};
    if (!isNaN(minPrice)) roomPriceFilter.$gte = minPrice;
    if (!isNaN(maxPrice)) roomPriceFilter.$lte = maxPrice;
    if (Object.keys(roomPriceFilter).length) {
      roomFilter.price = roomPriceFilter;
      singleUnitPriceFilter = { ...roomPriceFilter };
    }
  }
  if (type || validToiletFilter || roomFilter.price) {
    const matchingRoomPropertyIds = await Room.distinct('propertyId', roomFilter);
    const propertyAlternatives = [{
      managementMode: 'multi_room',
      isUnavailable: { $ne: true },
      availabilityStatus: { $ne: 'not_available' },
      _id: { $in: matchingRoomPropertyIds }
    }];
    if (!validToiletFilter) {
      propertyAlternatives.unshift({
        managementMode: { $ne: 'multi_room' },
        ...(type ? { type } : {}),
        ...(singleUnitPriceFilter ? { price: singleUnitPriceFilter } : {})
      });
    }
    filter.$and = [...(filter.$and || []), { $or: propertyAlternatives }];
  }

  const properties = await Property.find(filter)
    .select('-adminContact')
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(Number(limit));
  const total = await Property.countDocuments(filter);
  const multiRoomProperties = properties.filter((property) => property.managementMode === 'multi_room');
  const summaries = multiRoomProperties.length ? await Room.aggregate([
    { $match: { propertyId: { $in: multiRoomProperties.map((property) => property._id) } } },
    {
      $group: {
        _id: '$propertyId',
        activeRoomCount: { $sum: { $cond: [{ $eq: ['$isActive', true] }, 1, 0] } },
        availableRoomCount: { $sum: { $cond: [{ $and: [{ $eq: ['$isActive', true] }, { $eq: ['$status', 'available'] }] }, 1, 0] } },
        reservedRoomCount: { $sum: { $cond: [{ $and: [{ $eq: ['$isActive', true] }, { $eq: ['$status', 'reserved'] }] }, 1, 0] } },
        occupiedRoomCount: { $sum: { $cond: [{ $and: [{ $eq: ['$isActive', true] }, { $eq: ['$status', 'occupied'] }] }, 1, 0] } },
        unavailableRoomCount: { $sum: { $cond: [{ $and: [{ $eq: ['$isActive', true] }, { $eq: ['$status', 'unavailable'] }] }, 1, 0] } },
        minimumAvailablePrice: { $min: { $cond: [{ $and: [{ $eq: ['$isActive', true] }, { $eq: ['$status', 'available'] }] }, '$price', null] } },
        maximumAvailablePrice: { $max: { $cond: [{ $and: [{ $eq: ['$isActive', true] }, { $eq: ['$status', 'available'] }] }, '$price', null] } }
      }
    }
  ]) : [];
  const summaryByProperty = new Map(summaries.map((summary) => [summary._id.toString(), summary]));
  const propertiesWithRoomSummary = properties.map((property) => {
    const serialized = typeof property.toObject === 'function' ? property.toObject() : { ...property };
    if (serialized.managementMode === 'multi_room') {
      const summary = summaryByProperty.get(serialized._id.toString());
      serialized.roomSummary = summary ? {
        activeRoomCount: summary.activeRoomCount,
        availableRoomCount: summary.availableRoomCount,
        reservedRoomCount: summary.reservedRoomCount,
        occupiedRoomCount: summary.occupiedRoomCount,
        unavailableRoomCount: summary.unavailableRoomCount,
        minimumAvailablePrice: summary.minimumAvailablePrice,
        maximumAvailablePrice: summary.maximumAvailablePrice
      } : {
        activeRoomCount: 0,
        availableRoomCount: 0,
        reservedRoomCount: 0,
        occupiedRoomCount: 0,
        unavailableRoomCount: 0,
        minimumAvailablePrice: null,
        maximumAvailablePrice: null
      };
      if (serialized.isUnavailable || serialized.availabilityStatus === 'not_available') {
        serialized.roomSummary.availableRoomCount = 0;
        serialized.roomSummary.minimumAvailablePrice = null;
        serialized.roomSummary.maximumAvailablePrice = null;
      }
    }
    return serialized;
  });
  res.json({ data: { properties: propertiesWithRoomSummary, total, page: Number(page), limit: Number(limit) } });
};

export const getProperty = async (req, res) => {
  const property = await Property.findById(req.params.id).populate('agentId', 'name email');
  if (!property) return res.status(404).json({ message: 'Property not found' });
  if (property.isDeleted && req.user?.role !== 'admin') return res.status(404).json({ message: 'Property not found' });
  const isPropertyManager = req.user?.role === 'admin'
    || (req.user?.role === 'agent' && (property.agentId?._id || property.agentId)?.toString() === req.user._id.toString());
  if (!isPropertyManager && property.approvalStatus !== 'approved') {
    return res.status(404).json({ message: 'Property not found' });
  }
  if (!isPropertyManager && property.visibleUntil && property.visibleUntil <= new Date()) {
    return res.status(404).json({ message: 'Property not found' });
  }
  if (req.user?.role === 'student') {
    await updateRecommendationData({ userId: req.user._id, viewedProperty: property._id, location: property.location, minPrice: property.price, maxPrice: property.price });
  }
  if (req.user?.role === 'admin' && !assertAdminPropertyAccess(req.user, property)) {
    return res.status(403).json({ message: adminAccessMessage });
  }
  const agentId = property.agentId?._id || property.agentId;
  const canViewPrivateContact = req.user?.role === 'admin'
    || (req.user?.role === 'agent' && agentId?.toString() === req.user._id.toString());
  const data = typeof property.toObject === 'function' ? property.toObject() : { ...property };
  if (!canViewPrivateContact) {
    delete data.adminContact;
    if (data.agentId && typeof data.agentId === 'object') {
      data.agentId = { ...data.agentId };
      for (const field of ['email', 'phone', 'contactPhone', 'whatsapp', 'mobile']) {
        delete data.agentId[field];
      }
    }
  }
  res.json({ data });
};

export const createProperty = async (req, res) => {
  const {
    title,
    description,
    location,
    customLocation,
    type,
    price,
    inspectionFee: submittedInspectionFee,
    visibleUntil,
    contactPhone: submittedContactPhone
  } = req.body;
  const isAdministrator = req.user.role === 'admin';
  const isSuperAdministrator = isSuperAdmin(req.user);
  const managementMode = req.body.managementMode || 'single_unit';
  const buildingFacilities = parseBuildingFacilities(req.body.buildingFacilities);
  const addressDirections = String(req.body.addressDirections || '').trim();
  if (!['single_unit', 'multi_room'].includes(managementMode)) {
    return res.status(400).json({ message: 'Select a valid property management mode.' });
  }
  if (buildingFacilities === null || buildingFacilities.some((item) => item.length > 80)) {
    return res.status(400).json({ message: 'Enter valid building facilities of no more than 80 characters each.' });
  }
  if (addressDirections.length > 1000) {
    return res.status(400).json({ message: 'Property directions cannot exceed 1000 characters.' });
  }
  if (isAdministrator && !isSuperAdministrator) {
    return res.status(403).json({ message: 'Only a Super Admin can create administrator-managed property listings.' });
  }
  const savedLocation = normalizePropertyLocation({ location, customLocation });
  if (!title || !description || !savedLocation || !type || price === undefined || price === null || String(price).trim() === '') {
    return res.status(400).json({ message: 'Property title, description, location, type and price are required' });
  }
  const commissionEstimate = calculatePropertyCommission(price);
  if (!commissionEstimate) {
    return res.status(400).json({ message: 'Please enter a valid property price of 0 or more.' });
  }
  const hasInspectionFee = submittedInspectionFee !== undefined
    && submittedInspectionFee !== null
    && String(submittedInspectionFee).trim() !== '';
  const inspectionFee = hasInspectionFee ? parseInspectionFee(submittedInspectionFee) : null;
  if (hasInspectionFee && inspectionFee === null) {
    return res.status(400).json({ message: 'Please enter a valid inspection fee of 0 or more.' });
  }
  const contactPhone = String(submittedContactPhone || '').trim();
  if (isSuperAdministrator && !contactPhone) {
    return res.status(400).json({ message: 'A private WhatsApp / Phone Number is required for administrator-created properties.' });
  }
  if (contactPhone && !normalizeNigerianPhoneNumber(contactPhone)) {
    return res.status(400).json({ message: 'Enter a valid Nigerian phone number, such as 08123456789 or +2348123456789.' });
  }
  const hasVisibleUntil = visibleUntil !== undefined && visibleUntil !== null && String(visibleUntil).trim() !== '';
  const parsedVisibleUntil = hasVisibleUntil ? new Date(visibleUntil) : null;
  if (hasVisibleUntil && Number.isNaN(parsedVisibleUntil.getTime())) {
    return res.status(400).json({ message: 'Please enter a valid visibility expiration date.' });
  }
  const locationCategory = String(location).trim().toLowerCase() === 'other'
    ? 'Other'
    : savedLocation;
  if (req.user.role === 'admin' && !assertAdminPropertyAccess(req.user, { location: savedLocation, locationCategory })) {
    return res.status(403).json({ message: adminAccessMessage });
  }
  if (String(location).trim().toLowerCase() === 'other' && !String(customLocation || '').trim()) {
    return res.status(400).json({ message: 'Please enter the location.' });
  }
  const availabilityStatus = req.body.availabilityStatus || 'available';
  if (!['available', 'not_available'].includes(availabilityStatus)) {
    return res.status(400).json({ message: 'Please select a valid property availability status.' });
  }
  let initialRooms = req.body.initialRooms;
  if (typeof initialRooms === 'string') {
    try {
      initialRooms = JSON.parse(initialRooms);
    } catch {
      return res.status(400).json({ message: 'Enter valid initial room information.' });
    }
  }
  if (managementMode === 'multi_room') {
    if (!Array.isArray(initialRooms) || initialRooms.length < 1 || initialRooms.length > 100) {
      return res.status(400).json({ message: 'A multi-room property must include between 1 and 100 valid initial rooms.' });
    }
    const invalidRoom = initialRooms.map(validateRoomInput).find(Boolean);
    if (invalidRoom) return res.status(400).json({ message: invalidRoom });
    const labels = initialRooms.map((room) => String(room.roomNumber).trim().toUpperCase());
    if (new Set(labels).size !== labels.length) {
      return res.status(409).json({ message: 'Initial room labels must be unique within this property.' });
    }
  }

  const imageFiles = req.files?.images || [];
  const videoFiles = req.files?.videos || [];
  if (imageFiles.length > PROPERTY_MEDIA_LIMITS.images || videoFiles.length > PROPERTY_MEDIA_LIMITS.videos) {
    return res.status(400).json({ message: 'The selected media exceeds the per-request image or video limit.' });
  }
  const imageOrder = resolvePropertyMediaOrder(req.body.imageOrder, 0, imageFiles.length);
  const videoOrder = resolvePropertyMediaOrder(req.body.videoOrder, 0, videoFiles.length);
  if (!imageOrder || !videoOrder) {
    return res.status(400).json({ message: 'The selected media order is invalid. Please review the media selection and try again.' });
  }

  const uploadedImages = await uploadPropertyMediaToCloudinary(imageFiles);
  let uploadedVideos = [];
  try {
    uploadedVideos = await uploadPropertyMediaToCloudinary(videoFiles);
  } catch (error) {
    await Promise.all(uploadedImages.map((media) => deleteCloudinaryAsset(media.publicId, media.resourceType)));
    throw error;
  }
  const images = imageOrder.map((entry) => uploadedImages[Number(entry.slice('upload:'.length))]);
  const videos = videoOrder.map((entry) => uploadedVideos[Number(entry.slice('upload:'.length))]);

  if (!images.length && !videos.length) {
    return res.status(400).json({ message: 'Please upload at least one property image or video before listing this property.' });
  }

  let property;
  let initialRoomIds = [];
  try {
    property = await Property.create({
      title,
      description,
      location: savedLocation,
      locationCategory,
      type,
      price: commissionEstimate.propertyPrice,
      managementMode,
      addressDirections,
      buildingFacilities,
      inspectionFee,
      images,
      videos,
      ownerType: isSuperAdministrator ? 'admin' : 'agent',
      ...(isSuperAdministrator ? {} : { agentId: req.user._id }),
      createdBy: req.user._id,
      createdByRole: req.user.role,
      approvalStatus: isSuperAdministrator ? 'approved' : 'pending',
      ...(isSuperAdministrator ? { approvedBy: req.user._id, approvedAt: new Date() } : {}),
      availabilityStatus,
      isUnavailable: availabilityStatus === 'not_available',
      ...(availabilityStatus === 'not_available' ? { availabilityReason: 'admin_disabled' } : {}),
      visibleUntil: parsedVisibleUntil,
      adminContact: {
        contactPhone
      }
    });
    if (managementMode === 'multi_room') {
      const roomDocuments = initialRooms.map((room) => {
        const status = room.status || 'available';
        return {
          propertyId: property._id,
          roomNumber: String(room.roomNumber).trim().toUpperCase(),
          title: String(room.title || '').trim(),
          description: String(room.description || '').trim(),
          type: room.type,
          price: Number(room.price),
          billingPeriod: room.billingPeriod || 'yearly',
          status,
          statusReason: String(room.statusReason || '').trim(),
          toilet: room.toilet || 'unknown',
          shower: room.shower || 'unknown',
          kitchen: room.kitchen || 'unknown',
          waterSource: room.waterSource || 'unknown',
          waterAvailable: room.waterAvailable ?? null,
          electricity: room.electricity ?? null,
          facilities: (room.facilities || []).map((item) => String(item).trim()).filter(Boolean),
          floorSection: String(room.floorSection || '').trim(),
          statusHistory: [{ to: status, reason: String(room.statusReason || '').trim(), changedBy: req.user._id }]
        };
      });
      initialRoomIds = roomDocuments.map(() => new mongoose.Types.ObjectId());
      roomDocuments.forEach((room, index) => { room._id = initialRoomIds[index]; });
      await Room.insertMany(roomDocuments, { ordered: true });
    }
  } catch (error) {
    if (property) {
      if (initialRoomIds.length) await Room.deleteMany({ _id: { $in: initialRoomIds } });
      await Property.deleteOne({ _id: property._id });
    }
    await Promise.all([...images, ...videos].map((media) => (
      deleteCloudinaryAsset(media.publicId, media.resourceType)
    )));
    throw error;
  }
  if (isSuperAdministrator) {
    await recordAdminActivity(req.user, 'property_created', `Property ${property.title} was created by a Super Admin.`, {
      propertyId: property._id,
      propertyLocation: property.location
    });
    await recordAdminActivity(req.user, 'property_approved', `Property ${property.title} was approved on creation by a Super Admin.`, {
      propertyId: property._id,
      propertyLocation: property.location
    });
  }
  const serializedProperty = typeof property.toObject === 'function' ? property.toObject() : property;
  const data = req.user.role === 'agent'
    ? { ...serializedProperty, commissionEstimate }
    : property;
  res.status(201).json({ message: 'Property created successfully', data });
};

export const updateProperty = async (req, res) => {
  const property = await Property.findById(req.params.id);
  if (!property) return res.status(404).json({ message: 'Property not found' });
  if (property.isDeleted) return res.status(409).json({ message: 'Deleted properties must be restored before they can be edited' });
  if (req.user.role !== 'admin' && property.agentId?.toString() !== req.user._id.toString()) {
    return res.status(403).json({ message: 'Unauthorized to edit this property' });
  }
  if (req.user.role === 'admin' && !assertAdminPropertyAccess(req.user, property)) {
    return res.status(403).json({ message: adminAccessMessage });
  }

  const editableFields = [
    'title', 'description', 'location', 'type', 'price', 'visibleUntil',
    'managementMode', 'addressDirections', 'buildingFacilities'
  ];
  const updates = { approvalStatus: req.user.role === 'admin' && isSuperAdmin(req.user) ? property.approvalStatus : 'pending' };
  const changes = [];
  let commissionEstimate;
  if (req.body.price !== undefined) {
    commissionEstimate = calculatePropertyCommission(req.body.price);
    if (!commissionEstimate) {
      return res.status(400).json({ message: 'Please enter a valid property price of 0 or more.' });
    }
  }
  if (req.body.visibleUntil !== undefined
    && req.body.visibleUntil !== null
    && String(req.body.visibleUntil).trim() !== ''
    && Number.isNaN(new Date(req.body.visibleUntil).getTime())) {
    return res.status(400).json({ message: 'Please enter a valid visibility expiration date.' });
  }
  if (req.body.contactPhone !== undefined) {
    const contactPhone = String(req.body.contactPhone || '').trim();
    if (contactPhone && !normalizeNigerianPhoneNumber(contactPhone)) {
      return res.status(400).json({ message: 'Enter a valid Nigerian phone number, such as 08123456789 or +2348123456789.' });
    }
  }
  if (req.body.inspectionFee !== undefined) {
    const submittedInspectionFee = req.body.inspectionFee;
    const hasInspectionFee = submittedInspectionFee !== null
      && String(submittedInspectionFee).trim() !== '';
    const inspectionFee = hasInspectionFee ? parseInspectionFee(submittedInspectionFee) : null;
    if (hasInspectionFee && inspectionFee === null) {
      return res.status(400).json({ message: 'Please enter a valid inspection fee of 0 or more.' });
    }
    if (req.body.availabilityStatus !== undefined) {
      if (!isSuperAdmin(req.user)) {
        return res.status(403).json({ message: 'Only a Super Admin can update property availability.' });
      }
      if (!['available', 'not_available'].includes(req.body.availabilityStatus)) {
        return res.status(400).json({ message: 'Please select a valid property availability status.' });
      }
      const unavailable = req.body.availabilityStatus === 'not_available';
      if (property.availabilityStatus !== req.body.availabilityStatus) {
        changes.push({ field: 'availabilityStatus', oldValue: property.availabilityStatus, newValue: req.body.availabilityStatus });
        updates.availabilityStatus = req.body.availabilityStatus;
      }
      if (property.isUnavailable !== unavailable) {
        changes.push({ field: 'isUnavailable', oldValue: property.isUnavailable, newValue: unavailable });
        updates.isUnavailable = unavailable;
      }
      const reason = unavailable ? 'admin_disabled' : undefined;
      if (property.availabilityReason !== reason) {
        changes.push({ field: 'availabilityReason', oldValue: property.availabilityReason, newValue: reason });
        updates.availabilityReason = reason;
      }
    }
    const oldValue = property.inspectionFee ?? null;
    if (oldValue !== inspectionFee) {
      changes.push({ field: 'inspectionFee', oldValue, newValue: inspectionFee });
      updates.inspectionFee = inspectionFee;
    }
  }
  if (req.body.location !== undefined && String(req.body.location).trim().toLowerCase() === 'other' && !String(req.body.customLocation || '').trim()) {
    return res.status(400).json({ message: 'Please enter the location.' });
  }
  if (req.body.location !== undefined && !normalizePropertyLocation({ location: req.body.location, customLocation: req.body.customLocation })) {
    return res.status(400).json({ message: 'Please select a valid location.' });
  }
  if (req.body.managementMode !== undefined) {
    if (!['single_unit', 'multi_room'].includes(req.body.managementMode)) {
      return res.status(400).json({ message: 'Select a valid property management mode.' });
    }
    if (req.body.managementMode === 'single_unit' && property.managementMode === 'multi_room') {
      const activeRooms = await Room.exists({ propertyId: property._id, isActive: true });
      if (activeRooms) return res.status(409).json({ message: 'Deactivate all rooms before changing this building to a single-unit listing.' });
    }
  }
  if (req.body.addressDirections !== undefined && String(req.body.addressDirections).trim().length > 1000) {
    return res.status(400).json({ message: 'Property directions cannot exceed 1000 characters.' });
  }
  if (req.body.buildingFacilities !== undefined) {
    const buildingFacilities = parseBuildingFacilities(req.body.buildingFacilities);
    if (buildingFacilities === null || buildingFacilities.some((item) => item.length > 80)) {
      return res.status(400).json({ message: 'Enter valid building facilities of no more than 80 characters each.' });
    }
    req.body.buildingFacilities = buildingFacilities;
  }
  const requestedLocation = req.body.location === undefined
    ? property.location
    : normalizePropertyLocation({ location: req.body.location, customLocation: req.body.customLocation });
  const requestedCategory = req.body.location === undefined
    ? (property.locationCategory || normalizePropertyLocation({ location: property.location }))
    : String(req.body.location).trim().toLowerCase() === 'other' ? 'Other' : requestedLocation;
  if (req.user.role === 'admin' && !assertAdminPropertyAccess(req.user, { location: requestedLocation, locationCategory: requestedCategory })) {
    return res.status(403).json({ message: adminAccessMessage });
  }
  if (req.body.location !== undefined) {
    updates.locationCategory = String(req.body.location).trim().toLowerCase() === 'other'
      ? 'Other'
      : normalizePropertyLocation({ location: req.body.location });
  }
  editableFields.forEach((field) => {
    if (req.body[field] === undefined) return;
    const newValue = field === 'visibleUntil'
      ? (req.body[field] ? new Date(req.body[field]) : null)
      : field === 'location'
        ? normalizePropertyLocation({ location: req.body[field], customLocation: req.body.customLocation })
        : field === 'price'
          ? commissionEstimate.propertyPrice
            : field === 'buildingFacilities'
              ? parseBuildingFacilities(req.body[field])
          : req.body[field];
    if (field === 'location' && !newValue) return;
    const oldValue = property[field];
    if (String(oldValue ?? '') !== String(newValue ?? '')) {
      changes.push({ field, oldValue, newValue });
      updates[field] = newValue;
    }
  });
  const nextContact = { ...(property.adminContact?.toObject?.() || property.adminContact || {}) };
  const submittedContactPhone = req.body.contactPhone;
  if (submittedContactPhone !== undefined) {
    const newValue = String(submittedContactPhone || '').trim();
    const oldValue = getPropertyContactNumber({ adminContact: nextContact });
    if (oldValue !== newValue || nextContact.contactPhone === undefined) {
      changes.push({ field: 'adminContact.contactPhone', oldValue, newValue });
      nextContact.contactPhone = newValue;
      updates.adminContact = nextContact;
    }
  }

  let nextImages = property.images || [];
  let nextVideos = property.videos || [];
  const previousImages = getStoredPropertyMedia(property, 'images');
  const previousVideos = getStoredPropertyMedia(property, 'videos');
  const imageFiles = req.files?.images || [];
  const videoFiles = req.files?.videos || [];
  if (imageFiles.length > PROPERTY_MEDIA_LIMITS.images || videoFiles.length > PROPERTY_MEDIA_LIMITS.videos) {
    return res.status(400).json({ message: 'The selected media exceeds the per-request image or video limit.' });
  }
  const imageOrder = resolvePropertyMediaOrder(req.body.imageOrder, previousImages.length, imageFiles.length);
  const videoOrder = resolvePropertyMediaOrder(req.body.videoOrder, previousVideos.length, videoFiles.length);
  if (!imageOrder || !videoOrder) {
    return res.status(400).json({ message: 'The selected media order is invalid. Please review the media selection and try again.' });
  }

  let uploadedImages = [];
  let uploadedVideos = [];
  try {
    uploadedImages = await uploadPropertyMediaToCloudinary(imageFiles);
    uploadedVideos = await uploadPropertyMediaToCloudinary(videoFiles);
  } catch (error) {
    await Promise.all(uploadedImages.map((media) => deleteCloudinaryAsset(media.publicId, media.resourceType)));
    throw error;
  }
  nextImages = imageOrder.map((entry) => {
    const [source, rawIndex] = entry.split(':');
    return source === 'existing' ? previousImages[Number(rawIndex)] : uploadedImages[Number(rawIndex)];
  });
  nextVideos = videoOrder.map((entry) => {
    const [source, rawIndex] = entry.split(':');
    return source === 'existing' ? previousVideos[Number(rawIndex)] : uploadedVideos[Number(rawIndex)];
  });

  const imageManifestProvided = req.body.imageOrder !== undefined;
  const videoManifestProvided = req.body.videoOrder !== undefined;
  if (imageManifestProvided || imageFiles.length) {
    updates.images = nextImages;
    changes.push({ field: 'images', oldValue: previousImages, newValue: nextImages });
  }
  if (videoManifestProvided || videoFiles.length) {
    updates.videos = nextVideos;
    changes.push({ field: 'videos', oldValue: previousVideos, newValue: nextVideos });
  }
  if (imageManifestProvided || videoManifestProvided) {
    updates.$unset = { image: '', video: '' };
  }

  if (!nextImages.length && !nextVideos.length) {
    return res.status(400).json({ message: 'Please upload at least one property image or video before listing this property.' });
  }

  const updatedProperty = await Property.findByIdAndUpdate(req.params.id, updates, { new: true });
  const retainedPublicIds = new Set(
    [...nextImages, ...nextVideos].map(getCloudinaryPublicId).filter(Boolean)
  );
  const removedMedia = [...previousImages, ...previousVideos].filter((item) => {
    const publicId = getCloudinaryPublicId(item);
    return publicId && !retainedPublicIds.has(publicId);
  });
  const removedPublicIds = new Set();
  for (const item of removedMedia) {
    const publicId = getCloudinaryPublicId(item);
    if (removedPublicIds.has(publicId)) continue;
    removedPublicIds.add(publicId);
    const isReferencedElsewhere = await Property.exists({
      _id: { $ne: property._id },
      $or: [
        { 'images.publicId': publicId },
        { 'images.public_id': publicId },
        { 'videos.publicId': publicId },
        { 'videos.public_id': publicId },
        { 'image.publicId': publicId },
        { 'image.public_id': publicId },
        { 'video.publicId': publicId },
        { 'video.public_id': publicId }
      ]
    });
    const resourceType = item.resourceType || item.resource_type || 'image';
    const managedFolder = resourceType === 'video'
      ? 'fulafia-ams/properties/videos/'
      : 'fulafia-ams/properties/images/';
    if (!isReferencedElsewhere && publicId.startsWith(managedFolder)) {
      await deleteCloudinaryAsset(publicId, resourceType);
    }
  }
  if (changes.length) {
    await PropertyEditHistory.create({
      propertyId: property._id,
      editedBy: req.user._id,
      editorRole: req.user.role,
      changes
    });
    if (req.user.role === 'admin') await recordAdminActivity(req.user, 'property_edited', `Property ${property.title} was edited.`, { propertyId: property._id, propertyLocation: updatedProperty.location });
  }
  const serializedProperty = typeof updatedProperty.toObject === 'function' ? updatedProperty.toObject() : updatedProperty;
  const resultingPrice = commissionEstimate?.propertyPrice ?? updatedProperty.price ?? property.price;
  const estimate = calculatePropertyCommission(resultingPrice);
  const data = req.user.role === 'agent'
    ? { ...serializedProperty, commissionEstimate: estimate }
    : updatedProperty;
  res.json({
    message: req.user.role === 'admin' && isSuperAdmin(req.user)
      ? 'Property updated successfully.'
      : 'Property updated and sent for approval',
    data
  });
};

export const rateProperty = async (req, res) => {
  const { rating, comment } = req.body;
  const property = await Property.findById(req.params.id);
  if (!property) return res.status(404).json({ message: 'Property not found' });

  if (!rating || rating < 1 || rating > 5) {
    return res.status(400).json({ message: 'Rating must be a number between 1 and 5' });
  }

  const hasPaidBooking = await Booking.findOne({
    propertyId: property._id,
    studentId: req.user._id,
    paymentStatus: 'paid'
  });

  if (!hasPaidBooking) {
    return res.status(403).json({ message: 'You can only rate properties you have paid for' });
  }

  const existingRatingIndex = property.ratings.findIndex((item) => item.studentId.toString() === req.user._id.toString());
  const ratingEntry = {
    studentId: req.user._id,
    name: req.user.name,
    rating,
    comment
  };

  if (existingRatingIndex >= 0) {
    property.ratings[existingRatingIndex] = ratingEntry;
  } else {
    property.ratings.push(ratingEntry);
  }

  property.ratingCount = property.ratings.length;
  property.averageRating = property.ratings.reduce((sum, item) => sum + item.rating, 0) / property.ratingCount;
  await property.save();

  const data = typeof property.toObject === 'function' ? property.toObject() : { ...property };
  delete data.adminContact;
  res.json({ message: 'Rating submitted successfully', data });
};

export const deleteProperty = async (req, res) => {
  const property = await Property.findById(req.params.id);
  if (!property) return res.status(404).json({ message: 'Property not found' });
  if (req.user.role !== 'admin' && property.agentId?.toString() !== req.user._id.toString()) {
    return res.status(403).json({ message: 'Unauthorized to delete this property' });
  }
  if (req.user.role === 'admin' && !assertAdminPropertyAccess(req.user, property)) {
    return res.status(403).json({ message: adminAccessMessage });
  }
  if (property.isDeleted) return res.status(409).json({ message: 'Property is already archived' });
  property.isDeleted = true;
  property.deletedAt = new Date();
  property.deletedBy = req.user._id;
  property.deletedByRole = req.user.role;
  property.deleteReason = req.body?.reason?.trim() || 'Property archived by owner';
  await property.save();
  await PropertyEditHistory.create({
    propertyId: property._id,
    editedBy: req.user._id,
    editorRole: req.user.role,
    changes: [
      { field: 'isDeleted', oldValue: false, newValue: true },
      { field: 'deleteReason', oldValue: undefined, newValue: property.deleteReason }
    ]
  });
  if (req.user.role === 'admin') await recordAdminActivity(req.user, 'property_deleted', `Property ${property.title} was deleted.`, { propertyId: property._id, propertyLocation: property.location });
  res.json({ success: true, message: 'Property deleted successfully.', data: property });
};

export const getAgentProperties = async (req, res) => {
  const properties = await Property.find({ agentId: req.user._id, isDeleted: { $ne: true } }).sort({ createdAt: -1 });
  res.json({
    data: properties.map((property) => ({
      ...(typeof property.toObject === 'function' ? property.toObject() : property),
      commissionEstimate: calculatePropertyCommission(property.price)
    }))
  });
};

export const getDeletedProperties = async (req, res) => {
  const properties = await Property.find({ isDeleted: true, ...getAdminPropertyFilter(req.user) })
    .populate('agentId', 'name email')
    .populate('deletedBy', 'name email')
    .sort({ deletedAt: -1 });
  res.json({ data: properties });
};

export const getPropertyHistory = async (req, res, next) => {
  try {
    const property = await Property.findById(req.params.id).populate('agentId', 'name email').populate('deletedBy', 'name email');
    if (!property) return res.status(404).json({ message: 'Property not found' });
    if (req.user.role === 'admin' && !assertAdminPropertyAccess(req.user, property)) {
      return res.status(403).json({ message: adminAccessMessage });
    }
    const [history, bookings, payments] = await Promise.all([
      PropertyEditHistory.find({ propertyId: property._id }).populate('editedBy', 'name email').sort({ editedAt: -1 }),
      Booking.find({ propertyId: property._id }).populate('studentId', 'name email').sort({ createdAt: -1 }),
      Payment.find({ bookingId: { $in: await Booking.find({ propertyId: property._id }).distinct('_id') } }).sort({ createdAt: -1 })
    ]);
    res.json({ data: { property, history, bookings, payments } });
  } catch (error) {
    next(error);
  }
};

export const restoreProperty = async (req, res) => {
  const property = await Property.findById(req.params.id);
  if (!property) return res.status(404).json({ message: 'Property not found' });
  if (!property.isDeleted) return res.status(409).json({ message: 'Property is not archived' });
  if (req.user.role === 'admin' && !assertAdminPropertyAccess(req.user, property)) {
    return res.status(403).json({ message: adminAccessMessage });
  }
  property.isDeleted = false;
  property.deletedAt = undefined;
  property.deletedBy = undefined;
  property.deletedByRole = undefined;
  property.deleteReason = undefined;
  if (property.availabilityReason === 'payment_verified' || property.isUnavailable) {
    property.availabilityStatus = 'not_available';
    property.isUnavailable = true;
  } else {
    property.availabilityStatus = 'available';
    property.isUnavailable = false;
    property.availabilityReason = undefined;
  }
  await property.save();
  if (req.user.role === 'admin') await recordAdminActivity(req.user, 'property_restored', `Property ${property.title} was restored.`, { propertyId: property._id, propertyLocation: property.location });
  res.json({ success: true, message: 'Property restored successfully.', data: property });
};
