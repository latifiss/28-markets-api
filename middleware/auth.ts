import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import type { PlanTier } from '../utils/tiers';

export interface AuthRequest extends Request {
  user?: any;
  apiKey?: string;
  apiKeyId?: string;
  tier?: PlanTier;
  mutationGuardPassed?: boolean;
}

export interface UserPayload {
  userId: string;
  email: string;
  tier?: PlanTier;
  role?: 'user' | 'admin';
}

const getJwtSecret = (): string => {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('JWT_SECRET must be configured with at least 32 characters');
  }
  return secret;
};

export const authenticateToken = (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  const authorization = req.headers.authorization;
  const token = authorization?.startsWith('Bearer ')
    ? authorization.slice(7)
    : undefined;

  if (!token) {
    return res.status(401).json({ error: 'Authentication token required' });
  }

  try {
    const payload = jwt.verify(token, getJwtSecret()) as UserPayload;
    req.user = payload;
    req.tier = payload.tier;
    return next();
  } catch {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
};

export const optionalAuth = (
  req: AuthRequest,
  _res: Response,
  next: NextFunction,
) => {
  const authorization = req.headers.authorization;
  const token = authorization?.startsWith('Bearer ')
    ? authorization.slice(7)
    : undefined;

  if (!token) return next();

  try {
    req.user = jwt.verify(token, getJwtSecret()) as UserPayload;
    req.tier = req.user.tier;
  } catch {
    // Optional authentication deliberately continues as anonymous.
  }

  return next();
};

export const generateToken = (payload: UserPayload): string =>
  jwt.sign(payload, getJwtSecret(), { expiresIn: '24h' });
