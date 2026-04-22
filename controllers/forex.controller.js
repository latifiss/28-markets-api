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
exports.bulkSyncForexPrices = exports.bulkExportForex = exports.bulkGetForex = exports.bulkImportForex = exports.bulkUpdateForexPrices = exports.bulkUpsertForex = exports.bulkDeleteForex = exports.bulkAddPriceHistoryEntries = exports.bulkUpdateForex = exports.bulkCreateForex = exports.clearPriceHistory = exports.deletePriceHistoryEntry = exports.updatePriceHistoryEntry = exports.getLatestPriceHistory = exports.getForexHistoryByPeriod = exports.updateLatestPrice = exports.addPriceEntry = exports.updateForexPrice = exports.addForexHistory = exports.getForexHistory = exports.deleteForex = exports.updateForex = exports.getForex = exports.getAllForex = exports.createForex = void 0;
const forex_model_1 = __importStar(require("../models/forex.model"));
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
                await client.del(key);
            }
        }
    }
    catch (error) {
        console.error('Error deleting cache by pattern:', error.message);
    }
};
const invalidateCache = async (code = null) => {
    await deleteCacheByPattern('forex:*');
    if (code) {
        await deleteCacheByPattern(`forex:code:${code}`);
        await deleteCacheByPattern(`forex:pricehistory:${code}`);
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
const createForex = async (req, res) => {
    try {
        const { code, name, from_currency, from_code, to_currency, to_code, currentPrice, percentage_change, monthly_change, yearly_change, } = req.body;
        if (!from_code ||
            from_code.length !== 3 ||
            !to_code ||
            to_code.length !== 3) {
            res.status(400).json({
                success: false,
                code: 400,
                message: 'Currency codes must be exactly 3 characters',
                details: {
                    from_code: from_code || 'missing',
                    to_code: to_code || 'missing',
                    expected: '3 characters',
                },
            });
            return;
        }
        const requiredFields = [
            'code',
            'name',
            'from_currency',
            'from_code',
            'to_currency',
            'to_code',
            'currentPrice',
        ];
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
        const newForex = new forex_model_1.default({
            code,
            name,
            from_currency,
            from_code: from_code.toUpperCase(),
            to_currency,
            to_code: to_code.toUpperCase(),
            currentPrice,
            percentage_change: percentage_change || 0,
            monthly_change: monthly_change || 0,
            yearly_change: yearly_change || 0,
            last_updated: new Date(),
        });
        const savedForex = await newForex.save();
        await forex_model_1.PriceHistory.create({
            forex_code: code,
            history: [{
                    date: new Date(),
                    price: currentPrice,
                }],
        });
        await invalidateCache(code);
        (0, ws_1.publishForexUpdate)(code, savedForex);
        res.status(201).json({
            success: true,
            code: 201,
            message: 'Forex pair created successfully',
            data: savedForex,
        });
    }
    catch (error) {
        if (error.code === 11000) {
            res.status(400).json({
                success: false,
                code: 400,
                message: 'Duplicate entry. Forex code already exists',
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
        console.error('Create error:', error);
        res.status(500).json({
            success: false,
            code: 500,
            message: 'Internal server error creating Forex pair',
            errorId: `ERR-${Date.now()}`,
        });
    }
};
exports.createForex = createForex;
const getAllForex = async (req, res) => {
    try {
        const cacheKey = 'forex:all';
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
        const forexPairs = await forex_model_1.default.find();
        await setCache(cacheKey, forexPairs);
        res.status(200).json({
            success: true,
            code: 200,
            fromCache: false,
            data: forexPairs,
        });
    }
    catch (error) {
        console.error('Get all error:', error);
        res.status(500).json({
            success: false,
            code: 500,
            message: 'Internal server error fetching Forex pairs',
            errorId: `ERR-${Date.now()}`,
        });
    }
};
exports.getAllForex = getAllForex;
const getForex = async (req, res) => {
    try {
        const code = paramToString(req.params.code);
        const cacheKey = `forex:code:${code}`;
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
        const forex = await forex_model_1.default.findOne({ code });
        if (!forex) {
            res.status(404).json({
                success: false,
                code: 404,
                message: 'Forex pair not found',
                details: { code },
            });
            return;
        }
        await setCache(cacheKey, forex);
        res.status(200).json({
            success: true,
            code: 200,
            fromCache: false,
            data: forex,
        });
    }
    catch (error) {
        console.error('Get by code error:', error);
        res.status(500).json({
            success: false,
            code: 500,
            message: 'Internal server error fetching Forex pair',
            errorId: `ERR-${Date.now()}`,
        });
    }
};
exports.getForex = getForex;
const updateForex = async (req, res) => {
    try {
        const code = paramToString(req.params.code);
        const { currentPrice, ...updateData } = req.body;
        if (updateData.from_code && updateData.from_code.length !== 3) {
            res.status(400).json({
                success: false,
                code: 400,
                message: 'From currency code must be exactly 3 characters',
                details: {
                    from_code: updateData.from_code,
                    expected: '3 characters',
                },
            });
            return;
        }
        if (updateData.to_code && updateData.to_code.length !== 3) {
            res.status(400).json({
                success: false,
                code: 400,
                message: 'To currency code must be exactly 3 characters',
                details: {
                    to_code: updateData.to_code,
                    expected: '3 characters',
                },
            });
            return;
        }
        const forex = await forex_model_1.default.findOne({ code });
        if (!forex) {
            res.status(404).json({
                success: false,
                code: 404,
                message: 'Forex pair not found',
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
        const oldPrice = forex.currentPrice;
        if (currentPrice !== undefined && currentPrice !== oldPrice) {
            const percentage_change = ((currentPrice - oldPrice) / oldPrice) * 100;
            updateOperations.$set.currentPrice = currentPrice;
            updateOperations.$set.percentage_change = parseFloat(percentage_change.toFixed(4));
        }
        const updatedForex = await forex_model_1.default.findOneAndUpdate({ code }, updateOperations, { new: true });
        if (currentPrice !== undefined && currentPrice !== oldPrice) {
            await forex_model_1.PriceHistory.findOneAndUpdate({ forex_code: code }, {
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
        (0, ws_1.publishForexUpdate)(code, updatedForex);
        res.status(200).json({
            success: true,
            code: 200,
            message: 'Forex pair updated successfully',
            data: updatedForex,
        });
    }
    catch (error) {
        if (error.code === 11000) {
            res.status(400).json({
                success: false,
                code: 400,
                message: 'Duplicate entry. Forex code already exists',
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
        console.error('Update error:', error);
        res.status(500).json({
            success: false,
            code: 500,
            message: 'Internal server error updating Forex pair',
            errorId: `ERR-${Date.now()}`,
        });
    }
};
exports.updateForex = updateForex;
const deleteForex = async (req, res) => {
    try {
        const code = paramToString(req.params.code);
        const deletedForex = await forex_model_1.default.findOneAndDelete({ code });
        if (!deletedForex) {
            res.status(404).json({
                success: false,
                code: 404,
                message: 'Forex pair not found',
                details: { code },
            });
            return;
        }
        await forex_model_1.PriceHistory.findOneAndDelete({ forex_code: code });
        await invalidateCache(code);
        res.status(200).json({
            success: true,
            code: 200,
            message: 'Forex pair deleted successfully',
            data: {
                code: deletedForex.code,
                name: deletedForex.name,
            },
        });
    }
    catch (error) {
        console.error('Delete error:', error);
        res.status(500).json({
            success: false,
            code: 500,
            message: 'Internal server error deleting Forex pair',
            errorId: `ERR-${Date.now()}`,
        });
    }
};
exports.deleteForex = deleteForex;
const getForexHistory = async (req, res) => {
    try {
        const code = paramToString(req.params.code);
        const { period = 'all', limit = 100 } = req.query;
        const cacheKey = `forex:pricehistory:${code}:${period}:${limit}`;
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
        const forex = await forex_model_1.default.findOne({ code });
        if (!forex) {
            res.status(404).json({
                success: false,
                code: 404,
                message: 'Forex pair not found',
                details: { code },
            });
            return;
        }
        const startDate = getDateRange(period);
        let query = { forex_code: code };
        if (startDate) {
            query['history.date'] = { $gte: startDate };
        }
        const priceHistory = await forex_model_1.PriceHistory.aggregate([
            { $match: { forex_code: code } },
            { $unwind: '$history' },
            ...(startDate ? [{ $match: { 'history.date': { $gte: startDate } } }] : []),
            { $sort: { 'history.date': -1 } },
            { $limit: Number(limit) },
            { $group: {
                    _id: '$_id',
                    forex_code: { $first: '$forex_code' },
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
            code: forex.code,
            name: forex.name,
            from_currency: forex.from_currency,
            from_code: forex.from_code,
            to_currency: forex.to_currency,
            to_code: forex.to_code,
            currentPrice: forex.currentPrice,
            percentage_change: forex.percentage_change,
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
        console.error('Get history error:', error);
        res.status(500).json({
            success: false,
            code: 500,
            message: 'Internal server error fetching price history',
            errorId: `ERR-${Date.now()}`,
        });
    }
};
exports.getForexHistory = getForexHistory;
const addForexHistory = async (req, res) => {
    try {
        const code = paramToString(req.params.code);
        const { date, price } = req.body;
        if (!price) {
            res.status(400).json({
                success: false,
                code: 400,
                message: 'Price is required',
                details: {
                    required: ['price'],
                },
            });
            return;
        }
        const forex = await forex_model_1.default.findOne({ code });
        if (!forex) {
            res.status(404).json({
                success: false,
                code: 404,
                message: 'Forex pair not found',
                details: { code },
            });
            return;
        }
        const newPriceEntry = {
            date: date ? new Date(date) : new Date(),
            price: Number(price),
        };
        const priceHistory = await forex_model_1.PriceHistory.findOneAndUpdate({ forex_code: code }, {
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
                code: forex.code,
                name: forex.name,
                new_price_entry: newPriceEntry,
                total_history_entries: priceHistory.history.length,
            },
        });
    }
    catch (error) {
        console.error('Add history error:', error);
        res.status(500).json({
            success: false,
            code: 500,
            message: 'Internal server error adding price history',
            errorId: `ERR-${Date.now()}`,
        });
    }
};
exports.addForexHistory = addForexHistory;
const updateForexPrice = async (req, res) => {
    try {
        const code = paramToString(req.params.code);
        const { currentPrice } = req.body;
        if (!currentPrice) {
            res.status(400).json({
                success: false,
                code: 400,
                message: 'Current price is required',
                details: {
                    required: ['currentPrice'],
                },
            });
            return;
        }
        const forex = await forex_model_1.default.findOne({ code });
        if (!forex) {
            res.status(404).json({
                success: false,
                code: 404,
                message: 'Forex pair not found',
                details: { code },
            });
            return;
        }
        const updateOperations = {
            $set: {
                last_updated: new Date(),
            },
        };
        if (currentPrice !== forex.currentPrice) {
            const percentage_change = ((currentPrice - forex.currentPrice) / forex.currentPrice) * 100;
            updateOperations.$set.currentPrice = currentPrice;
            updateOperations.$set.percentage_change = parseFloat(percentage_change.toFixed(4));
            await forex_model_1.PriceHistory.findOneAndUpdate({ forex_code: code }, {
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
        const updatedForex = await forex_model_1.default.findOneAndUpdate({ code }, updateOperations, { new: true });
        await invalidateCache(code);
        (0, ws_1.publishForexUpdate)(code, updatedForex);
        res.status(200).json({
            success: true,
            code: 200,
            message: 'Forex price updated successfully',
            data: updatedForex,
        });
    }
    catch (error) {
        console.error('Update price error:', error);
        res.status(500).json({
            success: false,
            code: 500,
            message: 'Internal server error updating Forex price',
            errorId: `ERR-${Date.now()}`,
        });
    }
};
exports.updateForexPrice = updateForexPrice;
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
        const forex = await forex_model_1.default.findOne({ code });
        if (!forex) {
            res.status(404).json({
                success: false,
                code: 404,
                message: 'Forex pair not found',
                details: { code },
            });
            return;
        }
        const newEntry = {
            date: new Date(date),
            price: Number(price),
        };
        const priceHistory = await forex_model_1.PriceHistory.findOneAndUpdate({ forex_code: code }, {
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
                code: forex.code,
                name: forex.name,
                from_currency: forex.from_currency,
                to_currency: forex.to_currency,
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
        const forex = await forex_model_1.default.findOne({ code });
        if (!forex) {
            res.status(404).json({
                success: false,
                code: 404,
                message: 'Forex pair not found',
                details: { code },
            });
            return;
        }
        const priceHistory = await forex_model_1.PriceHistory.findOne({ forex_code: code });
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
        forex.currentPrice = Number(price);
        forex.percentage_change = parseFloat(percentage_change.toFixed(4));
        forex.last_updated = new Date();
        await forex.save();
        await invalidateCache(code);
        res.status(200).json({
            success: true,
            code: 200,
            message: 'Latest price updated successfully',
            data: {
                code: forex.code,
                name: forex.name,
                from_currency: forex.from_currency,
                to_currency: forex.to_currency,
                latestPrice: {
                    date: priceHistory.history[0].date,
                    price: priceHistory.history[0].price,
                },
                currentPrice: forex.currentPrice,
                percentage_change: forex.percentage_change,
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
const getForexHistoryByPeriod = async (req, res) => {
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
        const cacheKey = `forex:pricehistory:${code}:${period}:${limit}`;
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
        const forex = await forex_model_1.default.findOne({ code });
        if (!forex) {
            res.status(404).json({
                success: false,
                code: 404,
                message: 'Forex pair not found',
                details: { code },
            });
            return;
        }
        const startDate = getDateRange(period);
        let query = { forex_code: code };
        if (startDate) {
            query['history.date'] = { $gte: startDate };
        }
        const priceHistory = await forex_model_1.PriceHistory.aggregate([
            { $match: { forex_code: code } },
            { $unwind: '$history' },
            ...(startDate ? [{ $match: { 'history.date': { $gte: startDate } } }] : []),
            { $sort: { 'history.date': -1 } },
            { $limit: Number(limit) },
            { $group: {
                    _id: '$_id',
                    forex_code: { $first: '$forex_code' },
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
            code: forex.code,
            name: forex.name,
            from_currency: forex.from_currency,
            from_code: forex.from_code,
            to_currency: forex.to_currency,
            to_code: forex.to_code,
            currentPrice: forex.currentPrice,
            percentage_change: forex.percentage_change,
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
        console.error('Get history by period error:', error);
        res.status(500).json({
            success: false,
            code: 500,
            message: 'Internal server error fetching price history',
            errorId: `ERR-${Date.now()}`,
        });
    }
};
exports.getForexHistoryByPeriod = getForexHistoryByPeriod;
const getLatestPriceHistory = async (req, res) => {
    try {
        const code = paramToString(req.params.code);
        const { limit = 30 } = req.query;
        const cacheKey = `forex:pricehistory:${code}:latest:${limit}`;
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
        const forex = await forex_model_1.default.findOne({ code });
        if (!forex) {
            res.status(404).json({
                success: false,
                code: 404,
                message: 'Forex pair not found',
                details: { code },
            });
            return;
        }
        const priceHistory = await forex_model_1.PriceHistory.findOne({ forex_code: code }, { 'history': { $slice: Number(limit) } }).sort({ updatedAt: -1 });
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
            code: forex.code,
            name: forex.name,
            from_currency: forex.from_currency,
            from_code: forex.from_code,
            to_currency: forex.to_currency,
            to_code: forex.to_code,
            currentPrice: forex.currentPrice,
            percentage_change: forex.percentage_change,
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
        const priceHistory = await forex_model_1.PriceHistory.findOne({ forex_code: codeStr });
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
        const priceHistory = await forex_model_1.PriceHistory.findOneAndUpdate({ forex_code: codeStr }, { $pull: { history: { _id: entryId } } }, { new: true });
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
        const priceHistory = await forex_model_1.PriceHistory.findOneAndUpdate({ forex_code: code }, { $set: { history: [] } }, { new: true });
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
const bulkCreateForex = async (req, res) => {
    var _a, _b;
    try {
        const { forexPairs } = req.body;
        if (!forexPairs || !Array.isArray(forexPairs) || forexPairs.length === 0) {
            res.status(400).json({
                success: false,
                code: 400,
                message: 'Forex pairs array is required and must not be empty',
                details: { required: ['forexPairs'] },
            });
            return;
        }
        const result = {
            successful: [],
            failed: [],
        };
        for (const forexData of forexPairs) {
            try {
                const { code, currentPrice } = forexData;
                if (!code) {
                    result.failed.push({
                        operation: 'create_forex',
                        error: 'Forex code is required',
                        data: forexData,
                    });
                    continue;
                }
                if (!currentPrice) {
                    result.failed.push({
                        code,
                        operation: 'create_forex',
                        error: 'Current price is required',
                        data: forexData,
                    });
                    continue;
                }
                const existingForex = await forex_model_1.default.findOne({ code });
                if (existingForex) {
                    result.failed.push({
                        code,
                        operation: 'create_forex',
                        error: 'Forex pair already exists',
                        data: forexData,
                    });
                    continue;
                }
                if (forexData.from_code && forexData.from_code.length !== 3) {
                    result.failed.push({
                        code,
                        operation: 'create_forex',
                        error: 'From currency code must be exactly 3 characters',
                        data: forexData,
                    });
                    continue;
                }
                if (forexData.to_code && forexData.to_code.length !== 3) {
                    result.failed.push({
                        code,
                        operation: 'create_forex',
                        error: 'To currency code must be exactly 3 characters',
                        data: forexData,
                    });
                    continue;
                }
                const newForex = new forex_model_1.default({
                    ...forexData,
                    from_code: (_a = forexData.from_code) === null || _a === void 0 ? void 0 : _a.toUpperCase(),
                    to_code: (_b = forexData.to_code) === null || _b === void 0 ? void 0 : _b.toUpperCase(),
                    percentage_change: forexData.percentage_change || 0,
                    last_updated: new Date(),
                });
                const savedForex = await newForex.save();
                await forex_model_1.PriceHistory.create({
                    forex_code: code,
                    history: [{
                            date: new Date(),
                            price: currentPrice,
                        }],
                });
                await invalidateCache(code);
                result.successful.push({
                    code,
                    operation: 'create_forex',
                    id: savedForex._id.toString(),
                });
            }
            catch (error) {
                result.failed.push({
                    code: forexData.code,
                    operation: 'create_forex',
                    error: error.message,
                    data: forexData,
                });
            }
        }
        res.status(201).json({
            success: true,
            code: 201,
            message: `Bulk forex creation completed: ${result.successful.length} successful, ${result.failed.length} failed`,
            data: result,
        });
    }
    catch (error) {
        console.error('Bulk create forex error:', error);
        res.status(500).json({
            success: false,
            code: 500,
            message: 'Internal server error during bulk forex creation',
            errorId: `ERR-${Date.now()}`,
        });
    }
};
exports.bulkCreateForex = bulkCreateForex;
const bulkUpdateForex = async (req, res) => {
    try {
        const { updates } = req.body;
        if (!updates || !Array.isArray(updates) || updates.length === 0) {
            res.status(400).json({
                success: false,
                code: 400,
                message: 'Updates array is required and must not be empty',
                details: { required: ['updates'] },
            });
            return;
        }
        const result = {
            successful: [],
            failed: [],
        };
        for (const update of updates) {
            try {
                const { code, data } = update;
                if (!code || !data) {
                    result.failed.push({
                        code,
                        operation: 'update_forex',
                        error: 'Forex code and update data are required',
                    });
                    continue;
                }
                const forex = await forex_model_1.default.findOne({ code });
                if (!forex) {
                    result.failed.push({
                        code,
                        operation: 'update_forex',
                        error: 'Forex pair not found',
                    });
                    continue;
                }
                const updateOperations = {
                    $set: {
                        ...data,
                        last_updated: new Date(),
                    },
                };
                if (data.currentPrice !== undefined && data.currentPrice !== forex.currentPrice) {
                    const percentage_change = ((data.currentPrice - forex.currentPrice) / forex.currentPrice) * 100;
                    updateOperations.$set.currentPrice = data.currentPrice;
                    updateOperations.$set.percentage_change = parseFloat(percentage_change.toFixed(4));
                    await forex_model_1.PriceHistory.findOneAndUpdate({ forex_code: code }, {
                        $push: {
                            history: {
                                $each: [{
                                        date: new Date(),
                                        price: data.currentPrice,
                                    }],
                                $position: 0,
                            },
                        },
                    }, { upsert: true });
                }
                const updatedForex = await forex_model_1.default.findOneAndUpdate({ code }, updateOperations, { new: true });
                await invalidateCache(code);
                result.successful.push({
                    code,
                    operation: 'update_forex',
                });
            }
            catch (error) {
                result.failed.push({
                    code: update.code,
                    operation: 'update_forex',
                    error: error.message,
                });
            }
        }
        res.status(200).json({
            success: true,
            code: 200,
            message: `Bulk forex update completed: ${result.successful.length} successful, ${result.failed.length} failed`,
            data: result,
        });
    }
    catch (error) {
        console.error('Bulk update forex error:', error);
        res.status(500).json({
            success: false,
            code: 500,
            message: 'Internal server error during bulk forex update',
            errorId: `ERR-${Date.now()}`,
        });
    }
};
exports.bulkUpdateForex = bulkUpdateForex;
const bulkAddPriceHistoryEntries = async (req, res) => {
    try {
        const { entries } = req.body;
        if (!entries || !Array.isArray(entries) || entries.length === 0) {
            res.status(400).json({
                success: false,
                code: 400,
                message: 'Entries array is required and must not be empty',
                details: {
                    required: ['entries'],
                    entryFormat: { code: 'string', date: 'Date', price: 'number' }
                },
            });
            return;
        }
        const result = {
            successful: [],
            failed: [],
        };
        for (const entry of entries) {
            try {
                const { code, date, price } = entry;
                if (!code || !price) {
                    result.failed.push({
                        code,
                        operation: 'add_price_entry',
                        error: 'Forex code and price are required',
                    });
                    continue;
                }
                const forex = await forex_model_1.default.findOne({ code });
                if (!forex) {
                    result.failed.push({
                        code,
                        operation: 'add_price_entry',
                        error: 'Forex pair not found',
                    });
                    continue;
                }
                const newPriceEntry = {
                    date: date ? new Date(date) : new Date(),
                    price: Number(price),
                };
                const priceHistory = await forex_model_1.PriceHistory.findOneAndUpdate({ forex_code: code }, {
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
                result.successful.push({
                    code,
                    operation: 'add_price_entry',
                });
            }
            catch (error) {
                result.failed.push({
                    code: entry.code,
                    operation: 'add_price_entry',
                    error: error.message,
                });
            }
        }
        res.status(200).json({
            success: true,
            code: 200,
            message: `Bulk price entries added: ${result.successful.length} successful, ${result.failed.length} failed`,
            data: result,
        });
    }
    catch (error) {
        console.error('Bulk add price entries error:', error);
        res.status(500).json({
            success: false,
            code: 500,
            message: 'Internal server error during bulk price entry addition',
            errorId: `ERR-${Date.now()}`,
        });
    }
};
exports.bulkAddPriceHistoryEntries = bulkAddPriceHistoryEntries;
const bulkDeleteForex = async (req, res) => {
    try {
        const { codes } = req.body;
        if (!codes || !Array.isArray(codes) || codes.length === 0) {
            res.status(400).json({
                success: false,
                code: 400,
                message: 'Forex codes array is required and must not be empty',
                details: { required: ['codes'] },
            });
            return;
        }
        const result = {
            successful: [],
            failed: [],
        };
        for (const code of codes) {
            try {
                const deletedFrom = [];
                const deletedForex = await forex_model_1.default.findOneAndDelete({ code });
                if (deletedForex) {
                    deletedFrom.push('forex');
                }
                const deletedHistory = await forex_model_1.PriceHistory.findOneAndDelete({ forex_code: code });
                if (deletedHistory) {
                    deletedFrom.push('priceHistory');
                }
                if (deletedFrom.length > 0) {
                    await invalidateCache(code);
                    result.successful.push({ code, deleted_from: deletedFrom });
                }
                else {
                    result.failed.push({ code, error: 'No forex data found for this code' });
                }
            }
            catch (error) {
                result.failed.push({ code, error: error.message });
            }
        }
        res.status(200).json({
            success: true,
            code: 200,
            message: `Bulk forex deletion completed: ${result.successful.length} successful, ${result.failed.length} failed`,
            data: result,
        });
    }
    catch (error) {
        console.error('Bulk delete forex error:', error);
        res.status(500).json({
            success: false,
            code: 500,
            message: 'Internal server error during bulk forex deletion',
            errorId: `ERR-${Date.now()}`,
        });
    }
};
exports.bulkDeleteForex = bulkDeleteForex;
const bulkUpsertForex = async (req, res) => {
    try {
        const { items } = req.body;
        if (!items || !Array.isArray(items) || items.length === 0) {
            res.status(400).json({
                success: false,
                code: 400,
                message: 'Items array is required and must not be empty',
                details: { required: ['items'] },
            });
            return;
        }
        const result = {
            successful: [],
            failed: [],
        };
        for (const item of items) {
            try {
                const { code, currentPrice } = item;
                if (!code) {
                    result.failed.push({
                        operation: 'upsert_forex',
                        error: 'Forex code is required',
                        data: item,
                    });
                    continue;
                }
                const existing = await forex_model_1.default.findOne({ code });
                let operation = 'updated';
                if (existing) {
                    const updateOperations = {
                        $set: {
                            ...item,
                            last_updated: new Date(),
                        },
                    };
                    if (currentPrice !== undefined && currentPrice !== existing.currentPrice) {
                        const percentage_change = ((currentPrice - existing.currentPrice) / existing.currentPrice) * 100;
                        updateOperations.$set.currentPrice = currentPrice;
                        updateOperations.$set.percentage_change = parseFloat(percentage_change.toFixed(4));
                        await forex_model_1.PriceHistory.findOneAndUpdate({ forex_code: code }, {
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
                    await forex_model_1.default.findOneAndUpdate({ code }, updateOperations, { new: true, runValidators: true });
                }
                else {
                    if (!currentPrice) {
                        result.failed.push({
                            code,
                            operation: 'upsert_forex',
                            error: 'Current price is required for new forex pairs',
                            data: item,
                        });
                        continue;
                    }
                    const newForex = new forex_model_1.default({
                        ...item,
                        percentage_change: item.percentage_change || 0,
                        last_updated: new Date(),
                    });
                    await newForex.save();
                    await forex_model_1.PriceHistory.create({
                        forex_code: code,
                        history: [{
                                date: new Date(),
                                price: currentPrice,
                            }],
                    });
                    operation = 'created';
                }
                await invalidateCache(code);
                result.successful.push({
                    code,
                    operation: `${operation}_forex`,
                });
            }
            catch (error) {
                result.failed.push({
                    code: item.code,
                    operation: 'upsert_forex',
                    error: error.message,
                    data: item,
                });
            }
        }
        res.status(200).json({
            success: true,
            code: 200,
            message: `Bulk forex upsert completed: ${result.successful.length} successful, ${result.failed.length} failed`,
            data: result,
        });
    }
    catch (error) {
        console.error('Bulk upsert forex error:', error);
        res.status(500).json({
            success: false,
            code: 500,
            message: 'Internal server error during bulk forex upsert',
            errorId: `ERR-${Date.now()}`,
        });
    }
};
exports.bulkUpsertForex = bulkUpsertForex;
const bulkUpdateForexPrices = async (req, res) => {
    try {
        const { prices } = req.body;
        if (!prices || !Array.isArray(prices) || prices.length === 0) {
            res.status(400).json({
                success: false,
                code: 400,
                message: 'Prices array is required and must not be empty',
                details: {
                    required: ['prices'],
                    priceFormat: { code: 'string', currentPrice: 'number' }
                },
            });
            return;
        }
        const result = {
            successful: [],
            failed: [],
        };
        for (const priceUpdate of prices) {
            try {
                const { code, currentPrice } = priceUpdate;
                if (!code || !currentPrice) {
                    result.failed.push({
                        code,
                        operation: 'update_price',
                        error: 'Forex code and current price are required',
                    });
                    continue;
                }
                const forex = await forex_model_1.default.findOne({ code });
                if (!forex) {
                    result.failed.push({
                        code,
                        operation: 'update_price',
                        error: 'Forex pair not found',
                    });
                    continue;
                }
                const updateOperations = {
                    $set: {
                        last_updated: new Date(),
                    },
                };
                if (currentPrice !== forex.currentPrice) {
                    const percentage_change = ((currentPrice - forex.currentPrice) / forex.currentPrice) * 100;
                    updateOperations.$set.currentPrice = currentPrice;
                    updateOperations.$set.percentage_change = parseFloat(percentage_change.toFixed(4));
                    await forex_model_1.PriceHistory.findOneAndUpdate({ forex_code: code }, {
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
                await forex_model_1.default.findOneAndUpdate({ code }, updateOperations, { new: true });
                await invalidateCache(code);
                result.successful.push({
                    code,
                    operation: 'update_price',
                });
            }
            catch (error) {
                result.failed.push({
                    code: priceUpdate.code,
                    operation: 'update_price',
                    error: error.message,
                });
            }
        }
        res.status(200).json({
            success: true,
            code: 200,
            message: `Bulk price updates completed: ${result.successful.length} successful, ${result.failed.length} failed`,
            data: result,
        });
    }
    catch (error) {
        console.error('Bulk update prices error:', error);
        res.status(500).json({
            success: false,
            code: 500,
            message: 'Internal server error during bulk price updates',
            errorId: `ERR-${Date.now()}`,
        });
    }
};
exports.bulkUpdateForexPrices = bulkUpdateForexPrices;
const bulkImportForex = async (req, res) => {
    try {
        const { forexList } = req.body;
        if (!forexList || !Array.isArray(forexList) || forexList.length === 0) {
            res.status(400).json({
                success: false,
                code: 400,
                message: 'Forex list array is required and must not be empty',
                details: {
                    required: ['forexList'],
                    forexFormat: {
                        code: 'string (required)',
                        name: 'string (required)',
                        from_currency: 'string (required)',
                        from_code: 'string (3 chars, required)',
                        to_currency: 'string (required)',
                        to_code: 'string (3 chars, required)',
                        currentPrice: 'number (required)',
                        priceHistory: 'array of {date, price} (optional)'
                    }
                },
            });
            return;
        }
        const result = {
            successful: [],
            failed: [],
        };
        for (const forexData of forexList) {
            const { code, name, from_currency, from_code, to_currency, to_code, currentPrice, priceHistory } = forexData;
            if (!code || !name || !from_currency || !from_code || !to_currency || !to_code || !currentPrice) {
                result.failed.push({
                    code: code || 'unknown',
                    error: 'Missing required fields',
                    details: { required: ['code', 'name', 'from_currency', 'from_code', 'to_currency', 'to_code', 'currentPrice'] },
                });
                continue;
            }
            if (from_code.length !== 3 || to_code.length !== 3) {
                result.failed.push({
                    code,
                    error: 'Currency codes must be exactly 3 characters',
                    details: { from_code, to_code },
                });
                continue;
            }
            const collectionsCreated = [];
            try {
                const existingForex = await forex_model_1.default.findOne({ code });
                if (!existingForex) {
                    const newForex = new forex_model_1.default({
                        code,
                        name,
                        from_currency,
                        from_code: from_code.toUpperCase(),
                        to_currency,
                        to_code: to_code.toUpperCase(),
                        currentPrice,
                        percentage_change: forexData.percentage_change || 0,
                        monthly_change: forexData.monthly_change || 0,
                        yearly_change: forexData.yearly_change || 0,
                        last_updated: new Date(),
                    });
                    await newForex.save();
                    collectionsCreated.push('forex');
                }
                else {
                    collectionsCreated.push('forex (already exists)');
                }
                const historyEntries = priceHistory || [{ date: new Date(), price: currentPrice }];
                const existingHistory = await forex_model_1.PriceHistory.findOne({ forex_code: code });
                if (!existingHistory) {
                    await forex_model_1.PriceHistory.create({
                        forex_code: code,
                        history: historyEntries.map((entry) => ({
                            date: new Date(entry.date),
                            price: entry.price,
                        })),
                    });
                    collectionsCreated.push('priceHistory');
                }
                else {
                    const newEntries = historyEntries.map((entry) => ({
                        date: new Date(entry.date),
                        price: entry.price,
                    }));
                    await forex_model_1.PriceHistory.findOneAndUpdate({ forex_code: code }, {
                        $push: {
                            history: {
                                $each: newEntries,
                                $position: 0,
                            },
                        },
                    });
                    collectionsCreated.push('priceHistory (updated)');
                }
                const priceHistoryDoc = await forex_model_1.PriceHistory.findOne({ forex_code: code });
                if (priceHistoryDoc && priceHistoryDoc.history.length > 5000) {
                    priceHistoryDoc.history = priceHistoryDoc.history.slice(0, 5000);
                    await priceHistoryDoc.save();
                }
                await invalidateCache(code);
                result.successful.push({
                    code,
                    collections_created: collectionsCreated,
                });
            }
            catch (error) {
                result.failed.push({
                    code,
                    error: error.message,
                    details: { collections_created_before_error: collectionsCreated },
                });
            }
        }
        res.status(201).json({
            success: true,
            code: 201,
            message: `Bulk forex import completed: ${result.successful.length} successful, ${result.failed.length} failed`,
            data: result,
        });
    }
    catch (error) {
        console.error('Bulk import forex error:', error);
        res.status(500).json({
            success: false,
            code: 500,
            message: 'Internal server error during bulk forex import',
            errorId: `ERR-${Date.now()}`,
        });
    }
};
exports.bulkImportForex = bulkImportForex;
const bulkGetForex = async (req, res) => {
    try {
        const { codes, from_currency, to_currency, min_price, max_price, limit = 100, page = 1 } = req.body;
        const query = {};
        if (codes && Array.isArray(codes) && codes.length > 0) {
            query.code = { $in: codes };
        }
        if (from_currency) {
            query.from_currency = from_currency;
        }
        if (to_currency) {
            query.to_currency = to_currency;
        }
        if (min_price !== undefined || max_price !== undefined) {
            query.currentPrice = {};
            if (min_price !== undefined)
                query.currentPrice.$gte = min_price;
            if (max_price !== undefined)
                query.currentPrice.$lte = max_price;
        }
        const skip = (page - 1) * limit;
        const [forexPairs, total] = await Promise.all([
            forex_model_1.default.find(query).skip(skip).limit(limit).sort({ code: 1 }),
            forex_model_1.default.countDocuments(query),
        ]);
        const result = {
            total,
            page,
            limit,
            total_pages: Math.ceil(total / limit),
            data: forexPairs,
        };
        res.status(200).json({
            success: true,
            code: 200,
            data: result,
        });
    }
    catch (error) {
        console.error('Bulk get forex error:', error);
        res.status(500).json({
            success: false,
            code: 500,
            message: 'Internal server error during bulk forex fetch',
            errorId: `ERR-${Date.now()}`,
        });
    }
};
exports.bulkGetForex = bulkGetForex;
const bulkExportForex = async (req, res) => {
    try {
        const { codes, includeHistory = false, historyLimit = 100 } = req.body;
        const query = {};
        if (codes && Array.isArray(codes) && codes.length > 0) {
            query.code = { $in: codes };
        }
        const forexPairs = await forex_model_1.default.find(query).sort({ code: 1 });
        if (includeHistory) {
            const exportData = [];
            for (const forex of forexPairs) {
                const priceHistory = await forex_model_1.PriceHistory.findOne({ forex_code: forex.code }, { history: { $slice: historyLimit } });
                exportData.push({
                    ...forex.toObject(),
                    priceHistory: priceHistory ? priceHistory.history : [],
                });
            }
            res.status(200).json({
                success: true,
                code: 200,
                data: exportData,
                metadata: {
                    total_exported: exportData.length,
                    include_history: includeHistory,
                    history_limit: historyLimit,
                    export_date: new Date(),
                },
            });
        }
        else {
            res.status(200).json({
                success: true,
                code: 200,
                data: forexPairs,
                metadata: {
                    total_exported: forexPairs.length,
                    export_date: new Date(),
                },
            });
        }
    }
    catch (error) {
        console.error('Bulk export forex error:', error);
        res.status(500).json({
            success: false,
            code: 500,
            message: 'Internal server error during bulk forex export',
            errorId: `ERR-${Date.now()}`,
        });
    }
};
exports.bulkExportForex = bulkExportForex;
const bulkSyncForexPrices = async (req, res) => {
    try {
        const { priceUpdates } = req.body;
        if (!priceUpdates || !Array.isArray(priceUpdates) || priceUpdates.length === 0) {
            res.status(400).json({
                success: false,
                code: 400,
                message: 'Price updates array is required and must not be empty',
                details: {
                    required: ['priceUpdates'],
                    updateFormat: { code: 'string', price: 'number', date: 'Date (optional)' }
                },
            });
            return;
        }
        const result = {
            updated: [],
            created: [],
            failed: [],
        };
        for (const update of priceUpdates) {
            try {
                const { code, price, date } = update;
                if (!code || !price) {
                    result.failed.push({
                        code: code || 'unknown',
                        error: 'Forex code and price are required',
                    });
                    continue;
                }
                const forex = await forex_model_1.default.findOne({ code });
                if (forex) {
                    const oldPrice = forex.currentPrice;
                    const percentage_change = ((price - oldPrice) / oldPrice) * 100;
                    await forex_model_1.default.findOneAndUpdate({ code }, {
                        $set: {
                            currentPrice: price,
                            percentage_change: parseFloat(percentage_change.toFixed(4)),
                            last_updated: new Date(),
                        },
                    });
                    await forex_model_1.PriceHistory.findOneAndUpdate({ forex_code: code }, {
                        $push: {
                            history: {
                                $each: [{
                                        date: date ? new Date(date) : new Date(),
                                        price: price,
                                    }],
                                $position: 0,
                            },
                        },
                    }, { upsert: true });
                    result.updated.push({
                        code,
                        old_price: oldPrice,
                        new_price: price,
                        percentage_change: parseFloat(percentage_change.toFixed(4)),
                    });
                }
                else {
                    result.failed.push({
                        code,
                        error: 'Forex pair not found. Use bulk import to create new pairs.',
                    });
                }
                await invalidateCache(code);
            }
            catch (error) {
                result.failed.push({
                    code: update.code,
                    error: error.message,
                });
            }
        }
        res.status(200).json({
            success: true,
            code: 200,
            message: `Bulk forex sync completed: ${result.updated.length} updated, ${result.created.length} created, ${result.failed.length} failed`,
            data: result,
        });
    }
    catch (error) {
        console.error('Bulk sync forex error:', error);
        res.status(500).json({
            success: false,
            code: 500,
            message: 'Internal server error during bulk forex sync',
            errorId: `ERR-${Date.now()}`,
        });
    }
};
exports.bulkSyncForexPrices = bulkSyncForexPrices;
//# sourceMappingURL=forex.controller.js.map