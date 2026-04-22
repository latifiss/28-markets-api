"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTierLimits = exports.checkRateLimit = void 0;
const usageTracker_1 = require("./usageTracker");
const user_1 = __importDefault(require("../models/user"));
const TIER_LIMITS = {
    free: { monthly: 1000, perMinute: 10 },
    pro: { monthly: 10000, perMinute: 100 },
    business: { monthly: 100000, perMinute: 500 },
};
const requestLogs = new Map();
const checkRateLimit = async (userId) => {
    const user = await user_1.default.findById(userId);
    if (!user) {
        return { allowed: false, reason: 'User not found' };
    }
    const limits = TIER_LIMITS[user.tier];
    const monthlyUsage = await (0, usageTracker_1.getMonthlyUsage)(userId);
    if (monthlyUsage >= limits.monthly) {
        return {
            allowed: false,
            reason: 'Monthly request limit exceeded. Please upgrade your plan.',
            limit: limits.monthly,
            current: monthlyUsage,
        };
    }
    const now = Date.now();
    const userRequests = requestLogs.get(userId) || [];
    const recentRequests = userRequests.filter(timestamp => now - timestamp < 60000);
    if (recentRequests.length >= limits.perMinute) {
        return {
            allowed: false,
            reason: `Rate limit of ${limits.perMinute} requests per minute exceeded.`,
            limit: limits.perMinute,
        };
    }
    recentRequests.push(now);
    requestLogs.set(userId, recentRequests);
    return {
        allowed: true,
        remaining: limits.monthly - monthlyUsage,
        limit: limits.monthly,
    };
};
exports.checkRateLimit = checkRateLimit;
const getTierLimits = (tier) => {
    return TIER_LIMITS[tier] || TIER_LIMITS.free;
};
exports.getTierLimits = getTierLimits;
//# sourceMappingURL=rateLimitChecker.js.map