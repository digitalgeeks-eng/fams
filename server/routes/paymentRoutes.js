import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import { authorizeRoles } from '../middleware/roleMiddleware.js';
import { uploadImages, uploadPaymentProofFile, validateUploadedFiles } from '../middleware/uploadMiddleware.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { paymentLimiter, uploadLimiter } from '../middleware/rateLimiter.js';
import {
  initializePaymentController,
  verifyPaymentController,
  uploadPaymentProof,
  paymentWebhook,
  getStudentPayments,
  getAdminPayments,
  submitManualPaymentProof
} from '../controllers/paymentController.js';

const router = express.Router();
router.post('/initialize', protect, authorizeRoles('student'), paymentLimiter, asyncHandler(initializePaymentController));
router.get('/verify/:reference', protect, authorizeRoles('student'), paymentLimiter, asyncHandler(verifyPaymentController));
router.post('/upload-proof', protect, authorizeRoles('student'), uploadLimiter, uploadImages.single('proofImage'), validateUploadedFiles, asyncHandler(uploadPaymentProof));
router.post('/manual/proof', protect, authorizeRoles('student'), uploadLimiter, uploadPaymentProofFile.single('proof'), validateUploadedFiles, asyncHandler(submitManualPaymentProof));
router.post('/webhook', asyncHandler(paymentWebhook));
router.get('/student', protect, authorizeRoles('student'), asyncHandler(getStudentPayments));
router.get('/admin', protect, authorizeRoles('admin'), asyncHandler(getAdminPayments));
export default router;
