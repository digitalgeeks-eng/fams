import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: function () { return this.authProvider !== 'google'; }, select: false },
  passwordResetToken: { type: String, select: false },
  passwordResetExpires: { type: Date, select: false },
  googleId: { type: String, unique: true, sparse: true, index: true },
  authProvider: { type: String, enum: ['local', 'google', 'both'], default: 'local' },
  profileImage: { type: String },
  status: { type: String, enum: ['active', 'suspended', 'deactivated'], default: 'active' },
  updatedAt: { type: Date, default: Date.now },
  lastLoginAt: { type: Date },
  role: { type: String, enum: ['student', 'agent', 'admin'], default: 'student' },
  adminRole: { type: String, enum: ['super_admin', 'location_admin'] },
  assignedLocation: { type: String, trim: true },
  verificationStatus: { type: String, enum: ['pending', 'verified', 'rejected'], default: 'pending' },
  // Agent specific fields
  phone: { type: String, trim: true },
  company: { type: String, trim: true },
  address: { type: String, trim: true },
  idNumber: { type: String, trim: true },
  idImage: { type: String },
  bio: { type: String, trim: true },
  accountNumber: { type: String, trim: true },
  bankName: { type: String, trim: true },
  accountName: { type: String, trim: true },
  // Enhanced agent fields for better verification
  yearsOfExperience: { type: Number, min: 0 },
  licenseNumber: { type: String, trim: true },
  licenseImage: { type: String },
  certifications: [{ type: String, trim: true }],
  verificationReason: { type: String, trim: true }, // For rejection reasons
  verifiedAt: { type: Date },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model('User', userSchema);
