import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthRequest extends Request {
  user?: any;
  apiKey?: string;
  apiKeyId?: string;
  mutationGuardPassed?: boolean;
}

export interface UserPayload {
  userId: string;
  email: string;
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

  if (!token) return res.status(401).json({ error: 'Authentication token required' });

  try {
    req.user = jwt.verify(token, getJwtSecret()) as UserPayload;
    return next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
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

  if (token) {
    try {
      req.user = jwt.verify(token, getJwtSecret()) as UserPayload;
    } catch {
      // Public reads remain available without a valid optional credential.
    }
  }
  return next();
};

export const generateToken = (payload: UserPayload): string =>
  jwt.sign(payload, getJwtSecret(), { expiresIn: '1h' });
