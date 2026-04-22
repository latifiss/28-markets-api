"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.clearPriceHistory = exports.deletePriceHistoryEntry = exports.updatePriceHistoryEntry = exports.getLatestPriceHistory = exports.getCommodityHistoryByPeriod = exports.updateLatestPrice = exports.addPriceEntry = exports.updateCommodityPrice = exports.addCommodityHistory = exports.getCommodityHistory = exports.deleteCommodity = exports.updateCommodity = exports.createCommodity = exports.getCommodityByCode = exports.getAllCommodities = void 0;
const commodity_model_1 = __importStar(require("../models/commodity.model"));
const redis_1 = require("../lib/redis");
const ws_1 = require("../lib/realtime/ws");
const setCache = async (key, data, expirationInSeconds = 3600) => {
    try {
        const client = await (0, redis_1.getRedisClient)();
        if (client && typeof client.set === 'function') {
            await client.set(key, JSON.stringify(data), { EX: expirationInSeconds });
        }
    }
    catch (error) {
        console.error('Error setting cache:', error.message);
    }
};
const getCache = async (key) => {
    try {
        const client = await (0, redis_1.getRedisClient)();
        if (client && typeof client.get === 'function') {
            const data = await client.get(key);
            return data ? JSON.parse(data) : null;
        }
        return null;
    }
    catch (error) {
        console.error('Error getting cache:', error.message);
        return null;
    }
};
const deleteCacheByPattern = async (pattern) => {
    try {
        const client = await (0, redis_1.getRedisClient)();
        if (client && typeof client.scanIterator === 'function') {
            for await (const key of client.scanIterator({ MATCH: pattern })) {
                if (key && typeof key === 'string') {
                    await client.del(key);
                }
            }
        }
    }
    catch (error) {
        console.error('Error deleting cache by pattern:', error.message);
    }
};
const invalidateCache = async (code = null) => {
    await deleteCacheByPattern('commodities:*');
    if (code) {
        await deleteCacheByPattern(`commodity:code:${code}`);
        await deleteCacheByPattern(`commodity:pricehistory:${code}`);
    }
};
const paramToString = (param) => {
    return Array.isArray(param) ? param[0] : param;
};
const getDateRange = (period) => {
    const now = new Date();
    switch (period) {
        case '1d':
            return new Date(now.setDate(now.getDate() - 1));
        case '1w':
            return new Date(now.setDate(now.getDate() - 7));
        case '1m':
        case '1month':
            return new Date(now.setMonth(now.getMonth() - 1));
        case '3m':
        case '3months':
            return new Date(now.setMonth(now.getMonth() - 3));
        case '6m':
        case '6months':
            return new Date(now.setMonth(now.getMonth() - 6));
        case '1y':
        case '1year':
            return new Date(now.setFullYear(now.getFullYear() - 1));
        case '5y':
        case '5years':
            return new Date(now.setFullYear(now.getFullYear() - 5));
        case '10y':
        case '10years':
            return new Date(now.setFullYear(now.getFullYear() - 10));
        case '20y':
        case '20years':
            return new Date(now.setFullYear(now.getFullYear() - 20));
        case 'all':
        default:
            return null;
    }
};
const getAllCommodities = async (req, res) => {
    try {
        const cacheKey = 'commodities:all';
        const cached = await getCache(cacheKey);
        if (cached) {
            res.status(200).json({
                success: true,
                code: 200,
                fromCache: true,
                data: cached,
            });
            return;
        }
        const commodities = await commodity_model_1.default.find();
        await setCache(cacheKey, commodities);
        res.status(200).json({
            success: true,
            code: 200,
            fromCache: false,
            data: commodities,
        });
    }
    catch (error) {
        console.error('Get all commodities error:', error);
        res.status(500).json({
            success: false,
            code: 500,
            message: 'Internal server error fetching commodities',
            errorId: `ERR-${Date.now()}`,
        });
    }
};
exports.getAllCommodities = getAllCommodities;
const getCommodityByCode = async (req, res) => {
    try {
        const code = paramToString(req.params.code);
        const cacheKey = `commodity:code:${code}`;
        const cached = await getCache(cacheKey);
        if (cached) {
            res.status(200).json({
                success: true,
                code: 200,
                fromCache: true,
                data: cached,
            });
            return;
        }
        const commodity = await commodity_model_1.default.findOne({ code });
        if (!commodity) {
            res.status(404).json({
                success: false,
                code: 404,
                message: 'Commodity not found',
                details: { code },
            });
            return;
        }
        await setCache(cacheKey, commodity);
        res.status(200).json({
            success: true,
            code: 200,
            fromCache: false,
            data: commodity,
        });
    }
    catch (error) {
        console.error('Get commodity error:', error);
        res.status(500).json({
            success: false,
            code: 500,
            message: 'Internal server error fetching commodity',
            errorId: `ERR-${Date.now()}`,
        });
    }
};
exports.getCommodityByCode = getCommodityByCode;
const createCommodity = async (req, res) => {
    try {
        const { code, name, unit, category, currentPrice, percentage_change } = req.body;
        const requiredFields = ['code', 'name', 'unit', 'category', 'currentPrice'];
        const missingFields = requiredFields.filter((field) => !req.body[field]);
        if (missingFields.length > 0) {
            res.status(400).json({
                success: false,
                code: 400,
                message: 'Missing required fields',
                details: { missingFields },
            });
            return;
        }
        const existingCommodity = await commodity_model_1.default.findOne({ code });
        if (existingCommodity) {
            res.status(400).json({
                success: false,
                code: 400,
                message: 'Commodity with this code already exists',
                details: {
                    duplicateField: 'code',
                    duplicateValue: code,
                },
            });
            return;
        }
        const commodity = await commodity_model_1.default.create({
            code,
            name,
            unit,
            category,
            currentPrice,
            percentage_change: percentage_change || 0,
            last_updated: new Date(),
        });
        await commodity_model_1.PriceHistory.create({
            commodity_code: code,
            history: [{
                    date: new Date(),
                    price: currentPrice,
                }],
        });
        await invalidateCache(code);
        (0, ws_1.publishCommodityUpdate)(code, commodity);
        res.status(201).json({
            success: true,
            code: 201,
            message: 'Commodity created successfully',
            data: commodity,
        });
    }
    catch (error) {
        if (error.code === 11000) {
            res.status(400).json({
                success: false,
                code: 400,
                message: 'Duplicate entry. Commodity code already exists',
                details: {
                    duplicateField: 'code',
                    duplicateValue: error.keyValue.code,
                },
            });
            return;
        }
        if (error.name === 'ValidationError') {
            const errors = Object.values(error.errors).map((err) => ({
                field: err.path,
                message: err.message,
            }));
            res.status(400).json({
                success: false,
                code: 400,
                message: 'Validation failed',
                details: { errors },
            });
            return;
        }
        console.error('Create commodity error:', error);
        res.status(500).json({
            success: false,
            code: 500,
            message: 'Internal server error creating commodity',
            errorId: `ERR-${Date.now()}`,
        });
    }
};
exports.createCommodity = createCommodity;
const updateCommodity = async (req, res) => {
    try {
        const code = paramToString(req.params.code);
        const { currentPrice, ...updateData } = req.body;
        const commodity = await commodity_model_1.default.findOne({ code });
        if (!commodity) {
            res.status(404).json({
                success: false,
                code: 404,
                message: 'Commodity not found',
                details: { code },
            });
            return;
        }
        const updateOperations = {
            $set: {
                ...updateData,
                last_updated: new Date(),
            },
        };
        const oldPrice = commodity.currentPrice;
        if (currentPrice !== undefined && currentPrice !== oldPrice) {
            const percentage_change = ((currentPrice - oldPrice) / oldPrice) * 100;
            updateOperations.$set.currentPrice = currentPrice;
            updateOperations.$set.percentage_change = parseFloat(percentage_change.toFixed(4));
        }
        const updatedCommodity = await commodity_model_1.default.findOneAndUpdate({ code }, updateOperations, { new: true, runValidators: true });
        if (currentPrice !== undefined && currentPrice !== oldPrice) {
            await commodity_model_1.PriceHistory.findOneAndUpdate({ commodity_code: code }, {
                $push: {
                    history: {
                        $each: [{
                                date: new Date(),
                                price: currentPrice,
                            }],
                        $position: 0,
                    },
                },
            }, { upsert: true });
        }
        await invalidateCache(code);
        (0, ws_1.publishCommodityUpdate)(code, updatedCommodity);
        res.status(200).json({
            success: true,
            code: 200,
            message: 'Commodity updated successfully',
            data: updatedCommodity,
        });
    }
    catch (error) {
        if (error.code === 11000) {
            res.status(400).json({
                success: false,
                code: 400,
                message: 'Duplicate entry. Commodity code already exists',
                details: {
                    duplicateField: 'code',
                    duplicateValue: error.keyValue.code,
                },
            });
            return;
        }
        if (error.name === 'ValidationError') {
            const errors = Object.values(error.errors).map((err) => ({
                field: err.path,
                message: err.message,
            }));
            res.status(400).json({
                success: false,
                code: 400,
                message: 'Validation failed',
                details: { errors },
            });
            return;
        }
        console.error('Update commodity error:', error);
        res.status(500).json({
            success: false,
            code: 500,
            message: 'Internal server error updating commodity',
            errorId: `ERR-${Date.now()}`,
        });
    }
};
exports.updateCommodity = updateCommodity;
const deleteCommodity = async (req, res) => {
    try {
        const code = paramToString(req.params.code);
        const deletedCommodity = await commodity_model_1.default.findOneAndDelete({ code });
        if (!deletedCommodity) {
            res.status(404).json({
                success: false,
                code: 404,
                message: 'Commodity not found',
                details: { code },
            });
            return;
        }
        await commodity_model_1.PriceHistory.findOneAndDelete({ commodity_code: code });
        await invalidateCache(code);
        res.status(200).json({
            success: true,
            code: 200,
            message: 'Commodity deleted successfully',
            data: {
                code: deletedCommodity.code,
                name: deletedCommodity.name,
            },
        });
    }
    catch (error) {
        console.error('Delete commodity error:', error);
        res.status(500).json({
            success: false,
            code: 500,
            message: 'Internal server error deleting commodity',
            errorId: `ERR-${Date.now()}`,
        });
    }
};
exports.deleteCommodity = deleteCommodity;
const getCommodityHistory = async (req, res) => {
    try {
        const code = paramToString(req.params.code);
        const { period = 'all', limit = 100 } = req.query;
        const cacheKey = `commodity:pricehistory:${code}:${period}:${limit}`;
        const cached = await getCache(cacheKey);
        if (cached) {
            res.status(200).json({
                success: true,
                code: 200,
                fromCache: true,
                data: cached,
            });
            return;
        }
        const commodity = await commodity_model_1.default.findOne({ code });
        if (!commodity) {
            res.status(404).json({
                success: false,
                code: 404,
                message: 'Commodity not found',
                details: { code },
            });
            return;
        }
        const startDate = getDateRange(period);
        let query = { commodity_code: code };
        if (startDate) {
            query['history.date'] = { $gte: startDate };
        }
        const priceHistory = await commodity_model_1.PriceHistory.aggregate([
            { $match: { commodity_code: code } },
            { $unwind: '$history' },
            ...(startDate ? [{ $match: { 'history.date': { $gte: startDate } } }] : []),
            { $sort: { 'history.date': -1 } },
            { $limit: Number(limit) },
            { $group: {
                    _id: '$_id',
                    commodity_code: { $first: '$commodity_code' },
                    history: { $push: '$history' },
                    createdAt: { $first: '$createdAt' },
                    updatedAt: { $first: '$updatedAt' }
                } }
        ]);
        if (!priceHistory.length) {
            res.status(404).json({
                success: false,
                code: 404,
                message: 'Price history not found',
                details: { code },
            });
            return;
        }
        const result = {
            code: commodity.code,
            name: commodity.name,
            unit: commodity.unit,
            category: commodity.category,
            currentPrice: commodity.currentPrice,
            percentage_change: commodity.percentage_change,
            ...priceHistory[0]
        };
        await setCache(cacheKey, result, 300);
        res.status(200).json({
            success: true,
            code: 200,
            fromCache: false,
            data: result,
        });
    }
    catch (error) {
        console.error('Get commodity history error:', error);
        res.status(500).json({
            success: false,
            code: 500,
            message: 'Internal server error fetching commodity history',
            errorId: `ERR-${Date.now()}`,
        });
    }
};
exports.getCommodityHistory = getCommodityHistory;
const addCommodityHistory = async (req, res) => {
    try {
        const code = paramToString(req.params.code);
        const { date, price } = req.body;
        if (!price) {
            res.status(400).json({
                success: false,
                code: 400,
                message: 'Price is required',
                details: { required: ['price'] },
            });
            return;
        }
        const commodity = await commodity_model_1.default.findOne({ code });
        if (!commodity) {
            res.status(404).json({
                success: false,
                code: 404,
                message: 'Commodity not found',
                details: { code },
            });
            return;
        }
        const newPriceEntry = {
            date: date ? new Date(date) : new Date(),
            price: Number(price),
        };
        const priceHistory = await commodity_model_1.PriceHistory.findOneAndUpdate({ commodity_code: code }, {
            $push: {
                history: {
                    $each: [newPriceEntry],
                    $position: 0,
                },
            },
        }, { upsert: true, new: true });
        const MAX_HISTORY_ENTRIES = 5000;
        if (priceHistory.history.length > MAX_HISTORY_ENTRIES) {
            priceHistory.history = priceHistory.history.slice(0, MAX_HISTORY_ENTRIES);
            await priceHistory.save();
        }
        await invalidateCache(code);
        res.status(200).json({
            success: true,
            code: 200,
            message: 'Price history added successfully',
            data: {
                code: commodity.code,
                name: commodity.name,
                new_price_entry: newPriceEntry,
                total_history_entries: priceHistory.history.length,
            },
        });
    }
    catch (error) {
        console.error('Add commodity history error:', error);
        res.status(500).json({
            success: false,
            code: 500,
            message: 'Internal server error adding price history',
            errorId: `ERR-${Date.now()}`,
        });
    }
};
exports.addCommodityHistory = addCommodityHistory;
const updateCommodityPrice = async (req, res) => {
    try {
        const code = paramToString(req.params.code);
        const { currentPrice } = req.body;
        if (!currentPrice) {
            res.status(400).json({
                success: false,
                code: 400,
                message: 'Current price is required',
                details: { required: ['currentPrice'] },
            });
            return;
        }
        const commodity = await commodity_model_1.default.findOne({ code });
        if (!commodity) {
            res.status(404).json({
                success: false,
                code: 404,
                message: 'Commodity not found',
                details: { code },
            });
            return;
        }
        const updateOperations = {
            $set: {
                last_updated: new Date(),
            },
        };
        if (currentPrice !== commodity.currentPrice) {
            const percentage_change = ((currentPrice - commodity.currentPrice) / commodity.currentPrice) * 100;
            updateOperations.$set.currentPrice = currentPrice;
            updateOperations.$set.percentage_change = parseFloat(percentage_change.toFixed(4));
            await commodity_model_1.PriceHistory.findOneAndUpdate({ commodity_code: code }, {
                $push: {
                    history: {
                        $each: [{
                                date: new Date(),
                                price: currentPrice,
                            }],
                        $position: 0,
                    },
                },
            }, { upsert: true });
        }
        const updatedCommodity = await commodity_model_1.default.findOneAndUpdate({ code }, updateOperations, { new: true });
        await invalidateCache(code);
        (0, ws_1.publishCommodityUpdate)(code, updatedCommodity);
        res.status(200).json({
            success: true,
            code: 200,
            message: 'Commodity price updated successfully',
            data: updatedCommodity,
        });
    }
    catch (error) {
        console.error('Update commodity price error:', error);
        res.status(500).json({
            success: false,
            code: 500,
            message: 'Internal server error updating commodity price',
            errorId: `ERR-${Date.now()}`,
        });
    }
};
exports.updateCommodityPrice = updateCommodityPrice;
const addPriceEntry = async (req, res) => {
    try {
        const code = paramToString(req.params.code);
        const { date, price } = req.body;
        if (!date || !price) {
            res.status(400).json({
                success: false,
                code: 400,
                message: 'Date and price are required',
                details: { required: ['date', 'price'] },
            });
            return;
        }
        const commodity = await commodity_model_1.default.findOne({ code });
        if (!commodity) {
            res.status(404).json({
                success: false,
                code: 404,
                message: 'Commodity not found',
                details: { code },
            });
            return;
        }
        const newEntry = {
            date: new Date(date),
            price: Number(price),
        };
        const priceHistory = await commodity_model_1.PriceHistory.findOneAndUpdate({ commodity_code: code }, {
            $push: {
                history: {
                    $each: [newEntry],
                    $position: 0,
                },
            },
        }, { upsert: true, new: true });
        const MAX_HISTORY_ENTRIES = 5000;
        if (priceHistory.history.length > MAX_HISTORY_ENTRIES) {
            priceHistory.history = priceHistory.history.slice(0, MAX_HISTORY_ENTRIES);
            await priceHistory.save();
        }
        await invalidateCache(code);
        res.status(200).json({
            success: true,
            code: 200,
            message: 'Price entry added successfully',
            data: {
                code: commodity.code,
                name: commodity.name,
                newEntry,
                totalEntries: priceHistory.history.length,
            },
        });
    }
    catch (error) {
        console.error('Add price entry error:', error);
        res.status(500).json({
            success: false,
            code: 500,
            message: 'Internal server error adding price entry',
            errorId: `ERR-${Date.now()}`,
        });
    }
};
exports.addPriceEntry = addPriceEntry;
const updateLatestPrice = async (req, res) => {
    try {
        const code = paramToString(req.params.code);
        const { price } = req.body;
        if (!price) {
            res.status(400).json({
                success: false,
                code: 400,
                message: 'Price is required',
                details: { required: ['price'] },
            });
            return;
        }
        const commodity = await commodity_model_1.default.findOne({ code });
        if (!commodity) {
            res.status(404).json({
                success: false,
                code: 404,
                message: 'Commodity not found',
                details: { code },
            });
            return;
        }
        const priceHistory = await commodity_model_1.PriceHistory.findOne({ commodity_code: code });
        if (!priceHistory || priceHistory.history.length === 0) {
            res.status(404).json({
                success: false,
                code: 404,
                message: 'No price entries found',
                details: { code },
            });
            return;
        }
        const oldPrice = priceHistory.history[0].price;
        const percentage_change = ((Number(price) - oldPrice) / oldPrice) * 100;
        priceHistory.history[0].price = Number(price);
        priceHistory.history[0].date = new Date();
        await priceHistory.save();
        commodity.currentPrice = Number(price);
        commodity.percentage_change = parseFloat(percentage_change.toFixed(4));
        commodity.last_updated = new Date();
        await commodity.save();
        await invalidateCache(code);
        (0, ws_1.publishCommodityUpdate)(code, commodity);
        res.status(200).json({
            success: true,
            code: 200,
            message: 'Latest price updated successfully',
            data: {
                code: commodity.code,
                name: commodity.name,
                latestPrice: {
                    date: priceHistory.history[0].date,
                    price: priceHistory.history[0].price,
                },
                currentPrice: commodity.currentPrice,
                percentage_change: commodity.percentage_change,
                totalEntries: priceHistory.history.length,
            },
        });
    }
    catch (error) {
        console.error('Update latest price error:', error);
        res.status(500).json({
            success: false,
            code: 500,
            message: 'Internal server error updating latest price',
            errorId: `ERR-${Date.now()}`,
        });
    }
};
exports.updateLatestPrice = updateLatestPrice;
const getCommodityHistoryByPeriod = async (req, res) => {
    try {
        const code = paramToString(req.params.code);
        const { period } = req.params;
        const { limit = 100 } = req.query;
        const validPeriods = ['1d', '1w', '1m', '3m', '6m', '1y', '5y', '10y', '20y', 'all'];
        if (!validPeriods.includes(period)) {
            res.status(400).json({
                success: false,
                code: 400,
                message: 'Invalid period. Must be one of: 1d, 1w, 1m, 3m, 6m, 1y, 5y, 10y, 20y, all',
                details: { period },
            });
            return;
        }
        const cacheKey = `commodity:pricehistory:${code}:${period}:${limit}`;
        const cached = await getCache(cacheKey);
        if (cached) {
            res.status(200).json({
                success: true,
                code: 200,
                fromCache: true,
                data: cached,
            });
            return;
        }
        const commodity = await commodity_model_1.default.findOne({ code });
        if (!commodity) {
            res.status(404).json({
                success: false,
                code: 404,
                message: 'Commodity not found',
                details: { code },
            });
            return;
        }
        const startDate = getDateRange(period);
        let query = { commodity_code: code };
        if (startDate) {
            query['history.date'] = { $gte: startDate };
        }
        const priceHistory = await commodity_model_1.PriceHistory.aggregate([
            { $match: { commodity_code: code } },
            { $unwind: '$history' },
            ...(startDate ? [{ $match: { 'history.date': { $gte: startDate } } }] : []),
            { $sort: { 'history.date': -1 } },
            { $limit: Number(limit) },
            { $group: {
                    _id: '$_id',
                    commodity_code: { $first: '$commodity_code' },
                    history: { $push: '$history' },
                    createdAt: { $first: '$createdAt' },
                    updatedAt: { $first: '$updatedAt' }
                } }
        ]);
        if (!priceHistory.length) {
            res.status(404).json({
                success: false,
                code: 404,
                message: 'Price history not found',
                details: { code },
            });
            return;
        }
        const result = {
            code: commodity.code,
            name: commodity.name,
            unit: commodity.unit,
            category: commodity.category,
            currentPrice: commodity.currentPrice,
            percentage_change: commodity.percentage_change,
            period,
            ...priceHistory[0]
        };
        await setCache(cacheKey, result, 300);
        res.status(200).json({
            success: true,
            code: 200,
            fromCache: false,
            data: result,
        });
    }
    catch (error) {
        console.error('Get commodity history by period error:', error);
        res.status(500).json({
            success: false,
            code: 500,
            message: 'Internal server error fetching commodity history',
            errorId: `ERR-${Date.now()}`,
        });
    }
};
exports.getCommodityHistoryByPeriod = getCommodityHistoryByPeriod;
const getLatestPriceHistory = async (req, res) => {
    try {
        const code = paramToString(req.params.code);
        const { limit = 30 } = req.query;
        const cacheKey = `commodity:pricehistory:${code}:latest:${limit}`;
        const cached = await getCache(cacheKey);
        if (cached) {
            res.status(200).json({
                success: true,
                code: 200,
                fromCache: true,
                data: cached,
            });
            return;
        }
        const commodity = await commodity_model_1.default.findOne({ code });
        if (!commodity) {
            res.status(404).json({
                success: false,
                code: 404,
                message: 'Commodity not found',
                details: { code },
            });
            return;
        }
        const priceHistory = await commodity_model_1.PriceHistory.findOne({ commodity_code: code }, { 'history': { $slice: Number(limit) } }).sort({ updatedAt: -1 });
        if (!priceHistory) {
            res.status(404).json({
                success: false,
                code: 404,
                message: 'Price history not found',
                details: { code },
            });
            return;
        }
        const result = {
            code: commodity.code,
            name: commodity.name,
            unit: commodity.unit,
            category: commodity.category,
            currentPrice: commodity.currentPrice,
            percentage_change: commodity.percentage_change,
            ...priceHistory.toObject()
        };
        await setCache(cacheKey, result, 300);
        res.status(200).json({
            success: true,
            code: 200,
            fromCache: false,
            data: result,
        });
    }
    catch (error) {
        console.error('Get latest price history error:', error);
        res.status(500).json({
            success: false,
            code: 500,
            message: 'Internal server error fetching latest price history',
            errorId: `ERR-${Date.now()}`,
        });
    }
};
exports.getLatestPriceHistory = getLatestPriceHistory;
const updatePriceHistoryEntry = async (req, res) => {
    try {
        const { code, entryId } = req.params;
        const codeStr = paramToString(code);
        const { price, date } = req.body;
        const priceHistory = await commodity_model_1.PriceHistory.findOne({ commodity_code: codeStr });
        if (!priceHistory) {
            res.status(404).json({
                success: false,
                code: 404,
                message: 'Price history not found',
                details: { code: codeStr },
            });
            return;
        }
        const entryIndex = priceHistory.history.findIndex((entry) => entry._id.toString() === entryId);
        if (entryIndex === -1) {
            res.status(404).json({
                success: false,
                code: 404,
                message: 'Price history entry not found',
                details: { entryId },
            });
            return;
        }
        if (price !== undefined)
            priceHistory.history[entryIndex].price = Number(price);
        if (date)
            priceHistory.history[entryIndex].date = new Date(date);
        await priceHistory.save();
        await invalidateCache(codeStr);
        res.status(200).json({
            success: true,
            code: 200,
            message: 'Price history entry updated successfully',
            data: {
                code: codeStr,
                entry: priceHistory.history[entryIndex],
            }
        });
    }
    catch (error) {
        console.error('Update price history entry error:', error);
        res.status(500).json({
            success: false,
            code: 500,
            message: 'Internal server error updating price history entry',
            errorId: `ERR-${Date.now()}`,
        });
    }
};
exports.updatePriceHistoryEntry = updatePriceHistoryEntry;
const deletePriceHistoryEntry = async (req, res) => {
    try {
        const { code, entryId } = req.params;
        const codeStr = paramToString(code);
        const priceHistory = await commodity_model_1.PriceHistory.findOneAndUpdate({ commodity_code: codeStr }, { $pull: { history: { _id: entryId } } }, { new: true });
        if (!priceHistory) {
            res.status(404).json({
                success: false,
                code: 404,
                message: 'Price history or entry not found',
                details: { code: codeStr, entryId },
            });
            return;
        }
        await invalidateCache(codeStr);
        res.status(200).json({
            success: true,
            code: 200,
            message: 'Price history entry deleted successfully',
            data: {
                code: codeStr,
                total_entries: priceHistory.history.length
            }
        });
    }
    catch (error) {
        console.error('Delete price history entry error:', error);
        res.status(500).json({
            success: false,
            code: 500,
            message: 'Internal server error deleting price history entry',
            errorId: `ERR-${Date.now()}`,
        });
    }
};
exports.deletePriceHistoryEntry = deletePriceHistoryEntry;
const clearPriceHistory = async (req, res) => {
    try {
        const code = paramToString(req.params.code);
        const priceHistory = await commodity_model_1.PriceHistory.findOneAndUpdate({ commodity_code: code }, { $set: { history: [] } }, { new: true });
        if (!priceHistory) {
            res.status(404).json({
                success: false,
                code: 404,
                message: 'Price history not found',
                details: { code },
            });
            return;
        }
        await invalidateCache(code);
        res.status(200).json({
            success: true,
            code: 200,
            message: 'Price history cleared successfully',
            data: {
                code,
            }
        });
    }
    catch (error) {
        console.error('Clear price history error:', error);
        res.status(500).json({
            success: false,
            code: 500,
            message: 'Internal server error clearing price history',
            errorId: `ERR-${Date.now()}`,
        });
    }
};
exports.clearPriceHistory = clearPriceHistory;
//# sourceMappingURL=commodities.controller.js.map