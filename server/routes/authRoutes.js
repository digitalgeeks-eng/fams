import express from 'express';
import { register, login, forgotPassword, resetPassword, googleLogin, getMe } from '../controllers/authController.js';
import { protect } from '../middleware/authMiddleware.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { uploadImages } from '../middleware/uploadMiddleware.js';

const router = express.Router();
router.post('/register', uploadImages.fields([
  { name: 'idImage', maxCount: 1 },
  { name: 'licenseImage', maxCount: 1 }
]), asyncHandler(register));
router.post('/login', asyncHandler(login));
router.post('/forgot-password', asyncHandler(forgotPassword));
router.post('/reset-password/:token', asyncHandler(resetPassword));
router.post('/google', asyncHandler(googleLogin));
router.get('/me', protect, asyncHandler(getMe));
export default router;
