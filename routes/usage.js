"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_1 = require("../middleware/auth");
const apiKey_1 = __importDefault(require("../models/apiKey"));
const apiUsage_1 = __importDefault(require("../models/apiUsage"));
const router = express_1.default.Router();
router.get('/profile', auth_1.authenticateToken, async (req, res) => {
    var _a;
    try {
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
        if (!userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }
        const { month, year } = req.query;
        const keys = await apiKey_1.default.find({ userId, revoked: false }).select('_id key createdAt');
        const keyIds = keys.map((k) => k._id);
        const match = { apiKeyId: { $in: keyIds } };
        if (month) {
            match.month = Number(month);
        }
        if (year) {
            match.year = Number(year);
        }
        const usage = await apiUsage_1.default.aggregate([
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
    }
    catch (err) {
        console.error('Failed to load profile usage', err);
        return res.status(500).json({ error: 'Failed to load usage data' });
    }
});
router.get('/api-key/:key', auth_1.authenticateToken, async (req, res) => {
    var _a;
    try {
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
        if (!userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }
        const { key } = req.params;
        const { month, year } = req.query;
        const apiKey = await apiKey_1.default.findOne({ key, userId, revoked: false });
        if (!apiKey) {
            return res.status(404).json({ error: 'API key not found' });
        }
        const match = { apiKeyId: apiKey._id };
        if (month) {
            match.month = Number(month);
        }
        if (year) {
            match.year = Number(year);
        }
        const usage = await apiUsage_1.default.find(match)
            .select('-__v')
            .sort({ year: -1, month: -1, endpoint: 1, method: 1 });
        return res.json({
            apiKey: apiKey.key,
            apiKeyId: apiKey._id,
            createdAt: apiKey.createdAt,
            usage,
        });
    }
    catch (err) {
        console.error('Failed to load api key usage', err);
        return res.status(500).json({ error: 'Failed to load usage data' });
    }
});
exports.default = router;
//# sourceMappingURL=usage.js.map