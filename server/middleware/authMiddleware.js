import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import User from '../models/User.js';

dotenv.config();

export const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.match(/^Bearer\s+/i) ? authHeader.split(' ')[1] : null;

    if (!token) {
      res.status(401);
      return next(new Error('Authorization token required'));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');
    if (!user) {
      res.status(401);
      return next(new Error('User not found'));
    }
    if (user.status && user.status !== 'active') {
      res.status(403);
      return next(new Error(`Account is ${user.status}. Contact an administrator.`));
    }

    if (user.role === 'admin' && !user.adminRole) {
      user.adminRole = 'super_admin';
    }
    req.user = user;
    next();
  } catch (error) {
    res.status(401);
    const message = error.name === 'TokenExpiredError' ? 'Token expired' : 'Invalid or expired token';
    next(new Error(message));
  }
};
