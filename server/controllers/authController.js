import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import User from '../models/User.js';
import { validateBankDetails, validateEmail, validatePasswordStrength, validateRequired } from '../utils/validators.js';
import { uploadBufferToCloudinary } from '../services/cloudinaryService.js';
import { OAuth2Client } from 'google-auth-library';
import { sendEmail } from '../services/emailService.js';

dotenv.config();

const generateToken = (id) => jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '7d' });
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const userResponse = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  verificationStatus: user.verificationStatus,
  profileImage: user.profileImage,
  authProvider: user.authProvider,
  status: user.status || 'active',
  lastLoginAt: user.lastLoginAt
});

export const register = async (req, res) => {
  const missing = validateRequired(['name', 'email', 'password', 'role'], req.body);
  if (missing.length) {
    return res.status(400).json({ message: `Missing fields: ${missing.join(', ')}` });
  }

  const { name, email, password, role, phone, company, address, yearsOfExperience, licenseNumber, bio, accountNumber, bankName, accountName } = req.body;
  const normalizedName = name?.trim();
  const normalizedEmail = email?.trim().toLowerCase();
  const normalizedRole = role?.trim().toLowerCase();

  if (!normalizedName) return res.status(400).json({ message: 'Name is required' });
  if (!validateEmail(normalizedEmail)) return res.status(400).json({ message: 'Invalid email address' });
  if (!validatePasswordStrength(password)) return res.status(400).json({ message: 'Password must be at least 6 characters' });
  if (!['student', 'agent', 'admin'].includes(normalizedRole)) return res.status(400).json({ message: 'Invalid role selected' });

  // Agent-specific validation
  if (normalizedRole === 'agent') {
    if (!phone?.trim()) return res.status(400).json({ message: 'Phone number is required for agents' });
    if (!address?.trim()) return res.status(400).json({ message: 'Address is required for agents' });
    if (yearsOfExperience === undefined || yearsOfExperience === null || yearsOfExperience === '' || Number.isNaN(Number(yearsOfExperience)) || Number(yearsOfExperience) < 0) return res.status(400).json({ message: 'Years of experience is required for agents' });
    if (!req.files?.idImage?.[0]) return res.status(400).json({ message: 'Passport or ID photo is required.' });

    const bankValidation = validateBankDetails({ accountNumber, bankName, accountName });
    if (!bankValidation.valid) {
      return res.status(400).json({ message: bankValidation.message });
    }
  }

  const existingUser = await User.findOne({ email: normalizedEmail });
  if (existingUser) return res.status(409).json({ message: 'Email already registered' });

  const hashedPassword = await bcrypt.hash(password, 10);
  const verificationStatus = normalizedRole === 'agent' ? 'pending' : 'verified';

  const userData = {
    name: normalizedName,
    email: normalizedEmail,
    password: hashedPassword,
    role: normalizedRole,
    verificationStatus
  };

  // Add agent-specific fields
  if (normalizedRole === 'agent') {
    userData.phone = phone?.trim();
    if (company?.trim()) userData.company = company.trim();
    userData.address = address?.trim();
    userData.yearsOfExperience = parseInt(yearsOfExperience);
    if (licenseNumber?.trim()) userData.licenseNumber = licenseNumber.trim();
    if (bio?.trim()) userData.bio = bio.trim();

    const bankValidation = validateBankDetails({ accountNumber, bankName, accountName });
    if (bankValidation.valid && (bankValidation.normalized.accountNumber || bankValidation.normalized.bankName || bankValidation.normalized.accountName)) {
      userData.accountNumber = bankValidation.normalized.accountNumber;
      userData.bankName = bankValidation.normalized.bankName;
      userData.accountName = bankValidation.normalized.accountName;
    }

    const idImage = await uploadBufferToCloudinary(req.files.idImage[0].buffer, { folder: 'fulafia-ams/agents/identity', resourceType: 'image' });
    userData.idImage = idImage.secure_url;
    if (req.files.licenseImage?.[0]) {
      const licenseImage = await uploadBufferToCloudinary(req.files.licenseImage[0].buffer, { folder: 'fulafia-ams/agents/licenses', resourceType: 'image' });
      userData.licenseImage = licenseImage.secure_url;
    }
  }

  const user = await User.create({ ...userData, authProvider: 'local' });
  const token = generateToken(user._id);

  res.status(201).json({
    message: 'User registered successfully',
    data: {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        verificationStatus: user.verificationStatus,
        phone: user.phone,
        company: user.company,
        address: user.address
      },
      token
    }
  });
};

export const login = async (req, res) => {
  const missing = validateRequired(['email', 'password'], req.body);
  if (missing.length) {
    return res.status(400).json({ message: `Missing fields: ${missing.join(', ')}` });
  }

  const { email, password } = req.body;
  const normalizedEmail = email?.trim().toLowerCase();
  const user = await User.findOne({ email: normalizedEmail }).select('+password');
  if (!user) return res.status(401).json({ message: 'Invalid credentials' });

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) return res.status(401).json({ message: 'Invalid credentials' });
  if (user.status && user.status !== 'active') return res.status(403).json({ message: `Account is ${user.status}. Contact an administrator.` });

  const token = generateToken(user._id);
  user.lastLoginAt = new Date();
  await user.save();
  res.json({
    message: 'Login successful',
    data: { user: { id: user._id, name: user.name, email: user.email, role: user.role, verificationStatus: user.verificationStatus }, token }
  });
};

export const forgotPassword = async (req, res) => {
  const normalizedEmail = req.body.email?.trim().toLowerCase();
  const response = { message: 'If an account exists for that email, a password reset link has been sent.' };

  if (!normalizedEmail || !validateEmail(normalizedEmail)) return res.json(response);

  const user = await User.findOne({ email: normalizedEmail }).select('+passwordResetToken +passwordResetExpires');
  if (!user) return res.json(response);

  const resetToken = crypto.randomBytes(32).toString('hex');
  user.passwordResetToken = crypto.createHash('sha256').update(resetToken).digest('hex');
  user.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000);
  await user.save({ validateBeforeSave: false });

  const clientUrl = process.env.CLIENT_URL || process.env.FRONTEND_URL || 'http://localhost:5173';
  const resetUrl = `${clientUrl.replace(/\/$/, '')}/reset-password/${resetToken}`;
  await sendEmail({
    to: user.email,
    subject: 'Reset your FULAFIA AMS password',
    text: `Use this link to reset your password: ${resetUrl}\n\nThis link expires in 1 hour. If you did not request this, you can ignore this email.`,
    html: `<p>Use the link below to reset your FULAFIA AMS password:</p><p><a href="${resetUrl}">Reset password</a></p><p>This link expires in 1 hour. If you did not request this, you can ignore this email.</p>`
  });

  return res.json(response);
};

export const resetPassword = async (req, res) => {
  const { token } = req.params;
  const { password } = req.body;
  if (!token || !validatePasswordStrength(password)) {
    return res.status(400).json({ message: 'Password must be at least 6 characters' });
  }

  const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: { $gt: new Date() }
  }).select('+password +passwordResetToken +passwordResetExpires');

  if (!user) return res.status(400).json({ message: 'This password reset link is invalid or has expired.' });

  user.password = await bcrypt.hash(password, 10);
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  user.authProvider = user.googleId ? 'both' : 'local';
  await user.save();

  return res.json({ message: 'Password reset successful. You can now log in.' });
};

export const googleLogin = async (req, res) => {
  const { credential } = req.body;
  if (!credential) return res.status(400).json({ message: 'Google credential is required' });
  if (!process.env.GOOGLE_CLIENT_ID) return res.status(503).json({ message: 'Google authentication is not configured' });

  let payload;
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID
    });
    payload = ticket.getPayload();
  } catch (error) {
    return res.status(401).json({ message: 'Google authentication failed. Please try again.' });
  }

  if (!payload?.sub || !payload.email || payload.email_verified !== true) {
    return res.status(401).json({ message: 'Google account email must be verified.' });
  }

  const normalizedEmail = payload.email.trim().toLowerCase();
  let user = await User.findOne({ googleId: payload.sub }).select('+password');
  if (!user) user = await User.findOne({ email: normalizedEmail }).select('+password');

  if (user) {
    if (user.status && user.status !== 'active') return res.status(403).json({ message: `Account is ${user.status}. Contact an administrator.` });
    user.googleId = payload.sub;
    user.authProvider = user.password ? 'both' : 'google';
    if (!user.profileImage && payload.picture) user.profileImage = payload.picture;
    await user.save();
  } else {
    user = await User.create({
      name: payload.name?.trim() || normalizedEmail.split('@')[0],
      email: normalizedEmail,
      googleId: payload.sub,
      authProvider: 'google',
      profileImage: payload.picture,
      role: 'student',
      verificationStatus: 'verified'
    });
  }

  user.lastLoginAt = new Date();
  await user.save();

  const token = generateToken(user._id);
  res.json({ message: 'Google login successful', data: { user: userResponse(user), token } });
};

export const getMe = async (req, res) => {
  const user = req.user;
  res.json({ data: userResponse(user) });
};
