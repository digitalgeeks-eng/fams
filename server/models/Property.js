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
  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Date },
  deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  deletedByRole: { type: String, enum: ['agent', 'admin'] },
  deleteReason: { type: String, trim: true, maxlength: 500 },
  visibleUntil: { type: Date },
  averageRating: { type: Number, default: 0 },
  ratingCount: { type: Number, default: 0 },
  ratings: [propertyRatingSchema],
  createdAt: { type: Date, default: Date.now }
});

propertySchema.pre('validate', function (next) {
  const hasMedia = Array.isArray(this.images) && this.images.length > 0
    || Array.isArray(this.videos) && this.videos.length > 0;

  if (!hasMedia) {
    return next(new Error('Please upload at least one property image or video before listing this property.'));
  }

  next();
});

export default mongoose.model('Property', propertySchema);
