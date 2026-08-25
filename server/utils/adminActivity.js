import AdminActivity from '../models/AdminActivity.js';

export const recordAdminActivity = (admin, action, description, details = {}) => AdminActivity.create({
  adminId: admin._id,
  adminName: admin.name,
  adminRole: admin.adminRole || 'super_admin',
  assignedLocation: admin.assignedLocation,
  action,
  description,
  ...details
});
