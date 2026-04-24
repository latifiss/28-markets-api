"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.tieredUsage = void 0;
const user_1 = __importDefault(require("../models/user"));
const apiUsage_1 = __importDefault(require("../models/apiUsage"));
const tiers_1 = require("../utils/tiers");
const perMinuteBuckets = new Map();
const getEndpointKey = (req, explicit) => {
    var _a, _b;
    if (explicit)
        return explicit;
    const base = req.baseUrl || '';
    const routePath = (_b = (_a = req.route) === null || _a === void 0 ? void 0 : _a.path) !== null && _b !== void 0 ? _b : req.path;
    return `${req.method.toUpperCase()} ${base}${routePath}`;
};
const getMinuteWindowStart = (now) => Math.floor(now / 60000) * 60000;
const tieredUsage = (options = {}) => async (req, res, next) => {
    var _a, _b, _c, _d;
    try {
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
        if (!userId) {
            return res.status(401).json({ error: 'Authenticated user required' });
        }
        const user = await user_1.default.findById(userId);
        if (!user || !user.isActive) {
            return res.status(403).json({ error: 'User is not active' });
        }
        const tier = (_b = user.tier) !== null && _b !== void 0 ? _b : 'free';
        req.tier = tier;
        if (options.allowedTiers && !options.allowedTiers.includes(tier)) {
            return res.status(403).json({
                error: 'Your subscription tier does not include this endpoint',
            });
        }
        const endpointKey = getEndpointKey(req, options.endpointKey);
        const now = Date.now();
        const minuteStart = getMinuteWindowStart(now);
        const identity = `${(_c = req.apiKey) !== null && _c !== void 0 ? _c : userId}:${endpointKey}:${minuteStart}`;
        const limits = tiers_1.TIER_LIMITS[tier];
        const bucket = perMinuteBuckets.get(identity);
        if (!bucket) {
            perMinuteBuckets.set(identity, { count: 1, windowStart: minuteStart });
        }
        else {
            if (bucket.windowStart !== minuteStart) {
                bucket.windowStart = minuteStart;
                bucket.count = 1;
            }
            else {
                bucket.count += 1;
            }
            if (bucket.count > limits.perMinute) {
                if (bucket.count > limits.perMinute * 3) {
                    console.warn(`[ABUSE] apiKey=${(_d = req.apiKey) !== null && _d !== void 0 ? _d : 'none'} user=${userId} endpoint=${endpointKey} tier=${tier} count=${bucket.count} perMinuteLimit=${limits.perMinute}`);
                }
                return res.status(429).json({
                    error: 'Per-minute rate limit exceeded for your tier',
                });
            }
        }
        if (!req.apiKeyId) {
            return next();
        }
        const nowDate = new Date();
        const month = nowDate.getMonth() + 1;
        const year = nowDate.getFullYear();
        const usage = await apiUsage_1.default.findOneAndUpdate({
            apiKeyId: req.apiKeyId,
            endpoint: endpointKey,
            method: req.method.toUpperCase(),
            month,
            year,
        }, { $inc: { count: 1 } }, { new: true, upsert: true });
        if (usage.count > limits.monthlyRequests) {
            return res.status(429).json({
                error: 'Monthly request limit reached for your tier',
            });
        }
        return next();
    }
    catch (err) {
        console.error('Tiered usage middleware error', err);
        return res.status(500).json({ error: 'Usage tracking failed' });
    }
};
exports.tieredUsage = tieredUsage;
//# sourceMappingURL=usage.js.map