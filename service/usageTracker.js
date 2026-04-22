"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getEndpointBreakdown = exports.getMonthlyUsage = exports.trackApiUsage = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const usage_1 = __importDefault(require("../models/usage"));
const trackApiUsage = async (userId, endpoint, method) => {
    const yearMonth = new Date().toISOString().slice(0, 7);
    await usage_1.default.findOneAndUpdate({
        userId: new mongoose_1.default.Types.ObjectId(userId),
        endpoint,
        yearMonth,
    }, {
        $inc: { count: 1 },
        $set: {
            method: method.toUpperCase(),
            lastRequestAt: new Date(),
        },
    }, {
        upsert: true,
        new: true,
    });
};
exports.trackApiUsage = trackApiUsage;
const getMonthlyUsage = async (userId) => {
    var _a;
    const yearMonth = new Date().toISOString().slice(0, 7);
    const result = await usage_1.default.aggregate([
        {
            $match: {
                userId: new mongoose_1.default.Types.ObjectId(userId),
                yearMonth,
            },
        },
        {
            $group: {
                _id: null,
                total: { $sum: '$count' },
            },
        },
    ]);
    return ((_a = result[0]) === null || _a === void 0 ? void 0 : _a.total) || 0;
};
exports.getMonthlyUsage = getMonthlyUsage;
const getEndpointBreakdown = async (userId) => {
    const yearMonth = new Date().toISOString().slice(0, 7);
    return await usage_1.default.aggregate([
        {
            $match: {
                userId: new mongoose_1.default.Types.ObjectId(userId),
                yearMonth,
            },
        },
        {
            $group: {
                _id: '$endpoint',
                total: { $sum: '$count' },
            },
        },
        {
            $sort: { total: -1 },
        },
    ]);
};
exports.getEndpointBreakdown = getEndpointBreakdown;
//# sourceMappingURL=usageTracker.js.map