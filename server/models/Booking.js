import mongoose from 'mongoose';

const bookingSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  propertyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Property', required: true },
  bookingStatus: { type: String, enum: ['pending', 'confirmed', 'cancelled', 'completed'], default: 'pending' },
  paymentStatus: { type: String, enum: ['pending', 'paid', 'failed'], default: 'pending' },
  transactionReference: { type: String },
  successfulPayment: { type: Boolean, default: false },
  checkInDate: { type: Date, required: true },
  checkOutDate: { type: Date, required: true },
  guestCount: { type: Number, default: 1, min: 1 },
  cancellationReason: { type: String, trim: true },
  refundStatus: { type: String, enum: ['none', 'requested', 'approved', 'rejected'], default: 'none' },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model('Booking', bookingSchema);
