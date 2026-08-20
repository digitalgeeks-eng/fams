import User from '../models/User.js';
import Property from '../models/Property.js';
import Booking from '../models/Booking.js';
import Payment from '../models/Payment.js';
import Complaint from '../models/Complaint.js';
import UserManagementHistory from '../models/UserManagementHistory.js';

export const getAnalytics = async (req, res) => {
  const totalStudents = await User.countDocuments({ role: 'student' });
  const verifiedAgents = await User.countDocuments({ role: 'agent', verificationStatus: 'verified' });
  const pendingAgents = await User.countDocuments({ role: 'agent', verificationStatus: 'pending' });
  const activeProperties = await Property.countDocuments({ approvalStatus: 'approved', isDeleted: { $ne: true } });
  const totalBookings = await Booking.countDocuments();
  const totalPayments = await Payment.countDocuments({ verificationStatus: 'verified' });
  const pendingComplaints = await Complaint.countDocuments({ status: 'pending' });

  res.json({
    data: { totalStudents, verifiedAgents, pendingAgents, activeProperties, totalBookings, totalPayments, pendingComplaints }
  });
};

export const listAgents = async (req, res) => {
  const agents = await User.find({ role: 'agent' }).select('-password').sort({ verificationStatus: 1, createdAt: -1 });
  res.json({ data: agents });
};

export const getAgentDetails = async (req, res) => {
  const agent = await User.findById(req.params.id).select('-password');
  if (!agent || agent.role !== 'agent') {
    return res.status(404).json({ message: 'Agent not found' });
  }
  
  // Get agent's properties
  const properties = await Property.find({ agentId: agent._id }).sort({ createdAt: -1 });
  
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
  agent.verificationStatus = req.body.status === 'rejected' ? 'rejected' : 'verified';
  await agent.save();
  res.json({ message: 'Agent verification updated', data: agent });
};

export const listPropertiesAdmin = async (req, res) => {
  const properties = await Property.find()
    .populate('agentId', 'name email')
    .populate('deletedBy', 'name email')
    .sort({ createdAt: -1 });
  res.json({ data: properties });
};

export const approveProperty = async (req, res) => {
  const property = await Property.findById(req.params.id);
  if (!property) return res.status(404).json({ message: 'Property not found' });
  property.approvalStatus = req.body.status === 'rejected' ? 'rejected' : 'approved';
  await property.save();
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

  if (role && ['student', 'agent', 'admin'].includes(role)) {
    filter.role = role;
  }
  if (status && ['active', 'suspended', 'deactivated'].includes(status)) filter.status = status;
  if (verificationStatus && ['pending', 'verified', 'rejected'].includes(verificationStatus)) filter.verificationStatus = verificationStatus;
  if (authProvider && ['local', 'google', 'both'].includes(authProvider)) filter.authProvider = authProvider;

  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
      { phone: { $regex: search, $options: 'i' } }
    ];
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

export const getUserAdmin = async (req, res) => {
  const user = await User.findById(req.params.id).select('-password');
  if (!user) return res.status(404).json({ message: 'User not found' });
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
  if (user._id.equals(req.user._id)) return res.status(403).json({ message: 'You cannot change your own account status' });
  if (user.role === 'admin' && status !== 'active') {
    const activeAdmins = await User.countDocuments({ role: 'admin', status: { $in: [null, 'active'] } });
    if (activeAdmins <= 1) return res.status(403).json({ message: 'The last active administrator cannot be suspended or deactivated' });
  }
  const oldStatus = user.status || 'active';
  user.status = status;
  await user.save();
  await recordUserAction(req.user._id, user._id, `user_${status}`, [{ field: 'status', oldValue: oldStatus, newValue: status }]);
  res.json({ message: `User ${status} successfully.`, data: user });
};

export const deleteUser = async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ message: 'User not found' });
  if (user._id.toString() === req.user._id.toString()) return res.status(403).json({ message: 'You cannot deactivate your own account' });
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
