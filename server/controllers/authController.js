import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import User from '../models/User.js';
import { validateEmail, validatePasswordStrength, validateRequired } from '../utils/validators.js';

dotenv.config();

const generateToken = (id) => jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '7d' });

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
    userData.idImage = req.files.idImage[0].path.replace(/\\/g, '/');
    userData.licenseImage = req.files.licenseImage[0].path.replace(/\\/g, '/');
  }

  const user = await User.create(userData);
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
  const user = await User.findOne({ email: normalizedEmail });
  if (!user) return res.status(401).json({ message: 'Invalid credentials' });

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) return res.status(401).json({ message: 'Invalid credentials' });

  const token = generateToken(user._id);
  res.json({
    message: 'Login successful',
    data: { user: { id: user._id, name: user.name, email: user.email, role: user.role, verificationStatus: user.verificationStatus }, token }
  });
};

export const getMe = async (req, res) => {
  const user = req.user;
  res.json({ data: { id: user._id, name: user.name, email: user.email, role: user.role, verificationStatus: user.verificationStatus } });
};
