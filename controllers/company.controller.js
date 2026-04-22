"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getGroupCompaniesByIndustryInExchange = exports.getIndustryPerformanceInExchange = exports.getCompaniesFromIndustryInExchange = exports.getGroupCompaniesByIndustry = exports.getCompaniesFromIndustryInCountry = exports.getCompaniesFromIndustry = exports.getCompaniesFromExchange = exports.getCompaniesFromCountry = exports.getAllCompanies = exports.getCompany = exports.updateCompany = exports.createCompany = void 0;
const company_model_1 = __importDefault(require("../models/company.model"));
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
const createCompany = async (req, res) => {
    try {
        const newCompany = await company_model_1.default.create(req.body);
        await deleteCacheByPattern('companies:*');
        res.status(201).json({
            status: 'success',
            data: {
                company: newCompany,
            },
        });
    }
    catch (err) {
        res.status(400).json({
            status: 'fail',
            message: err.message,
        });
    }
};
exports.createCompany = createCompany;
const updateCompany = async (req, res) => {
    try {
        const company = await company_model_1.default.findByIdAndUpdate(req.params.id, req.body, {
            new: true,
            runValidators: true,
        });
        if (!company) {
            res.status(404).json({
                status: 'fail',
                message: 'Company not found',
            });
            return;
        }
        await deleteCacheByPattern('companies:*');
        await deleteCacheByPattern(`company:${req.params.id}`);
        res.status(200).json({
            status: 'success',
            data: {
                company,
            },
        });
    }
    catch (err) {
        res.status(400).json({
            status: 'fail',
            message: err.message,
        });
    }
};
exports.updateCompany = updateCompany;
const getCompany = async (req, res) => {
    try {
        const cacheKey = `company:${req.params.id}`;
        const cached = await getCache(cacheKey);
        if (cached) {
            res.status(200).json({ status: 'success', data: { company: cached } });
            return;
        }
        const company = await company_model_1.default.findById(req.params.id);
        if (!company) {
            res.status(404).json({
                status: 'fail',
                message: 'Company not found',
            });
            return;
        }
        await setCache(cacheKey, company);
        res.status(200).json({
            status: 'success',
            data: {
                company,
            },
        });
    }
    catch (err) {
        res.status(400).json({
            status: 'fail',
            message: err.message,
        });
    }
};
exports.getCompany = getCompany;
const getAllCompanies = async (req, res) => {
    try {
        const cacheKey = 'companies:all';
        const cached = await getCache(cacheKey);
        if (cached) {
            res.status(200).json(cached);
            return;
        }
        const companies = await company_model_1.default.find();
        const response = {
            status: 'success',
            results: companies.length,
            data: { companies },
        };
        await setCache(cacheKey, response);
        res.status(200).json(response);
    }
    catch (err) {
        res.status(400).json({
            status: 'fail',
            message: err.message,
        });
    }
};
exports.getAllCompanies = getAllCompanies;
const getCompaniesFromCountry = async (req, res) => {
    try {
        const cacheKey = `companies:country:${req.params.country}`;
        const cached = await getCache(cacheKey);
        if (cached) {
            res.status(200).json(cached);
            return;
        }
        const companies = await company_model_1.default.find({
            'about.country': req.params.country,
        });
        const response = {
            status: 'success',
            results: companies.length,
            data: { companies },
        };
        await setCache(cacheKey, response);
        res.status(200).json(response);
    }
    catch (err) {
        res.status(400).json({
            status: 'fail',
            message: err.message,
        });
    }
};
exports.getCompaniesFromCountry = getCompaniesFromCountry;
const getCompaniesFromExchange = async (req, res) => {
    try {
        const cacheKey = `companies:exchange:${req.params.exchangeName}`;
        const cached = await getCache(cacheKey);
        if (cached) {
            res.status(200).json(cached);
            return;
        }
        const companies = await company_model_1.default.find({
            'shares.exchange_listed_name': req.params.exchangeName,
        });
        const response = {
            status: 'success',
            results: companies.length,
            data: { companies },
        };
        await setCache(cacheKey, response);
        res.status(200).json(response);
    }
    catch (err) {
        res.status(400).json({
            status: 'fail',
            message: err.message,
        });
    }
};
exports.getCompaniesFromExchange = getCompaniesFromExchange;
const getCompaniesFromIndustry = async (req, res) => {
    try {
        const cacheKey = `companies:industry:${req.params.industry}`;
        const cached = await getCache(cacheKey);
        if (cached) {
            res.status(200).json(cached);
            return;
        }
        const companies = await company_model_1.default.find({
            'about.industry': req.params.industry,
        });
        const response = {
            status: 'success',
            results: companies.length,
            data: { companies },
        };
        await setCache(cacheKey, response);
        res.status(200).json(response);
    }
    catch (err) {
        res.status(400).json({
            status: 'fail',
            message: err.message,
        });
    }
};
exports.getCompaniesFromIndustry = getCompaniesFromIndustry;
const getCompaniesFromIndustryInCountry = async (req, res) => {
    try {
        const cacheKey = `companies:industry:${req.params.industry}:country:${req.params.country}`;
        const cached = await getCache(cacheKey);
        if (cached) {
            res.status(200).json(cached);
            return;
        }
        const companies = await company_model_1.default.find({
            'about.industry': req.params.industry,
            'about.country': req.params.country,
        });
        const response = {
            status: 'success',
            results: companies.length,
            data: { companies },
        };
        await setCache(cacheKey, response);
        res.status(200).json(response);
    }
    catch (err) {
        res.status(400).json({
            status: 'fail',
            message: err.message,
        });
    }
};
exports.getCompaniesFromIndustryInCountry = getCompaniesFromIndustryInCountry;
const getGroupCompaniesByIndustry = async (req, res) => {
    try {
        const cacheKey = 'companies:groupByIndustry';
        const cached = await getCache(cacheKey);
        if (cached) {
            res.status(200).json(cached);
            return;
        }
        const companies = await company_model_1.default.aggregate([
            {
                $group: {
                    _id: '$about.industry',
                    companies: { $push: '$$ROOT' },
                    count: { $sum: 1 },
                },
            },
            { $sort: { count: -1 } },
        ]);
        const response = {
            status: 'success',
            results: companies.length,
            data: { companies },
        };
        await setCache(cacheKey, response);
        res.status(200).json(response);
    }
    catch (err) {
        res.status(400).json({
            status: 'fail',
            message: err.message,
        });
    }
};
exports.getGroupCompaniesByIndustry = getGroupCompaniesByIndustry;
const getCompaniesFromIndustryInExchange = async (req, res) => {
    try {
        const cacheKey = `companies:industry:${req.params.industry}:exchange:${req.params.exchangeName}`;
        const cached = await getCache(cacheKey);
        if (cached) {
            res.status(200).json(cached);
            return;
        }
        const companies = await company_model_1.default.find({
            'about.industry': req.params.industry,
            'shares.exchange_listed_name': req.params.exchangeName,
        });
        const response = {
            status: 'success',
            results: companies.length,
            data: { companies },
        };
        await setCache(cacheKey, response);
        res.status(200).json(response);
    }
    catch (err) {
        res.status(400).json({
            status: 'fail',
            message: err.message,
        });
    }
};
exports.getCompaniesFromIndustryInExchange = getCompaniesFromIndustryInExchange;
const getIndustryPerformanceInExchange = async (req, res) => {
    try {
        const cacheKey = `companies:performance:exchange:${req.params.exchangeName}`;
        const cached = await getCache(cacheKey);
        if (cached) {
            res.status(200).json(cached);
            return;
        }
        const exchangeName = req.params.exchangeName;
        const industryPerformance = await company_model_1.default.aggregate([
            { $match: { 'shares.exchange_listed_name': exchangeName } },
            {
                $group: {
                    _id: '$about.industry',
                    totalMarketCap: { $sum: '$key_statistics.market_capitalization' },
                    weightedPerformance: {
                        $sum: {
                            $multiply: [
                                '$key_statistics.market_capitalization',
                                '$key_statistics.percentage_change',
                            ],
                        },
                    },
                    companies: { $push: '$$ROOT' },
                },
            },
            {
                $project: {
                    industry: '$_id',
                    performance: { $divide: ['$weightedPerformance', '$totalMarketCap'] },
                    companyCount: { $size: '$companies' },
                },
            },
            { $sort: { performance: -1 } },
        ]);
        const response = {
            status: 'success',
            data: { exchange: exchangeName, industryPerformance },
        };
        await setCache(cacheKey, response);
        res.status(200).json(response);
    }
    catch (err) {
        res.status(400).json({
            status: 'fail',
            message: err.message,
        });
    }
};
exports.getIndustryPerformanceInExchange = getIndustryPerformanceInExchange;
const getGroupCompaniesByIndustryInExchange = async (req, res) => {
    try {
        const cacheKey = `companies:groupByIndustry:exchange:${req.params.exchangeName}`;
        const cached = await getCache(cacheKey);
        if (cached) {
            res.status(200).json(cached);
            return;
        }
        const exchangeName = req.params.exchangeName;
        const companiesByIndustry = await company_model_1.default.aggregate([
            { $match: { 'shares.exchange_listed_name': exchangeName } },
            {
                $group: {
                    _id: '$about.industry',
                    companies: { $push: '$$ROOT' },
                    count: { $sum: 1 },
                    totalMarketCap: { $sum: '$key_statistics.market_capitalization' },
                },
            },
            {
                $project: {
                    industry: '$_id',
                    companyCount: '$count',
                    totalMarketCap: 1,
                    companies: 1,
                    _id: 0,
                },
            },
            { $sort: { totalMarketCap: -1 } },
        ]);
        if (companiesByIndustry.length === 0) {
            res.status(404).json({
                status: 'fail',
                message: 'No companies found for the specified exchange',
            });
            return;
        }
        const response = {
            status: 'success',
            results: companiesByIndustry.length,
            data: { exchange: exchangeName, companiesByIndustry },
        };
        await setCache(cacheKey, response);
        res.status(200).json(response);
    }
    catch (err) {
        res.status(400).json({
            status: 'fail',
            message: err.message,
        });
    }
};
exports.getGroupCompaniesByIndustryInExchange = getGroupCompaniesByIndustryInExchange;
//# sourceMappingURL=company.controller.js.map