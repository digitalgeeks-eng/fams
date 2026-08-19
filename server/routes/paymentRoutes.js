import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import { authorizeRoles } from '../middleware/roleMiddleware.js';
import { uploadImages, uploadPaymentProofFile } from '../middleware/uploadMiddleware.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
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
router.post('/initialize', protect, authorizeRoles('student'), asyncHandler(initializePaymentController));
router.get('/verify/:reference', protect, authorizeRoles('student'), asyncHandler(verifyPaymentController));
router.post('/upload-proof', protect, authorizeRoles('student'), uploadImages.single('proofImage'), asyncHandler(uploadPaymentProof));
router.post('/manual/proof', protect, authorizeRoles('student'), uploadPaymentProofFile.single('proof'), asyncHandler(submitManualPaymentProof));
router.post('/webhook', express.json({ type: '*/*' }), asyncHandler(paymentWebhook));
router.get('/student', protect, authorizeRoles('student'), asyncHandler(getStudentPayments));
router.get('/admin', protect, authorizeRoles('admin'), asyncHandler(getAdminPayments));
export default router;
