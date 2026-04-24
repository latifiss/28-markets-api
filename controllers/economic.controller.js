"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getGovernmentDebtToGDPHistory = exports.deleteGovernmentDebtToGDP = exports.updateGovernmentDebtToGDP = exports.getLatestGovernmentDebtToGDP = exports.getAllGovernmentDebtToGDP = exports.createGovernmentDebtToGDP = exports.getBalanceOfTradeHistory = exports.deleteBalanceOfTrade = exports.updateBalanceOfTrade = exports.getLatestBalanceOfTrade = exports.getAllBalanceOfTrade = exports.createBalanceOfTrade = exports.getUnemploymentRateHistory = exports.deleteUnemploymentRate = exports.updateUnemploymentRate = exports.getLatestUnemploymentRate = exports.getAllUnemploymentRate = exports.createUnemploymentRate = exports.getInflationRateHistory = exports.deleteInflationRate = exports.updateInflationRate = exports.getLatestInflationRate = exports.getAllInflationRate = exports.createInflationRate = exports.getInterestRateHistory = exports.deleteInterestRate = exports.updateInterestRate = exports.getLatestInterestRate = exports.getAllInterestRate = exports.createInterestRate = exports.getGovernmentGDPValueHistory = exports.deleteGovernmentGDPValue = exports.updateGovernmentGDPValue = exports.getLatestGovernmentGDPValue = exports.getAllGovernmentGDPValue = exports.createGovernmentGDPValue = exports.getGDPGrowthAnnualHistory = exports.deleteGDPGrowthAnnual = exports.updateGDPGrowthAnnual = exports.getLatestGDPGrowthAnnual = exports.getAllGDPGrowthAnnual = exports.createGDPGrowthAnnual = exports.getGDPGrowthQuarterlyHistory = exports.deleteGDPGrowthQuarterly = exports.updateGDPGrowthQuarterly = exports.getLatestGDPGrowthQuarterly = exports.getAllGDPGrowthQuarterly = exports.createGDPGrowthQuarterly = exports.getCache = exports.setCache = void 0;
exports.bulkUpdateIndicators = exports.getGovernmentSpendingHistory = exports.deleteGovernmentSpending = exports.updateGovernmentSpending = exports.getLatestGovernmentSpending = exports.getAllGovernmentSpending = exports.createGovernmentSpending = exports.getFiscalExpenditureHistory = exports.deleteFiscalExpenditure = exports.updateFiscalExpenditure = exports.getLatestFiscalExpenditure = exports.getAllFiscalExpenditure = exports.createFiscalExpenditure = exports.getGovernmentRevenuesHistory = exports.deleteGovernmentRevenues = exports.updateGovernmentRevenues = exports.getLatestGovernmentRevenues = exports.getAllGovernmentRevenues = exports.createGovernmentRevenues = exports.getGovernmentBudgetValueHistory = exports.deleteGovernmentBudgetValue = exports.updateGovernmentBudgetValue = exports.getLatestGovernmentBudgetValue = exports.getAllGovernmentBudgetValue = exports.createGovernmentBudgetValue = exports.getGovernmentDebtValueHistory = exports.deleteGovernmentDebtValue = exports.updateGovernmentDebtValue = exports.getLatestGovernmentDebtValue = exports.getAllGovernmentDebtValue = exports.createGovernmentDebtValue = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const economic_model_1 = require("../models/economic.model");
const redis_1 = require("../lib/redis");
const setCache = async (key, data, expirationInSeconds = 3600) => {
    try {
        const client = await (0, redis_1.getRedisClient)();
        if (client && typeof client.set === 'function') {
            await client.set(key, JSON.stringify(data), {
                EX: expirationInSeconds,
            });
        }
    }
    catch (error) {
        console.error('Error setting cache:', error.message);
    }
};
exports.setCache = setCache;
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
exports.getCache = getCache;
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
const invalidateCache = async (indicatorName, specificKey) => {
    await deleteCacheByPattern(`economic:${indicatorName}:*`);
    if (specificKey) {
        await deleteCacheByPattern(`economic:${indicatorName}:${specificKey}`);
    }
};
const createHandler = async (Model, req, res, indicatorName) => {
    try {
        if (req.rateLimit && req.rateLimit.remaining === 0) {
            res.status(429).json({
                success: false,
                code: 429,
                message: 'Too many requests. Rate limit exceeded',
                details: {
                    limit: req.rateLimit.limit,
                    resetIn: req.rateLimit.resetIn,
                },
            });
            return;
        }
        const newIndicator = new Model(req.body);
        const savedIndicator = await newIndicator.save();
        if (savedIndicator && typeof savedIndicator.addToHistory === 'function') {
            await savedIndicator.addToHistory();
        }
        await invalidateCache(indicatorName);
        res.status(201).json({
            success: true,
            code: 201,
            message: `${indicatorName} created successfully`,
            data: savedIndicator,
        });
    }
    catch (error) {
        if (error.code === 11000) {
            res.status(400).json({
                success: false,
                code: 400,
                message: 'Duplicate entry',
                details: {
                    duplicateField: Object.keys(error.keyPattern)[0],
                    duplicateValue: Object.values(error.keyValue)[0],
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
        console.error(`Create ${indicatorName} error:`, error);
        res.status(500).json({
            success: false,
            code: 500,
            message: `Internal server error creating ${indicatorName}`,
            errorId: `ECON-ERR-${Date.now()}`,
        });
    }
};
const getAllHandler = async (Model, req, res, indicatorName) => {
    try {
        if (req.rateLimit && req.rateLimit.remaining === 0) {
            res.status(429).json({
                success: false,
                code: 429,
                message: 'Too many requests. Rate limit exceeded',
                details: {
                    limit: req.rateLimit.limit,
                    resetIn: req.rateLimit.resetIn,
                },
            });
            return;
        }
        const { page = 1, limit = 50, year, sortBy = 'year', sortOrder = 'desc', } = req.query;
        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const cacheKey = `economic:${indicatorName}:all:${pageNum}:${limitNum}:${year}:${sortBy}:${sortOrder}`;
        const cached = await (0, exports.getCache)(cacheKey);
        if (cached) {
            res.status(200).json({
                success: true,
                code: 200,
                fromCache: true,
                ...cached,
            });
            return;
        }
        const query = {};
        if (year) {
            query.year = parseInt(year);
        }
        const skip = (pageNum - 1) * limitNum;
        const total = await Model.countDocuments(query);
        const sort = {};
        sort[sortBy] = sortOrder === 'desc' ? -1 : 1;
        const data = await Model.find(query)
            .sort(sort)
            .skip(skip)
            .limit(limitNum)
            .lean();
        const result = {
            success: true,
            code: 200,
            fromCache: false,
            data,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                pages: Math.ceil(total / limitNum),
                hasNext: skip + data.length < total,
                hasPrev: pageNum > 1,
            },
            filters: {
                year: year || null,
                sortBy,
                sortOrder,
            },
        };
        await (0, exports.setCache)(cacheKey, result, 300);
        res.status(200).json(result);
    }
    catch (error) {
        console.error(`Get all ${indicatorName} error:`, error);
        res.status(500).json({
            success: false,
            code: 500,
            message: `Internal server error fetching ${indicatorName}`,
            errorId: `ECON-ERR-${Date.now()}`,
        });
    }
};
const getLatestHandler = async (Model, req, res, indicatorName) => {
    try {
        if (req.rateLimit && req.rateLimit.remaining === 0) {
            res.status(429).json({
                success: false,
                code: 429,
                message: 'Too many requests. Rate limit exceeded',
                details: {
                    limit: req.rateLimit.limit,
                    resetIn: req.rateLimit.resetIn,
                },
            });
            return;
        }
        const cacheKey = `economic:${indicatorName}:latest`;
        const cached = await (0, exports.getCache)(cacheKey);
        if (cached) {
            res.status(200).json({
                success: true,
                code: 200,
                fromCache: true,
                data: cached,
            });
            return;
        }
        const latest = await (Model.findLatest ? Model.findLatest() : Model.findOne().sort({ year: -1 }));
        if (!latest) {
            res.status(404).json({
                success: false,
                code: 404,
                message: `No ${indicatorName} data found`,
            });
            return;
        }
        await (0, exports.setCache)(cacheKey, latest, 300);
        res.status(200).json({
            success: true,
            code: 200,
            fromCache: false,
            data: latest,
        });
    }
    catch (error) {
        console.error(`Get latest ${indicatorName} error:`, error);
        res.status(500).json({
            success: false,
            code: 500,
            message: `Internal server error fetching latest ${indicatorName}`,
            errorId: `ECON-ERR-${Date.now()}`,
        });
    }
};
const updateHandler = async (Model, req, res, indicatorName) => {
    try {
        if (req.rateLimit && req.rateLimit.remaining === 0) {
            res.status(429).json({
                success: false,
                code: 429,
                message: 'Too many requests. Rate limit exceeded',
                details: {
                    limit: req.rateLimit.limit,
                    resetIn: req.rateLimit.resetIn,
                },
            });
            return;
        }
        let { id } = req.params;
        const { current_value, current_balance, ...updateData } = req.body;
        if (Array.isArray(id)) {
            id = id[0];
        }
        let query = {};
        if (id && typeof id === 'string' && mongoose_1.default.Types.ObjectId.isValid(id)) {
            query._id = new mongoose_1.default.Types.ObjectId(id);
        }
        else if (updateData.quarter && updateData.year) {
            query = { quarter: updateData.quarter, year: updateData.year };
        }
        else if (updateData.month && updateData.year) {
            query = { month: updateData.month, year: updateData.year };
        }
        else if (updateData.year) {
            query = { year: updateData.year };
        }
        else if (Model.modelName.includes('GovernmentDebt')) {
            const latest = await Model.findOne().sort({ year: -1, month: -1, quarter: -1 });
            if (latest) {
                query._id = latest._id;
            }
            else {
                res.status(404).json({
                    success: false,
                    code: 404,
                    message: 'No record found to update',
                });
                return;
            }
        }
        else {
            res.status(400).json({
                success: false,
                code: 400,
                message: 'Missing query parameters',
                details: { required: ['id or (year, month/quarter)'] },
            });
            return;
        }
        if (!query || Object.keys(query).length === 0) {
            res.status(400).json({
                success: false,
                code: 400,
                message: 'Invalid query parameters',
            });
            return;
        }
        const existing = await Model.findOne(query);
        if (!existing) {
            res.status(404).json({
                success: false,
                code: 404,
                message: `${indicatorName} record not found`,
            });
            return;
        }
        const updateOperations = { $set: updateData };
        if (current_value !== undefined) {
            updateOperations.$set.previous_value = existing.current_value;
            updateOperations.$set.current_value = current_value;
        }
        if (current_balance !== undefined) {
            updateOperations.$set.previous_balance = existing.current_balance;
            updateOperations.$set.current_balance = current_balance;
        }
        const updated = await Model.findOneAndUpdate(query, updateOperations, {
            new: true,
            runValidators: true,
        });
        if (updated && typeof updated.addToHistory === 'function') {
            await updated.addToHistory();
        }
        await invalidateCache(indicatorName, id);
        res.status(200).json({
            success: true,
            code: 200,
            message: `${indicatorName} updated successfully`,
            data: updated,
        });
    }
    catch (error) {
        if (error.code === 11000) {
            res.status(400).json({
                success: false,
                code: 400,
                message: 'Duplicate entry',
                details: {
                    duplicateField: Object.keys(error.keyPattern)[0],
                    duplicateValue: Object.values(error.keyValue)[0],
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
        console.error(`Update ${indicatorName} error:`, error);
        res.status(500).json({
            success: false,
            code: 500,
            message: `Internal server error updating ${indicatorName}`,
            errorId: `ECON-ERR-${Date.now()}`,
        });
    }
};
const deleteHandler = async (Model, req, res, indicatorName) => {
    try {
        if (req.rateLimit && req.rateLimit.remaining === 0) {
            res.status(429).json({
                success: false,
                code: 429,
                message: 'Too many requests. Rate limit exceeded',
                details: {
                    limit: req.rateLimit.limit,
                    resetIn: req.rateLimit.resetIn,
                },
            });
            return;
        }
        let { id } = req.params;
        // Ensure id is a string, not an array
        if (Array.isArray(id)) {
            id = id[0];
        }
        if (!id || typeof id !== 'string' || !mongoose_1.default.Types.ObjectId.isValid(id)) {
            res.status(400).json({
                success: false,
                code: 400,
                message: 'Invalid ID',
            });
            return;
        }
        const deleted = await Model.findByIdAndDelete(id);
        if (!deleted) {
            res.status(404).json({
                success: false,
                code: 404,
                message: `${indicatorName} record not found`,
            });
            return;
        }
        await invalidateCache(indicatorName, id);
        const response = {
            success: true,
            code: 200,
            message: `${indicatorName} deleted successfully`,
            data: {
                year: deleted.year,
            },
        };
        if (deleted.month) {
            response.data.month = deleted.month;
        }
        if (deleted.quarter) {
            response.data.quarter = deleted.quarter;
        }
        res.status(200).json(response);
    }
    catch (error) {
        console.error(`Delete ${indicatorName} error:`, error);
        res.status(500).json({
            success: false,
            code: 500,
            message: `Internal server error deleting ${indicatorName}`,
            errorId: `ECON-ERR-${Date.now()}`,
        });
    }
};
const getHistoryHandler = async (Model, req, res, indicatorName) => {
    try {
        if (req.rateLimit && req.rateLimit.remaining === 0) {
            res.status(429).json({
                success: false,
                code: 429,
                message: 'Too many requests. Rate limit exceeded',
                details: {
                    limit: req.rateLimit.limit,
                    resetIn: req.rateLimit.resetIn,
                },
            });
            return;
        }
        const { startYear, endYear } = req.query;
        const cacheKey = `economic:${indicatorName}:history:${startYear}:${endYear}`;
        const cached = await (0, exports.getCache)(cacheKey);
        if (cached) {
            res.status(200).json({
                success: true,
                code: 200,
                fromCache: true,
                data: cached,
            });
            return;
        }
        const query = {};
        if (startYear || endYear) {
            query.year = {};
            if (startYear)
                query.year.$gte = parseInt(startYear);
            if (endYear)
                query.year.$lte = parseInt(endYear);
        }
        const history = await Model.find(query)
            .select('year month quarter current_value previous_value current_balance previous_balance')
            .sort({ year: -1, month: -1, quarter: -1 });
        await (0, exports.setCache)(cacheKey, history, 600);
        res.status(200).json({
            success: true,
            code: 200,
            fromCache: false,
            data: history,
        });
    }
    catch (error) {
        console.error(`Get ${indicatorName} history error:`, error);
        res.status(500).json({
            success: false,
            code: 500,
            message: `Internal server error fetching ${indicatorName} history`,
            errorId: `ECON-ERR-${Date.now()}`,
        });
    }
};
// GDP Growth Quarterly
const createGDPGrowthQuarterly = async (req, res) => createHandler(economic_model_1.GDPGrowthQuarterly, req, res, 'GDP Growth Quarterly');
exports.createGDPGrowthQuarterly = createGDPGrowthQuarterly;
const getAllGDPGrowthQuarterly = async (req, res) => getAllHandler(economic_model_1.GDPGrowthQuarterly, req, res, 'GDP Growth Quarterly');
exports.getAllGDPGrowthQuarterly = getAllGDPGrowthQuarterly;
const getLatestGDPGrowthQuarterly = async (req, res) => getLatestHandler(economic_model_1.GDPGrowthQuarterly, req, res, 'GDP Growth Quarterly');
exports.getLatestGDPGrowthQuarterly = getLatestGDPGrowthQuarterly;
const updateGDPGrowthQuarterly = async (req, res) => updateHandler(economic_model_1.GDPGrowthQuarterly, req, res, 'GDP Growth Quarterly');
exports.updateGDPGrowthQuarterly = updateGDPGrowthQuarterly;
const deleteGDPGrowthQuarterly = async (req, res) => deleteHandler(economic_model_1.GDPGrowthQuarterly, req, res, 'GDP Growth Quarterly');
exports.deleteGDPGrowthQuarterly = deleteGDPGrowthQuarterly;
const getGDPGrowthQuarterlyHistory = async (req, res) => getHistoryHandler(economic_model_1.GDPGrowthQuarterly, req, res, 'GDP Growth Quarterly');
exports.getGDPGrowthQuarterlyHistory = getGDPGrowthQuarterlyHistory;
// GDP Growth Annual
const createGDPGrowthAnnual = async (req, res) => createHandler(economic_model_1.GDPGrowthAnnual, req, res, 'GDP Growth Annual');
exports.createGDPGrowthAnnual = createGDPGrowthAnnual;
const getAllGDPGrowthAnnual = async (req, res) => getAllHandler(economic_model_1.GDPGrowthAnnual, req, res, 'GDP Growth Annual');
exports.getAllGDPGrowthAnnual = getAllGDPGrowthAnnual;
const getLatestGDPGrowthAnnual = async (req, res) => getLatestHandler(economic_model_1.GDPGrowthAnnual, req, res, 'GDP Growth Annual');
exports.getLatestGDPGrowthAnnual = getLatestGDPGrowthAnnual;
const updateGDPGrowthAnnual = async (req, res) => updateHandler(economic_model_1.GDPGrowthAnnual, req, res, 'GDP Growth Annual');
exports.updateGDPGrowthAnnual = updateGDPGrowthAnnual;
const deleteGDPGrowthAnnual = async (req, res) => deleteHandler(economic_model_1.GDPGrowthAnnual, req, res, 'GDP Growth Annual');
exports.deleteGDPGrowthAnnual = deleteGDPGrowthAnnual;
const getGDPGrowthAnnualHistory = async (req, res) => getHistoryHandler(economic_model_1.GDPGrowthAnnual, req, res, 'GDP Growth Annual');
exports.getGDPGrowthAnnualHistory = getGDPGrowthAnnualHistory;
// Government GDP Value
const createGovernmentGDPValue = async (req, res) => createHandler(economic_model_1.GovernmentGDPValue, req, res, 'Government GDP Value');
exports.createGovernmentGDPValue = createGovernmentGDPValue;
const getAllGovernmentGDPValue = async (req, res) => getAllHandler(economic_model_1.GovernmentGDPValue, req, res, 'Government GDP Value');
exports.getAllGovernmentGDPValue = getAllGovernmentGDPValue;
const getLatestGovernmentGDPValue = async (req, res) => getLatestHandler(economic_model_1.GovernmentGDPValue, req, res, 'Government GDP Value');
exports.getLatestGovernmentGDPValue = getLatestGovernmentGDPValue;
const updateGovernmentGDPValue = async (req, res) => updateHandler(economic_model_1.GovernmentGDPValue, req, res, 'Government GDP Value');
exports.updateGovernmentGDPValue = updateGovernmentGDPValue;
const deleteGovernmentGDPValue = async (req, res) => deleteHandler(economic_model_1.GovernmentGDPValue, req, res, 'Government GDP Value');
exports.deleteGovernmentGDPValue = deleteGovernmentGDPValue;
const getGovernmentGDPValueHistory = async (req, res) => getHistoryHandler(economic_model_1.GovernmentGDPValue, req, res, 'Government GDP Value');
exports.getGovernmentGDPValueHistory = getGovernmentGDPValueHistory;
// Interest Rate
const createInterestRate = async (req, res) => createHandler(economic_model_1.InterestRate, req, res, 'Interest Rate');
exports.createInterestRate = createInterestRate;
const getAllInterestRate = async (req, res) => getAllHandler(economic_model_1.InterestRate, req, res, 'Interest Rate');
exports.getAllInterestRate = getAllInterestRate;
const getLatestInterestRate = async (req, res) => getLatestHandler(economic_model_1.InterestRate, req, res, 'Interest Rate');
exports.getLatestInterestRate = getLatestInterestRate;
const updateInterestRate = async (req, res) => updateHandler(economic_model_1.InterestRate, req, res, 'Interest Rate');
exports.updateInterestRate = updateInterestRate;
const deleteInterestRate = async (req, res) => deleteHandler(economic_model_1.InterestRate, req, res, 'Interest Rate');
exports.deleteInterestRate = deleteInterestRate;
const getInterestRateHistory = async (req, res) => getHistoryHandler(economic_model_1.InterestRate, req, res, 'Interest Rate');
exports.getInterestRateHistory = getInterestRateHistory;
// Inflation Rate
const createInflationRate = async (req, res) => createHandler(economic_model_1.InflationRate, req, res, 'Inflation Rate');
exports.createInflationRate = createInflationRate;
const getAllInflationRate = async (req, res) => getAllHandler(economic_model_1.InflationRate, req, res, 'Inflation Rate');
exports.getAllInflationRate = getAllInflationRate;
const getLatestInflationRate = async (req, res) => getLatestHandler(economic_model_1.InflationRate, req, res, 'Inflation Rate');
exports.getLatestInflationRate = getLatestInflationRate;
const updateInflationRate = async (req, res) => updateHandler(economic_model_1.InflationRate, req, res, 'Inflation Rate');
exports.updateInflationRate = updateInflationRate;
const deleteInflationRate = async (req, res) => deleteHandler(economic_model_1.InflationRate, req, res, 'Inflation Rate');
exports.deleteInflationRate = deleteInflationRate;
const getInflationRateHistory = async (req, res) => getHistoryHandler(economic_model_1.InflationRate, req, res, 'Inflation Rate');
exports.getInflationRateHistory = getInflationRateHistory;
// Unemployment Rate
const createUnemploymentRate = async (req, res) => createHandler(economic_model_1.UnemploymentRate, req, res, 'Unemployment Rate');
exports.createUnemploymentRate = createUnemploymentRate;
const getAllUnemploymentRate = async (req, res) => getAllHandler(economic_model_1.UnemploymentRate, req, res, 'Unemployment Rate');
exports.getAllUnemploymentRate = getAllUnemploymentRate;
const getLatestUnemploymentRate = async (req, res) => getLatestHandler(economic_model_1.UnemploymentRate, req, res, 'Unemployment Rate');
exports.getLatestUnemploymentRate = getLatestUnemploymentRate;
const updateUnemploymentRate = async (req, res) => updateHandler(economic_model_1.UnemploymentRate, req, res, 'Unemployment Rate');
exports.updateUnemploymentRate = updateUnemploymentRate;
const deleteUnemploymentRate = async (req, res) => deleteHandler(economic_model_1.UnemploymentRate, req, res, 'Unemployment Rate');
exports.deleteUnemploymentRate = deleteUnemploymentRate;
const getUnemploymentRateHistory = async (req, res) => getHistoryHandler(economic_model_1.UnemploymentRate, req, res, 'Unemployment Rate');
exports.getUnemploymentRateHistory = getUnemploymentRateHistory;
// Balance of Trade
const createBalanceOfTrade = async (req, res) => createHandler(economic_model_1.BalanceOfTrade, req, res, 'Balance of Trade');
exports.createBalanceOfTrade = createBalanceOfTrade;
const getAllBalanceOfTrade = async (req, res) => getAllHandler(economic_model_1.BalanceOfTrade, req, res, 'Balance of Trade');
exports.getAllBalanceOfTrade = getAllBalanceOfTrade;
const getLatestBalanceOfTrade = async (req, res) => getLatestHandler(economic_model_1.BalanceOfTrade, req, res, 'Balance of Trade');
exports.getLatestBalanceOfTrade = getLatestBalanceOfTrade;
const updateBalanceOfTrade = async (req, res) => updateHandler(economic_model_1.BalanceOfTrade, req, res, 'Balance of Trade');
exports.updateBalanceOfTrade = updateBalanceOfTrade;
const deleteBalanceOfTrade = async (req, res) => deleteHandler(economic_model_1.BalanceOfTrade, req, res, 'Balance of Trade');
exports.deleteBalanceOfTrade = deleteBalanceOfTrade;
const getBalanceOfTradeHistory = async (req, res) => getHistoryHandler(economic_model_1.BalanceOfTrade, req, res, 'Balance of Trade');
exports.getBalanceOfTradeHistory = getBalanceOfTradeHistory;
// Government Debt to GDP
const createGovernmentDebtToGDP = async (req, res) => createHandler(economic_model_1.GovernmentDebtToGDP, req, res, 'Government Debt to GDP');
exports.createGovernmentDebtToGDP = createGovernmentDebtToGDP;
const getAllGovernmentDebtToGDP = async (req, res) => getAllHandler(economic_model_1.GovernmentDebtToGDP, req, res, 'Government Debt to GDP');
exports.getAllGovernmentDebtToGDP = getAllGovernmentDebtToGDP;
const getLatestGovernmentDebtToGDP = async (req, res) => getLatestHandler(economic_model_1.GovernmentDebtToGDP, req, res, 'Government Debt to GDP');
exports.getLatestGovernmentDebtToGDP = getLatestGovernmentDebtToGDP;
const updateGovernmentDebtToGDP = async (req, res) => updateHandler(economic_model_1.GovernmentDebtToGDP, req, res, 'Government Debt to GDP');
exports.updateGovernmentDebtToGDP = updateGovernmentDebtToGDP;
const deleteGovernmentDebtToGDP = async (req, res) => deleteHandler(economic_model_1.GovernmentDebtToGDP, req, res, 'Government Debt to GDP');
exports.deleteGovernmentDebtToGDP = deleteGovernmentDebtToGDP;
const getGovernmentDebtToGDPHistory = async (req, res) => getHistoryHandler(economic_model_1.GovernmentDebtToGDP, req, res, 'Government Debt to GDP');
exports.getGovernmentDebtToGDPHistory = getGovernmentDebtToGDPHistory;
// Government Debt Value
const createGovernmentDebtValue = async (req, res) => createHandler(economic_model_1.GovernmentDebtValue, req, res, 'Government Debt Value');
exports.createGovernmentDebtValue = createGovernmentDebtValue;
const getAllGovernmentDebtValue = async (req, res) => getAllHandler(economic_model_1.GovernmentDebtValue, req, res, 'Government Debt Value');
exports.getAllGovernmentDebtValue = getAllGovernmentDebtValue;
const getLatestGovernmentDebtValue = async (req, res) => getLatestHandler(economic_model_1.GovernmentDebtValue, req, res, 'Government Debt Value');
exports.getLatestGovernmentDebtValue = getLatestGovernmentDebtValue;
const updateGovernmentDebtValue = async (req, res) => updateHandler(economic_model_1.GovernmentDebtValue, req, res, 'Government Debt Value');
exports.updateGovernmentDebtValue = updateGovernmentDebtValue;
const deleteGovernmentDebtValue = async (req, res) => deleteHandler(economic_model_1.GovernmentDebtValue, req, res, 'Government Debt Value');
exports.deleteGovernmentDebtValue = deleteGovernmentDebtValue;
const getGovernmentDebtValueHistory = async (req, res) => getHistoryHandler(economic_model_1.GovernmentDebtValue, req, res, 'Government Debt Value');
exports.getGovernmentDebtValueHistory = getGovernmentDebtValueHistory;
// Government Budget Value
const createGovernmentBudgetValue = async (req, res) => createHandler(economic_model_1.GovernmentBudgetValue, req, res, 'Government Budget Value');
exports.createGovernmentBudgetValue = createGovernmentBudgetValue;
const getAllGovernmentBudgetValue = async (req, res) => getAllHandler(economic_model_1.GovernmentBudgetValue, req, res, 'Government Budget Value');
exports.getAllGovernmentBudgetValue = getAllGovernmentBudgetValue;
const getLatestGovernmentBudgetValue = async (req, res) => getLatestHandler(economic_model_1.GovernmentBudgetValue, req, res, 'Government Budget Value');
exports.getLatestGovernmentBudgetValue = getLatestGovernmentBudgetValue;
const updateGovernmentBudgetValue = async (req, res) => updateHandler(economic_model_1.GovernmentBudgetValue, req, res, 'Government Budget Value');
exports.updateGovernmentBudgetValue = updateGovernmentBudgetValue;
const deleteGovernmentBudgetValue = async (req, res) => deleteHandler(economic_model_1.GovernmentBudgetValue, req, res, 'Government Budget Value');
exports.deleteGovernmentBudgetValue = deleteGovernmentBudgetValue;
const getGovernmentBudgetValueHistory = async (req, res) => getHistoryHandler(economic_model_1.GovernmentBudgetValue, req, res, 'Government Budget Value');
exports.getGovernmentBudgetValueHistory = getGovernmentBudgetValueHistory;
// Government Revenues
const createGovernmentRevenues = async (req, res) => createHandler(economic_model_1.GovernmentRevenues, req, res, 'Government Revenues');
exports.createGovernmentRevenues = createGovernmentRevenues;
const getAllGovernmentRevenues = async (req, res) => getAllHandler(economic_model_1.GovernmentRevenues, req, res, 'Government Revenues');
exports.getAllGovernmentRevenues = getAllGovernmentRevenues;
const getLatestGovernmentRevenues = async (req, res) => getLatestHandler(economic_model_1.GovernmentRevenues, req, res, 'Government Revenues');
exports.getLatestGovernmentRevenues = getLatestGovernmentRevenues;
const updateGovernmentRevenues = async (req, res) => updateHandler(economic_model_1.GovernmentRevenues, req, res, 'Government Revenues');
exports.updateGovernmentRevenues = updateGovernmentRevenues;
const deleteGovernmentRevenues = async (req, res) => deleteHandler(economic_model_1.GovernmentRevenues, req, res, 'Government Revenues');
exports.deleteGovernmentRevenues = deleteGovernmentRevenues;
const getGovernmentRevenuesHistory = async (req, res) => getHistoryHandler(economic_model_1.GovernmentRevenues, req, res, 'Government Revenues');
exports.getGovernmentRevenuesHistory = getGovernmentRevenuesHistory;
// Fiscal Expenditure
const createFiscalExpenditure = async (req, res) => createHandler(economic_model_1.FiscalExpenditure, req, res, 'Fiscal Expenditure');
exports.createFiscalExpenditure = createFiscalExpenditure;
const getAllFiscalExpenditure = async (req, res) => getAllHandler(economic_model_1.FiscalExpenditure, req, res, 'Fiscal Expenditure');
exports.getAllFiscalExpenditure = getAllFiscalExpenditure;
const getLatestFiscalExpenditure = async (req, res) => getLatestHandler(economic_model_1.FiscalExpenditure, req, res, 'Fiscal Expenditure');
exports.getLatestFiscalExpenditure = getLatestFiscalExpenditure;
const updateFiscalExpenditure = async (req, res) => updateHandler(economic_model_1.FiscalExpenditure, req, res, 'Fiscal Expenditure');
exports.updateFiscalExpenditure = updateFiscalExpenditure;
const deleteFiscalExpenditure = async (req, res) => deleteHandler(economic_model_1.FiscalExpenditure, req, res, 'Fiscal Expenditure');
exports.deleteFiscalExpenditure = deleteFiscalExpenditure;
const getFiscalExpenditureHistory = async (req, res) => getHistoryHandler(economic_model_1.FiscalExpenditure, req, res, 'Fiscal Expenditure');
exports.getFiscalExpenditureHistory = getFiscalExpenditureHistory;
// Government Spending
const createGovernmentSpending = async (req, res) => createHandler(economic_model_1.GovernmentSpending, req, res, 'Government Spending');
exports.createGovernmentSpending = createGovernmentSpending;
const getAllGovernmentSpending = async (req, res) => getAllHandler(economic_model_1.GovernmentSpending, req, res, 'Government Spending');
exports.getAllGovernmentSpending = getAllGovernmentSpending;
const getLatestGovernmentSpending = async (req, res) => getLatestHandler(economic_model_1.GovernmentSpending, req, res, 'Government Spending');
exports.getLatestGovernmentSpending = getLatestGovernmentSpending;
const updateGovernmentSpending = async (req, res) => updateHandler(economic_model_1.GovernmentSpending, req, res, 'Government Spending');
exports.updateGovernmentSpending = updateGovernmentSpending;
const deleteGovernmentSpending = async (req, res) => deleteHandler(economic_model_1.GovernmentSpending, req, res, 'Government Spending');
exports.deleteGovernmentSpending = deleteGovernmentSpending;
const getGovernmentSpendingHistory = async (req, res) => getHistoryHandler(economic_model_1.GovernmentSpending, req, res, 'Government Spending');
exports.getGovernmentSpendingHistory = getGovernmentSpendingHistory;
// Bulk update for mixed indicator types
const bulkUpdateIndicators = async (req, res) => {
    try {
        if (req.rateLimit && req.rateLimit.remaining === 0) {
            res.status(429).json({
                success: false,
                code: 429,
                message: 'Too many requests. Rate limit exceeded',
                details: {
                    limit: req.rateLimit.limit,
                    resetIn: req.rateLimit.resetIn,
                },
            });
            return;
        }
        const indicatorsData = req.body;
        if (!Array.isArray(indicatorsData)) {
            res.status(400).json({
                success: false,
                code: 400,
                message: 'Request body must be an array of indicator objects',
            });
            return;
        }
        if (indicatorsData.length > 100) {
            res.status(400).json({
                success: false,
                code: 400,
                message: 'Maximum 100 indicators can be updated in a single request',
            });
            return;
        }
        const results = [];
        const errors = [];
        for (const indicator of indicatorsData) {
            try {
                const { type, id, ...data } = indicator;
                let ModelToUse;
                let indicatorName;
                switch (type) {
                    case 'gdp_growth_quarterly':
                        ModelToUse = economic_model_1.GDPGrowthQuarterly;
                        indicatorName = 'GDP Growth Quarterly';
                        break;
                    case 'gdp_growth_annual':
                        ModelToUse = economic_model_1.GDPGrowthAnnual;
                        indicatorName = 'GDP Growth Annual';
                        break;
                    case 'government_gdp_value':
                        ModelToUse = economic_model_1.GovernmentGDPValue;
                        indicatorName = 'Government GDP Value';
                        break;
                    case 'interest_rate':
                        ModelToUse = economic_model_1.InterestRate;
                        indicatorName = 'Interest Rate';
                        break;
                    case 'inflation_rate':
                        ModelToUse = economic_model_1.InflationRate;
                        indicatorName = 'Inflation Rate';
                        break;
                    case 'unemployment_rate':
                        ModelToUse = economic_model_1.UnemploymentRate;
                        indicatorName = 'Unemployment Rate';
                        break;
                    case 'balance_of_trade':
                        ModelToUse = economic_model_1.BalanceOfTrade;
                        indicatorName = 'Balance of Trade';
                        break;
                    case 'government_debt_to_gdp':
                        ModelToUse = economic_model_1.GovernmentDebtToGDP;
                        indicatorName = 'Government Debt to GDP';
                        break;
                    case 'government_debt_value':
                        ModelToUse = economic_model_1.GovernmentDebtValue;
                        indicatorName = 'Government Debt Value';
                        break;
                    case 'government_budget_value':
                        ModelToUse = economic_model_1.GovernmentBudgetValue;
                        indicatorName = 'Government Budget Value';
                        break;
                    case 'government_revenues':
                        ModelToUse = economic_model_1.GovernmentRevenues;
                        indicatorName = 'Government Revenues';
                        break;
                    case 'fiscal_expenditure':
                        ModelToUse = economic_model_1.FiscalExpenditure;
                        indicatorName = 'Fiscal Expenditure';
                        break;
                    case 'government_spending':
                        ModelToUse = economic_model_1.GovernmentSpending;
                        indicatorName = 'Government Spending';
                        break;
                    default:
                        errors.push({
                            type,
                            id,
                            error: `Unknown indicator type: ${type}`,
                        });
                        continue;
                }
                let query = {};
                let idStr = id;
                if (Array.isArray(idStr)) {
                    idStr = idStr[0];
                }
                if (idStr && typeof idStr === 'string' && mongoose_1.default.Types.ObjectId.isValid(idStr)) {
                    query._id = new mongoose_1.default.Types.ObjectId(idStr);
                }
                else if (data.quarter && data.year) {
                    query = { quarter: data.quarter, year: data.year };
                }
                else if (data.month && data.year) {
                    query = { month: data.month, year: data.year };
                }
                else if (data.year) {
                    query = { year: data.year };
                }
                else {
                    errors.push({
                        type,
                        id,
                        error: 'Missing required query parameters (id or year/month/quarter)',
                    });
                    continue;
                }
                const existing = await ModelToUse.findOne(query);
                if (existing) {
                    const updateOps = { $set: data };
                    if (data.current_value !== undefined) {
                        updateOps.$set.previous_value = existing.current_value;
                        updateOps.$set.current_value = data.current_value;
                    }
                    if (data.current_balance !== undefined) {
                        updateOps.$set.previous_balance = existing.current_balance;
                        updateOps.$set.current_balance = data.current_balance;
                    }
                    await ModelToUse.findOneAndUpdate(query, updateOps, {
                        new: true,
                        runValidators: true,
                    });
                    results.push({
                        type,
                        id: id || query.year,
                        status: 'updated',
                        indicatorName,
                    });
                }
                else {
                    const newRecord = await new ModelToUse(data).save();
                    results.push({
                        type,
                        id: newRecord._id,
                        status: 'created',
                        indicatorName,
                    });
                }
                await invalidateCache(indicatorName, id);
            }
            catch (error) {
                errors.push({
                    type: indicator.type,
                    id: indicator.id,
                    error: error.message,
                });
            }
        }
        res.status(200).json({
            success: errors.length === 0,
            code: errors.length === 0 ? 200 : 207,
            message: `Bulk indicator update completed. ${results.length} processed, ${errors.length} failed.`,
            data: {
                results,
                errors: errors.length > 0 ? errors : undefined,
                summary: {
                    total: indicatorsData.length,
                    processed: results.length,
                    failed: errors.length,
                },
            },
        });
    }
    catch (error) {
        console.error('Bulk update indicators error:', error);
        res.status(500).json({
            success: false,
            code: 500,
            message: 'Internal server error bulk updating indicators',
            errorId: `ECON-ERR-${Date.now()}`,
        });
    }
};
exports.bulkUpdateIndicators = bulkUpdateIndicators;
//# sourceMappingURL=economic.controller.js.map