import User from '../models/User.js';
import Recommendation from '../models/Recommendation.js';
import { getRecommendations, updateRecommendationData, updateUserLocation, trackPropertyTypePreference } from '../services/recommendationService.js';
import { validateBankDetails } from '../utils/validators.js';

export const getProfile = async (req, res) => {
  const user = await User.findById(req.user._id).select('-password');
  res.json({ data: user });
};

export const updateProfile = async (req, res) => {
  const allowedFields = ['name', 'phone', 'company', 'address', 'bio', 'yearsOfExperience', 'licenseNumber', 'accountNumber', 'bankName', 'accountName'];
  const updates = {};

  allowedFields.forEach((field) => {
    if (req.body[field] === undefined) return;
    if (field === 'name') {
      const value = typeof req.body[field] === 'string' ? req.body[field].trim() : '';
      if (!value) {
        return res.status(400).json({ message: 'Name is required' });
      }
      updates.name = value;
      return;
    }

    if (['phone', 'company', 'address', 'bio', 'licenseNumber', 'accountNumber', 'bankName', 'accountName'].includes(field)) {
      updates[field] = typeof req.body[field] === 'string' ? req.body[field].trim() : req.body[field];
    }

    if (field === 'yearsOfExperience') {
      const value = Number(req.body[field]);
      if (req.body[field] === '' || Number.isNaN(value) || value < 0) {
        return res.status(400).json({ message: 'Years of experience must be a valid number' });
      }
      updates.yearsOfExperience = value;
    }
  });

  const hasBankInput = ['accountNumber', 'bankName', 'accountName'].some((field) => req.body[field] !== undefined);
  if (hasBankInput) {
    const bankValidation = validateBankDetails({
      accountNumber: req.body.accountNumber,
      bankName: req.body.bankName,
      accountName: req.body.accountName
    });

    if (!bankValidation.valid) {
      return res.status(400).json({ message: bankValidation.message });
    }

    updates.accountNumber = bankValidation.normalized.accountNumber;
    updates.bankName = bankValidation.normalized.bankName;
    updates.accountName = bankValidation.normalized.accountName;
  }

  if (!Object.keys(updates).length) {
    return res.status(400).json({ message: 'No profile changes submitted' });
  }

  const user = await User.findByIdAndUpdate(req.user._id, updates, { new: true }).select('-password');
  res.json({ message: req.user.role === 'agent' ? 'Bank information updated successfully.' : 'Profile updated', data: user });
};

export const trackUserLocation = async (req, res) => {
  const { latitude, longitude, locationName } = req.body;
  
  if (typeof latitude !== 'number' || typeof longitude !== 'number') {
    return res.status(400).json({ message: 'Valid latitude and longitude are required' });
  }

  await updateUserLocation({ userId: req.user._id, latitude, longitude, locationName });
  res.json({ message: 'Location tracked successfully' });
};

export const getUserRecommendations = async (req, res) => {
  const recommendations = await getRecommendations(req.user._id);
  await updateRecommendationData({ userId: req.user._id });
  res.json({ data: recommendations });
};

export const addSearchHistory = async (req, res) => {
  const { query, location, minPrice, maxPrice, propertyType } = req.body;
  
  // Track search history
  await updateRecommendationData({ userId: req.user._id, searchQuery: query, location, minPrice, maxPrice, propertyType });
  
  // Track property type preference separately
  if (propertyType) {
    await trackPropertyTypePreference({ userId: req.user._id, propertyType });
  }

  res.json({ message: 'Search history saved' });
};
