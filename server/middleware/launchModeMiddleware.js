import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import User from '../models/User.js';
import { isSuperAdmin } from '../utils/adminScope.js';
import { getLaunchStatus } from '../utils/launchConfig.js';

const preLaunchMessage = 'StudentNest is not open yet.';

export const createLaunchModeMiddleware = (launchConfig, getNow = () => new Date()) => async (req, res, next) => {
  const status = getLaunchStatus(getNow(), launchConfig);
  if (!launchConfig.enabled || status.launched) return next();

  if (req.method === 'POST' && (req.path === '/auth/login' || req.path === '/auth/google')) return next();
  if (req.method === 'GET' && req.path === '/auth/me') return next();

  const authorization = req.headers.authorization;
  const token = authorization?.match(/^Bearer\s+/i) ? authorization.split(' ')[1] : null;
  if (!token) return res.status(423).json({ message: preLaunchMessage, code: 'PRE_LAUNCH' });

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return res.status(423).json({ message: preLaunchMessage, code: 'PRE_LAUNCH' });
  }

  if (typeof decoded.id !== 'string' || !mongoose.isValidObjectId(decoded.id)) {
    return res.status(423).json({ message: preLaunchMessage, code: 'PRE_LAUNCH' });
  }

  let user;
  try {
    user = await User.findById(decoded.id).select('role adminRole status');
  } catch (error) {
    return next(error);
  }
  if (user && (!user.status || user.status === 'active') && isSuperAdmin(user)) return next();

  return res.status(423).json({ message: preLaunchMessage, code: 'PRE_LAUNCH' });
};
