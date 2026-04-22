"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateIndexPrice = exports.addIndexHistory = exports.getIndexHistory = exports.deleteIndex = exports.getIndexByCode = exports.getAllIndices = exports.updateIndex = exports.createIndex = void 0;
const indice_model_1 = __importDefault(require("../models/indice.model"));
const redis_1 = require("../lib/redis");
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
    await deleteCacheByPattern('index:*');
    if (code) {
        await deleteCacheByPattern(`index:code:${code}`);
    }
};
const createIndex = async (req, res) => {
    try {
        const indexData = req.body;
        const requiredFields = ['code', 'symbol', 'name', 'currentPrice'];
        const missingFields = requiredFields.filter((field) => !indexData[field]);
        if (missingFields.length > 0) {
            res.status(400).json({
                success: false,
                code: 400,
                message: 'Missing required fields',
                details: { missingFields },
            });
            return;
        }
        const existingIndex = await indice_model_1.default.findOne({ code: indexData.code });
        if (existingIndex) {
            res.status(400).json({
                success: false,
                code: 400,
                message: 'Index with this code already exists',
                details: {
                    duplicateField: 'code',
                    duplicateValue: indexData.code,
                },
            });
            return;
        }
        indexData.price_history = indexData.price_history || [];
        indexData.price_history.push({
            date: new Date(),
            price: indexData.currentPrice,
        });
        const newIndex = await indice_model_1.default.create(indexData);
        await invalidateCache(indexData.code);
        res.status(201).json({
            success: true,
            code: 201,
            message: 'Index created successfully',
            data: newIndex,
        });
    }
    catch (error) {
        if (error.code === 11000) {
            res.status(400).json({
                success: false,
                code: 400,
                message: 'Duplicate entry. Index code already exists',
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
        console.error('Create index error:', error);
        res.status(500).json({
            success: false,
            code: 500,
            message: 'Internal server error creating index',
            errorId: `ERR-${Date.now()}`,
        });
    }
};
exports.createIndex = createIndex;
const updateIndex = async (req, res) => {
    try {
        const { code } = req.params;
        const updateData = req.body;
        const index = await indice_model_1.default.findOne({ code });
        if (!index) {
            res.status(404).json({
                success: false,
                code: 404,
                message: 'Index not found',
                details: { code },
            });
            return;
        }
        const updateOperations = { $set: { ...updateData } };
        if (updateData.currentPrice !== undefined &&
            updateData.currentPrice !== index.currentPrice) {
            updateOperations.$set.last_updated = new Date();
            updateOperations.$push = {
                price_history: {
                    $each: [
                        {
                            date: new Date(),
                            price: updateData.currentPrice,
                        },
                    ],
                    $position: 0,
                },
            };
        }
        const updatedIndex = await indice_model_1.default.findOneAndUpdate({ code }, updateOperations, { new: true, runValidators: true });
        await invalidateCache(code);
        res.status(200).json({
            success: true,
            code: 200,
            message: 'Index updated successfully',
            data: updatedIndex,
        });
    }
    catch (error) {
        if (error.code === 11000) {
            res.status(400).json({
                success: false,
                code: 400,
                message: 'Duplicate entry. Index code already exists',
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
        console.error('Update index error:', error);
        res.status(500).json({
            success: false,
            code: 500,
            message: 'Internal server error updating index',
            errorId: `ERR-${Date.now()}`,
        });
    }
};
exports.updateIndex = updateIndex;
const getAllIndices = async (req, res) => {
    try {
        let { sortBy = 'code', limit } = req.query;
        const sortByString = Array.isArray(sortBy) ? sortBy[0] : sortBy;
        const limitString = Array.isArray(limit) ? limit[0] : limit;
        const cacheKey = `index:all:${sortByString}:${limitString || 'all'}`;
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
        let query = indice_model_1.default.find();
        if (sortByString) {
            query = query.sort(sortByString);
        }
        if (limitString) {
            query = query.limit(parseInt(limitString));
        }
        const indices = await query.exec();
        await setCache(cacheKey, indices);
        res.status(200).json({
            success: true,
            code: 200,
            fromCache: false,
            data: indices,
        });
    }
    catch (error) {
        console.error('Get all indices error:', error);
        res.status(500).json({
            success: false,
            code: 500,
            message: 'Internal server error fetching indices',
            errorId: `ERR-${Date.now()}`,
        });
    }
};
exports.getAllIndices = getAllIndices;
const getIndexByCode = async (req, res) => {
    try {
        const { code } = req.params;
        const cacheKey = `index:code:${code}`;
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
        const index = await indice_model_1.default.findOne({ code });
        if (!index) {
            res.status(404).json({
                success: false,
                code: 404,
                message: 'Index not found',
                details: { code },
            });
            return;
        }
        await setCache(cacheKey, index);
        res.status(200).json({
            success: true,
            code: 200,
            fromCache: false,
            data: index,
        });
    }
    catch (error) {
        console.error('Get index error:', error);
        res.status(500).json({
            success: false,
            code: 500,
            message: 'Internal server error fetching index',
            errorId: `ERR-${Date.now()}`,
        });
    }
};
exports.getIndexByCode = getIndexByCode;
const deleteIndex = async (req, res) => {
    try {
        const { code } = req.params;
        const deletedIndex = await indice_model_1.default.findOneAndDelete({ code });
        if (!deletedIndex) {
            res.status(404).json({
                success: false,
                code: 404,
                message: 'Index not found',
                details: { code },
            });
            return;
        }
        await invalidateCache(code);
        res.status(200).json({
            success: true,
            code: 200,
            message: 'Index deleted successfully',
            data: {
                code: deletedIndex.code,
                name: deletedIndex.name,
            },
        });
    }
    catch (error) {
        console.error('Delete index error:', error);
        res.status(500).json({
            success: false,
            code: 500,
            message: 'Internal server error deleting index',
            errorId: `ERR-${Date.now()}`,
        });
    }
};
exports.deleteIndex = deleteIndex;
const getIndexHistory = async (req, res) => {
    try {
        const { code } = req.params;
        const cacheKey = `index:code:${code}:history`;
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
        const index = await indice_model_1.default.findOne({ code }).select('code name price_history');
        if (!index) {
            res.status(404).json({
                success: false,
                code: 404,
                message: 'Index not found',
                details: { code },
            });
            return;
        }
        const result = {
            code: index.code,
            name: index.name,
            price_history: index.price_history,
        };
        await setCache(cacheKey, result);
        res.status(200).json({
            success: true,
            code: 200,
            fromCache: false,
            data: result,
        });
    }
    catch (error) {
        console.error('Get index history error:', error);
        res.status(500).json({
            success: false,
            code: 500,
            message: 'Internal server error fetching index history',
            errorId: `ERR-${Date.now()}`,
        });
    }
};
exports.getIndexHistory = getIndexHistory;
const addIndexHistory = async (req, res) => {
    try {
        const { code } = req.params;
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
        const newPriceEntry = {
            date: date || new Date(),
            price,
        };
        const updatedIndex = await indice_model_1.default.findOneAndUpdate({ code }, {
            $push: { price_history: newPriceEntry },
            $set: { last_updated: new Date() },
        }, { new: true });
        if (!updatedIndex) {
            res.status(404).json({
                success: false,
                code: 404,
                message: 'Index not found',
                details: { code },
            });
            return;
        }
        await invalidateCache(code);
        res.status(200).json({
            success: true,
            code: 200,
            message: 'Price history added successfully',
            data: {
                code: updatedIndex.code,
                new_price_entry: newPriceEntry,
                total_history_entries: updatedIndex.price_history.length,
            },
        });
    }
    catch (error) {
        console.error('Add index history error:', error);
        res.status(500).json({
            success: false,
            code: 500,
            message: 'Internal server error adding price history',
            errorId: `ERR-${Date.now()}`,
        });
    }
};
exports.addIndexHistory = addIndexHistory;
const updateIndexPrice = async (req, res) => {
    try {
        const { code } = req.params;
        const codeString = Array.isArray(code) ? code[0] : code;
        const { currentPrice, value_change, percentage_change } = req.body;
        if (!currentPrice) {
            res.status(400).json({
                success: false,
                code: 400,
                message: 'Current price is required',
                details: { required: ['currentPrice'] },
            });
            return;
        }
        const index = await indice_model_1.default.findOne({ code });
        if (!index) {
            res.status(404).json({
                success: false,
                code: 404,
                message: 'Index not found',
                details: { code },
            });
            return;
        }
        const oldPrice = index.currentPrice;
        const now = new Date();
        const updateOperations = {
            $set: {
                last_updated: now,
                currentPrice,
            },
            $push: {
                price_history: {
                    $each: [
                        {
                            date: now,
                            price: currentPrice,
                        }
                    ],
                    $position: 0,
                },
            },
        };
        if (oldPrice !== currentPrice) {
            updateOperations.$push.price_history.$each.unshift({
                date: now,
                price: oldPrice,
            });
        }
        if (value_change !== undefined) {
            updateOperations.$set.value_change = value_change;
        }
        if (percentage_change !== undefined) {
            updateOperations.$set.percentage_change = percentage_change;
        }
        const updatedIndex = await indice_model_1.default.findOneAndUpdate({ code: codeString }, updateOperations, { new: true });
        await invalidateCache(codeString);
        res.status(200).json({
            success: true,
            code: 200,
            message: 'Index price updated successfully',
            data: updatedIndex,
        });
    }
    catch (error) {
        console.error('Update index price error:', error);
        res.status(500).json({
            success: false,
            code: 500,
            message: 'Internal server error updating index price',
            errorId: `ERR-${Date.now()}`,
        });
    }
};
exports.updateIndexPrice = updateIndexPrice;
//# sourceMappingURL=index.controller.js.map