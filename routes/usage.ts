import express from 'express';
import { authenticateToken, type AuthRequest } from '../middleware/auth';
import ApiKey from '../models/apiKey';
import ApiUsage from '../models/apiUsage';

const router = express.Router();

router.get('/profile', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { month, year } = req.query;

    const keys = await ApiKey.find({ userId, revoked: false }).select('_id key createdAt');
    const keyIds = keys.map((k) => k._id);

    const match: any = { apiKeyId: { $in: keyIds } };
    if (month) {
      match.month = Number(month);
    }
    if (year) {
      match.year = Number(year);
    }

    const usage = await ApiUsage.aggregate([
      { $match: match },
      {
        $group: {
          _id: {
            apiKeyId: '$apiKeyId',
            endpoint: '$endpoint',
            method: '$method',
            month: '$month',
            year: '$year',
          },
          count: { $sum: '$count' },
        },
      },
      {
        $lookup: {
          from: 'apikeys',
          localField: '_id.apiKeyId',
          foreignField: '_id',
          as: 'key',
        },
      },
      { $unwind: '$key' },
      {
        $project: {
          _id: 0,
          apiKey: '$key.key',
          apiKeyCreatedAt: '$key.createdAt',
          endpoint: '$_id.endpoint',
          method: '$_id.method',
          month: '$_id.month',
          year: '$_id.year',
          count: 1,
        },
      },
      { $sort: { year: -1, month: -1, endpoint: 1, method: 1 } },
    ]);

    return res.json({
      userId,
      keys: keys.map((k) => ({ id: k._id, key: k.key, createdAt: k.createdAt })),
      usage,
    });
  } catch (err: any) {
    console.error('Failed to load profile usage', err);
    return res.status(500).json({ error: 'Failed to load usage data' });
  }
});

router.get('/api-key/:key', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { key } = req.params;
    const { month, year } = req.query;

    const apiKey = await ApiKey.findOne({ key, userId, revoked: false });
    if (!apiKey) {
      return res.status(404).json({ error: 'API key not found' });
    }

    const match: any = { apiKeyId: apiKey._id };
    if (month) {
      match.month = Number(month);
    }
    if (year) {
      match.year = Number(year);
    }

    const usage = await ApiUsage.find(match)
      .select('-__v')
      .sort({ year: -1, month: -1, endpoint: 1, method: 1 });

    return res.json({
      apiKey: apiKey.key,
      apiKeyId: apiKey._id,
      createdAt: apiKey.createdAt,
      usage,
    });
  } catch (err: any) {
    console.error('Failed to load api key usage', err);
    return res.status(500).json({ error: 'Failed to load usage data' });
  }
});

export default router;

