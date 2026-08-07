import mongoose from 'mongoose';

const paymentSchema = new mongoose.Schema({
  bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true },
  paymentMethod: { type: String, enum: ['online', 'offline'], required: true },
  paymentReference: { type: String, required: true },
  amount: { type: Number, required: true }, // Amount paid in Naira
  proofImage: { type: String },
  verificationStatus: { type: String, enum: ['pending', 'verified', 'rejected'], default: 'pending' },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model('Payment', paymentSchema);
