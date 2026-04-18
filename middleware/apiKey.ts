import ApiKey from '../models/apiKey';
import crypto from 'crypto';
import type { AuthRequest } from './auth';
import User from '../models/user';

export const generateApiKey = async (userId: string, description?: string): Promise<string> => {
  const key = crypto.randomBytes(32).toString('hex');
  await ApiKey.create({ userId, key, description });
  return key;
};

export const revokeApiKey = async (key: string): Promise<boolean> => {
  const result = await ApiKey.findOneAndUpdate({ key, revoked: false }, { revoked: true });
  return !!result;
};

export const authenticateApiKey = async (req: AuthRequest, res: any, next: any) => {
  const apiKey = req.headers['x-api-key'] as string;
  if (!apiKey) return res.status(401).json({ error: 'API key required' });

  const keyData = await ApiKey.findOne({ key: apiKey, revoked: false });
  if (!keyData) return res.status(403).json({ error: 'Invalid API key' });

  const user = await User.findById(keyData.userId);
  if (!user) return res.status(403).json({ error: 'User not found' });

  req.apiKey = apiKey;
  req.apiKeyId = String(keyData._id);
  req.user = { userId: keyData.userId.toString(), email: user.email };
  req.tier = user.tier;

  next();
};
