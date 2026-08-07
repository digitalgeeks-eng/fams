import express from 'express';
import { register, login, getMe } from '../controllers/authController.js';
import { protect } from '../middleware/authMiddleware.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { uploadImages } from '../middleware/uploadMiddleware.js';

const router = express.Router();
router.post('/register', uploadImages.fields([
  { name: 'idImage', maxCount: 1 },
  { name: 'licenseImage', maxCount: 1 }
]), asyncHandler(register));
router.post('/login', asyncHandler(login));
router.get('/me', protect, asyncHandler(getMe));
export default router;
