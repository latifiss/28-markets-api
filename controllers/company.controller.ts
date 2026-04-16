import type { Request, Response } from 'express';
import Company from '../models/company.model';
import { getRedisClient } from '../lib/redis';

const setCache = async (key: string, data: any, expirationInSeconds = 3600): Promise<void> => {
  try {
    const client = await getRedisClient();
    if (client && typeof client.set === 'function') {
      await client.set(key, JSON.stringify(data), { EX: expirationInSeconds });
    }
  } catch (error: any) {
    console.error('Error setting cache:', error.message);
  }
};

const getCache = async (key: string): Promise<any> => {
  try {
    const client = await getRedisClient();
    if (client && typeof client.get === 'function') {
      const data = await client.get(key);
      return data ? JSON.parse(data) : null;
    }
    return null;
  } catch (error: any) {
    console.error('Error getting cache:', error.message);
    return null;
  }
};

const deleteCacheByPattern = async (pattern: string): Promise<void> => {
  try {
    const client = await getRedisClient();
    if (client && typeof client.scanIterator === 'function') {
      for await (const key of client.scanIterator({ MATCH: pattern })) {
        await client.del(key);
      }
    }
  } catch (error: any) {
    console.error('Error deleting cache by pattern:', error.message);
  }
};

export const createCompany = async (req: Request, res: Response): Promise<void> => {
  try {
    const newCompany = await Company.create(req.body);
    await deleteCacheByPattern('companies:*');
    res.status(201).json({
      status: 'success',
      data: {
        company: newCompany,
      },
    });
  } catch (err: any) {
    res.status(400).json({
      status: 'fail',
      message: err.message,
    });
  }
};

export const updateCompany = async (req: Request, res: Response): Promise<void> => {
  try {
    const company = await Company.findByIdAndUpdate(req.params.id, req.body, {
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
  } catch (err: any) {
    res.status(400).json({
      status: 'fail',
      message: err.message,
    });
  }
};

export const getCompany = async (req: Request, res: Response): Promise<void> => {
  try {
    const cacheKey = `company:${req.params.id}`;
    const cached = await getCache(cacheKey);
    if (cached) {
      res.status(200).json({ status: 'success', data: { company: cached } });
      return;
    }
    const company = await Company.findById(req.params.id);
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
  } catch (err: any) {
    res.status(400).json({
      status: 'fail',
      message: err.message,
    });
  }
};

export const getAllCompanies = async (req: Request, res: Response): Promise<void> => {
  try {
    const cacheKey = 'companies:all';
    const cached = await getCache(cacheKey);
    if (cached) {
      res.status(200).json(cached);
      return;
    }
    const companies = await Company.find();
    const response = {
      status: 'success',
      results: companies.length,
      data: { companies },
    };
    await setCache(cacheKey, response);
    res.status(200).json(response);
  } catch (err: any) {
    res.status(400).json({
      status: 'fail',
      message: err.message,
    });
  }
};

export const getCompaniesFromCountry = async (req: Request, res: Response): Promise<void> => {
  try {
    const cacheKey = `companies:country:${req.params.country}`;
    const cached = await getCache(cacheKey);
    if (cached) {
      res.status(200).json(cached);
      return;
    }
    const companies = await Company.find({
      'about.country': req.params.country,
    });
    const response = {
      status: 'success',
      results: companies.length,
      data: { companies },
    };
    await setCache(cacheKey, response);
    res.status(200).json(response);
  } catch (err: any) {
    res.status(400).json({
      status: 'fail',
      message: err.message,
    });
  }
};

export const getCompaniesFromExchange = async (req: Request, res: Response): Promise<void> => {
  try {
    const cacheKey = `companies:exchange:${req.params.exchangeName}`;
    const cached = await getCache(cacheKey);
    if (cached) {
      res.status(200).json(cached);
      return;
    }
    const companies = await Company.find({
      'shares.exchange_listed_name': req.params.exchangeName,
    });
    const response = {
      status: 'success',
      results: companies.length,
      data: { companies },
    };
    await setCache(cacheKey, response);
    res.status(200).json(response);
  } catch (err: any) {
    res.status(400).json({
      status: 'fail',
      message: err.message,
    });
  }
};

export const getCompaniesFromIndustry = async (req: Request, res: Response): Promise<void> => {
  try {
    const cacheKey = `companies:industry:${req.params.industry}`;
    const cached = await getCache(cacheKey);
    if (cached) {
      res.status(200).json(cached);
      return;
    }
    const companies = await Company.find({
      'about.industry': req.params.industry,
    });
    const response = {
      status: 'success',
      results: companies.length,
      data: { companies },
    };
    await setCache(cacheKey, response);
    res.status(200).json(response);
  } catch (err: any) {
    res.status(400).json({
      status: 'fail',
      message: err.message,
    });
  }
};

export const getCompaniesFromIndustryInCountry = async (req: Request, res: Response): Promise<void> => {
  try {
    const cacheKey = `companies:industry:${req.params.industry}:country:${req.params.country}`;
    const cached = await getCache(cacheKey);
    if (cached) {
      res.status(200).json(cached);
      return;
    }
    const companies = await Company.find({
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
  } catch (err: any) {
    res.status(400).json({
      status: 'fail',
      message: err.message,
    });
  }
};

export const getGroupCompaniesByIndustry = async (req: Request, res: Response): Promise<void> => {
  try {
    const cacheKey = 'companies:groupByIndustry';
    const cached = await getCache(cacheKey);
    if (cached) {
      res.status(200).json(cached);
      return;
    }
    const companies = await Company.aggregate([
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
  } catch (err: any) {
    res.status(400).json({
      status: 'fail',
      message: err.message,
    });
  }
};

export const getCompaniesFromIndustryInExchange = async (req: Request, res: Response): Promise<void> => {
  try {
    const cacheKey = `companies:industry:${req.params.industry}:exchange:${req.params.exchangeName}`;
    const cached = await getCache(cacheKey);
    if (cached) {
      res.status(200).json(cached);
      return;
    }
    const companies = await Company.find({
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
  } catch (err: any) {
    res.status(400).json({
      status: 'fail',
      message: err.message,
    });
  }
};

export const getIndustryPerformanceInExchange = async (req: Request, res: Response): Promise<void> => {
  try {
    const cacheKey = `companies:performance:exchange:${req.params.exchangeName}`;
    const cached = await getCache(cacheKey);
    if (cached) {
      res.status(200).json(cached);
      return;
    }
    const exchangeName = req.params.exchangeName;
    const industryPerformance = await Company.aggregate([
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
  } catch (err: any) {
    res.status(400).json({
      status: 'fail',
      message: err.message,
    });
  }
};

export const getGroupCompaniesByIndustryInExchange = async (req: Request, res: Response): Promise<void> => {
  try {
    const cacheKey = `companies:groupByIndustry:exchange:${req.params.exchangeName}`;
    const cached = await getCache(cacheKey);
    if (cached) {
      res.status(200).json(cached);
      return;
    }
    const exchangeName = req.params.exchangeName;
    const companiesByIndustry = await Company.aggregate([
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
  } catch (err: any) {
    res.status(400).json({
      status: 'fail',
      message: err.message,
    });
  }
};
