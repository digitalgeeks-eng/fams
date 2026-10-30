import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import User from '../models/User.js';
import EmailVerification from '../models/EmailVerification.js';
import { validateBankDetails, validateEmail, validatePasswordStrength, validateRequired } from '../utils/validators.js';
import { deleteCloudinaryAsset, uploadBufferToCloudinary } from '../services/cloudinaryService.js';
import { OAuth2Client } from 'google-auth-library';
import { getEmailDeliveryDiagnostics, sendEmail } from '../services/emailService.js';

dotenv.config();

const generateToken = (id) => jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '7d' });
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const getGoogleVerificationErrorCategory = (error) => {
  const message = typeof error?.message === 'string' ? error.message.toLowerCase() : '';
  if (message.includes('audience') || message.includes('recipient')) return 'audience_mismatch';
  if (message.includes('issuer')) return 'issuer_mismatch';
  if (message.includes('expired') || message.includes('expiration') || message.includes('exp field') || message.includes('token used too late')) return 'expired_or_invalid_expiration';
  if (message.includes('signature') || message.includes('certificate') || message.includes('public key')) return 'signature_verification_failed';
  if (message.includes('fetch') || message.includes('network') || message.includes('timeout') || message.includes('econn')) return 'google_keys_unavailable';
  return 'token_verification_failed';
};
const REGISTRATION_CODE_TTL_MS = 10 * 60 * 1000;
const PENDING_REGISTRATION_TTL_MS = 24 * 60 * 60 * 1000;
const REGISTRATION_RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_REGISTRATION_CODE_SENDS = 5;
const MAX_REGISTRATION_CODE_ATTEMPTS = 5;

const hashRegistrationCode = (email, code) => crypto
  .createHmac('sha256', process.env.JWT_SECRET)
  .update(`${email}:${code}`)
  .digest('hex');

const registrationCodeMatches = (email, code, storedHash) => {
  if (!storedHash) return false;
  const providedHash = Buffer.from(hashRegistrationCode(email, code), 'hex');
  const expectedHash = Buffer.from(storedHash, 'hex');
  return providedHash.length === expectedHash.length && crypto.timingSafeEqual(providedHash, expectedHash);
};

const getPendingImageBuffer = (image) => {
  if (Buffer.isBuffer(image)) return image;
  if (image?._bsontype === 'Binary' && typeof image.value === 'function') {
    const buffer = image.value(true);
    if (Buffer.isBuffer(buffer)) return buffer;
  }
  throw new TypeError('Pending registration image data is not valid binary data.');
};

const uploadPendingRegistrationImages = async (registrationData) => {
  const uploadedAssets = [];
  const userImages = {};
  try {
    if (registrationData.idImageBuffer) {
      const result = await uploadBufferToCloudinary(getPendingImageBuffer(registrationData.idImageBuffer), {
        folder: 'fulafia-ams/agents/identity',
        resourceType: 'image'
      });
      uploadedAssets.push(result);
      userImages.idImage = result.secure_url;
    }
    if (registrationData.licenseImageBuffer) {
      const result = await uploadBufferToCloudinary(getPendingImageBuffer(registrationData.licenseImageBuffer), {
        folder: 'fulafia-ams/agents/licenses',
        resourceType: 'image'
      });
      uploadedAssets.push(result);
      userImages.licenseImage = result.secure_url;
    }
    return { userImages, uploadedAssets };
  } catch (error) {
    for (const asset of uploadedAssets) {
      await deleteCloudinaryAsset(asset.public_id, 'image');
    }
    throw error;
  }
};

const deleteUploadedRegistrationImages = async (uploadedAssets) => {
  for (const asset of uploadedAssets) {
    await deleteCloudinaryAsset(asset.public_id, 'image');
  }
};

const issueRegistrationCode = async (email, registrationData) => {
  const now = new Date();
  await EmailVerification.deleteOne({
    email,
    registrationStatus: 'pending',
    expiresAt: { $lte: now }
  });
  const code = String(crypto.randomInt(100000, 1000000));
  const codeHash = hashRegistrationCode(email, code);
  const setValues = {
    registrationStatus: 'pending',
    verificationCodeHash: codeHash,
    verificationCodeExpiresAt: new Date(now.getTime() + REGISTRATION_CODE_TTL_MS),
    verificationAttempts: 0,
    lastCodeSentAt: now,
    expiresAt: new Date(now.getTime() + PENDING_REGISTRATION_TTL_MS)
  };
  if (registrationData) setValues.registrationData = registrationData;

  let pending;
  try {
    pending = await EmailVerification.findOneAndUpdate({
      email,
      registrationStatus: { $ne: 'completed' },
      $and: [
        { $or: [{ lastCodeSentAt: { $exists: false } }, { lastCodeSentAt: { $lte: new Date(now.getTime() - REGISTRATION_RESEND_COOLDOWN_MS) } }] },
        { $or: [{ resendCount: { $exists: false } }, { resendCount: { $lt: MAX_REGISTRATION_CODE_SENDS } }] }
      ]
    }, {
      $set: setValues,
      $inc: { resendCount: 1 },
      $unset: { verificationToken: '', verifiedAt: '' }
    }, { new: true, upsert: true, runValidators: true });
  } catch (error) {
    if (error.code !== 11000) throw error;

    const existing = await EmailVerification.findOne({ email });
    if (existing?.registrationStatus === 'completed') return { status: 'completed' };
    if (existing?.resendCount >= MAX_REGISTRATION_CODE_SENDS) return { status: 'limit' };

    const cooldownRemaining = existing?.lastCodeSentAt
      ? REGISTRATION_RESEND_COOLDOWN_MS - (now.getTime() - existing.lastCodeSentAt.getTime())
      : 0;
    if (cooldownRemaining > 0) {
      if (registrationData && existing.registrationStatus === 'pending') {
        await EmailVerification.updateOne(
          { _id: existing._id, registrationStatus: 'pending' },
          { $set: { registrationData } }
        );
      }
      const codeExpiresInSeconds = existing.verificationCodeExpiresAt
        ? Math.max(0, Math.ceil((existing.verificationCodeExpiresAt.getTime() - now.getTime()) / 1000))
        : 0;
      return {
        status: 'cooldown',
        retryAfterSeconds: Math.ceil(cooldownRemaining / 1000),
        codeExpiresInSeconds
      };
    }
    throw error;
  }

  try {
    await sendEmail({
      to: email,
      subject: 'StudentNest — Verify Your Email Address',
      text: `Welcome to StudentNest.\n\nThank you for registering.\n\nYour email verification code is: ${code}\n\nThis code will expire in 10 minutes.\n\nIf you did not request this registration, please ignore this email.\n\nStudentNest`,
      html: `<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111;"><p>Welcome to StudentNest.</p><p>Thank you for registering.</p><p>Your email verification code is:</p><p style="font-size: 24px; font-weight: bold; letter-spacing: 4px;">${code}</p><p>This code will expire in 10 minutes.</p><p>If you did not request this registration, please ignore this email.</p><p>StudentNest</p></div>`
    });
  } catch (error) {
    console.error('Registration verification email delivery failed:', getEmailDeliveryDiagnostics(error));
    await EmailVerification.updateOne(
      {
        _id: pending._id,
        registrationStatus: 'pending',
        verificationCodeHash: codeHash,
        resendCount: { $gt: 0 }
      },
      {
        $unset: { verificationCodeHash: '', verificationCodeExpiresAt: '', lastCodeSentAt: '' },
        $inc: { resendCount: -1 }
      }
    );
    return { status: 'email-failed' };
  }

  return { status: 'sent', retryAfterSeconds: REGISTRATION_RESEND_COOLDOWN_MS / 1000 };
};

const respondToCodeIssue = (res, email, result, isResend = false) => {
  if (result.status === 'sent') {
    return res.status(202).json({
      message: isResend ? 'A new verification code has been sent.' : 'A verification code has been sent to your email.',
      data: { email, expiresInSeconds: REGISTRATION_CODE_TTL_MS / 1000, resendAfterSeconds: result.retryAfterSeconds }
    });
  }
  if (result.status === 'cooldown') {
    if (isResend) {
      return res.status(429).json({ message: `Please wait ${result.retryAfterSeconds} seconds before requesting another code.`, data: { resendAfterSeconds: result.retryAfterSeconds } });
    }
    return res.status(202).json({
      message: 'A verification code was recently sent to your email.',
      data: { email, expiresInSeconds: result.codeExpiresInSeconds, resendAfterSeconds: result.retryAfterSeconds }
    });
  }
  if (result.status === 'limit') {
    return res.status(429).json({ message: 'The maximum number of verification codes has been requested. Please try again later.' });
  }
  if (result.status === 'completed') {
    return res.status(409).json({ message: 'An account with this email is already registered.' });
  }
  return res.status(503).json({ message: 'Unable to send the verification email. Please try again.' });
};

const userResponse = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  verificationStatus: user.verificationStatus,
  profileImage: user.profileImage,
  authProvider: user.authProvider,
  status: user.status || 'active',
  adminRole: user.role === 'admin' ? (user.adminRole || 'super_admin') : undefined,
  assignedLocation: user.role === 'admin' ? user.assignedLocation : undefined,
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
  if (!['student', 'agent'].includes(normalizedRole)) return res.status(400).json({ message: 'Invalid role selected' });

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

  const registrationData = {
    name: normalizedName,
    email: normalizedEmail,
    passwordHash: hashedPassword,
    role: normalizedRole,
    verificationStatus
  };

  // Add agent-specific fields
  if (normalizedRole === 'agent') {
    registrationData.phone = phone?.trim();
    if (company?.trim()) registrationData.company = company.trim();
    registrationData.address = address?.trim();
    registrationData.yearsOfExperience = parseInt(yearsOfExperience, 10);
    if (licenseNumber?.trim()) registrationData.licenseNumber = licenseNumber.trim();
    if (bio?.trim()) registrationData.bio = bio.trim();

    const bankValidation = validateBankDetails({ accountNumber, bankName, accountName });
    if (bankValidation.valid && (bankValidation.normalized.accountNumber || bankValidation.normalized.bankName || bankValidation.normalized.accountName)) {
      registrationData.accountNumber = bankValidation.normalized.accountNumber;
      registrationData.bankName = bankValidation.normalized.bankName;
      registrationData.accountName = bankValidation.normalized.accountName;
    }

    registrationData.idImageBuffer = req.files.idImage[0].buffer;
    if (req.files.licenseImage?.[0]) {
      registrationData.licenseImageBuffer = req.files.licenseImage[0].buffer;
    }
  }

  const result = await issueRegistrationCode(normalizedEmail, registrationData);
  return respondToCodeIssue(res, normalizedEmail, result);
};

export const resendRegistrationCode = async (req, res) => {
  const normalizedEmail = req.body.email?.trim().toLowerCase();
  if (!normalizedEmail || !validateEmail(normalizedEmail)) {
    return res.status(400).json({ message: 'Please enter a valid email address.' });
  }

  const existingUser = await User.exists({ email: normalizedEmail });
  if (existingUser) return res.status(409).json({ message: 'Email already registered. Please log in.' });

  const pending = await EmailVerification.findOne({
    email: normalizedEmail,
    registrationStatus: 'pending',
    registrationData: { $exists: true },
    expiresAt: { $gt: new Date() }
  });
  if (!pending) {
    return res.status(404).json({ message: 'No pending registration was found. Please submit the registration form again.' });
  }

  const result = await issueRegistrationCode(normalizedEmail);
  return respondToCodeIssue(res, normalizedEmail, result, true);
};

export const verifyRegistrationCode = async (req, res) => {
  const normalizedEmail = req.body.email?.trim().toLowerCase();
  const code = req.body.code;
  if (!normalizedEmail || !validateEmail(normalizedEmail)) {
    return res.status(400).json({ message: 'Please enter a valid email address.' });
  }
  if (typeof code !== 'string' || !/^\d{6}$/.test(code)) {
    return res.status(400).json({ message: 'Enter the six-digit verification code.' });
  }

  const pending = await EmailVerification.findOne({
    email: normalizedEmail,
    registrationStatus: 'pending',
    registrationData: { $exists: true }
  }).select('+verificationCodeHash +registrationData');
  if (!pending) {
    const completed = await EmailVerification.exists({ email: normalizedEmail, registrationStatus: 'completed' });
    return res.status(completed ? 409 : 400).json({
      message: completed ? 'Registration is already complete. Please log in.' : 'No pending registration was found.'
    });
  }
  if (pending.expiresAt <= new Date()) {
    return res.status(400).json({ message: 'This registration has expired. Please submit the registration form again.' });
  }
  if (!pending.verificationCodeExpiresAt || pending.verificationCodeExpiresAt <= new Date()) {
    return res.status(400).json({ message: 'This verification code has expired. Request a new code to continue.' });
  }
  if ((pending.verificationAttempts || 0) >= MAX_REGISTRATION_CODE_ATTEMPTS) {
    return res.status(429).json({ message: 'Too many incorrect attempts. Request a new verification code.' });
  }

  if (!registrationCodeMatches(normalizedEmail, code, pending.verificationCodeHash)) {
    const updated = await EmailVerification.findOneAndUpdate({
      _id: pending._id,
      registrationStatus: 'pending',
      verificationCodeExpiresAt: { $gt: new Date() },
      verificationAttempts: { $lt: MAX_REGISTRATION_CODE_ATTEMPTS }
    }, { $inc: { verificationAttempts: 1 } }, { new: true });
    if (!updated || updated.verificationAttempts >= MAX_REGISTRATION_CODE_ATTEMPTS) {
      return res.status(429).json({ message: 'Too many incorrect attempts. Request a new verification code.' });
    }
    return res.status(400).json({ message: 'The verification code is incorrect. Please try again.' });
  }

  const { userImages, uploadedAssets } = await uploadPendingRegistrationImages(pending.registrationData);
  const session = await mongoose.startSession();
  let outcome = null;
  let authResponse = null;
  try {
    await session.withTransaction(async () => {
      outcome = null;
      authResponse = null;
      const current = await EmailVerification.findOne({
        _id: pending._id,
        registrationStatus: 'pending',
        registrationData: { $exists: true }
      }).select('+verificationCodeHash +registrationData').session(session);

      if (!current) {
        const completed = await EmailVerification.exists({
          email: normalizedEmail,
          registrationStatus: 'completed'
        }).session(session);
        outcome = completed ? 'completed' : 'not-found';
        return;
      }
      if (current.updatedAt.getTime() !== pending.updatedAt.getTime()) {
        outcome = 'registration-updated';
        return;
      }
      if (current.expiresAt <= new Date()) {
        outcome = 'registration-expired';
        return;
      }
      if (!current.verificationCodeExpiresAt || current.verificationCodeExpiresAt <= new Date()) {
        outcome = 'code-expired';
        return;
      }
      if ((current.verificationAttempts || 0) >= MAX_REGISTRATION_CODE_ATTEMPTS) {
        outcome = 'attempt-limit';
        return;
      }
      if (!registrationCodeMatches(normalizedEmail, code, current.verificationCodeHash)) {
        outcome = 'incorrect';
        return;
      }

      const existingUser = await User.findOne({ email: normalizedEmail }).session(session);
      if (existingUser) {
        outcome = 'email-registered';
        return;
      }

      const registrationData = current.registrationData;
      const [user] = await User.create([{
        name: registrationData.name,
        email: registrationData.email,
        password: registrationData.passwordHash,
        role: registrationData.role,
        verificationStatus: registrationData.verificationStatus,
        emailVerifiedAt: new Date(),
        authProvider: 'local',
        phone: registrationData.phone,
        company: registrationData.company,
        address: registrationData.address,
        yearsOfExperience: registrationData.yearsOfExperience,
        licenseNumber: registrationData.licenseNumber,
        bio: registrationData.bio,
        accountNumber: registrationData.accountNumber,
        bankName: registrationData.bankName,
        accountName: registrationData.accountName,
        idImage: userImages.idImage,
        licenseImage: userImages.licenseImage
      }], { session });

      const updateResult = await EmailVerification.updateOne({
        _id: current._id,
        registrationStatus: 'pending',
        verificationCodeHash: current.verificationCodeHash,
        verificationCodeExpiresAt: { $gt: new Date() }
      }, {
        $set: {
          registrationStatus: 'completed',
          completedUserId: user._id,
          verifiedAt: new Date()
        },
        $unset: {
          registrationData: '',
          verificationCodeHash: '',
          verificationCodeExpiresAt: '',
          verificationAttempts: '',
          resendCount: '',
          lastCodeSentAt: ''
        }
      }, { session });
      if (updateResult.modifiedCount !== 1) {
        throw new Error('Registration verification state could not be completed.');
      }

      authResponse = {
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
          token: generateToken(user._id)
        }
      };
      outcome = 'completed-successfully';
    });
  } catch (error) {
    await deleteUploadedRegistrationImages(uploadedAssets);
    if (error.code === 11000) {
      return res.status(409).json({ message: 'Email already registered. Please log in.' });
    }
    throw error;
  } finally {
    await session.endSession();
  }

  if (outcome !== 'completed-successfully') {
    await deleteUploadedRegistrationImages(uploadedAssets);
  }
  if (outcome === 'completed-successfully') return res.status(201).json(authResponse);
  if (outcome === 'registration-updated') {
    return res.status(409).json({ message: 'Registration details changed. Please verify using the current registration details.' });
  }
  if (outcome === 'registration-expired') {
    return res.status(400).json({ message: 'This registration has expired. Please submit the registration form again.' });
  }
  if (outcome === 'code-expired') {
    return res.status(400).json({ message: 'This verification code has expired. Request a new code to continue.' });
  }
  if (outcome === 'attempt-limit') {
    return res.status(429).json({ message: 'Too many incorrect attempts. Request a new verification code.' });
  }
  if (outcome === 'incorrect') {
    const updated = await EmailVerification.findOneAndUpdate({
      _id: pending._id,
      registrationStatus: 'pending',
      verificationCodeHash: pending.verificationCodeHash,
      verificationCodeExpiresAt: { $gt: new Date() },
      verificationAttempts: { $lt: MAX_REGISTRATION_CODE_ATTEMPTS }
    }, { $inc: { verificationAttempts: 1 } }, { new: true });
    if (!updated || updated.verificationAttempts >= MAX_REGISTRATION_CODE_ATTEMPTS) {
      return res.status(429).json({ message: 'Too many incorrect attempts. Request a new verification code.' });
    }
    return res.status(400).json({ message: 'The verification code is incorrect. Please try again.' });
  }
  if (outcome === 'email-registered') {
    return res.status(409).json({ message: 'Email already registered. Please log in.' });
  }
  if (outcome === 'not-found') {
    return res.status(400).json({ message: 'No pending registration was found. Please submit the registration form again.' });
  }
  return res.status(409).json({ message: 'Registration is already complete. Please log in.' });
};

export const sendRegistrationVerification = async (req, res) => {
  const normalizedEmail = req.body.email?.trim().toLowerCase();
  if (!normalizedEmail || !validateEmail(normalizedEmail)) {
    return res.status(400).json({ message: 'Please enter a valid email address.' });
  }

  const response = { message: 'If this email can be used, a verification link has been sent.' };
  const existingUser = await User.exists({ email: normalizedEmail });
  if (existingUser) return res.json(response);
  const pendingRegistration = await EmailVerification.exists({
    email: normalizedEmail,
    registrationStatus: 'pending',
    registrationData: { $exists: true }
  });
  if (pendingRegistration) {
    return res.status(409).json({ message: 'A registration is already pending for this email. Enter the code sent to your email.' });
  }

  const verificationToken = crypto.randomBytes(32).toString('hex');
  await EmailVerification.deleteMany({ email: normalizedEmail });
  await EmailVerification.create({
    email: normalizedEmail,
    verificationToken: crypto.createHash('sha256').update(verificationToken).digest('hex'),
    expiresAt: new Date(Date.now() + 30 * 60 * 1000)
  });

  const clientUrl = process.env.CLIENT_URL || process.env.FRONTEND_URL || 'http://localhost:5173';
  const verificationUrl = `${clientUrl.replace(/\/$/, '')}/verify-email/${verificationToken}`;
  try {
    await sendEmail({
      to: normalizedEmail,
      subject: 'Verify your StudentNest email',
      text: `Verify your email address to continue registration: ${verificationUrl}\n\nThis link expires in 30 minutes.`,
      html: `<p>Verify your email address to continue registration:</p><p><a href="${verificationUrl}">Verify email address</a></p><p>This link expires in 30 minutes.</p>`
    });
  } catch (error) {
    await EmailVerification.deleteOne({ email: normalizedEmail });
    throw error;
  }

  return res.json(response);
};

export const verifyEmail = async (req, res) => {
  const hashedToken = crypto.createHash('sha256').update(req.params.token || '').digest('hex');
  const verification = await EmailVerification.findOne({
    verificationToken: hashedToken,
    expiresAt: { $gt: new Date() },
    verifiedAt: null
  }).select('+verificationToken');

  if (!verification) return res.status(400).json({ message: 'This verification link is invalid or has expired.' });

  verification.verifiedAt = new Date();
  verification.verificationToken = undefined;
  await verification.save({ validateBeforeSave: false });
  return res.json({ message: 'Email verified successfully.', data: { email: verification.email } });
};

export const registrationVerificationStatus = async (req, res) => {
  const normalizedEmail = req.query.email?.trim().toLowerCase();
  if (!normalizedEmail || !validateEmail(normalizedEmail)) return res.json({ data: { verified: false } });

  const verification = await EmailVerification.findOne({
    email: normalizedEmail,
    verifiedAt: { $ne: null },
    expiresAt: { $gt: new Date() }
  });
  return res.json({ data: { verified: Boolean(verification) } });
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
    data: { user: userResponse(user), token }
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
    subject: 'Reset your StudentNest password',
    text: `Use this link to reset your password: ${resetUrl}\n\nThis link expires in 1 hour. If you did not request this, you can ignore this email.`,
    html: `<p>Use the link below to reset your StudentNest password:</p><p><a href="${resetUrl}">Reset password</a></p><p>This link expires in 1 hour. If you did not request this, you can ignore this email.</p>`
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
    console.warn('Google ID token verification failed', {
      category: getGoogleVerificationErrorCategory(error),
      googleClientIdConfigured: Boolean(process.env.GOOGLE_CLIENT_ID)
    });
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
