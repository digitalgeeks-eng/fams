import mongoose from 'mongoose';

const roomInspectionRequestSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  propertyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Property', required: true, index: true },
  roomId: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', index: true },
  bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', index: true },
  activeBookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking' },
  message: { type: String, trim: true, maxlength: 1000 },
  status: { type: String, enum: ['pending', 'accepted', 'declined', 'cancelled', 'completed'], default: 'pending', index: true },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reviewedAt: { type: Date },
  responseNote: { type: String, trim: true, maxlength: 1000 }
}, { timestamps: true });

roomInspectionRequestSchema.index({ roomId: 1, studentId: 1, status: 1 });
roomInspectionRequestSchema.index(
  { roomId: 1, studentId: 1 },
  { unique: true, partialFilterExpression: { roomId: { $exists: true }, status: 'pending' } }
);
roomInspectionRequestSchema.index(
  { activeBookingId: 1 },
  { unique: true, partialFilterExpression: { activeBookingId: { $exists: true } } }
);

export default mongoose.model('RoomInspectionRequest', roomInspectionRequestSchema);
