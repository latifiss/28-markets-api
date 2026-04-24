"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.compareTier = exports.TIER_LIMITS = exports.PLAN_ORDER = void 0;
exports.PLAN_ORDER = ['free', 'pro', 'business'];
exports.TIER_LIMITS = {
    free: {
        monthlyRequests: 1000,
        perMinute: 30,
    },
    pro: {
        monthlyRequests: 10000,
        perMinute: 120,
    },
    business: {
        monthlyRequests: 100000,
        perMinute: 600,
    },
};
const compareTier = (a, b) => exports.PLAN_ORDER.indexOf(a) - exports.PLAN_ORDER.indexOf(b);
exports.compareTier = compareTier;
//# sourceMappingURL=tiers.js.map