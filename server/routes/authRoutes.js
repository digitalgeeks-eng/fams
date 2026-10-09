import express from 'express';
import { register, verifyRegistrationCode, resendRegistrationCode, login, forgotPassword, resetPassword, googleLogin, getMe, sendRegistrationVerification, verifyEmail, registrationVerificationStatus } from '../controllers/authController.js';
import { protect } from '../middleware/authMiddleware.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { uploadImages, validateUploadedFiles } from '../middleware/uploadMiddleware.js';
import { authLimiter, emailLimiter, uploadLimiter, registrationVerificationLimiter, registrationResendLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();
router.post('/register', authLimiter, uploadLimiter, uploadImages.fields([
  { name: 'idImage', maxCount: 1 },
  { name: 'licenseImage', maxCount: 1 }
]), validateUploadedFiles, asyncHandler(register));
router.post('/verify-registration', registrationVerificationLimiter, asyncHandler(verifyRegistrationCode));
router.post('/resend-registration-code', registrationResendLimiter, asyncHandler(resendRegistrationCode));
router.post('/send-registration-verification', emailLimiter, asyncHandler(sendRegistrationVerification));
router.get('/verify-email/:token', emailLimiter, asyncHandler(verifyEmail));
router.get('/registration-verification-status', emailLimiter, asyncHandler(registrationVerificationStatus));
router.post('/login', authLimiter, asyncHandler(login));
router.post('/forgot-password', emailLimiter, asyncHandler(forgotPassword));
router.post('/reset-password/:token', emailLimiter, asyncHandler(resetPassword));
router.post('/google', authLimiter, asyncHandler(googleLogin));
router.get('/me', protect, asyncHandler(getMe));
export default router;
