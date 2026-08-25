import dotenv from 'dotenv';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import User from './models/User.js';

dotenv.config();

const run = async () => {
  try {
    const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/fulafia-ams';
    await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });
    const email = 'admin@fulafia.edu.ng';
    const existing = await User.findOne({ email });
    if (existing) {
      if (existing.role === 'admin' && !existing.adminRole) {
        existing.adminRole = 'super_admin';
        await existing.save();
      }
      console.log('Admin already exists:', existing.email);
      process.exit(0);
    }
    const password = 'Admin@1234';
    const hashed = await bcrypt.hash(password, 10);
    const admin = await User.create({
      name: 'FULAFIA Admin',
      email,
      password: hashed,
      role: 'admin',
      adminRole: 'super_admin',
      adminSource: 'created_as_admin',
      verificationStatus: 'verified'
    });
    console.log('Admin created successfully.');
    console.log('Email:', admin.email);
    console.log('Password:', password);
    process.exit(0);
  } catch (error) {
    console.error('Failed to create admin:', error);
    process.exit(1);
  }
};

run();
