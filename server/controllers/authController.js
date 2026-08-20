import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import User from '../models/User.js';
import { validateEmail, validatePasswordStrength, validateRequired } from '../utils/validators.js';
import { uploadBufferToCloudinary } from '../services/cloudinaryService.js';
import { OAuth2Client } from 'google-auth-library';

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

  const { name, email, password, role, phone, company, address, yearsOfExperience, licenseNumber, bio } = req.body;
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
    if (!licenseNumber?.trim()) return res.status(400).json({ message: 'License number is required for agents' });
    if (!yearsOfExperience || yearsOfExperience < 0) return res.status(400).json({ message: 'Years of experience is required for agents' });
    if (!req.files?.idImage || !req.files?.licenseImage) {
      return res.status(400).json({ message: 'Both ID and License photos are required for agent verification' });
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
    userData.company = company?.trim();
    userData.address = address?.trim();
    userData.yearsOfExperience = parseInt(yearsOfExperience);
    userData.licenseNumber = licenseNumber?.trim();
    userData.bio = bio?.trim();
    const [idImage, licenseImage] = await Promise.all([
      uploadBufferToCloudinary(req.files.idImage[0].buffer, { folder: 'fulafia-ams/agents/identity', resourceType: 'image' }),
      uploadBufferToCloudinary(req.files.licenseImage[0].buffer, { folder: 'fulafia-ams/agents/licenses', resourceType: 'image' })
    ]);
    userData.idImage = idImage.secure_url;
    userData.licenseImage = licenseImage.secure_url;
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
