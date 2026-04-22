"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.rateLimiter = void 0;
const rateLimitChecker_1 = require("../service/rateLimitChecker");
const usageTracker_1 = require("../service/usageTracker");
const user_1 = __importDefault(require("../models/user"));
const rateLimiter = async (req, res, next) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Authentication required' });
        }
        const userId = req.user.userId;
        const user = await user_1.default.findById(userId);
        if (!user) {
            return res.status(401).json({ error: 'User not found' });
        }
        const check = await (0, rateLimitChecker_1.checkRateLimit)(userId);
        if (!check.allowed) {
            return res.status(429).json({
                error: check.reason,
                limit: check.limit,
                current: check.current,
                tier: user.tier,
            });
        }
        await (0, usageTracker_1.trackApiUsage)(userId, req.path, req.method);
        res.setHeader('X-RateLimit-Limit', check.limit);
        res.setHeader('X-RateLimit-Remaining', check.remaining);
        res.setHeader('X-User-Tier', user.tier);
        res.setHeader('X-Auth-Method', req.apiKey ? 'api-key' : 'jwt');
        next();
    }
    catch (error) {
        console.error('Rate limiter error:', error);
        next();
    }
};
exports.rateLimiter = rateLimiter;
//# sourceMappingURL=rateLimiter.js.map