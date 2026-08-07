import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import { authorizeRoles } from '../middleware/roleMiddleware.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import {
  createBooking,
  getStudentBookings,
  getAgentBookings,
  getBooking,
  cancelBooking,
  approveBooking,
  rejectBooking
} from '../controllers/bookingController.js';

const router = express.Router();
router.post('/', protect, authorizeRoles('student'), asyncHandler(createBooking));
router.get('/student', protect, authorizeRoles('student'), asyncHandler(getStudentBookings));
router.get('/agent', protect, authorizeRoles('agent'), asyncHandler(getAgentBookings));
router.get('/:id', protect, asyncHandler(getBooking));
router.put('/:id/cancel', protect, authorizeRoles('student'), asyncHandler(cancelBooking));
router.put('/:id/approve', protect, authorizeRoles('agent', 'admin'), asyncHandler(approveBooking));
router.put('/:id/reject', protect, authorizeRoles('agent', 'admin'), asyncHandler(rejectBooking));
export default router;
