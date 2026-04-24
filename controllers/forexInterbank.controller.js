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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.clearPriceHistory = exports.deletePriceHistoryEntry = exports.updatePriceHistoryEntry = exports.getLatestPriceHistory = exports.getInterbankPairByBankCode = exports.updatePrices = exports.getInterbankPairByCode = exports.addPriceHistory = exports.getInterbankPairHistoryByPeriod = exports.getInterbankPairHistory = exports.getInterbankPair = exports.getAllInterbankPairs = exports.deleteInterbankPair = exports.updateInterbankPair = exports.createInterbankPair = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const forexInterbank_model_1 = __importStar(require("../models/forexInterbank.model"));
const redis_1 = require("../lib/redis");
const ws_1 = require("../lib/realtime/ws");
const setCache = async (key, data, expirationInSeconds = 86400) => {
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
const invalidateCache = async (code = null, id = null, bankCode = null) => {
    await deleteCacheByPattern('forexinterbank:*');
    if (code) {
        await deleteCacheByPattern(`forexinterbank:code:${code}`);
    }
    if (id) {
        await deleteCacheByPattern(`forexinterbank:id:${id}`);
    }
    if (bankCode) {
        await deleteCacheByPattern(`forexinterbank:bankcode:${bankCode}`);
        await deleteCacheByPattern(`forexinterbank:pricehistory:${bankCode}`);
    }
};
const paramToString = (param) => {
    return String(param).trim();
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
const createInterbankPair = async (req, res) => {
    try {
        const { bankName, bankCode, code, name, from_currency, from_code, to_currency, to_code, current_buying_price, buying_percentage_change, current_selling_price, selling_percentage_change, current_midrate_price, midrate_percentage_change, } = req.body;
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
            'bankName',
            'bankCode',
            'code',
            'name',
            'from_currency',
            'from_code',
            'to_currency',
            'to_code',
            'current_buying_price',
            'current_selling_price',
            'current_midrate_price',
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
        const newPair = new forexInterbank_model_1.default({
            bankName,
            bankCode,
            code,
            name,
            from_currency,
            from_code: from_code.toUpperCase(),
            to_currency,
            to_code: to_code.toUpperCase(),
            current_buying_price,
            buying_percentage_change: buying_percentage_change || 0,
            current_selling_price,
            selling_percentage_change: selling_percentage_change || 0,
            current_midrate_price,
            midrate_percentage_change: midrate_percentage_change || 0,
            last_updated: new Date(),
        });
        const savedPair = await newPair.save();
        await forexInterbank_model_1.PriceHistory.create({
            bank_code: bankCode,
            history: [{
                    date: new Date(),
                    buying_price: current_buying_price,
                    selling_price: current_selling_price,
                    midrate_price: current_midrate_price,
                }],
        });
        await invalidateCache(code, savedPair._id.toString(), bankCode);
        (0, ws_1.publishForexInterbankUpdate)({ id: savedPair._id.toString(), code, bankCode }, savedPair);
        res.status(201).json({
            success: true,
            code: 201,
            message: 'Forex Interbank pair created successfully',
            data: savedPair,
        });
    }
    catch (error) {
        if (error.code === 11000) {
            res.status(400).json({
                success: false,
                code: 400,
                message: 'Duplicate entry. Bank code or code already exists',
                details: {
                    duplicateField: Object.keys(error.keyPattern)[0],
                    duplicateValue: error.keyValue[Object.keys(error.keyPattern)[0]],
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
            message: 'Internal server error creating Forex Interbank pair',
            errorId: `ERR-${Date.now()}`,
        });
    }
};
exports.createInterbankPair = createInterbankPair;
const updateInterbankPair = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose_1.default.Types.ObjectId.isValid(id)) {
            res.status(400).json({
                success: false,
                code: 400,
                message: 'Invalid ID format',
                details: {
                    id,
                    expected: 'Valid MongoDB ObjectId',
                },
            });
            return;
        }
        const updateData = req.body;
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
        if (updateData.from_code)
            updateData.from_code = updateData.from_code.toUpperCase();
        if (updateData.to_code)
            updateData.to_code = updateData.to_code.toUpperCase();
        const pair = await forexInterbank_model_1.default.findById(id);
        if (!pair) {
            res.status(404).json({
                success: false,
                code: 404,
                message: 'Forex Interbank pair not found',
                details: { id },
            });
            return;
        }
        const oldPrices = {
            buying: pair.current_buying_price,
            selling: pair.current_selling_price,
            midrate: pair.current_midrate_price,
        };
        if (updateData.current_buying_price &&
            updateData.current_buying_price !== pair.current_buying_price) {
            const buyingPercentageChange = ((updateData.current_buying_price - pair.current_buying_price) /
                pair.current_buying_price) *
                100;
            updateData.buying_percentage_change = parseFloat(buyingPercentageChange.toFixed(4));
        }
        if (updateData.current_selling_price &&
            updateData.current_selling_price !== pair.current_selling_price) {
            const sellingPercentageChange = ((updateData.current_selling_price - pair.current_selling_price) /
                pair.current_selling_price) *
                100;
            updateData.selling_percentage_change = parseFloat(sellingPercentageChange.toFixed(4));
        }
        if (updateData.current_midrate_price &&
            updateData.current_midrate_price !== pair.current_midrate_price) {
            const midratePercentageChange = ((updateData.current_midrate_price - pair.current_midrate_price) /
                pair.current_midrate_price) *
                100;
            updateData.midrate_percentage_change = parseFloat(midratePercentageChange.toFixed(4));
        }
        updateData.last_updated = new Date();
        const updatedPair = await forexInterbank_model_1.default.findByIdAndUpdate(id, { $set: updateData }, { new: true, runValidators: true });
        if (!updatedPair) {
            res.status(404).json({
                success: false,
                code: 404,
                message: 'Forex Interbank pair not found',
                details: { id },
            });
            return;
        }
        if ((updateData.current_buying_price && updateData.current_buying_price !== oldPrices.buying) ||
            (updateData.current_selling_price && updateData.current_selling_price !== oldPrices.selling) ||
            (updateData.current_midrate_price && updateData.current_midrate_price !== oldPrices.midrate)) {
            await forexInterbank_model_1.PriceHistory.findOneAndUpdate({ bank_code: updatedPair.bankCode }, {
                $push: {
                    history: {
                        $each: [{
                                date: new Date(),
                                buying_price: updatedPair.current_buying_price,
                                selling_price: updatedPair.current_selling_price,
                                midrate_price: updatedPair.current_midrate_price,
                            }],
                        $position: 0,
                    },
                },
            }, { upsert: true });
        }
        await invalidateCache(updatedPair.code, id, updatedPair.bankCode);
        (0, ws_1.publishForexInterbankUpdate)({ id: id, code: updatedPair.code, bankCode: updatedPair.bankCode }, updatedPair);
        res.status(200).json({
            success: true,
            code: 200,
            message: 'Forex Interbank pair updated successfully',
            data: updatedPair,
        });
    }
    catch (error) {
        if (error.code === 11000) {
            res.status(400).json({
                success: false,
                code: 400,
                message: 'Duplicate entry. Bank code or code already exists',
                details: {
                    duplicateField: Object.keys(error.keyPattern)[0],
                    duplicateValue: error.keyValue[Object.keys(error.keyPattern)[0]],
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
            message: 'Internal server error updating Forex Interbank pair',
            errorId: `ERR-${Date.now()}`,
        });
    }
};
exports.updateInterbankPair = updateInterbankPair;
const deleteInterbankPair = async (req, res) => {
    try {
        const id = paramToString(req.params.id);
        if (!mongoose_1.default.Types.ObjectId.isValid(id)) {
            res.status(400).json({
                success: false,
                code: 400,
                message: 'Invalid ID format',
                details: {
                    id,
                    expected: 'Valid MongoDB ObjectId',
                },
            });
            return;
        }
        const pair = await forexInterbank_model_1.default.findById(id);
        if (!pair) {
            res.status(404).json({
                success: false,
                code: 404,
                message: 'Forex Interbank pair not found',
                details: { id },
            });
            return;
        }
        await forexInterbank_model_1.default.findByIdAndDelete(id);
        await forexInterbank_model_1.PriceHistory.findOneAndDelete({ bank_code: pair.bankCode });
        await invalidateCache(pair.code, id, pair.bankCode);
        res.status(200).json({
            success: true,
            code: 200,
            message: 'Forex Interbank pair deleted successfully',
            data: {
                id: pair._id,
                code: pair.code,
                bankName: pair.bankName,
            },
        });
    }
    catch (error) {
        console.error('Delete error:', error);
        res.status(500).json({
            success: false,
            code: 500,
            message: 'Internal server error deleting Forex Interbank pair',
            errorId: `ERR-${Date.now()}`,
        });
    }
};
exports.deleteInterbankPair = deleteInterbankPair;
const getAllInterbankPairs = async (req, res) => {
    try {
        const cacheKey = 'forexinterbank:all:nohistory';
        const cached = await getCache(cacheKey);
        if (cached) {
            res.status(200).json({
                success: true,
                code: 200,
                fromCache: true,
                count: cached.length,
                data: cached,
            });
            return;
        }
        const pairs = await forexInterbank_model_1.default.find();
        await setCache(cacheKey, pairs, 300);
        res.status(200).json({
            success: true,
            code: 200,
            fromCache: false,
            count: pairs.length,
            data: pairs,
        });
    }
    catch (error) {
        console.error('Get all error:', error);
        res.status(500).json({
            success: false,
            code: 500,
            message: 'Internal server error fetching Forex Interbank pairs',
            errorId: `ERR-${Date.now()}`,
        });
    }
};
exports.getAllInterbankPairs = getAllInterbankPairs;
const getInterbankPair = async (req, res) => {
    try {
        const id = paramToString(req.params.id);
        if (!mongoose_1.default.Types.ObjectId.isValid(id)) {
            res.status(400).json({
                success: false,
                code: 400,
                message: 'Invalid ID format',
                details: {
                    id,
                    expected: 'Valid MongoDB ObjectId',
                },
            });
            return;
        }
        const cacheKey = `forexinterbank:id:${id}`;
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
        const pair = await forexInterbank_model_1.default.findById(id);
        if (!pair) {
            res.status(404).json({
                success: false,
                code: 404,
                message: 'Forex Interbank pair not found',
                details: { id },
            });
            return;
        }
        await setCache(cacheKey, pair, 300);
        res.status(200).json({
            success: true,
            code: 200,
            fromCache: false,
            data: pair,
        });
    }
    catch (error) {
        console.error('Get by ID error:', error);
        res.status(500).json({
            success: false,
            code: 500,
            message: 'Internal server error fetching Forex Interbank pair',
            errorId: `ERR-${Date.now()}`,
        });
    }
};
exports.getInterbankPair = getInterbankPair;
const getInterbankPairHistory = async (req, res) => {
    try {
        const id = paramToString(req.params.id);
        if (!mongoose_1.default.Types.ObjectId.isValid(id)) {
            res.status(400).json({
                success: false,
                code: 400,
                message: 'Invalid ID format',
                details: {
                    id,
                    expected: 'Valid MongoDB ObjectId',
                },
            });
            return;
        }
        const pair = await forexInterbank_model_1.default.findById(id);
        if (!pair) {
            res.status(404).json({
                success: false,
                code: 404,
                message: 'Forex Interbank pair not found',
                details: { id },
            });
            return;
        }
        const cacheKey = `forexinterbank:pricehistory:${pair.bankCode}`;
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
        const { limit = 100, days } = req.query;
        let query = { bank_code: pair.bankCode };
        if (days) {
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - Number(days));
            query['history.date'] = { $gte: startDate };
        }
        const priceHistory = await forexInterbank_model_1.PriceHistory.aggregate([
            { $match: { bank_code: pair.bankCode } },
            { $unwind: '$history' },
            ...(days ? [{ $match: { 'history.date': { $gte: new Date(Date.now() - Number(days) * 24 * 60 * 60 * 1000) } } }] : []),
            { $sort: { 'history.date': -1 } },
            { $limit: Number(limit) },
            { $group: {
                    _id: '$_id',
                    bank_code: { $first: '$bank_code' },
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
                details: { bankCode: pair.bankCode },
            });
            return;
        }
        const result = {
            code: pair.code,
            bankCode: pair.bankCode,
            bankName: pair.bankName,
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
exports.getInterbankPairHistory = getInterbankPairHistory;
const getInterbankPairHistoryByPeriod = async (req, res) => {
    try {
        const { bankCode, period } = req.params;
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
        const cacheKey = `forexinterbank:pricehistory:${bankCode}:${period}:${limit}`;
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
        const pair = await forexInterbank_model_1.default.findOne({ bankCode });
        if (!pair) {
            res.status(404).json({
                success: false,
                code: 404,
                message: 'Forex Interbank pair not found',
                details: { bankCode },
            });
            return;
        }
        const startDate = getDateRange(period);
        let query = { bank_code: bankCode };
        if (startDate) {
            query['history.date'] = { $gte: startDate };
        }
        const priceHistory = await forexInterbank_model_1.PriceHistory.aggregate([
            { $match: { bank_code: bankCode } },
            { $unwind: '$history' },
            ...(startDate ? [{ $match: { 'history.date': { $gte: startDate } } }] : []),
            { $sort: { 'history.date': -1 } },
            { $limit: Number(limit) },
            { $group: {
                    _id: '$_id',
                    bank_code: { $first: '$bank_code' },
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
                details: { bankCode },
            });
            return;
        }
        const result = {
            code: pair.code,
            bankCode: pair.bankCode,
            bankName: pair.bankName,
            from_currency: pair.from_currency,
            from_code: pair.from_code,
            to_currency: pair.to_currency,
            to_code: pair.to_code,
            current_buying_price: pair.current_buying_price,
            current_selling_price: pair.current_selling_price,
            current_midrate_price: pair.current_midrate_price,
            buying_percentage_change: pair.buying_percentage_change,
            selling_percentage_change: pair.selling_percentage_change,
            midrate_percentage_change: pair.midrate_percentage_change,
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
            message: 'Internal server error fetching price history by period',
            errorId: `ERR-${Date.now()}`,
        });
    }
};
exports.getInterbankPairHistoryByPeriod = getInterbankPairHistoryByPeriod;
const addPriceHistory = async (req, res) => {
    try {
        const id = paramToString(req.params.id);
        if (!mongoose_1.default.Types.ObjectId.isValid(id)) {
            res.status(400).json({
                success: false,
                code: 400,
                message: 'Invalid ID format',
                details: {
                    id,
                    expected: 'Valid MongoDB ObjectId',
                },
            });
            return;
        }
        const { date, buying_price, selling_price, midrate_price } = req.body;
        if (!buying_price || !selling_price || !midrate_price) {
            res.status(400).json({
                success: false,
                code: 400,
                message: 'Missing price fields',
                details: {
                    required: ['buying_price', 'selling_price', 'midrate_price'],
                },
            });
            return;
        }
        const pair = await forexInterbank_model_1.default.findById(id);
        if (!pair) {
            res.status(404).json({
                success: false,
                code: 404,
                message: 'Forex Interbank pair not found',
                details: { id },
            });
            return;
        }
        const newPriceEntry = {
            date: date ? new Date(date) : new Date(),
            buying_price: Number(buying_price),
            selling_price: Number(selling_price),
            midrate_price: Number(midrate_price),
        };
        const priceHistory = await forexInterbank_model_1.PriceHistory.findOneAndUpdate({ bank_code: pair.bankCode }, {
            $push: {
                history: {
                    $each: [newPriceEntry],
                    $position: 0,
                },
            },
        }, { upsert: true, new: true });
        const MAX_HISTORY_ENTRIES = 1000;
        if (priceHistory.history.length > MAX_HISTORY_ENTRIES) {
            priceHistory.history = priceHistory.history.slice(0, MAX_HISTORY_ENTRIES);
            await priceHistory.save();
        }
        await invalidateCache(pair.code, id, pair.bankCode);
        res.status(200).json({
            success: true,
            code: 200,
            message: 'Price history added successfully',
            data: {
                code: pair.code,
                bankCode: pair.bankCode,
                bankName: pair.bankName,
                new_price_entry: newPriceEntry,
                total_history_entries: priceHistory.history.length,
            },
        });
    }
    catch (error) {
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
        console.error('Add history error:', error);
        res.status(500).json({
            success: false,
            code: 500,
            message: 'Internal server error adding price history',
            errorId: `ERR-${Date.now()}`,
        });
    }
};
exports.addPriceHistory = addPriceHistory;
const getInterbankPairByCode = async (req, res) => {
    try {
        const code = paramToString(req.params.code);
        const cacheKey = `forexinterbank:code:${code}`;
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
        const pair = await forexInterbank_model_1.default.findOne({ code });
        if (!pair) {
            res.status(404).json({
                success: false,
                code: 404,
                message: 'Forex Interbank pair not found',
                details: { code },
            });
            return;
        }
        await setCache(cacheKey, pair, 300);
        res.status(200).json({
            success: true,
            code: 200,
            fromCache: false,
            data: pair,
        });
    }
    catch (error) {
        console.error('Get by code error:', error);
        res.status(500).json({
            success: false,
            code: 500,
            message: 'Internal server error fetching Forex Interbank pair',
            errorId: `ERR-${Date.now()}`,
        });
    }
};
exports.getInterbankPairByCode = getInterbankPairByCode;
const updatePrices = async (req, res) => {
    try {
        const id = paramToString(req.params.id);
        if (!mongoose_1.default.Types.ObjectId.isValid(id)) {
            res.status(400).json({
                success: false,
                code: 400,
                message: 'Invalid ID format',
                details: {
                    id,
                    expected: 'Valid MongoDB ObjectId',
                },
            });
            return;
        }
        const { current_buying_price, current_selling_price, current_midrate_price, } = req.body;
        const pair = await forexInterbank_model_1.default.findById(id);
        if (!pair) {
            res.status(404).json({
                success: false,
                code: 404,
                message: 'Forex Interbank pair not found',
                details: { id },
            });
            return;
        }
        const updateOperations = {
            $set: {
                last_updated: new Date(),
            },
        };
        const priceHistoryEntry = {
            date: new Date(),
        };
        if (current_buying_price !== undefined &&
            current_buying_price !== pair.current_buying_price) {
            const buyingPercentageChange = ((current_buying_price - pair.current_buying_price) /
                pair.current_buying_price) *
                100;
            updateOperations.$set.current_buying_price = current_buying_price;
            updateOperations.$set.buying_percentage_change = parseFloat(buyingPercentageChange.toFixed(4));
            priceHistoryEntry.buying_price = current_buying_price;
        }
        else {
            priceHistoryEntry.buying_price = pair.current_buying_price;
        }
        if (current_selling_price !== undefined &&
            current_selling_price !== pair.current_selling_price) {
            const sellingPercentageChange = ((current_selling_price - pair.current_selling_price) /
                pair.current_selling_price) *
                100;
            updateOperations.$set.current_selling_price = current_selling_price;
            updateOperations.$set.selling_percentage_change = parseFloat(sellingPercentageChange.toFixed(4));
            priceHistoryEntry.selling_price = current_selling_price;
        }
        else {
            priceHistoryEntry.selling_price = pair.current_selling_price;
        }
        if (current_midrate_price !== undefined &&
            current_midrate_price !== pair.current_midrate_price) {
            const midratePercentageChange = ((current_midrate_price - pair.current_midrate_price) /
                pair.current_midrate_price) *
                100;
            updateOperations.$set.current_midrate_price = current_midrate_price;
            updateOperations.$set.midrate_percentage_change = parseFloat(midratePercentageChange.toFixed(4));
            priceHistoryEntry.midrate_price = current_midrate_price;
        }
        else {
            priceHistoryEntry.midrate_price = pair.current_midrate_price;
        }
        const updatedPair = await forexInterbank_model_1.default.findByIdAndUpdate(id, updateOperations, { new: true });
        if (!updatedPair) {
            res.status(404).json({
                success: false,
                code: 404,
                message: 'Forex Interbank pair not found',
                details: { id },
            });
            return;
        }
        await forexInterbank_model_1.PriceHistory.findOneAndUpdate({ bank_code: updatedPair.bankCode }, {
            $push: {
                history: {
                    $each: [priceHistoryEntry],
                    $position: 0,
                },
            },
        }, { upsert: true });
        await invalidateCache(updatedPair.code, id, updatedPair.bankCode);
        (0, ws_1.publishForexInterbankUpdate)({ id, code: updatedPair.code, bankCode: updatedPair.bankCode }, updatedPair);
        res.status(200).json({
            success: true,
            code: 200,
            message: 'Prices updated successfully',
            data: updatedPair,
        });
    }
    catch (error) {
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
        console.error('Update prices error:', error);
        res.status(500).json({
            success: false,
            code: 500,
            message: 'Internal server error updating prices',
            errorId: `ERR-${Date.now()}`,
        });
    }
};
exports.updatePrices = updatePrices;
const getInterbankPairByBankCode = async (req, res) => {
    try {
        const bankCode = paramToString(req.params.bankCode);
        const cacheKey = `forexinterbank:bankcode:${bankCode}`;
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
        const pairs = await forexInterbank_model_1.default.find({ bankCode });
        if (pairs.length === 0) {
            res.status(404).json({
                success: false,
                code: 404,
                message: 'No Forex Interbank pairs found for this bank code',
                details: { bankCode },
            });
            return;
        }
        await setCache(cacheKey, pairs, 300);
        res.status(200).json({
            success: true,
            code: 200,
            fromCache: false,
            count: pairs.length,
            data: pairs,
        });
    }
    catch (error) {
        console.error('Get by bank code error:', error);
        res.status(500).json({
            success: false,
            code: 500,
            message: 'Internal server error fetching Forex Interbank pairs',
            errorId: `ERR-${Date.now()}`,
        });
    }
};
exports.getInterbankPairByBankCode = getInterbankPairByBankCode;
const getLatestPriceHistory = async (req, res) => {
    try {
        const { bankCode } = req.params;
        const { limit = 30 } = req.query;
        const cacheKey = `forexinterbank:pricehistory:${bankCode}:latest:${limit}`;
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
        const priceHistory = await forexInterbank_model_1.PriceHistory.findOne({ bank_code: bankCode }, { 'history': { $slice: Number(limit) } }).sort({ updatedAt: -1 });
        if (!priceHistory) {
            res.status(404).json({
                success: false,
                code: 404,
                message: 'Price history not found',
                details: { bankCode },
            });
            return;
        }
        const pair = await forexInterbank_model_1.default.findOne({ bankCode }).select('bankName code name from_currency from_code to_currency to_code current_buying_price current_selling_price current_midrate_price buying_percentage_change selling_percentage_change midrate_percentage_change');
        const result = {
            bankCode,
            bankName: pair === null || pair === void 0 ? void 0 : pair.bankName,
            code: pair === null || pair === void 0 ? void 0 : pair.code,
            name: pair === null || pair === void 0 ? void 0 : pair.name,
            from_currency: pair === null || pair === void 0 ? void 0 : pair.from_currency,
            from_code: pair === null || pair === void 0 ? void 0 : pair.from_code,
            to_currency: pair === null || pair === void 0 ? void 0 : pair.to_currency,
            to_code: pair === null || pair === void 0 ? void 0 : pair.to_code,
            current_buying_price: pair === null || pair === void 0 ? void 0 : pair.current_buying_price,
            current_selling_price: pair === null || pair === void 0 ? void 0 : pair.current_selling_price,
            current_midrate_price: pair === null || pair === void 0 ? void 0 : pair.current_midrate_price,
            buying_percentage_change: pair === null || pair === void 0 ? void 0 : pair.buying_percentage_change,
            selling_percentage_change: pair === null || pair === void 0 ? void 0 : pair.selling_percentage_change,
            midrate_percentage_change: pair === null || pair === void 0 ? void 0 : pair.midrate_percentage_change,
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
        const { bankCode, entryId } = req.params;
        const { buying_price, selling_price, midrate_price, date } = req.body;
        const priceHistory = await forexInterbank_model_1.PriceHistory.findOne({ bank_code: bankCode });
        if (!priceHistory) {
            res.status(404).json({
                success: false,
                code: 404,
                message: 'Price history not found',
                details: { bankCode },
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
        if (buying_price !== undefined)
            priceHistory.history[entryIndex].buying_price = Number(buying_price);
        if (selling_price !== undefined)
            priceHistory.history[entryIndex].selling_price = Number(selling_price);
        if (midrate_price !== undefined)
            priceHistory.history[entryIndex].midrate_price = Number(midrate_price);
        if (date)
            priceHistory.history[entryIndex].date = new Date(date);
        await priceHistory.save();
        await invalidateCache(null, null, bankCode);
        res.status(200).json({
            success: true,
            code: 200,
            message: 'Price history entry updated successfully',
            data: {
                bankCode,
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
        const { bankCode, entryId } = req.params;
        const priceHistory = await forexInterbank_model_1.PriceHistory.findOneAndUpdate({ bank_code: bankCode }, { $pull: { history: { _id: entryId } } }, { new: true });
        if (!priceHistory) {
            res.status(404).json({
                success: false,
                code: 404,
                message: 'Price history or entry not found',
                details: { bankCode, entryId },
            });
            return;
        }
        await invalidateCache(null, null, bankCode);
        res.status(200).json({
            success: true,
            code: 200,
            message: 'Price history entry deleted successfully',
            data: {
                bankCode,
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
        const { bankCode } = req.params;
        const priceHistory = await forexInterbank_model_1.PriceHistory.findOneAndUpdate({ bank_code: bankCode }, { $set: { history: [] } }, { new: true });
        if (!priceHistory) {
            res.status(404).json({
                success: false,
                code: 404,
                message: 'Price history not found',
                details: { bankCode },
            });
            return;
        }
        await invalidateCache(null, null, bankCode);
        res.status(200).json({
            success: true,
            code: 200,
            message: 'Price history cleared successfully',
            data: {
                bankCode,
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
//# sourceMappingURL=forexInterbank.controller.js.map