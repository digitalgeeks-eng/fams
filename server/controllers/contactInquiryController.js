import mongoose from 'mongoose';
import ContactInquiry, { CONTACT_INQUIRY_CATEGORIES } from '../models/ContactInquiry.js';
import { validateEmail } from '../utils/validators.js';

const INQUIRY_STATUSES = ['New', 'In Progress', 'Resolved'];
const removeControlCharacters = (value) => value.replace(/[\u0000-\u001F\u007F]/g, '');

export const submitContactInquiry = async (req, res) => {
  const { name, email, category, message, website } = req.body || {};

  if (typeof website === 'string' && website.trim()) {
    return res.status(202).json({ message: 'Your message has been received.' });
  }

  if ([name, email, category, message].some((value) => typeof value !== 'string')) {
    return res.status(400).json({ message: 'Name, email, inquiry category, and message are required.' });
  }

  const normalizedName = removeControlCharacters(name).trim();
  const normalizedEmail = removeControlCharacters(email).trim().toLowerCase();
  const normalizedCategory = category.trim();
  const normalizedMessage = removeControlCharacters(message).trim();

  if (!normalizedName || normalizedName.length > 120) {
    return res.status(400).json({ message: 'Full name is required and must be 120 characters or fewer.' });
  }
  if (normalizedEmail.length > 254 || !validateEmail(normalizedEmail)) {
    return res.status(400).json({ message: 'Enter a valid email address (254 characters or fewer).' });
  }
  if (!CONTACT_INQUIRY_CATEGORIES.includes(normalizedCategory)) {
    return res.status(400).json({ message: 'Select a valid inquiry category.' });
  }
  if (!normalizedMessage || normalizedMessage.length > 5000) {
    return res.status(400).json({ message: 'Message is required and must be 5,000 characters or fewer.' });
  }

  const inquiry = await ContactInquiry.create({
    name: normalizedName,
    email: normalizedEmail,
    category: normalizedCategory,
    message: normalizedMessage
  });

  return res.status(201).json({
    message: 'Your message has been received. We will get back to you as soon as possible.',
    data: { id: inquiry._id }
  });
};

export const listContactInquiries = async (req, res) => {
  const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 20, 1), 100);
  const status = req.query.status;
  if (status && status !== 'all' && !INQUIRY_STATUSES.includes(status)) {
    return res.status(400).json({ message: 'Select a valid inquiry status.' });
  }

  const filter = status && status !== 'all' ? { status } : {};
  const [inquiries, total] = await Promise.all([
    ContactInquiry.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    ContactInquiry.countDocuments(filter)
  ]);

  return res.json({
    data: {
      inquiries,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
    }
  });
};

export const updateContactInquiryStatus = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ message: 'Invalid inquiry ID.' });
  }
  const { status } = req.body || {};
  if (!INQUIRY_STATUSES.includes(status)) {
    return res.status(400).json({ message: 'Select a valid inquiry status.' });
  }

  const inquiry = await ContactInquiry.findById(req.params.id);
  if (!inquiry) return res.status(404).json({ message: 'Inquiry not found.' });

  inquiry.status = status;
  await inquiry.save();
  return res.json({ message: 'Inquiry status updated.', data: inquiry });
};
