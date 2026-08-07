import express from 'express';
import { getProfile, updateProfile, getUserRecommendations, addSearchHistory, trackUserLocation } from '../controllers/userController.js';
import { protect } from '../middleware/authMiddleware.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

const router = express.Router();
router.use(protect);
router.get('/profile', asyncHandler(getProfile));
router.put('/profile', asyncHandler(updateProfile));
router.get('/recommendations', asyncHandler(getUserRecommendations));
router.post('/search-history', asyncHandler(addSearchHistory));
router.post('/track-location', asyncHandler(trackUserLocation));
export default router;
