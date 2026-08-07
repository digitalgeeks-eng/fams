import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import { authorizeRoles } from '../middleware/roleMiddleware.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import {
  sendNotification,
  createChatMessage,
  listChatMessages,
  listNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  getAllNotifications,
  editNotification,
  deleteNotification
} from '../controllers/communicationController.js';

const router = express.Router();
router.use(protect);
router.post('/notifications', authorizeRoles('admin'), asyncHandler(sendNotification));
router.post('/messages', asyncHandler(createChatMessage));
router.get('/messages', asyncHandler(listChatMessages));
router.get('/notifications', asyncHandler(listNotifications));
router.put('/notifications/:id/read', asyncHandler(markNotificationRead));
router.put('/notifications/read-all', asyncHandler(markAllNotificationsRead));
router.get('/notifications/admin/all', authorizeRoles('admin'), asyncHandler(getAllNotifications));
router.put('/notifications/admin/:id', authorizeRoles('admin'), asyncHandler(editNotification));
router.delete('/notifications/admin/:id', authorizeRoles('admin'), asyncHandler(deleteNotification));

export default router;
