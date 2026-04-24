"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.bulkUpdateTreasuryBonds = exports.calculateInvestmentReturn = exports.getHighestYieldingBonds = exports.getActiveTreasuryBonds = exports.deleteTreasuryBond = exports.updateTreasuryBond = exports.getTreasuryBond = exports.getAllTreasuryBonds = exports.createTreasuryBond = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const treasury_model_1 = __importDefault(require("../models/treasury.model"));
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
const invalidateCache = async (bondId = null) => {
    await deleteCacheByPattern('treasury:*');
    if (bondId) {
        await deleteCacheByPattern(`treasury:id:${bondId}`);
        await deleteCacheByPattern(`treasury:name:*${bondId}*`);
    }
};
const createTreasuryBond = async (req, res) => {
    try {
        const { name, tender, discount_rate, interest_rate, maturity, type, face_value, minimum_investment, description, issue_date, } = req.body;
        if (!name || !tender || !discount_rate || !interest_rate || !maturity) {
            res.status(400).json({
                success: false,
                code: 400,
                message: 'Missing required fields: name, tender, discount_rate, interest_rate, maturity',
                details: {
                    missingFields: [
                        !name && 'name',
                        !tender && 'tender',
                        !discount_rate && 'discount_rate',
                        !interest_rate && 'interest_rate',
                        !maturity && 'maturity',
                    ].filter(Boolean),
                },
            });
            return;
        }
        if (discount_rate < 0 || discount_rate > 100) {
            res.status(400).json({
                success: false,
                code: 400,
                message: 'Discount rate must be between 0 and 100',
                details: { discount_rate },
            });
            return;
        }
        if (interest_rate < 0 || interest_rate > 100) {
            res.status(400).json({
                success: false,
                code: 400,
                message: 'Interest rate must be between 0 and 100',
                details: { interest_rate },
            });
            return;
        }
        const newBond = new treasury_model_1.default({
            name,
            tender,
            discount_rate: parseFloat(discount_rate),
            interest_rate: parseFloat(interest_rate),
            maturity,
            type: type || 'T-Bill',
            face_value: face_value || 1000,
            minimum_investment: minimum_investment || 100,
            description,
            issue_date: issue_date || new Date(),
            last_updated: new Date(),
        });
        const savedBond = await newBond.save();
        await invalidateCache(savedBond._id.toString());
        res.status(201).json({
            success: true,
            code: 201,
            message: 'Treasury bond created successfully',
            data: savedBond,
        });
    }
    catch (error) {
        if (error.code === 11000) {
            res.status(400).json({
                success: false,
                code: 400,
                message: 'Duplicate entry. Treasury bond name already exists',
                details: {
                    duplicateField: 'name',
                    duplicateValue: error.keyValue.name,
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
            message: 'Internal server error creating treasury bond',
            errorId: `ERR-${Date.now()}`,
        });
    }
};
exports.createTreasuryBond = createTreasuryBond;
const getAllTreasuryBonds = async (req, res) => {
    try {
        const cacheKey = 'treasury:all';
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
        const bonds = await treasury_model_1.default.find();
        await setCache(cacheKey, bonds);
        res.status(200).json({
            success: true,
            code: 200,
            fromCache: false,
            data: bonds,
        });
    }
    catch (error) {
        console.error('Get all error:', error);
        res.status(500).json({
            success: false,
            code: 500,
            message: 'Internal server error fetching treasury bonds',
            errorId: `ERR-${Date.now()}`,
        });
    }
};
exports.getAllTreasuryBonds = getAllTreasuryBonds;
const getTreasuryBond = async (req, res) => {
    try {
        const { id } = req.params;
        const cacheKey = `treasury:id:${id}`;
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
        let bond;
        if (mongoose_1.default.Types.ObjectId.isValid(id)) {
            bond = await treasury_model_1.default.findById(id);
        }
        else {
            bond = await treasury_model_1.default.findOne({
                name: { $regex: new RegExp(`^${id}$`, 'i') },
            });
        }
        if (!bond) {
            res.status(404).json({
                success: false,
                code: 404,
                message: 'Treasury bond not found',
                details: { id },
            });
            return;
        }
        await setCache(cacheKey, bond);
        res.status(200).json({
            success: true,
            code: 200,
            fromCache: false,
            data: bond,
        });
    }
    catch (error) {
        console.error('Get by id error:', error);
        res.status(500).json({
            success: false,
            code: 500,
            message: 'Internal server error fetching treasury bond',
            errorId: `ERR-${Date.now()}`,
        });
    }
};
exports.getTreasuryBond = getTreasuryBond;
const updateTreasuryBond = async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = req.body;
        if (updateData.discount_rate !== undefined) {
            const discountRate = parseFloat(updateData.discount_rate);
            if (discountRate < 0 || discountRate > 100) {
                res.status(400).json({
                    success: false,
                    code: 400,
                    message: 'Discount rate must be between 0 and 100',
                    details: { discount_rate: discountRate },
                });
                return;
            }
        }
        if (updateData.interest_rate !== undefined) {
            const interestRate = parseFloat(updateData.interest_rate);
            if (interestRate < 0 || interestRate > 100) {
                res.status(400).json({
                    success: false,
                    code: 400,
                    message: 'Interest rate must be between 0 and 100',
                    details: { interest_rate: interestRate },
                });
                return;
            }
        }
        let bond;
        if (mongoose_1.default.Types.ObjectId.isValid(id)) {
            bond = await treasury_model_1.default.findById(id);
        }
        else {
            bond = await treasury_model_1.default.findOne({
                name: { $regex: new RegExp(`^${id}$`, 'i') },
            });
        }
        if (!bond) {
            res.status(404).json({
                success: false,
                code: 404,
                message: 'Treasury bond not found',
                details: { id },
            });
            return;
        }
        if (updateData.name && updateData.name !== bond.name) {
            const existingBond = await treasury_model_1.default.findOne({
                name: updateData.name,
            });
            if (existingBond) {
                res.status(409).json({
                    success: false,
                    code: 409,
                    message: 'Another treasury bond with this name already exists',
                    details: { name: updateData.name },
                });
                return;
            }
        }
        Object.keys(updateData).forEach((key) => {
            if (key !== 'id' && key !== '_id') {
                bond[key] = updateData[key];
            }
        });
        bond.last_updated = new Date();
        const updatedBond = await bond.save();
        await invalidateCache(bond._id.toString());
        res.status(200).json({
            success: true,
            code: 200,
            message: 'Treasury bond updated successfully',
            data: updatedBond,
        });
    }
    catch (error) {
        if (error.code === 11000) {
            res.status(400).json({
                success: false,
                code: 400,
                message: 'Duplicate entry. Treasury bond name already exists',
                details: {
                    duplicateField: 'name',
                    duplicateValue: error.keyValue.name,
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
            message: 'Internal server error updating treasury bond',
            errorId: `ERR-${Date.now()}`,
        });
    }
};
exports.updateTreasuryBond = updateTreasuryBond;
const deleteTreasuryBond = async (req, res) => {
    try {
        const { id } = req.params;
        let deletedBond;
        if (mongoose_1.default.Types.ObjectId.isValid(id)) {
            deletedBond = await treasury_model_1.default.findByIdAndDelete(id);
        }
        else {
            deletedBond = await treasury_model_1.default.findOneAndDelete({
                name: { $regex: new RegExp(`^${id}$`, 'i') },
            });
        }
        if (!deletedBond) {
            res.status(404).json({
                success: false,
                code: 404,
                message: 'Treasury bond not found',
                details: { id },
            });
            return;
        }
        await invalidateCache(deletedBond._id.toString());
        res.status(200).json({
            success: true,
            code: 200,
            message: 'Treasury bond deleted successfully',
            data: {
                id: deletedBond._id,
                name: deletedBond.name,
                tender: deletedBond.tender,
            },
        });
    }
    catch (error) {
        console.error('Delete error:', error);
        res.status(500).json({
            success: false,
            code: 500,
            message: 'Internal server error deleting treasury bond',
            errorId: `ERR-${Date.now()}`,
        });
    }
};
exports.deleteTreasuryBond = deleteTreasuryBond;
const getActiveTreasuryBonds = async (req, res) => {
    try {
        const cacheKey = 'treasury:active';
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
        const activeBonds = await treasury_model_1.default.findActiveBonds();
        await setCache(cacheKey, activeBonds);
        res.status(200).json({
            success: true,
            code: 200,
            fromCache: false,
            data: activeBonds,
        });
    }
    catch (error) {
        console.error('Get active bonds error:', error);
        res.status(500).json({
            success: false,
            code: 500,
            message: 'Internal server error fetching active treasury bonds',
            errorId: `ERR-${Date.now()}`,
        });
    }
};
exports.getActiveTreasuryBonds = getActiveTreasuryBonds;
const getHighestYieldingBonds = async (req, res) => {
    try {
        const { limit = 10 } = req.query;
        const cacheKey = `treasury:highest_yielding:${limit}`;
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
        const highestYieldingBonds = await treasury_model_1.default.findHighestYielding(parseInt(limit));
        await setCache(cacheKey, highestYieldingBonds, 300);
        res.status(200).json({
            success: true,
            code: 200,
            fromCache: false,
            data: highestYieldingBonds,
        });
    }
    catch (error) {
        console.error('Get highest yielding bonds error:', error);
        res.status(500).json({
            success: false,
            code: 500,
            message: 'Internal server error fetching highest yielding bonds',
            errorId: `ERR-${Date.now()}`,
        });
    }
};
exports.getHighestYieldingBonds = getHighestYieldingBonds;
const calculateInvestmentReturn = async (req, res) => {
    try {
        const { id } = req.params;
        const { investment_amount } = req.body;
        if (!investment_amount || investment_amount <= 0) {
            res.status(400).json({
                success: false,
                code: 400,
                message: 'Investment amount is required and must be greater than 0',
            });
            return;
        }
        let bond;
        if (mongoose_1.default.Types.ObjectId.isValid(id)) {
            bond = await treasury_model_1.default.findById(id);
        }
        else {
            bond = await treasury_model_1.default.findOne({
                name: { $regex: new RegExp(`^${id}$`, 'i') },
            });
        }
        if (!bond) {
            res.status(404).json({
                success: false,
                code: 404,
                message: 'Treasury bond not found',
                details: { id },
            });
            return;
        }
        const price = bond.calculatePrice(investment_amount);
        const interest = bond.calculateInterest(investment_amount);
        const totalReturn = bond.calculateTotalReturn(investment_amount);
        const discountAmount = investment_amount - price;
        res.status(200).json({
            success: true,
            code: 200,
            data: {
                bond: {
                    name: bond.name,
                    tender: bond.tender,
                    maturity: bond.maturity,
                    discount_rate: bond.discount_rate_formatted,
                    interest_rate: bond.interest_rate_formatted,
                },
                investment: {
                    amount: investment_amount,
                    price: price,
                    discount_amount: discountAmount,
                    interest: interest,
                    total_return: totalReturn,
                    net_gain: totalReturn - investment_amount,
                },
            },
        });
    }
    catch (error) {
        console.error('Calculate investment error:', error);
        res.status(500).json({
            success: false,
            code: 500,
            message: 'Internal server error calculating investment return',
            errorId: `ERR-${Date.now()}`,
        });
    }
};
exports.calculateInvestmentReturn = calculateInvestmentReturn;
const bulkUpdateTreasuryBonds = async (req, res) => {
    try {
        const bondsData = req.body;
        if (!Array.isArray(bondsData)) {
            res.status(400).json({
                success: false,
                code: 400,
                message: 'Request body must be an array of treasury bond objects',
            });
            return;
        }
        const validationErrors = [];
        bondsData.forEach((bond, index) => {
            if (!bond.name ||
                !bond.tender ||
                !bond.discount_rate ||
                !bond.interest_rate ||
                !bond.maturity) {
                validationErrors.push({
                    index,
                    message: 'Missing required fields: name, tender, discount_rate, interest_rate, maturity',
                });
            }
        });
        if (validationErrors.length > 0) {
            res.status(400).json({
                success: false,
                code: 400,
                message: 'Validation errors in bonds data',
                details: { errors: validationErrors },
            });
            return;
        }
        const operations = bondsData.map((bond) => ({
            updateOne: {
                filter: { name: bond.name },
                update: {
                    $set: {
                        ...bond,
                        discount_rate: parseFloat(bond.discount_rate),
                        interest_rate: parseFloat(bond.interest_rate),
                        last_updated: new Date(),
                    },
                },
                upsert: true,
            },
        }));
        const result = await treasury_model_1.default.bulkWrite(operations);
        await invalidateCache();
        res.status(200).json({
            success: true,
            code: 200,
            message: 'Treasury bonds bulk update completed',
            data: {
                matchedCount: result.matchedCount,
                modifiedCount: result.modifiedCount,
                upsertedCount: result.upsertedCount,
                totalProcessed: bondsData.length,
            },
        });
    }
    catch (error) {
        console.error('Bulk update error:', error);
        res.status(500).json({
            success: false,
            code: 500,
            message: 'Internal server error bulk updating treasury bonds',
            errorId: `ERR-${Date.now()}`,
        });
    }
};
exports.bulkUpdateTreasuryBonds = bulkUpdateTreasuryBonds;
//# sourceMappingURL=treasury.controller.js.map