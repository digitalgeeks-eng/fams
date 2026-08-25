import rateLimit from 'express-rate-limit';

const createLimiter = (max, windowMs = 15 * 60 * 1000) => rateLimit({
  windowMs,
  max,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests from this IP, please try again later.' }
});

const limiter = createLimiter(120);

export const authLimiter = createLimiter(10, 15 * 60 * 1000);
export const emailLimiter = createLimiter(5, 15 * 60 * 1000);
export const paymentLimiter = createLimiter(30, 15 * 60 * 1000);
export const uploadLimiter = createLimiter(20, 15 * 60 * 1000);
export const messageLimiter = createLimiter(60, 15 * 60 * 1000);
export const adminActionLimiter = createLimiter(60, 15 * 60 * 1000);

export default limiter;
