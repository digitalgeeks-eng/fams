import Property from '../models/Property.js';
import Booking from '../models/Booking.js';
import { updateRecommendationData } from '../services/recommendationService.js';
import { deleteCloudinaryAsset, uploadBufferToCloudinary } from '../services/cloudinaryService.js';

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
    $or: [
      { visibleUntil: { $exists: false } },
      { visibleUntil: null },
      { visibleUntil: '' },
      { visibleUntil: { $gt: new Date() } }
    ]
  };
  if (search) filter.title = { $regex: search, $options: 'i' };
  if (location) filter.location = { $regex: location, $options: 'i' };
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
  if (!title || !description || !location || !type || !price) {
    return res.status(400).json({ message: 'Property title, description, location, type and price are required' });
  }
  const images = await uploadPropertyMediaToCloudinary(req.files?.images);
  const videos = await uploadPropertyMediaToCloudinary(req.files?.videos);
  const property = await Property.create({
    title,
    description,
    location,
    type,
    price,
    images,
    videos,
    availabilityStatus: 'not_available',
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
  if (req.user.role !== 'admin' && property.agentId.toString() !== req.user._id.toString()) {
    return res.status(403).json({ message: 'Unauthorized to edit this property' });
  }

  const updates = {
    title: req.body.title || property.title,
    description: req.body.description || property.description,
    location: req.body.location || property.location,
    type: req.body.type || property.type,
    price: req.body.price || property.price,
    visibleUntil: req.body.visibleUntil ? new Date(req.body.visibleUntil) : property.visibleUntil,
    approvalStatus: 'pending',
    adminContact: {
      name: req.body.adminContactName || property.adminContact?.name || '',
      email: req.body.adminContactEmail || property.adminContact?.email || '',
      phone: req.body.adminContactPhone || property.adminContact?.phone || '',
      whatsapp: req.body.adminContactWhatsapp || property.adminContact?.whatsapp || '',
      facebook: req.body.adminContactFacebook || property.adminContact?.facebook || '',
      instagram: req.body.adminContactInstagram || property.adminContact?.instagram || '',
      twitter: req.body.adminContactTwitter || property.adminContact?.twitter || '',
      linkedin: req.body.adminContactLinkedin || property.adminContact?.linkedin || ''
    }
  };
  if (req.files) {
    if (req.files.images?.length) {
      updates.images = await uploadPropertyMediaToCloudinary(req.files.images);
    }
    if (req.files.videos?.length) {
      updates.videos = await uploadPropertyMediaToCloudinary(req.files.videos);
    }
  }

  const updatedProperty = await Property.findByIdAndUpdate(req.params.id, updates, { new: true });
  if (req.files?.images?.length) await deleteCloudinaryMedia(property.images);
  if (req.files?.videos?.length) await deleteCloudinaryMedia(property.videos);
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
  await deleteCloudinaryMedia([...property.images, ...property.videos]);
  await property.remove();
  res.json({ message: 'Property deleted successfully' });
};

export const getAgentProperties = async (req, res) => {
  const properties = await Property.find({ agentId: req.user._id }).sort({ createdAt: -1 });
  res.json({ data: properties });
};
