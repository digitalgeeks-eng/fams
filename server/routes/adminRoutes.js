import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import { authorizeRoles } from '../middleware/roleMiddleware.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import {
  getAnalytics,
  listAgents,
  verifyAgent,
  getAgentDetails,
  listPropertiesAdmin,
  approveProperty,
  listComplaintsAdmin,
  listUsersAdmin,
  updateUserRole,
  deleteUser
} from '../controllers/adminController.js';
import { getDeletedProperties } from '../controllers/propertyController.js';
import { getAdminPayments, verifyPaymentAdmin } from '../controllers/paymentController.js';
import { getAdminBookings } from '../controllers/bookingController.js';

const router = express.Router();
router.use(protect, authorizeRoles('admin'));
router.get('/analytics', asyncHandler(getAnalytics));
router.get('/agents', asyncHandler(listAgents));
router.get('/agents/:id', asyncHandler(getAgentDetails));
router.put('/agents/:id/verify', asyncHandler(verifyAgent));
router.get('/properties', asyncHandler(listPropertiesAdmin));
router.get('/properties/deleted', asyncHandler(getDeletedProperties));
router.put('/properties/:id/approve', asyncHandler(approveProperty));
router.get('/payments', asyncHandler(getAdminPayments));
router.get('/bookings', asyncHandler(getAdminBookings));
router.put('/payments/:id/verify', asyncHandler(verifyPaymentAdmin));
router.get('/complaints', asyncHandler(listComplaintsAdmin));
router.get('/users', asyncHandler(listUsersAdmin));
router.put('/users/:id/role', asyncHandler(updateUserRole));
router.delete('/users/:id', asyncHandler(deleteUser));
export default router;
