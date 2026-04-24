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
exports.clearPriceHistory = exports.deletePriceHistoryEntry = exports.getLatestPriceHistory = exports.getPriceHistory = exports.updatePriceHistory = exports.addPriceHistory = exports.deleteGoldbod = exports.updateGoldbod = exports.createGoldbod = exports.getGoldbodByCode = exports.getAllGoldbod = void 0;
const golbod_model_1 = __importStar(require("../models/golbod.model"));
const redis_1 = require("../lib/redis");
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
const getAllGoldbod = async (req, res) => {
    try {
        const cacheKey = 'goldbod:all';
        const cached = await getCache(cacheKey);
        if (cached) {
            res.status(200).json(cached);
            return;
        }
        const goldbod = await golbod_model_1.default.find();
        await setCache(cacheKey, goldbod);
        res.status(200).json(goldbod);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.getAllGoldbod = getAllGoldbod;
const getGoldbodByCode = async (req, res) => {
    try {
        const cacheKey = `goldbod:${req.params.code}`;
        const cached = await getCache(cacheKey);
        if (cached) {
            res.status(200).json(cached);
            return;
        }
        const goldbod = await golbod_model_1.default.findOne({ code: req.params.code });
        if (!goldbod) {
            res.status(404).json({ message: 'Goldbod not found' });
            return;
        }
        await setCache(cacheKey, goldbod);
        res.status(200).json(goldbod);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.getGoldbodByCode = getGoldbodByCode;
const createGoldbod = async (req, res) => {
    try {
        const existingGoldbod = await golbod_model_1.default.findOne({ code: 'goldbod' });
        if (existingGoldbod) {
            res.status(400).json({ message: 'Goldbod already exists' });
            return;
        }
        const goldbod = new golbod_model_1.default({
            code: 'goldbod',
            name: 'Goldbod',
            unit: 'pounds',
            currentPrice: req.body.currentPrice,
            percentage_change: 0,
            last_updated: new Date(),
        });
        await goldbod.save();
        await golbod_model_1.PriceHistory.create({
            goldbod_id: goldbod.code,
            history: [{
                    date: new Date(),
                    price: req.body.currentPrice,
                }],
        });
        await deleteCacheByPattern('goldbod:*');
        res.status(201).json(goldbod);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.createGoldbod = createGoldbod;
const updateGoldbod = async (req, res) => {
    try {
        const goldbod = await golbod_model_1.default.findOne({ code: 'goldbod' });
        if (!goldbod) {
            res.status(404).json({ message: 'Goldbod not found' });
            return;
        }
        const oldPrice = goldbod.currentPrice;
        const newPrice = req.body.currentPrice;
        const percentageChange = ((newPrice - oldPrice) / oldPrice) * 100;
        const updatedGoldbod = await golbod_model_1.default.findOneAndUpdate({ code: 'goldbod' }, {
            $set: {
                currentPrice: newPrice,
                percentage_change: percentageChange,
                last_updated: new Date(),
            },
        }, { new: true });
        await golbod_model_1.PriceHistory.findOneAndUpdate({ goldbod_id: 'goldbod' }, {
            $push: {
                history: {
                    $each: [{ date: new Date(), price: newPrice }],
                    $position: 0,
                },
            },
        }, { upsert: true });
        await deleteCacheByPattern('goldbod:*');
        res.status(200).json(updatedGoldbod);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.updateGoldbod = updateGoldbod;
const deleteGoldbod = async (req, res) => {
    try {
        const goldbod = await golbod_model_1.default.findOneAndDelete({ code: 'goldbod' });
        if (!goldbod) {
            res.status(404).json({ message: 'Goldbod not found' });
            return;
        }
        await golbod_model_1.PriceHistory.findOneAndDelete({ goldbod_id: 'goldbod' });
        await deleteCacheByPattern('goldbod:*');
        res.status(200).json({ message: 'Goldbod deleted successfully' });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.deleteGoldbod = deleteGoldbod;
const addPriceHistory = async (req, res) => {
    try {
        const { price, date } = req.body;
        if (!price) {
            res.status(400).json({ message: 'Price is required' });
            return;
        }
        const goldbod = await golbod_model_1.default.findOne({ code: 'goldbod' });
        if (!goldbod) {
            res.status(404).json({ message: 'Goldbod not found' });
            return;
        }
        const priceHistory = await golbod_model_1.PriceHistory.findOneAndUpdate({ goldbod_id: 'goldbod' }, {
            $push: {
                history: {
                    $each: [{
                            date: date ? new Date(date) : new Date(),
                            price: Number(price)
                        }],
                    $position: 0,
                },
            },
        }, { upsert: true, new: true });
        const MAX_HISTORY_ENTRIES = 1000;
        if (priceHistory.history.length > MAX_HISTORY_ENTRIES) {
            priceHistory.history = priceHistory.history.slice(0, MAX_HISTORY_ENTRIES);
            await priceHistory.save();
        }
        await deleteCacheByPattern('goldbod:price-history:*');
        res.status(201).json({
            message: 'Price history added successfully',
            data: {
                goldbod_id: 'goldbod',
                entry: {
                    date: date ? new Date(date) : new Date(),
                    price: Number(price),
                },
                total_entries: priceHistory.history.length,
            }
        });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.addPriceHistory = addPriceHistory;
const updatePriceHistory = async (req, res) => {
    try {
        const { entryId } = req.params;
        const { price, date } = req.body;
        const priceHistory = await golbod_model_1.PriceHistory.findOne({ goldbod_id: 'goldbod' });
        if (!priceHistory) {
            res.status(404).json({ message: 'Price history not found' });
            return;
        }
        const entryIndex = priceHistory.history.findIndex((entry) => entry._id.toString() === entryId);
        if (entryIndex === -1) {
            res.status(404).json({ message: 'Price history entry not found' });
            return;
        }
        if (price)
            priceHistory.history[entryIndex].price = Number(price);
        if (date)
            priceHistory.history[entryIndex].date = new Date(date);
        await priceHistory.save();
        await deleteCacheByPattern('goldbod:price-history:*');
        res.status(200).json({
            message: 'Price history entry updated successfully',
            data: {
                goldbod_id: 'goldbod',
                entry: priceHistory.history[entryIndex],
            }
        });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.updatePriceHistory = updatePriceHistory;
const getPriceHistory = async (req, res) => {
    try {
        const { limit = 100, days } = req.query;
        const cacheKey = `goldbod:price-history:limit=${limit}:days=${days}`;
        const cached = await getCache(cacheKey);
        if (cached) {
            res.status(200).json(cached);
            return;
        }
        let query = { goldbod_id: 'goldbod' };
        if (days) {
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - Number(days));
            query['history.date'] = { $gte: startDate };
        }
        const priceHistory = await golbod_model_1.PriceHistory.aggregate([
            { $match: { goldbod_id: 'goldbod' } },
            { $unwind: '$history' },
            ...(days ? [{ $match: { 'history.date': { $gte: new Date(Date.now() - Number(days) * 24 * 60 * 60 * 1000) } } }] : []),
            { $sort: { 'history.date': -1 } },
            { $limit: Number(limit) },
            { $group: {
                    _id: '$_id',
                    goldbod_id: { $first: '$goldbod_id' },
                    history: { $push: '$history' },
                    createdAt: { $first: '$createdAt' },
                    updatedAt: { $first: '$updatedAt' }
                } }
        ]);
        if (!priceHistory.length) {
            res.status(404).json({ message: 'Price history not found' });
            return;
        }
        const result = priceHistory[0];
        await setCache(cacheKey, result, 300);
        res.status(200).json({
            goldbod_id: result.goldbod_id,
            total_entries: result.history.length,
            history: result.history,
            metadata: {
                limit: Number(limit),
                days: days ? Number(days) : null,
            }
        });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.getPriceHistory = getPriceHistory;
const getLatestPriceHistory = async (req, res) => {
    try {
        const cacheKey = 'goldbod:price-history:latest';
        const cached = await getCache(cacheKey);
        if (cached) {
            res.status(200).json(cached);
            return;
        }
        const priceHistory = await golbod_model_1.PriceHistory.findOne({ goldbod_id: 'goldbod' }, { 'history': { $slice: 30 } }).sort({ updatedAt: -1 });
        if (!priceHistory) {
            res.status(404).json({ message: 'Price history not found' });
            return;
        }
        await setCache(cacheKey, priceHistory, 300);
        res.status(200).json(priceHistory);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.getLatestPriceHistory = getLatestPriceHistory;
const deletePriceHistoryEntry = async (req, res) => {
    try {
        const { entryId } = req.params;
        const priceHistory = await golbod_model_1.PriceHistory.findOneAndUpdate({ goldbod_id: 'goldbod' }, { $pull: { history: { _id: entryId } } }, { new: true });
        if (!priceHistory) {
            res.status(404).json({ message: 'Price history or entry not found' });
            return;
        }
        await deleteCacheByPattern('goldbod:price-history:*');
        res.status(200).json({
            message: 'Price history entry deleted successfully',
            total_entries: priceHistory.history.length
        });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.deletePriceHistoryEntry = deletePriceHistoryEntry;
const clearPriceHistory = async (req, res) => {
    try {
        const priceHistory = await golbod_model_1.PriceHistory.findOneAndUpdate({ goldbod_id: 'goldbod' }, { $set: { history: [] } }, { new: true });
        if (!priceHistory) {
            res.status(404).json({ message: 'Price history not found' });
            return;
        }
        await deleteCacheByPattern('goldbod:price-history:*');
        res.status(200).json({
            message: 'Price history cleared successfully',
            goldbod_id: 'goldbod'
        });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.clearPriceHistory = clearPriceHistory;
//# sourceMappingURL=goldbod.controller.js.map