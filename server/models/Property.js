import mongoose from 'mongoose';

const propertyRatingSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true },
  rating: { type: Number, required: true, min: 1, max: 5 },
  comment: { type: String, trim: true },
  createdAt: { type: Date, default: Date.now }
}, { _id: false });

const propertySchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  description: { type: String, required: true, trim: true },
  location: { type: String, required: true, trim: true },
  type: { type: String, enum: ['Single Room', 'Self-Contain', 'Room and Parlour', 'Mini Flat'], required: true },
  price: { type: Number, required: true },
  images: [{ type: mongoose.Schema.Types.Mixed }],
  videos: [{ type: mongoose.Schema.Types.Mixed }],
  agentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  adminContact: {
    name: { type: String, trim: true },
    email: { type: String, trim: true },
    phone: { type: String, trim: true },
    whatsapp: { type: String, trim: true },
    facebook: { type: String, trim: true },
    instagram: { type: String, trim: true },
    twitter: { type: String, trim: true },
    linkedin: { type: String, trim: true }
  },
  approvalStatus: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  isUnavailable: { type: Boolean, default: false },
  availabilityStatus: { type: String, enum: ['available', 'not_available'], default: 'available' },
  availabilityReason: { type: String, enum: ['payment_verified', 'admin_disabled', 'other'] },
  visibleUntil: { type: Date },
  averageRating: { type: Number, default: 0 },
  ratingCount: { type: Number, default: 0 },
  ratings: [propertyRatingSchema],
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model('Property', propertySchema);
