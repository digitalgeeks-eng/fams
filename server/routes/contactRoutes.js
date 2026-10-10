import express from 'express';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { contactInquiryLimiter } from '../middleware/rateLimiter.js';
import { submitContactInquiry } from '../controllers/contactInquiryController.js';

const router = express.Router();

router.post('/', contactInquiryLimiter, asyncHandler(submitContactInquiry));

export default router;
