import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import { authorizeAdminRoles, authorizeRoles } from '../middleware/roleMiddleware.js';
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
import { createLocationAdmin, listAdmins, searchUsersForPromotion, promoteUserToLocationAdmin, updateAdminScope, listAdminActivities } from '../controllers/adminController.js';
import { getUserAdmin, updateUserAdmin, updateUserStatus } from '../controllers/adminController.js';
import { getDeletedProperties } from '../controllers/propertyController.js';
import { getAdminPayments, verifyPaymentAdmin } from '../controllers/paymentController.js';
import { getAdminBookings } from '../controllers/bookingController.js';

const router = express.Router();
router.use(protect, authorizeRoles('admin'));
router.post('/admins', authorizeAdminRoles('super_admin'), asyncHandler(createLocationAdmin));
router.get('/admins', authorizeAdminRoles('super_admin'), asyncHandler(listAdmins));
router.get('/users/search', authorizeAdminRoles('super_admin'), asyncHandler(searchUsersForPromotion));
router.post('/users/:id/promote', authorizeAdminRoles('super_admin'), asyncHandler(promoteUserToLocationAdmin));
router.patch('/admins/:id/scope', authorizeAdminRoles('super_admin'), asyncHandler(updateAdminScope));
router.get('/activities', authorizeAdminRoles('super_admin'), asyncHandler(listAdminActivities));
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
router.get('/users/:id', asyncHandler(getUserAdmin));
router.put('/users/:id', asyncHandler(updateUserAdmin));
router.patch('/users/:id/status', asyncHandler(updateUserStatus));
router.put('/users/:id/role', asyncHandler(updateUserRole));
router.delete('/users/:id', asyncHandler(deleteUser));
export default router;
