import rateLimit from 'express-rate-limit';

export const generalRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: {
    error: 'Too many requests from this IP, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: {
    error: 'Too many authentication attempts, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

export const apiKeyRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 50,
  message: {
    error: 'API rate limit exceeded, please try again in an hour.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});