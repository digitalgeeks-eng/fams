import Message from '../models/Message.js';
import Notification from '../models/Notification.js';
import User from '../models/User.js';
import { sendEmail, buildNotificationEmail } from '../services/emailService.js';

const createNotification = async ({ userId, type, title, message, relatedId }) => {
  const notification = await Notification.create({ userId, type, title, message, relatedId });
  return notification;
};

const resolveRecipients = async ({ audience, userIds }) => {
  if (Array.isArray(userIds) && userIds.length > 0) {
    return await User.find({ _id: { $in: userIds } }).select('email _id');
  }

  if (audience === 'all') {
    return await User.find({}).select('email _id');
  }

  if (audience === 'student') {
    return await User.find({ role: 'student' }).select('email _id');
  }

  if (audience === 'agent') {
    return await User.find({ role: 'agent' }).select('email _id');
  }

  if (audience === 'admin') {
    return await User.find({ role: 'admin' }).select('email _id');
  }

  return [];
};

export const sendNotification = async (req, res) => {
  const { title, message, audience = 'all', userIds = [] } = req.body;
  if (!title || !message) return res.status(400).json({ message: 'Title and message are required' });

  const recipients = await resolveRecipients({ audience, userIds });
  if (!recipients.length) {
    return res.status(404).json({ message: 'No recipients found for the selected target' });
  }

  const notifications = await Notification.insertMany(
    recipients.map((recipient) => ({
      userId: recipient._id,
      type: 'notification',
      title,
      message,
      relatedId: null
    }))
  );

  const emailPayload = buildNotificationEmail({ title, message });
  await Promise.all(
    recipients.map((recipient) => sendEmail({ to: recipient.email, ...emailPayload }).catch(() => null))
  );

  res.status(201).json({ message: 'Notifications sent successfully', data: notifications });
};

export const createChatMessage = async (req, res) => {
  const { recipientId, bookingId, content } = req.body;
  if (!recipientId || !content) return res.status(400).json({ message: 'Recipient and content are required' });

  const message = await Message.create({ senderId: req.user._id, recipientId, bookingId, content });
  await createNotification({
    userId: recipientId,
    type: 'chat',
    title: 'New message',
    message: `${req.user.name} sent you a message: ${content.slice(0, 80)}`,
    relatedId: message._id
  });

  const recipient = await User.findById(recipientId);
  if (recipient?.email) {
    const emailPayload = buildNotificationEmail({
      title: 'New in-app message received',
      message: `${req.user.name} sent you a new message. Log in to reply.`
    });
    await sendEmail({ to: recipient.email, ...emailPayload }).catch(() => null);
  }

  res.status(201).json({ message: 'Message sent', data: message });
};

export const listChatMessages = async (req, res) => {
  const { bookingId } = req.query;
  const filter = {
    $or: [{ senderId: req.user._id }, { recipientId: req.user._id }]
  };
  if (bookingId) filter.bookingId = bookingId;

  const messages = await Message.find(filter)
    .populate('senderId', 'name role')
    .populate('recipientId', 'name role')
    .sort({ createdAt: 1 });

  res.json({ data: messages });
};

export const listNotifications = async (req, res) => {
  const notifications = await Notification.find({ userId: req.user._id }).sort({ createdAt: -1 });
  res.json({ data: notifications });
};

export const markNotificationRead = async (req, res) => {
  const notification = await Notification.findOne({ _id: req.params.id, userId: req.user._id });
  if (!notification) return res.status(404).json({ message: 'Notification not found' });
  notification.isRead = true;
  await notification.save();
  res.json({ message: 'Notification marked as read', data: notification });
};

export const markAllNotificationsRead = async (req, res) => {
  await Notification.updateMany({ userId: req.user._id, isRead: false }, { isRead: true });
  res.json({ message: 'All notifications marked as read' });
};

export const getAllNotifications = async (req, res) => {
  const notifications = await Notification.find({}).populate('userId', 'name email').sort({ createdAt: -1 });
  res.json({ data: notifications });
};

export const editNotification = async (req, res) => {
  const { id } = req.params;
  const { title, message } = req.body;

  if (!title || !message) {
    return res.status(400).json({ message: 'Title and message are required' });
  }

  const notification = await Notification.findByIdAndUpdate(
    id,
    { title, message },
    { new: true, runValidators: true }
  );

  if (!notification) {
    return res.status(404).json({ message: 'Notification not found' });
  }

  res.json({ message: 'Notification updated successfully', data: notification });
};

export const deleteNotification = async (req, res) => {
  const { id } = req.params;

  const notification = await Notification.findByIdAndDelete(id);

  if (!notification) {
    return res.status(404).json({ message: 'Notification not found' });
  }

  res.json({ message: 'Notification deleted successfully' });
};
