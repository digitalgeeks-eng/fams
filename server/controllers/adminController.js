import User from '../models/User.js';
import Property from '../models/Property.js';
import Booking from '../models/Booking.js';
import Payment from '../models/Payment.js';
import Complaint from '../models/Complaint.js';

export const getAnalytics = async (req, res) => {
  const totalStudents = await User.countDocuments({ role: 'student' });
  const verifiedAgents = await User.countDocuments({ role: 'agent', verificationStatus: 'verified' });
  const pendingAgents = await User.countDocuments({ role: 'agent', verificationStatus: 'pending' });
  const activeProperties = await Property.countDocuments({ approvalStatus: 'approved' });
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
  const properties = await Property.find().populate('agentId', 'name email').sort({ createdAt: -1 });
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
  const { search = '', role } = req.query;
  const filter = {};

  if (role && ['student', 'agent', 'admin'].includes(role)) {
    filter.role = role;
  }

  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } }
    ];
  }

  const users = await User.find(filter).select('-password').sort({ createdAt: -1 });
  res.json({ data: users });
};

export const deleteUser = async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ message: 'User not found' });
  if (user._id.toString() === req.user._id.toString()) {
    return res.status(403).json({ message: 'You cannot delete your own account' });
  }
  await user.remove();
  res.json({ message: 'User deleted successfully' });
};

export const updateUserRole = async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ message: 'User not found' });
  const { role } = req.body;
  if (!['student', 'agent', 'admin'].includes(role)) return res.status(400).json({ message: 'Invalid role' });
  user.role = role;
  await user.save();
  res.json({ message: 'User role updated', data: user });
};
