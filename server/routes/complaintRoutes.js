import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import { authorizeAdminRoles, authorizeRoles } from '../middleware/roleMiddleware.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { createComplaint, getStudentComplaints, getAdminComplaints, updateComplaintStatus } from '../controllers/complaintController.js';

const router = express.Router();
router.post('/', protect, authorizeRoles('student', 'agent'), asyncHandler(createComplaint));
router.get('/student', protect, authorizeRoles('student', 'agent'), asyncHandler(getStudentComplaints));
router.get('/admin', protect, authorizeAdminRoles('super_admin'), asyncHandler(getAdminComplaints));
router.put('/:id/status', protect, authorizeAdminRoles('super_admin'), asyncHandler(updateComplaintStatus));
export default router;
