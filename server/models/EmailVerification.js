import mongoose from 'mongoose';

const emailVerificationSchema = new mongoose.Schema({
  email: { type: String, required: true, lowercase: true, trim: true, unique: true, index: true },
  verificationToken: { type: String, required: true, select: false },
  expiresAt: { type: Date, required: true, index: true },
  verifiedAt: { type: Date }
}, { timestamps: true });

emailVerificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model('EmailVerification', emailVerificationSchema);
