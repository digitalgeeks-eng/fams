import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import connectDatabase from '../config/db.js';
import User from '../models/User.js';
import Property from '../models/Property.js';
import Booking from '../models/Booking.js';
import Payment from '../models/Payment.js';
import Complaint from '../models/Complaint.js';
import Recommendation from '../models/Recommendation.js';

dotenv.config();

const initializeDatabase = async () => {
  try {
    await connectDatabase();

    await Promise.all([
      User.syncIndexes(),
      Property.syncIndexes(),
      Booking.syncIndexes(),
      Payment.syncIndexes(),
      Complaint.syncIndexes(),
      Recommendation.syncIndexes()
    ]);

    await User.updateMany({ role: 'admin', adminRole: { $exists: false } }, { $set: { adminRole: 'super_admin' } });

    const adminEmail = 'admin@fulafia.edu.ng';
    const existingAdmin = await User.findOne({ email: adminEmail.toLowerCase() });
    if (!existingAdmin) {
      const hashedPassword = await bcrypt.hash('Admin@1234', 10);
      await User.create({
        name: 'FULAFIA Admin',
        email: adminEmail.toLowerCase(),
        password: hashedPassword,
        role: 'admin',
        adminRole: 'super_admin',
        verificationStatus: 'verified'
      });
      console.log('Admin user created successfully.');
    } else {
      console.log('Admin user already exists.');
    }

    console.log('Database initialization completed.');
    process.exit(0);
  } catch (error) {
    console.error('Database initialization failed:', error.message);
    process.exit(1);
  }
};

initializeDatabase();
