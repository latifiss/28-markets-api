import crypto from 'crypto';
import type { NextFunction, Response } from 'express';
import ApiKey from '../models/apiKey';
import User from '../models/user';
import { deleteCache, getCache, setCache } from '../lib/cache';
import type { AuthRequest } from './auth';

const hashApiKey = (key: string) =>
  crypto.createHash('sha256').update(key).digest('hex');

const cacheKey = (hash: string) => `auth:api-key:${hash}`;

type CachedApiKey = {
  keyId: string;
  userId: string;
  email: string;
  tier: 'free' | 'pro' | 'business';
  role: 'user' | 'admin';
  isActive: boolean;
};

export const generateApiKey = async (
  userId: string,
  description?: string,
): Promise<string> => {
  const key = crypto.randomBytes(32).toString('hex');
  await ApiKey.create({
    userId,
    keyHash: hashApiKey(key),
    description,
  });
  return key;
};

export const revokeApiKey = async (key: string): Promise<boolean> => {
  const hash = hashApiKey(key);
  let result = await ApiKey.findOneAndUpdate(
    { keyHash: hash, revoked: false },
    { revoked: true },
  );

  // Support revoking keys that have not yet completed lazy migration.
  if (!result) {
    result = await ApiKey.findOneAndUpdate(
      { key, revoked: false },
      { revoked: true },
    );
  }

  await deleteCache(cacheKey(hash));
  return Boolean(result);
};

export const authenticateApiKey = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const rawKey = req.headers['x-api-key'];
    if (typeof rawKey !== 'string' || rawKey.length < 32 || rawKey.length > 256) {
      return res.status(401).json({ error: 'A valid API key is required' });
    }

    const hash = hashApiKey(rawKey);
    let metadata = await getCache<CachedApiKey>(cacheKey(hash));

    if (!metadata) {
      let record = await ApiKey.findOne({
        keyHash: hash,
        revoked: false,
      }).select('_id userId').lean();

      if (!record) {
        const legacy = await ApiKey.findOne({
          key: rawKey,
          revoked: false,
        }).select('_id userId').lean();

        if (legacy) {
          record = legacy;
          await ApiKey.updateOne(
            { _id: legacy._id, key: rawKey },
            { $set: { keyHash: hash }, $unset: { key: 1 } },
          );
        }
      }

      if (!record) {
        return res.status(403).json({ error: 'Invalid API key' });
      }

      const user = await User.findById(record.userId)
        .select('email tier role isActive')
        .lean();

      if (!user || !user.isActive) {
        return res.status(403).json({ error: 'User is not active' });
      }

      metadata = {
        keyId: String(record._id),
        userId: String(record.userId),
        email: user.email,
        tier: user.tier,
        role: user.role || 'user',
        isActive: user.isActive,
      };

      await setCache(cacheKey(hash), metadata, 30);
    }

    if (!metadata.isActive) {
      return res.status(403).json({ error: 'User is not active' });
    }

    req.apiKey = `key:${metadata.keyId}`;
    req.apiKeyId = metadata.keyId;
    req.user = {
      userId: metadata.userId,
      email: metadata.email,
      tier: metadata.tier,
      role: metadata.role,
    };
    req.tier = metadata.tier;

    return next();
  } catch (error) {
    console.error('API key authentication failed:', error);
    return res.status(503).json({
      error: 'Authentication is temporarily unavailable',
    });
  }
};
