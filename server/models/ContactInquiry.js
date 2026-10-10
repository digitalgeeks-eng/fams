import mongoose from 'mongoose';

const CONTACT_INQUIRY_CATEGORIES = [
  'Accommodation Inquiry',
  'Property Listing',
  'Registration or Account Issue',
  'Payment Issue',
  'Complaint',
  'Other'
];

const contactInquirySchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 120 },
  email: { type: String, required: true, trim: true, lowercase: true, maxlength: 254 },
  category: { type: String, required: true, enum: CONTACT_INQUIRY_CATEGORIES },
  message: { type: String, required: true, trim: true, maxlength: 5000 },
  status: { type: String, enum: ['New', 'In Progress', 'Resolved'], default: 'New', required: true }
}, { timestamps: true });

export { CONTACT_INQUIRY_CATEGORIES };
export default mongoose.model('ContactInquiry', contactInquirySchema);
