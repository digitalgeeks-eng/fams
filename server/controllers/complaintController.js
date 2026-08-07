import Complaint from '../models/Complaint.js';

export const createComplaint = async (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ message: 'Complaint message is required' });

  const complaint = await Complaint.create({ studentId: req.user._id, message });
  res.status(201).json({ message: 'Complaint submitted', data: complaint });
};

export const getStudentComplaints = async (req, res) => {
  const complaints = await Complaint.find({ studentId: req.user._id }).sort({ createdAt: -1 });
  res.json({ data: complaints });
};

export const getAdminComplaints = async (req, res) => {
  const complaints = await Complaint.find().populate('studentId', 'name email role').sort({ createdAt: -1 });
  res.json({ data: complaints });
};

export const updateComplaintStatus = async (req, res) => {
  const complaint = await Complaint.findById(req.params.id);
  if (!complaint) return res.status(404).json({ message: 'Complaint not found' });
  const { status } = req.body;
  if (!['pending', 'resolved', 'rejected'].includes(status)) {
    return res.status(400).json({ message: 'Invalid status value' });
  }
  complaint.status = status;
  await complaint.save();
  res.json({ message: 'Complaint status updated', data: complaint });
};
