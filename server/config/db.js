import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI;
mongoose.set('strictQuery', false);

const connectDatabase = async () => {
  if (!MONGO_URI) {
    throw new Error('MONGO_URI is not set. Add your MongoDB Atlas connection string in the server environment variables.');
  }

  try {
    const conn = await mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: 10000,
    });
    console.log(`MongoDB connected: ${conn.connection.host}/${conn.connection.name}`);
    return conn;
  } catch (error) {
    console.error('MongoDB connection error:', error.message);
    throw error;
  }
};

export default connectDatabase;
