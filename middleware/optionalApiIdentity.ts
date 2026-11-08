import type { NextFunction, Response } from 'express';
import type { AuthRequest } from './auth';
import { authenticateApiKey } from './apiKey';
import { optionalAuth } from './auth';

export function optionalApiIdentity(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  if (req.headers['x-api-key']) {
    return authenticateApiKey(req, res, next);
  }
  return optionalAuth(req, res, next);
}
