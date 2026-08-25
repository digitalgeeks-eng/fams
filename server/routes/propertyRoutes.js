import express from 'express';
import { optionalProtect, protect } from '../middleware/authMiddleware.js';
import { authorizeRoles } from '../middleware/roleMiddleware.js';
import { uploadPropertyMedia, validateUploadedFiles } from '../middleware/uploadMiddleware.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
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

const router = express.Router();
router.get('/', asyncHandler(listProperties));
router.get('/agent/me', protect, authorizeRoles('agent'), asyncHandler(getAgentProperties));
router.get('/:id', optionalProtect, asyncHandler(getProperty));
router.post(
  '/',
  protect,
  authorizeRoles('agent', 'admin'),
  uploadPropertyMedia.fields([
    { name: 'images', maxCount: 15 },
    { name: 'videos', maxCount: 5 }
  ]),
  validateUploadedFiles,
  asyncHandler(createProperty)
);
router.put(
  '/:id',
  protect,
  authorizeRoles('agent', 'admin'),
  uploadPropertyMedia.fields([
    { name: 'images', maxCount: 15 },
    { name: 'videos', maxCount: 5 }
  ]),
  validateUploadedFiles,
  asyncHandler(updateProperty)
);
router.get('/:id/history', protect, authorizeRoles('admin'), asyncHandler(getPropertyHistory));
router.patch('/:id/restore', protect, authorizeRoles('admin'), asyncHandler(restoreProperty));
router.post('/:id/rate', protect, authorizeRoles('student'), asyncHandler(rateProperty));
router.delete('/:id', protect, authorizeRoles('agent', 'admin'), asyncHandler(deleteProperty));
export default router;
