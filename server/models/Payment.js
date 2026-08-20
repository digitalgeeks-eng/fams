import mongoose from 'mongoose';

const paymentSchema = new mongoose.Schema({
  bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  paymentMethod: { type: String, enum: ['online', 'offline', 'manual'], required: true },
  paymentProvider: { type: String, trim: true },
  accountName: { type: String, trim: true },
  accountNumber: { type: String, trim: true },
  paymentReference: { type: String, required: true, trim: true },
  transactionReference: { type: String, trim: true },
  amount: { type: Number, required: true }, // Amount paid in Naira
  proofImage: { type: String },
  proofPath: { type: String },
  proofFilename: { type: String, trim: true },
  verificationStatus: { type: String, enum: ['pending', 'proof_submitted', 'verified', 'rejected', 'failed'], default: 'pending' },
  submittedAt: { type: Date },
  verifiedAt: { type: Date },
  verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  adminNote: { type: String, trim: true, maxlength: 500 },
  status: { type: String, enum: ['pending', 'proof_submitted', 'verified', 'rejected', 'failed'], default: 'pending' }
}, { timestamps: true });

export default mongoose.model('Payment', paymentSchema);
