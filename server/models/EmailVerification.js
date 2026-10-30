import mongoose from 'mongoose';

const emailVerificationSchema = new mongoose.Schema({
  email: { type: String, required: true, lowercase: true, trim: true, unique: true, index: true },
  verificationToken: { type: String, select: false },
  verificationCodeHash: { type: String, select: false },
  verificationCodeExpiresAt: { type: Date },
  verificationAttempts: { type: Number },
  resendCount: { type: Number },
  lastCodeSentAt: { type: Date },
  registrationStatus: { type: String, enum: ['pending', 'completed'] },
  registrationData: { type: mongoose.Schema.Types.Mixed, select: false },
  completedUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  expiresAt: { type: Date, required: true },
  verifiedAt: { type: Date }
}, { timestamps: true });

emailVerificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model('EmailVerification', emailVerificationSchema);
