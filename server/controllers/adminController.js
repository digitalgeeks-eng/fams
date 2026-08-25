import User from '../models/User.js';
import Property from '../models/Property.js';
import Booking from '../models/Booking.js';
import Payment from '../models/Payment.js';
import Complaint from '../models/Complaint.js';
import UserManagementHistory from '../models/UserManagementHistory.js';
import bcrypt from 'bcryptjs';
import AdminActivity from '../models/AdminActivity.js';
import { recordAdminActivity } from '../utils/adminActivity.js';
import { ADMIN_LOCATIONS, adminAccessMessage, getAdminPropertyFilter, isSuperAdmin, normalizeAdminLocation } from '../utils/adminScope.js';
import { validateEmail, validatePasswordStrength } from '../utils/validators.js';

export const getAnalytics = async (req, res) => {
  const propertyScope = getAdminPropertyFilter(req.user);
  const scopedPropertyIds = await Property.find(propertyScope).select('_id agentId');
  const propertyIds = scopedPropertyIds.map((property) => property._id);
  const agentIds = scopedPropertyIds.map((property) => property.agentId);
  const bookingIds = await Booking.find({ propertyId: { $in: propertyIds } }).distinct('_id');
  const studentIds = await Booking.find({ _id: { $in: bookingIds } }).distinct('studentId');
  const totalStudents = isSuperAdmin(req.user) ? await User.countDocuments({ role: 'student' }) : await User.countDocuments({ _id: { $in: studentIds }, role: 'student' });
  const verifiedAgents = isSuperAdmin(req.user) ? await User.countDocuments({ role: 'agent', verificationStatus: 'verified' }) : await User.countDocuments({ _id: { $in: agentIds }, role: 'agent', verificationStatus: 'verified' });
  const pendingAgents = isSuperAdmin(req.user) ? await User.countDocuments({ role: 'agent', verificationStatus: 'pending' }) : await User.countDocuments({ _id: { $in: agentIds }, role: 'agent', verificationStatus: 'pending' });
  const activeProperties = await Property.countDocuments({ ...propertyScope, approvalStatus: 'approved', isDeleted: { $ne: true } });
  const totalBookings = await Booking.countDocuments({ propertyId: { $in: propertyIds } });
  const totalPayments = await Payment.countDocuments({ verificationStatus: 'verified', bookingId: { $in: bookingIds } });
  const pendingComplaints = await Complaint.countDocuments({ status: 'pending' });

  res.json({
    data: { totalStudents, verifiedAgents, pendingAgents, activeProperties, totalBookings, totalPayments, pendingComplaints, adminRole: req.user.adminRole || 'super_admin', assignedLocation: req.user.assignedLocation || null }
  });
};

export const listAgents = async (req, res) => {
  const propertyIds = await Property.find(getAdminPropertyFilter(req.user)).distinct('agentId');
  const agents = await User.find({ role: 'agent', ...(isSuperAdmin(req.user) ? {} : { _id: { $in: propertyIds } }) }).select('-password').sort({ verificationStatus: 1, createdAt: -1 });
  res.json({ data: agents });
};

export const getAgentDetails = async (req, res) => {
  const agent = await User.findById(req.params.id).select('-password');
  if (!agent || agent.role !== 'agent') {
    return res.status(404).json({ message: 'Agent not found' });
  }
  
  // Get agent's properties
  const properties = await Property.find({ agentId: agent._id, ...getAdminPropertyFilter(req.user) }).sort({ createdAt: -1 });
  if (!isSuperAdmin(req.user) && !properties.length) return res.status(403).json({ message: adminAccessMessage });
  
  res.json({ 
    data: {
      ...agent.toObject(),
      properties: properties,
      totalProperties: properties.length,
      approvedProperties: properties.filter(p => p.approvalStatus === 'approved').length,
      pendingProperties: properties.filter(p => p.approvalStatus === 'pending').length,
      rejectedProperties: properties.filter(p => p.approvalStatus === 'rejected').length
    }
  });
};

export const verifyAgent = async (req, res) => {
  const agent = await User.findById(req.params.id).select('-password');
  if (!agent || agent.role !== 'agent') return res.status(404).json({ message: 'Agent not found' });
  const hasScopedProperty = await Property.exists({ agentId: agent._id, ...getAdminPropertyFilter(req.user) });
  if (!isSuperAdmin(req.user) && !hasScopedProperty) return res.status(403).json({ message: adminAccessMessage });
  agent.verificationStatus = req.body.status === 'rejected' ? 'rejected' : 'verified';
  await agent.save();
  res.json({ message: 'Agent verification updated', data: agent });
};

export const listPropertiesAdmin = async (req, res) => {
  const properties = await Property.find(getAdminPropertyFilter(req.user))
    .populate('agentId', 'name email')
    .populate('deletedBy', 'name email')
    .sort({ createdAt: -1 });
  res.json({ data: properties });
};

export const approveProperty = async (req, res) => {
  const property = await Property.findById(req.params.id);
  if (!property) return res.status(404).json({ message: 'Property not found' });
  if (!isSuperAdmin(req.user) && !(await Property.exists({ _id: property._id, ...getAdminPropertyFilter(req.user) }))) return res.status(403).json({ message: adminAccessMessage });
  property.approvalStatus = req.body.status === 'rejected' ? 'rejected' : 'approved';
  await property.save();
  await recordAdminActivity(req.user, property.approvalStatus === 'approved' ? 'property_approved' : 'property_rejected', `Property ${property.title} was ${property.approvalStatus}.`, { propertyId: property._id, propertyLocation: property.location });
  res.json({ message: 'Property status updated', data: property });
};

export const listPaymentsAdmin = async (req, res) => {
  const payments = await Payment.find().populate('bookingId');
  res.json({ data: payments });
};

export const verifyPaymentAdmin = async (req, res) => {
  const payment = await Payment.findById(req.params.id);
  if (!payment) return res.status(404).json({ message: 'Payment record not found' });
  payment.verificationStatus = req.body.status === 'rejected' ? 'rejected' : 'verified';
  await payment.save();
  if (payment.verificationStatus === 'verified') {
    const booking = await Booking.findById(payment.bookingId);
    booking.paymentStatus = 'paid';
    booking.bookingStatus = 'confirmed';
    await booking.save();
  }
  res.json({ message: 'Payment verification updated', data: payment });
};

export const listComplaintsAdmin = async (req, res) => {
  const complaints = await Complaint.find().populate('studentId', 'name email').sort({ createdAt: -1 });
  res.json({ data: complaints });
};

export const listUsersAdmin = async (req, res) => {
  const { search = '', role, status, verificationStatus, authProvider } = req.query;
  const page = Math.max(Number(req.query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
  const filter = {};
  if (!isSuperAdmin(req.user)) filter.role = { $ne: 'admin' };
  if (!isSuperAdmin(req.user)) {
    const scopedProperties = await Property.find(getAdminPropertyFilter(req.user)).select('_id agentId');
    const scopedPropertyIds = scopedProperties.map((property) => property._id);
    const scopedStudentIds = await Booking.find({ propertyId: { $in: scopedPropertyIds } }).distinct('studentId');
    filter.$or = [{ _id: { $in: scopedProperties.map((property) => property.agentId) } }, { _id: { $in: scopedStudentIds } }];
  }

  if (role && ['student', 'agent', 'admin'].includes(role) && (isSuperAdmin(req.user) || role !== 'admin')) {
    filter.role = role;
  }
  if (status && ['active', 'suspended', 'deactivated'].includes(status)) filter.status = status;
  if (verificationStatus && ['pending', 'verified', 'rejected'].includes(verificationStatus)) filter.verificationStatus = verificationStatus;
  if (authProvider && ['local', 'google', 'both'].includes(authProvider)) filter.authProvider = authProvider;

  if (search) {
    filter.$and = [{ $or: [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
      { phone: { $regex: search, $options: 'i' } }
    ] }];
  }

  const [users, totalUsers, statistics] = await Promise.all([
    User.find(filter).select('-password').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    User.countDocuments(filter),
    User.aggregate([{ $group: { _id: '$role', count: { $sum: 1 } } }])
  ]);
  const stats = { total: await User.countDocuments(), active: await User.countDocuments({ status: { $in: [null, 'active'] } }), suspended: await User.countDocuments({ status: 'suspended' }), deactivated: await User.countDocuments({ status: 'deactivated' }), students: 0, agents: 0, admins: 0, pendingAgents: await User.countDocuments({ role: 'agent', verificationStatus: 'pending' }) };
  statistics.forEach((entry) => { stats[`${entry._id}s`] = entry.count; });
  res.json({ data: { users, pagination: { page, limit, totalUsers, totalPages: Math.ceil(totalUsers / limit) }, statistics: stats } });
};

const recordUserAction = (adminId, targetUserId, action, changes = []) => UserManagementHistory.create({ adminId, targetUserId, action, changes });

const isUserWithinAdminScope = async (admin, user) => {
  if (isSuperAdmin(admin) || user.role === 'admin') return false;
  const propertyIds = await Property.find(getAdminPropertyFilter(admin)).distinct('_id');
  return user.role === 'agent'
    ? Boolean(await Property.exists({ _id: { $in: propertyIds }, agentId: user._id }))
    : Boolean(await Booking.exists({ propertyId: { $in: propertyIds }, studentId: user._id }));
};

export const getUserAdmin = async (req, res) => {
  const user = await User.findById(req.params.id).select('-password');
  if (!user) return res.status(404).json({ message: 'User not found' });
  if (user.role === 'admin' && !isSuperAdmin(req.user)) return res.status(403).json({ message: 'Location admins cannot manage administrator accounts.' });
  if (!isSuperAdmin(req.user) && user.role !== 'admin') {
    const scopedPropertyIds = await Property.find(getAdminPropertyFilter(req.user)).distinct('_id');
    const allowed = user.role === 'agent'
      ? await Property.exists({ _id: { $in: scopedPropertyIds }, agentId: user._id })
      : await Booking.exists({ propertyId: { $in: scopedPropertyIds }, studentId: user._id });
    if (!allowed) return res.status(403).json({ message: adminAccessMessage });
  }
  const bookings = await Booking.find({ studentId: user._id }).select('propertyId bookingStatus paymentStatus createdAt').sort({ createdAt: -1 });
  const [properties, complaints, payments, history] = await Promise.all([
    Property.find({ agentId: user._id }).select('title price approvalStatus isDeleted availabilityStatus createdAt').sort({ createdAt: -1 }),
    Complaint.find({ studentId: user._id }).select('message status createdAt').sort({ createdAt: -1 }),
    Payment.find({ $or: [{ userId: user._id }, { bookingId: { $in: bookings.map((booking) => booking._id) } }] }).select('bookingId amount paymentMethod verificationStatus createdAt').sort({ createdAt: -1 }),
    UserManagementHistory.find({ targetUserId: user._id }).populate('adminId', 'name email').sort({ createdAt: -1 })
  ]);
  res.json({ data: { user, properties, bookings, complaints, payments, history } });
};

export const updateUserAdmin = async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ message: 'User not found' });
  if (user.role === 'admin' && !isSuperAdmin(req.user)) return res.status(403).json({ message: 'Location admins cannot manage administrator accounts.' });
  if (!isSuperAdmin(req.user) && user.role !== 'admin') {
    const scopedPropertyIds = await Property.find(getAdminPropertyFilter(req.user)).distinct('_id');
    const allowed = user.role === 'agent'
      ? await Property.exists({ _id: { $in: scopedPropertyIds }, agentId: user._id })
      : await Booking.exists({ propertyId: { $in: scopedPropertyIds }, studentId: user._id });
    if (!allowed) return res.status(403).json({ message: adminAccessMessage });
  }
  const allowedFields = ['name', 'email', 'phone', 'company', 'address', 'bio'];
  const changes = [];
  allowedFields.forEach((field) => {
    if (req.body[field] === undefined || req.body[field] === user[field]) return;
    changes.push({ field, oldValue: user[field], newValue: req.body[field] });
    user[field] = typeof req.body[field] === 'string' ? req.body[field].trim() : req.body[field];
  });
  if (req.body.email) user.email = req.body.email.trim().toLowerCase();
  if (!changes.length) return res.json({ message: 'No user changes submitted', data: user });
  await user.save();
  await recordUserAction(req.user._id, user._id, 'user_updated', changes);
  res.json({ message: 'User updated successfully.', data: user });
};

export const updateUserStatus = async (req, res) => {
  const { status } = req.body;
  if (!['active', 'suspended', 'deactivated'].includes(status)) return res.status(400).json({ message: 'Invalid user status' });
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ message: 'User not found' });
  if (user.role === 'admin' && !isSuperAdmin(req.user)) return res.status(403).json({ message: 'Only the Super Admin can manage administrator accounts.' });
  if (!isSuperAdmin(req.user) && !(await isUserWithinAdminScope(req.user, user))) return res.status(403).json({ message: adminAccessMessage });
  if (user._id.equals(req.user._id)) return res.status(403).json({ message: 'You cannot change your own account status' });
  if (user.role === 'admin' && status !== 'active') {
    const activeAdmins = await User.countDocuments({ role: 'admin', status: { $in: [null, 'active'] } });
    if (activeAdmins <= 1) return res.status(403).json({ message: 'The last active administrator cannot be suspended or deactivated' });
  }
  const oldStatus = user.status || 'active';
  user.status = status;
  await user.save();
  await recordUserAction(req.user._id, user._id, `user_${status}`, [{ field: 'status', oldValue: oldStatus, newValue: status }]);
  if (user.role === 'admin') await recordAdminActivity(req.user, status === 'active' ? 'admin_activated' : 'admin_deactivated', `${user.name} was ${status}.`, { propertyLocation: user.assignedLocation });
  res.json({ message: `User ${status} successfully.`, data: user });
};

export const deleteUser = async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ message: 'User not found' });
  if (user._id.toString() === req.user._id.toString()) return res.status(403).json({ message: 'You cannot deactivate your own account' });
  if (user.role === 'admin' && !isSuperAdmin(req.user)) return res.status(403).json({ message: 'Only the Super Admin can manage administrator accounts.' });
  if (!isSuperAdmin(req.user) && !(await isUserWithinAdminScope(req.user, user))) return res.status(403).json({ message: adminAccessMessage });
  if (user.role === 'admin') {
    const activeAdmins = await User.countDocuments({ role: 'admin', status: { $in: [null, 'active'] } });
    if (activeAdmins <= 1) return res.status(403).json({ message: 'The last active administrator cannot be deactivated' });
  }
  const oldStatus = user.status || 'active';
  user.status = 'deactivated';
  await user.save();
  await recordUserAction(req.user._id, user._id, 'user_deactivated', [{ field: 'status', oldValue: oldStatus, newValue: 'deactivated' }]);
  res.json({ message: 'User deactivated successfully.', data: user });
};

export const updateUserRole = async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ message: 'User not found' });
  const { role } = req.body;
  if ((user.role === 'admin' || role === 'admin') && !isSuperAdmin(req.user)) return res.status(403).json({ message: 'Only the Super Admin can manage administrator roles.' });
  if (!isSuperAdmin(req.user) && !(await isUserWithinAdminScope(req.user, user))) return res.status(403).json({ message: adminAccessMessage });
  if (!['student', 'agent', 'admin'].includes(role)) return res.status(400).json({ message: 'Invalid role' });
  if (user._id.equals(req.user._id) && role !== 'admin') return res.status(403).json({ message: 'You cannot remove your own administrator role' });
  if (user.role === 'admin' && role !== 'admin') {
    const activeAdmins = await User.countDocuments({ role: 'admin', status: { $in: [null, 'active'] } });
    if (activeAdmins <= 1) return res.status(403).json({ message: 'The last administrator cannot lose administrator access' });
  }
  const oldRole = user.role;
  user.role = role;
  await user.save();
  await recordUserAction(req.user._id, user._id, 'role_changed', [{ field: 'role', oldValue: oldRole, newValue: role }]);
  res.json({ message: 'User role updated successfully.', data: user });
};

export const createLocationAdmin = async (req, res) => {
  const { name, email, phone, password, assignedLocation } = req.body;
  const normalizedLocation = normalizeAdminLocation(assignedLocation);
  if (!name?.trim() || !validateEmail(email?.trim().toLowerCase()) || !validatePasswordStrength(password) || !phone?.trim() || !normalizedLocation) {
    return res.status(400).json({ message: 'Name, valid email, phone, password, and assigned location are required.' });
  }
  const normalizedEmail = email.trim().toLowerCase();
  if (await User.exists({ email: normalizedEmail })) return res.status(409).json({ message: 'Email already registered' });
  const user = await User.create({ name: name.trim(), email: normalizedEmail, phone: phone.trim(), password: await bcrypt.hash(password, 10), role: 'admin', adminRole: 'location_admin', assignedLocation: normalizedLocation, adminSource: 'created_as_admin', verificationStatus: 'verified', authProvider: 'local' });
  await recordAdminActivity(req.user, 'admin_created', `Location Admin created for ${normalizedLocation}.`, { propertyLocation: normalizedLocation });
  res.status(201).json({ message: 'Location Admin created successfully.', data: { user: { id: user._id, name: user.name, email: user.email, phone: user.phone, role: user.role, adminRole: user.adminRole, assignedLocation: user.assignedLocation, status: user.status, createdAt: user.createdAt } } });
};

export const listAdmins = async (req, res) => {
  const admins = await User.find({ role: 'admin' }).select('-password -passwordResetToken -passwordResetExpires').sort({ createdAt: -1 });
  res.json({ data: admins });
};

export const searchUsersForPromotion = async (req, res) => {
  const search = String(req.query.search || '').trim();
  const page = Math.max(Number(req.query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 25);
  const filter = {};
  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
      { phone: { $regex: search, $options: 'i' } }
    ];
  }
  const [users, total] = await Promise.all([
    User.find(filter).select('_id name email phone role adminRole assignedLocation status createdAt').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    User.countDocuments(filter)
  ]);
  res.json({ data: { users, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } } });
};

export const promoteUserToLocationAdmin = async (req, res) => {
  const assignedLocation = normalizeAdminLocation(req.body.assignedLocation);
  if (!assignedLocation) return res.status(400).json({ message: 'A valid assigned location is required.' });

  const target = await User.findById(req.params.id).select('+password');
  if (!target) return res.status(404).json({ message: 'User not found' });
  if (target.role === 'admin' && (target.adminRole || 'super_admin') === 'super_admin') return res.status(409).json({ message: 'This user is already a Super Admin.' });
  if (target.role === 'admin' && target.adminRole === 'location_admin') {
    const oldLocation = target.assignedLocation;
    target.assignedLocation = assignedLocation;
    await target.save();
    await recordAdminActivity(req.user, 'admin_location_changed', `${target.name}'s location changed from ${oldLocation || 'none'} to ${assignedLocation}.`, { propertyLocation: assignedLocation });
    return res.json({ message: `${target.name}'s Location Admin assignment was changed to ${assignedLocation}.`, data: target });
  }

  const previousRole = target.role;
  const updated = await User.findOneAndUpdate(
    { _id: target._id, role: { $ne: 'admin' } },
    { $set: { role: 'admin', adminRole: 'location_admin', assignedLocation, adminSource: 'promoted_existing_user' } },
    { new: true, runValidators: true }
  ).select('-password -passwordResetToken -passwordResetExpires');
  if (!updated) return res.status(409).json({ message: 'This user was already changed. Refresh and try again.' });

  await recordAdminActivity(req.user, 'user_promoted_to_location_admin', `${updated.name} was promoted from ${previousRole} to Location Admin for ${assignedLocation}.`, { propertyLocation: assignedLocation });
  res.json({ message: `${updated.name} has been promoted to Location Admin for ${assignedLocation}.`, data: updated });
};

export const updateAdminScope = async (req, res) => {
  const admin = await User.findOne({ _id: req.params.id, role: 'admin' });
  const assignedLocation = normalizeAdminLocation(req.body.assignedLocation);
  if (!admin) return res.status(404).json({ message: 'Administrator not found' });
  if (admin.adminRole === 'super_admin') return res.status(403).json({ message: 'The Super Admin scope cannot be changed.' });
  if (admin._id.equals(req.user._id)) return res.status(403).json({ message: 'You cannot change your own administrator scope.' });
  if (!assignedLocation) return res.status(400).json({ message: 'A valid assigned location is required.' });
  const oldLocation = admin.assignedLocation;
  admin.adminRole = 'location_admin';
  admin.assignedLocation = assignedLocation;
  admin.adminSource = admin.adminSource || 'created_as_admin';
  await admin.save();
  await recordAdminActivity(req.user, 'admin_location_changed', `Administrator location changed from ${oldLocation || 'none'} to ${assignedLocation}.`, { propertyLocation: assignedLocation });
  res.json({ message: 'Administrator location updated successfully.', data: admin });
};

export const listAdminActivities = async (req, res) => {
  const activities = await AdminActivity.find().sort({ timestamp: -1 }).limit(200).populate('adminId', 'name email');
  res.json({ data: activities });
};

export { ADMIN_LOCATIONS };
