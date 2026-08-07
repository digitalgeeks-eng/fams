import User from '../models/User.js';
import Recommendation from '../models/Recommendation.js';
import { getRecommendations, updateRecommendationData, updateUserLocation, trackPropertyTypePreference } from '../services/recommendationService.js';

export const getProfile = async (req, res) => {
  res.json({ data: req.user });
};

export const updateProfile = async (req, res) => {
  const updates = { name: req.body.name || req.user.name };
  const user = await User.findByIdAndUpdate(req.user._id, updates, { new: true }).select('-password');
  res.json({ message: 'Profile updated', data: user });
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
