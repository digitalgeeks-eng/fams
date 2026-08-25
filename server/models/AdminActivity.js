import mongoose from 'mongoose';

const adminActivitySchema = new mongoose.Schema({
  adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  adminName: { type: String, required: true },
  adminRole: { type: String, required: true },
  assignedLocation: { type: String },
  action: { type: String, required: true },
  propertyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Property' },
  propertyLocation: { type: String },
  description: { type: String, required: true }
}, { timestamps: { createdAt: 'timestamp', updatedAt: false } });

export default mongoose.model('AdminActivity', adminActivitySchema);
