import express from 'express';
import { optionalProtect, protect } from '../middleware/authMiddleware.js';
import { authorizeRoles } from '../middleware/roleMiddleware.js';
import { uploadPropertyMedia, uploadRoomPropertyMedia, validateUploadedFiles } from '../middleware/uploadMiddleware.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { PROPERTY_MEDIA_LIMITS } from '../utils/propertyMedia.js';
import {
  listProperties,
  getProperty,
  createProperty,
  updateProperty,
  deleteProperty,
  getAgentProperties,
  rateProperty,
  getPropertyHistory,
  restoreProperty
} from '../controllers/propertyController.js';
import {
  createPropertyRooms,
  createRoomInspectionRequest,
  deactivatePropertyRoom,
  getPropertyRooms,
  listStudentRoomInspectionRequests,
  listRoomInspectionRequests,
  updatePropertyRoom,
  updateRoomInspectionRequest
} from '../controllers/roomController.js';

const router = express.Router();
router.get('/', asyncHandler(listProperties));
router.get('/agent/me', protect, authorizeRoles('agent'), asyncHandler(getAgentProperties));
router.get('/:propertyId/rooms', optionalProtect, asyncHandler(getPropertyRooms));
router.post(
  '/:propertyId/rooms',
  protect,
  authorizeRoles('agent', 'admin'),
  uploadRoomPropertyMedia.fields([
    { name: 'images', maxCount: 5 },
    { name: 'videos', maxCount: 2 }
  ]),
  validateUploadedFiles,
  asyncHandler(createPropertyRooms)
);
router.get(
  '/:propertyId/room-inspection-requests',
  protect,
  authorizeRoles('agent', 'admin'),
  asyncHandler(listRoomInspectionRequests)
);
router.get(
  '/:propertyId/my-room-inspection-requests',
  protect,
  authorizeRoles('student'),
  asyncHandler(listStudentRoomInspectionRequests)
);
router.patch(
  '/:propertyId/room-inspection-requests/:requestId',
  protect,
  authorizeRoles('agent', 'admin'),
  asyncHandler(updateRoomInspectionRequest)
);
router.put(
  '/:propertyId/rooms/:roomId',
  protect,
  authorizeRoles('agent', 'admin'),
  uploadRoomPropertyMedia.fields([
    { name: 'images', maxCount: 5 },
    { name: 'videos', maxCount: 2 }
  ]),
  validateUploadedFiles,
  asyncHandler(updatePropertyRoom)
);
router.delete(
  '/:propertyId/rooms/:roomId',
  protect,
  authorizeRoles('agent', 'admin'),
  asyncHandler(deactivatePropertyRoom)
);
router.post(
  '/:propertyId/rooms/:roomId/inspection-requests',
  protect,
  authorizeRoles('student'),
  asyncHandler(createRoomInspectionRequest)
);
router.get('/:id', optionalProtect, asyncHandler(getProperty));
router.post(
  '/',
  protect,
  authorizeRoles('agent', 'admin'),
  uploadPropertyMedia.fields([
    { name: 'images', maxCount: PROPERTY_MEDIA_LIMITS.images },
    { name: 'videos', maxCount: PROPERTY_MEDIA_LIMITS.videos }
  ]),
  validateUploadedFiles,
  asyncHandler(createProperty)
);
router.put(
  '/:id',
  protect,
  authorizeRoles('agent', 'admin'),
  uploadPropertyMedia.fields([
    { name: 'images', maxCount: PROPERTY_MEDIA_LIMITS.images },
    { name: 'videos', maxCount: PROPERTY_MEDIA_LIMITS.videos }
  ]),
  validateUploadedFiles,
  asyncHandler(updateProperty)
);
router.get('/:id/history', protect, authorizeRoles('admin'), asyncHandler(getPropertyHistory));
router.patch('/:id/restore', protect, authorizeRoles('admin'), asyncHandler(restoreProperty));
router.post('/:id/rate', protect, authorizeRoles('student'), asyncHandler(rateProperty));
router.delete('/:id', protect, authorizeRoles('agent', 'admin'), asyncHandler(deleteProperty));
export default router;
