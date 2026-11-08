import express from 'express';
import mongoose from 'mongoose';
import type { AuthRequest } from '../middleware/auth';
import Usage from '../models/usage';

const router = express.Router();

// Authentication is enforced once, centrally, for the entire /api/v1 namespace.
// This route accepts either a bearer token or an API key.
router.get('/', async (req: AuthRequest, res) => {
  try {
    const yearMonth = typeof req.query.month === 'string'
      ? req.query.month
      : new Date().toISOString().slice(0, 7);

    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(yearMonth)) {
      return res.status(400).json({ error: 'month must use YYYY-MM format' });
    }

    const usage = await Usage.aggregate([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(req.user!.userId),
          yearMonth,
        },
      },
      { $group: { _id: '$endpoint', requests: { $sum: '$count' } } },
      { $sort: { requests: -1 } },
    ]);

    return res.json({
      data: {
        month: yearMonth,
        totalRequests: usage.reduce((total, item) => total + item.requests, 0),
        endpoints: usage.map((item) => ({ endpoint: item._id, requests: item.requests })),
      },
    });
  } catch (error) {
    console.error('Usage lookup failed:', error);
    return res.status(500).json({ error: 'Unable to fetch API usage' });
  }
});

export default router;
