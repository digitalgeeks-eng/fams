import dotenv from 'dotenv';
import connectDatabase from '../config/db.js';
import User from '../models/User.js';
import Property from '../models/Property.js';
import Booking from '../models/Booking.js';
import Payment from '../models/Payment.js';
import Complaint from '../models/Complaint.js';
import Message from '../models/Message.js';
import Notification from '../models/Notification.js';
import Recommendation from '../models/Recommendation.js';
import Announcement from '../models/Announcement.js';

dotenv.config();

const confirm = process.argv.includes('--confirm');
const dryRun = !confirm;

const logCounts = async () => {
  const nonAdminUsers = await User.find({ role: { $in: ['student', 'agent'] } }).select('_id role name email');
  const nonAdminIds = nonAdminUsers.map((user) => user._id);
  const agentIds = nonAdminUsers.filter((user) => user.role === 'agent').map((user) => user._id);
  const studentIds = nonAdminUsers.filter((user) => user.role === 'student').map((user) => user._id);

  const properties = await Property.find({ agentId: { $in: agentIds } }).select('_id title');
  const propertyIds = properties.map((property) => property._id);

  const bookings = await Booking.find({
    $or: [
      { studentId: { $in: studentIds } },
      { propertyId: { $in: propertyIds } }
    ]
  }).select('_id');
  const bookingIds = bookings.map((booking) => booking._id);

  const counts = {
    users: nonAdminUsers.length,
    agents: agentIds.length,
    students: studentIds.length,
    properties: propertyIds.length,
    bookings: bookingIds.length,
    payments: await Payment.countDocuments({ bookingId: { $in: bookingIds } }),
    complaints: await Complaint.countDocuments({ studentId: { $in: studentIds } }),
    messages: await Message.countDocuments({ $or: [ { senderId: { $in: nonAdminIds } }, { recipientId: { $in: nonAdminIds } } ] }),
    notifications: await Notification.countDocuments({ userId: { $in: nonAdminIds } }),
    recommendations: await Recommendation.countDocuments({ userId: { $in: nonAdminIds } }),
    announcements: await Announcement.countDocuments({ createdBy: { $in: nonAdminIds } })
  };

  console.log('=== Cleanup preview ===');
  console.log(`Student + Agent users: ${counts.users} (${counts.agents} agent(s), ${counts.students} student(s))`);
  console.log(`Agent properties: ${counts.properties}`);
  console.log(`Bookings: ${counts.bookings}`);
  console.log(`Payments: ${counts.payments}`);
  console.log(`Complaints: ${counts.complaints}`);
  console.log(`Messages: ${counts.messages}`);
  console.log(`Notifications: ${counts.notifications}`);
  console.log(`Recommendations: ${counts.recommendations}`);
  console.log(`Announcements created by removed users: ${counts.announcements}`);
  console.log('========================');

  return { nonAdminIds, agentIds, studentIds, propertyIds, bookingIds };
};

const runCleanup = async () => {
  await connectDatabase();
  const { nonAdminIds, agentIds, studentIds, propertyIds, bookingIds } = await logCounts();

  if (nonAdminIds.length === 0) {
    console.log('No agent or student users were found. Nothing to delete.');
    process.exit(0);
  }

  if (dryRun) {
    console.log('Dry run complete. Add --confirm to actually delete the listed records.');
    process.exit(0);
  }

  console.log('Deleting payments...');
  await Payment.deleteMany({ bookingId: { $in: bookingIds } });

  console.log('Deleting bookings...');
  await Booking.deleteMany({ _id: { $in: bookingIds } });

  console.log('Deleting complaints...');
  await Complaint.deleteMany({ studentId: { $in: studentIds } });

  console.log('Deleting messages...');
  await Message.deleteMany({ $or: [ { senderId: { $in: nonAdminIds } }, { recipientId: { $in: nonAdminIds } } ] });

  console.log('Deleting notifications...');
  await Notification.deleteMany({ userId: { $in: nonAdminIds } });

  console.log('Deleting recommendations...');
  await Recommendation.deleteMany({ userId: { $in: nonAdminIds } });

  console.log('Deleting announcements created by removed users...');
  await Announcement.deleteMany({ createdBy: { $in: nonAdminIds } });

  console.log('Deleting properties...');
  await Property.deleteMany({ _id: { $in: propertyIds } });

  console.log('Deleting student and agent users...');
  await User.deleteMany({ _id: { $in: nonAdminIds } });

  console.log('Cleanup completed. Only admin users remain in the database.');
  process.exit(0);
};

runCleanup().catch((error) => {
  console.error('Cleanup failed:', error);
  process.exit(1);
});
