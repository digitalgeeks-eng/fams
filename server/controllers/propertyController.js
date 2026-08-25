import Property from '../models/Property.js';
import Booking from '../models/Booking.js';
import Payment from '../models/Payment.js';
import PropertyEditHistory from '../models/PropertyEditHistory.js';
import { updateRecommendationData } from '../services/recommendationService.js';
import { deleteCloudinaryAsset, uploadBufferToCloudinary } from '../services/cloudinaryService.js';
import { normalizePropertyLocation } from '../utils/locations.js';

const uploadPropertyMediaToCloudinary = async (files = []) => Promise.all(files.map(async (file) => {
  const resourceType = file.mimetype.startsWith('video/') ? 'video' : 'image';
  const result = await uploadBufferToCloudinary(file.buffer, {
    folder: resourceType === 'video' ? 'fulafia-ams/properties/videos' : 'fulafia-ams/properties/images',
    resourceType
  });
  return { url: result.secure_url, publicId: result.public_id, resourceType };
}));

const deleteCloudinaryMedia = async (media = []) => {
  await Promise.all(media.map((item) => {
    if (!item || typeof item !== 'object' || !item.publicId) return null;
    return deleteCloudinaryAsset(item.publicId, item.resourceType || 'image');
  }));
};

export const listProperties = async (req, res) => {
  const { search, location, type, priceRange, page = 1, limit = 12 } = req.query;
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
  if (type) filter.type = type;
  if (priceRange) {
    const [minPrice, maxPrice] = priceRange.split('-').map(Number);
    if (!isNaN(minPrice)) filter.price = { ...filter.price, $gte: minPrice };
    if (!isNaN(maxPrice)) filter.price = { ...filter.price, $lte: maxPrice };
  }

  const properties = await Property.find(filter)
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(Number(limit));
  const total = await Property.countDocuments(filter);
  res.json({ data: { properties, total, page: Number(page), limit: Number(limit) } });
};

export const getProperty = async (req, res) => {
  const property = await Property.findById(req.params.id).populate('agentId', 'name email');
  if (!property) return res.status(404).json({ message: 'Property not found' });
  if (property.isDeleted && req.user?.role !== 'admin') return res.status(404).json({ message: 'Property not found' });
  if (req.user?.role === 'student' && (property.visibleUntil && property.visibleUntil <= new Date())) {
    return res.status(404).json({ message: 'Property not found' });
  }
  if (req.user?.role === 'student') {
    await updateRecommendationData({ userId: req.user._id, viewedProperty: property._id, location: property.location, minPrice: property.price, maxPrice: property.price });
  }
  res.json({ data: property });
};

export const createProperty = async (req, res) => {
  const {
    title,
    description,
    location,
    customLocation,
    type,
    price,
    visibleUntil,
    adminContactName,
    adminContactEmail,
    adminContactPhone,
    adminContactWhatsapp,
    adminContactFacebook,
    adminContactInstagram,
    adminContactTwitter,
    adminContactLinkedin
  } = req.body;
  const savedLocation = normalizePropertyLocation({ location, customLocation });
  if (!title || !description || !savedLocation || !type || !price) {
    return res.status(400).json({ message: 'Property title, description, location, type and price are required' });
  }
  if (String(location).trim().toLowerCase() === 'other' && !String(customLocation || '').trim()) {
    return res.status(400).json({ message: 'Please enter the location.' });
  }

  const images = await uploadPropertyMediaToCloudinary(req.files?.images);
  const videos = await uploadPropertyMediaToCloudinary(req.files?.videos);

  if (!images.length && !videos.length) {
    return res.status(400).json({ message: 'Please upload at least one property image or video before listing this property.' });
  }

  const property = await Property.create({
    title,
    description,
    location: savedLocation,
    type,
    price,
    images,
    videos,
    availabilityStatus: 'available',
    visibleUntil: visibleUntil ? new Date(visibleUntil) : null,
    agentId: req.user._id,
    adminContact: {
      name: adminContactName || '',
      email: adminContactEmail || '',
      phone: adminContactPhone || '',
      whatsapp: adminContactWhatsapp || '',
      facebook: adminContactFacebook || '',
      instagram: adminContactInstagram || '',
      twitter: adminContactTwitter || '',
      linkedin: adminContactLinkedin || ''
    }
  });
  res.status(201).json({ message: 'Property created successfully', data: property });
};

export const updateProperty = async (req, res) => {
  const property = await Property.findById(req.params.id);
  if (!property) return res.status(404).json({ message: 'Property not found' });
  if (property.isDeleted) return res.status(409).json({ message: 'Deleted properties must be restored before they can be edited' });
  if (req.user.role !== 'admin' && property.agentId.toString() !== req.user._id.toString()) {
    return res.status(403).json({ message: 'Unauthorized to edit this property' });
  }

  const editableFields = ['title', 'description', 'location', 'type', 'price', 'visibleUntil'];
  const updates = { approvalStatus: 'pending' };
  const changes = [];
  if (req.body.location !== undefined && String(req.body.location).trim().toLowerCase() === 'other' && !String(req.body.customLocation || '').trim()) {
    return res.status(400).json({ message: 'Please enter the location.' });
  }
  if (req.body.location !== undefined && !normalizePropertyLocation({ location: req.body.location, customLocation: req.body.customLocation })) {
    return res.status(400).json({ message: 'Please select a valid location.' });
  }
  editableFields.forEach((field) => {
    if (req.body[field] === undefined) return;
    const newValue = field === 'visibleUntil'
      ? (req.body[field] ? new Date(req.body[field]) : undefined)
      : field === 'location'
        ? normalizePropertyLocation({ location: req.body[field], customLocation: req.body.customLocation })
        : req.body[field];
    if (field === 'location' && !newValue) return;
    const oldValue = property[field];
    if (String(oldValue ?? '') !== String(newValue ?? '')) {
      changes.push({ field, oldValue, newValue });
      updates[field] = newValue;
    }
  });
  const contactFields = {
    name: 'adminContactName', email: 'adminContactEmail', phone: 'adminContactPhone',
    whatsapp: 'adminContactWhatsapp', facebook: 'adminContactFacebook',
    instagram: 'adminContactInstagram', twitter: 'adminContactTwitter', linkedin: 'adminContactLinkedin'
  };
  const nextContact = { ...property.adminContact?.toObject?.(), ...property.adminContact?.toObject?.() };
  Object.entries(contactFields).forEach(([field, requestField]) => {
    if (req.body[requestField] === undefined) return;
    const newValue = req.body[requestField] || '';
    if ((property.adminContact?.[field] || '') !== newValue) {
      changes.push({ field: `adminContact.${field}`, oldValue: property.adminContact?.[field] || '', newValue });
      nextContact[field] = newValue;
    }
  });
  if (Object.keys(nextContact).length) updates.adminContact = nextContact;

  let nextImages = property.images || [];
  let nextVideos = property.videos || [];

  if (req.files) {
    if (req.files.images?.length) {
      nextImages = await uploadPropertyMediaToCloudinary(req.files.images);
      updates.images = nextImages;
      changes.push({ field: 'images', oldValue: property.images, newValue: nextImages });
    }
    if (req.files.videos?.length) {
      nextVideos = await uploadPropertyMediaToCloudinary(req.files.videos);
      updates.videos = nextVideos;
      changes.push({ field: 'videos', oldValue: property.videos, newValue: nextVideos });
    }
  }

  if (!nextImages.length && !nextVideos.length) {
    return res.status(400).json({ message: 'Please upload at least one property image or video before listing this property.' });
  }

  const updatedProperty = await Property.findByIdAndUpdate(req.params.id, updates, { new: true });
  if (req.files?.images?.length) await deleteCloudinaryMedia(property.images);
  if (req.files?.videos?.length) await deleteCloudinaryMedia(property.videos);
  if (changes.length) {
    await PropertyEditHistory.create({
      propertyId: property._id,
      editedBy: req.user._id,
      editorRole: req.user.role,
      changes
    });
  }
  res.json({ message: 'Property updated and sent for approval', data: updatedProperty });
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

  res.json({ message: 'Rating submitted successfully', data: property });
};

export const deleteProperty = async (req, res) => {
  const property = await Property.findById(req.params.id);
  if (!property) return res.status(404).json({ message: 'Property not found' });
  if (req.user.role !== 'admin' && property.agentId.toString() !== req.user._id.toString()) {
    return res.status(403).json({ message: 'Unauthorized to delete this property' });
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
  res.json({ success: true, message: 'Property deleted successfully.', data: property });
};

export const getAgentProperties = async (req, res) => {
  const properties = await Property.find({ agentId: req.user._id, isDeleted: { $ne: true } }).sort({ createdAt: -1 });
  res.json({ data: properties });
};

export const getDeletedProperties = async (req, res) => {
  const properties = await Property.find({ isDeleted: true })
    .populate('agentId', 'name email')
    .populate('deletedBy', 'name email')
    .sort({ deletedAt: -1 });
  res.json({ data: properties });
};

export const getPropertyHistory = async (req, res, next) => {
  try {
    const property = await Property.findById(req.params.id).populate('agentId', 'name email').populate('deletedBy', 'name email');
    if (!property) return res.status(404).json({ message: 'Property not found' });
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
  res.json({ success: true, message: 'Property restored successfully.', data: property });
};
