import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import { authenticateApiKey } from './apiKey';
import { authenticateToken } from './auth';

export const unifiedAuth = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const hasApiKey = req.headers['x-api-key'];
  const hasToken = req.headers['authorization'];
  
  if (hasApiKey) {
    return authenticateApiKey(req, res, next);
  }
  
  if (hasToken) {
    return authenticateToken(req, res, next);
  }
  
  return res.status(401).json({ error: 'Authentication required. Provide JWT token or API key' });
};