import mongoose from 'mongoose';

const roomStatusHistorySchema = new mongoose.Schema({
  from: { type: String, enum: ['available', 'reserved', 'occupied', 'unavailable'] },
  to: { type: String, enum: ['available', 'reserved', 'occupied', 'unavailable'], required: true },
  reason: { type: String, trim: true, maxlength: 500 },
  changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  changedAt: { type: Date, default: Date.now }
}, { _id: false });

const roomSchema = new mongoose.Schema({
  propertyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Property', required: true, index: true },
  roomNumber: { type: String, required: true, trim: true, uppercase: true, maxlength: 40 },
  title: { type: String, trim: true, maxlength: 120 },
  description: { type: String, trim: true, maxlength: 2000 },
  type: { type: String, enum: ['Single Room', 'Self-Contain', 'Room and Parlour', 'Mini Flat', 'Other'], required: true },
  price: { type: Number, required: true, min: 0, validate: Number.isFinite },
  billingPeriod: { type: String, enum: ['yearly', 'monthly', 'weekly', 'daily'], default: 'yearly' },
  status: { type: String, enum: ['available', 'reserved', 'occupied', 'unavailable'], default: 'available', index: true },
  statusReason: { type: String, trim: true, maxlength: 500 },
  toilet: { type: String, enum: ['private', 'shared', 'none', 'unknown'], default: 'unknown' },
  shower: { type: String, enum: ['private', 'shared', 'none', 'unknown'], default: 'unknown' },
  kitchen: { type: String, enum: ['private', 'shared', 'none', 'unknown'], default: 'unknown' },
  waterSource: { type: String, enum: ['tap', 'borehole', 'well', 'other', 'unavailable', 'unknown'], default: 'unknown' },
  waterAvailable: { type: Boolean, default: null },
  electricity: { type: Boolean, default: null },
  facilities: [{ type: String, trim: true, maxlength: 80 }],
  floorSection: { type: String, trim: true, maxlength: 80 },
  images: [{ type: mongoose.Schema.Types.Mixed }],
  videos: [{ type: mongoose.Schema.Types.Mixed }],
  isActive: { type: Boolean, default: true, index: true },
  statusHistory: { type: [roomStatusHistorySchema], default: [] }
}, { timestamps: true });

roomSchema.index({ propertyId: 1, roomNumber: 1 }, { unique: true });
roomSchema.index({ propertyId: 1, status: 1, price: 1, isActive: 1 });

export default mongoose.model('Room', roomSchema);
