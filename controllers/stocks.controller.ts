import type { Request, Response } from 'express';
import mongoose from 'mongoose';
import {
  Profile,
  Statistics,
  Dividends,
  Earnings,
  Financial,
  Holders,
  PriceHistory,
} from '../models/stocks.model';
import { getRedisClient } from '../lib/redis';
import { publishStockUpdate } from '../lib/realtime/ws';

const setCache = async (
  key: string,
  data: any,
  expirationInSeconds = 3600,
): Promise<void> => {
  try {
    const client = await getRedisClient();
    if (client && typeof client.set === 'function') {
      await client.set(key, JSON.stringify(data), {
        EX: expirationInSeconds,
      });
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

const invalidateCompanyCache = async (
  company_id: string,
  ticker_symbol?: string | string[],
): Promise<void> => {
  try {
    const patterns = [
      `equity:profile:company:${company_id}`,
      `equity:statistics:company:${company_id}`,
      `equity:dividends:company:${company_id}`,
      `equity:earnings:company:${company_id}`,
      `equity:financial:company:${company_id}`,
      `equity:holders:company:${company_id}`,
      `equity:company:${company_id}:all`,
      `equity:priceHistory:company:${company_id}`,
      `equity:priceHistory:company:${company_id}:24h`,
      `equity:priceHistory:company:${company_id}:1w`,
      `equity:priceHistory:company:${company_id}:3m`,
      `equity:priceHistory:company:${company_id}:6m`,
      `equity:priceHistory:company:${company_id}:ytd`,
      `equity:priceHistory:company:${company_id}:1y`,
      `equity:priceHistory:company:${company_id}:2y`,
      `equity:priceHistory:company:${company_id}:5y`,
      `equity:priceHistory:company:${company_id}:10y`,
      `equity:priceHistory:company:${company_id}:alltime`,
    ];

    if (ticker_symbol) {
      const symbols = Array.isArray(ticker_symbol) ? ticker_symbol : [ticker_symbol];
      symbols.forEach(symbol => {
        if (symbol) {
          patterns.push(`equity:*:ticker:${symbol}*`);
        }
      });
    }

    for (const pattern of patterns) {
      await deleteCacheByPattern(pattern);
    }

    console.log(`Cache invalidated for company_id: ${company_id}`);
  } catch (error: any) {
    console.error('Error invalidating company cache:', error.message);
  }
};

interface BulkCreateResult {
  successful: Array<{ company_id: string; operation: string; id?: string }>;
  failed: Array<{ company_id?: string; operation: string; error: string; data?: any }>;
}

interface BulkUpdateResult {
  successful: Array<{ company_id: string; operation: string }>;
  failed: Array<{ company_id?: string; operation: string; error: string }>;
}

export const createProfile = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { company_id } = req.body;
    if (!company_id) {
      res.status(400).json({
        success: false,
        code: 400,
        message: 'Company ID is required',
        details: { required: ['company_id'] },
      });
      return;
    }

    const existingProfile = await Profile.findOne({ company_id });
    if (existingProfile) {
      res.status(400).json({
        success: false,
        code: 400,
        message: 'Profile already exists for this company',
        details: { company_id },
      });
      return;
    }

    const profile = await Profile.create(req.body);
    await invalidateCompanyCache(company_id, req.body.about?.ticker_symbol);

    res.status(201).json({
      success: true,
      code: 201,
      message: 'Profile created successfully',
      data: profile,
    });
  } catch (error: any) {
    if (error.code === 11000) {
      res.status(400).json({
        success: false,
        code: 400,
        message: 'Duplicate entry',
        details: {
          duplicateField: Object.keys(error.keyPattern)[0],
          duplicateValue: error.keyValue[Object.keys(error.keyPattern)[0]],
        },
      });
      return;
    }

    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map((err: any) => ({
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

    console.error('Create profile error:', error);
    res.status(500).json({
      success: false,
      code: 500,
      message: 'Internal server error creating profile',
      errorId: `ERR-${Date.now()}`,
    });
  }
};

export const getProfileByCompanyId = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { company_id } = req.params;

    const cacheKey = `equity:profile:company:${company_id}`;
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

    const profile = await Profile.findOne({ company_id });
    if (!profile) {
      res.status(404).json({
        success: false,
        code: 404,
        message: 'Profile not found',
        details: { company_id },
      });
      return;
    }

    await setCache(cacheKey, profile);

    res.status(200).json({
      success: true,
      code: 200,
      fromCache: false,
      data: profile,
    });
  } catch (error: any) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      code: 500,
      message: 'Internal server error fetching profile',
      errorId: `ERR-${Date.now()}`,
    });
  }
};

export const updateProfile = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { company_id } = req.params;

    const currentProfile = await Profile.findOne({ company_id });
    if (!currentProfile) {
      res.status(404).json({
        success: false,
        code: 404,
        message: 'Profile not found',
        details: { company_id },
      });
      return;
    }

    const profile = await Profile.findOneAndUpdate(
      { company_id },
      req.body,
      { new: true, runValidators: true },
    );

    if (!profile) {
      res.status(404).json({
        success: false,
        code: 404,
        message: 'Profile not found',
        details: { company_id },
      });
      return;
    }

    await invalidateCompanyCache(company_id as string, profile.about?.ticker_symbol);

    res.status(200).json({
      success: true,
      code: 200,
      message: 'Profile updated successfully',
      data: profile,
    });
  } catch (error: any) {
    if (error.code === 11000) {
      res.status(400).json({
        success: false,
        code: 400,
        message: 'Duplicate entry',
        details: {
          duplicateField: Object.keys(error.keyPattern)[0],
          duplicateValue: error.keyValue[Object.keys(error.keyPattern)[0]],
        },
      });
      return;
    }

    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map((err: any) => ({
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

    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      code: 500,
      message: 'Internal server error updating profile',
      errorId: `ERR-${Date.now()}`,
    });
  }
};

export const deleteProfile = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { company_id } = req.params;

    const profile = await Profile.findOneAndDelete({ company_id });
    if (!profile) {
      res.status(404).json({
        success: false,
        code: 404,
        message: 'Profile not found',
        details: { company_id },
      });
      return;
    }

    await invalidateCompanyCache(company_id as string, profile.about?.ticker_symbol);

    res.status(200).json({
      success: true,
      code: 200,
      message: 'Profile deleted successfully',
      data: {
        company_id: profile.company_id,
        company_name: profile.about?.company_name,
      },
    });
  } catch (error: any) {
    console.error('Delete profile error:', error);
    res.status(500).json({
      success: false,
      code: 500,
      message: 'Internal server error deleting profile',
      errorId: `ERR-${Date.now()}`,
    });
  }
};

export const createStatistics = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { company_id } = req.body;
    if (!company_id) {
      res.status(400).json({
        success: false,
        code: 400,
        message: 'Company ID is required',
        details: { required: ['company_id'] },
      });
      return;
    }

    const existingStats = await Statistics.findOne({ company_id });
    if (existingStats) {
      res.status(400).json({
        success: false,
        code: 400,
        message: 'Statistics already exist for this company',
        details: { company_id },
      });
      return;
    }

    const statistics = await Statistics.create(req.body);

    if (
      (statistics as any).addToKeyStatsHistory &&
      typeof (statistics as any).addToKeyStatsHistory === 'function'
    ) {
      (statistics as any).addToKeyStatsHistory();
      await statistics.save();
    }

    await invalidateCompanyCache(company_id, req.body.ticker_symbol);

    res.status(201).json({
      success: true,
      code: 201,
      message: 'Statistics created successfully',
      data: statistics,
    });
  } catch (error: any) {
    if (error.code === 11000) {
      res.status(400).json({
        success: false,
        code: 400,
        message: 'Duplicate entry',
        details: {
          duplicateField: Object.keys(error.keyPattern)[0],
          duplicateValue: error.keyValue[Object.keys(error.keyPattern)[0]],
        },
      });
      return;
    }

    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map((err: any) => ({
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

    console.error('Create statistics error:', error);
    res.status(500).json({
      success: false,
      code: 500,
      message: 'Internal server error creating statistics',
      errorId: `ERR-${Date.now()}`,
    });
  }
};

export const getStatisticsByCompanyId = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { company_id } = req.params;

    const cacheKey = `equity:statistics:company:${company_id}`;
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

    const statistics = await Statistics.findOne({ company_id });
    if (!statistics) {
      res.status(404).json({
        success: false,
        code: 404,
        message: 'Statistics not found',
        details: { company_id },
      });
      return;
    }

    await setCache(cacheKey, statistics);

    res.status(200).json({
      success: true,
      code: 200,
      fromCache: false,
      data: statistics,
    });
  } catch (error: any) {
    console.error('Get statistics error:', error);
    res.status(500).json({
      success: false,
      code: 500,
      message: 'Internal server error fetching statistics',
      errorId: `ERR-${Date.now()}`,
    });
  }
};

export const updateStatistics = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { company_id } = req.params;

    const existingStats = await Statistics.findOne({ company_id });
    
    if (!existingStats) {
      res.status(404).json({
        success: false,
        code: 404,
        message: 'Statistics not found',
        details: { company_id },
      });
      return;
    }

    const updateData = req.body;
    
    if (updateData.key_statistics && !updateData.key_statistics.current_price) {
      updateData.key_statistics.current_price = existingStats.key_statistics?.current_price;
    }

    const statistics = await Statistics.findOneAndUpdate(
      { company_id },
      updateData,
      { new: true, runValidators: true },
    );

    await invalidateCompanyCache(company_id as string, statistics.ticker_symbol);

    res.status(200).json({
      success: true,
      code: 200,
      message: 'Statistics updated successfully',
      data: statistics,
    });
  } catch (error: any) {
    if (error.code === 11000) {
      res.status(400).json({
        success: false,
        code: 400,
        message: 'Duplicate entry',
        details: {
          duplicateField: Object.keys(error.keyPattern)[0],
          duplicateValue: error.keyValue[Object.keys(error.keyPattern)[0]],
        },
      });
      return;
    }

    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map((err: any) => ({
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

    console.error('Update statistics error:', error);
    res.status(500).json({
      success: false,
      code: 500,
      message: 'Internal server error updating statistics',
      errorId: `ERR-${Date.now()}`,
    });
  }
};

export const deleteStatistics = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { company_id } = req.params;

    const statistics = await Statistics.findOneAndDelete({ company_id });
    if (!statistics) {
      res.status(404).json({
        success: false,
        code: 404,
        message: 'Statistics not found',
        details: { company_id },
      });
      return;
    }

    await invalidateCompanyCache(company_id as string, statistics.ticker_symbol);

    res.status(200).json({
      success: true,
      code: 200,
      message: 'Statistics deleted successfully',
      data: {
        company_id: statistics.company_id,
        company_name: statistics.company_name,
      },
    });
  } catch (error: any) {
    console.error('Delete statistics error:', error);
    res.status(500).json({
      success: false,
      code: 500,
      message: 'Internal server error deleting statistics',
      errorId: `ERR-${Date.now()}`,
    });
  }
};

export const createDividends = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { company_id } = req.body;
    if (!company_id) {
      res.status(400).json({
        success: false,
        code: 400,
        message: 'Company ID is required',
        details: { required: ['company_id'] },
      });
      return;
    }

    const existingDividends = await Dividends.findOne({ company_id });
    if (existingDividends) {
      res.status(400).json({
        success: false,
        code: 400,
        message: 'Dividends data already exists for this company',
        details: { company_id },
      });
      return;
    }

    const dividends = await Dividends.create(req.body);

    if (
      (dividends as any).addDividendToHistory &&
      typeof (dividends as any).addDividendToHistory === 'function'
    ) {
      (dividends as any).addDividendToHistory();
      await dividends.save();
    }

    await invalidateCompanyCache(company_id, req.body.ticker_symbol);

    res.status(201).json({
      success: true,
      code: 201,
      message: 'Dividends data created successfully',
      data: dividends,
    });
  } catch (error: any) {
    if (error.code === 11000) {
      res.status(400).json({
        success: false,
        code: 400,
        message: 'Duplicate entry',
        details: {
          duplicateField: Object.keys(error.keyPattern)[0],
          duplicateValue: error.keyValue[Object.keys(error.keyPattern)[0]],
        },
      });
      return;
    }

    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map((err: any) => ({
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

    console.error('Create dividends error:', error);
    res.status(500).json({
      success: false,
      code: 500,
      message: 'Internal server error creating dividends data',
      errorId: `ERR-${Date.now()}`,
    });
  }
};

export const getDividendsByCompanyId = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { company_id } = req.params;

    const cacheKey = `equity:dividends:company:${company_id}`;
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

    const dividends = await Dividends.findOne({ company_id });
    if (!dividends) {
      res.status(404).json({
        success: false,
        code: 404,
        message: 'Dividends data not found',
        details: { company_id },
      });
      return;
    }

    await setCache(cacheKey, dividends);

    res.status(200).json({
      success: true,
      code: 200,
      fromCache: false,
      data: dividends,
    });
  } catch (error: any) {
    console.error('Get dividends error:', error);
    res.status(500).json({
      success: false,
      code: 500,
      message: 'Internal server error fetching dividends data',
      errorId: `ERR-${Date.now()}`,
    });
  }
};

export const updateDividends = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { company_id } = req.params;

    const dividends = await Dividends.findOneAndUpdate(
      { company_id },
      req.body,
      { new: true, runValidators: true },
    );

    if (!dividends) {
      res.status(404).json({
        success: false,
        code: 404,
        message: 'Dividends data not found',
        details: { company_id },
      });
      return;
    }

    await invalidateCompanyCache(company_id as string, dividends.ticker_symbol);

    res.status(200).json({
      success: true,
      code: 200,
      message: 'Dividends data updated successfully',
      data: dividends,
    });
  } catch (error: any) {
    if (error.code === 11000) {
      res.status(400).json({
        success: false,
        code: 400,
        message: 'Duplicate entry',
        details: {
          duplicateField: Object.keys(error.keyPattern)[0],
          duplicateValue: error.keyValue[Object.keys(error.keyPattern)[0]],
        },
      });
      return;
    }

    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map((err: any) => ({
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

    console.error('Update dividends error:', error);
    res.status(500).json({
      success: false,
      code: 500,
      message: 'Internal server error updating dividends data',
      errorId: `ERR-${Date.now()}`,
    });
  }
};

export const deleteDividends = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { company_id } = req.params;

    const dividends = await Dividends.findOneAndDelete({ company_id });
    if (!dividends) {
      res.status(404).json({
        success: false,
        code: 404,
        message: 'Dividends data not found',
        details: { company_id },
      });
      return;
    }

    await invalidateCompanyCache(company_id as string, dividends.ticker_symbol);

    res.status(200).json({
      success: true,
      code: 200,
      message: 'Dividends data deleted successfully',
      data: {
        company_id: dividends.company_id,
        company_name: dividends.company_name,
      },
    });
  } catch (error: any) {
    console.error('Delete dividends error:', error);
    res.status(500).json({
      success: false,
      code: 500,
      message: 'Internal server error deleting dividends data',
      errorId: `ERR-${Date.now()}`,
    });
  }
};

export const createEarnings = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { company_id } = req.body;
    if (!company_id) {
      res.status(400).json({
        success: false,
        code: 400,
        message: 'Company ID is required',
        details: { required: ['company_id'] },
      });
      return;
    }

    const existingEarnings = await Earnings.findOne({ company_id });
    if (existingEarnings) {
      res.status(400).json({
        success: false,
        code: 400,
        message: 'Earnings data already exists for this company',
        details: { company_id },
      });
      return;
    }

    const earnings = await Earnings.create(req.body);

    if (
      (earnings as any).addEarningsToHistory &&
      typeof (earnings as any).addEarningsToHistory === 'function'
    ) {
      (earnings as any).addEarningsToHistory('quarterly');
      await earnings.save();
    }

    await invalidateCompanyCache(company_id, req.body.ticker_symbol);

    res.status(201).json({
      success: true,
      code: 201,
      message: 'Earnings data created successfully',
      data: earnings,
    });
  } catch (error: any) {
    if (error.code === 11000) {
      res.status(400).json({
        success: false,
        code: 400,
        message: 'Duplicate entry',
        details: {
          duplicateField: Object.keys(error.keyPattern)[0],
          duplicateValue: error.keyValue[Object.keys(error.keyPattern)[0]],
        },
      });
      return;
    }

    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map((err: any) => ({
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

    console.error('Create earnings error:', error);
    res.status(500).json({
      success: false,
      code: 500,
      message: 'Internal server error creating earnings data',
      errorId: `ERR-${Date.now()}`,
    });
  }
};

export const getEarningsByCompanyId = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { company_id } = req.params;

    const cacheKey = `equity:earnings:company:${company_id}`;
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

    const earnings = await Earnings.findOne({ company_id });
    if (!earnings) {
      res.status(404).json({
        success: false,
        code: 404,
        message: 'Earnings data not found',
        details: { company_id },
      });
      return;
    }

    await setCache(cacheKey, earnings);

    res.status(200).json({
      success: true,
      code: 200,
      fromCache: false,
      data: earnings,
    });
  } catch (error: any) {
    console.error('Get earnings error:', error);
    res.status(500).json({
      success: false,
      code: 500,
      message: 'Internal server error fetching earnings data',
      errorId: `ERR-${Date.now()}`,
    });
  }
};

export const updateEarnings = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { company_id } = req.params;

    const earnings = await Earnings.findOneAndUpdate(
      { company_id },
      req.body,
      { new: true, runValidators: true },
    );

    if (!earnings) {
      res.status(404).json({
        success: false,
        code: 404,
        message: 'Earnings data not found',
        details: { company_id },
      });
      return;
    }

    await invalidateCompanyCache(company_id as string, earnings.ticker_symbol);

    res.status(200).json({
      success: true,
      code: 200,
      message: 'Earnings data updated successfully',
      data: earnings,
    });
  } catch (error: any) {
    if (error.code === 11000) {
      res.status(400).json({
        success: false,
        code: 400,
        message: 'Duplicate entry',
        details: {
          duplicateField: Object.keys(error.keyPattern)[0],
          duplicateValue: error.keyValue[Object.keys(error.keyPattern)[0]],
        },
      });
      return;
    }

    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map((err: any) => ({
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

    console.error('Update earnings error:', error);
    res.status(500).json({
      success: false,
      code: 500,
      message: 'Internal server error updating earnings data',
      errorId: `ERR-${Date.now()}`,
    });
  }
};

export const deleteEarnings = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { company_id } = req.params;

    const earnings = await Earnings.findOneAndDelete({ company_id });
    if (!earnings) {
      res.status(404).json({
        success: false,
        code: 404,
        message: 'Earnings data not found',
        details: { company_id },
      });
      return;
    }

    await invalidateCompanyCache(company_id as string, earnings.ticker_symbol);

    res.status(200).json({
      success: true,
      code: 200,
      message: 'Earnings data deleted successfully',
      data: {
        company_id: earnings.company_id,
        company_name: earnings.company_name,
      },
    });
  } catch (error: any) {
    console.error('Delete earnings error:', error);
    res.status(500).json({
      success: false,
      code: 500,
      message: 'Internal server error deleting earnings data',
      errorId: `ERR-${Date.now()}`,
    });
  }
};

export const createFinancial = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { company_id } = req.body;
    if (!company_id) {
      res.status(400).json({
        success: false,
        code: 400,
        message: 'Company ID is required',
        details: { required: ['company_id'] },
      });
      return;
    }

    const existingFinancial = await Financial.findOne({ company_id });
    if (existingFinancial) {
      res.status(400).json({
        success: false,
        code: 400,
        message: 'Financial data already exists for this company',
        details: { company_id },
      });
      return;
    }

    const financial = await Financial.create(req.body);

    if (
      (financial as any).addRevenueToHistory &&
      typeof (financial as any).addRevenueToHistory === 'function'
    ) {
      (financial as any).addRevenueToHistory('quarterly');
      (financial as any).addNetMarginToHistory('quarterly');
      (financial as any).addDebtToHistory('quarterly');
      await financial.save();
    }

    await invalidateCompanyCache(company_id, req.body.ticker_symbol);

    res.status(201).json({
      success: true,
      code: 201,
      message: 'Financial data created successfully',
      data: financial,
    });
  } catch (error: any) {
    if (error.code === 11000) {
      res.status(400).json({
        success: false,
        code: 400,
        message: 'Duplicate entry',
        details: {
          duplicateField: Object.keys(error.keyPattern)[0],
          duplicateValue: error.keyValue[Object.keys(error.keyPattern)[0]],
        },
      });
      return;
    }

    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map((err: any) => ({
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

    console.error('Create financial error:', error);
    res.status(500).json({
      success: false,
      code: 500,
      message: 'Internal server error creating financial data',
      errorId: `ERR-${Date.now()}`,
    });
  }
};

export const getFinancialByCompanyId = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { company_id } = req.params;

    const cacheKey = `equity:financial:company:${company_id}`;
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

    const financial = await Financial.findOne({ company_id });
    if (!financial) {
      res.status(404).json({
        success: false,
        code: 404,
        message: 'Financial data not found',
        details: { company_id },
      });
      return;
    }

    await setCache(cacheKey, financial);

    res.status(200).json({
      success: true,
      code: 200,
      fromCache: false,
      data: financial,
    });
  } catch (error: any) {
    console.error('Get financial error:', error);
    res.status(500).json({
      success: false,
      code: 500,
      message: 'Internal server error fetching financial data',
      errorId: `ERR-${Date.now()}`,
    });
  }
};

export const updateFinancial = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { company_id } = req.params;

    const financial = await Financial.findOneAndUpdate(
      { company_id },
      req.body,
      { new: true, runValidators: true },
    );

    if (!financial) {
      res.status(404).json({
        success: false,
        code: 404,
        message: 'Financial data not found',
        details: { company_id },
      });
      return;
    }

    await invalidateCompanyCache(company_id as string, financial.ticker_symbol);

    res.status(200).json({
      success: true,
      code: 200,
      message: 'Financial data updated successfully',
      data: financial,
    });
  } catch (error: any) {
    if (error.code === 11000) {
      res.status(400).json({
        success: false,
        code: 400,
        message: 'Duplicate entry',
        details: {
          duplicateField: Object.keys(error.keyPattern)[0],
          duplicateValue: error.keyValue[Object.keys(error.keyPattern)[0]],
        },
      });
      return;
    }

    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map((err: any) => ({
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

    console.error('Update financial error:', error);
    res.status(500).json({
      success: false,
      code: 500,
      message: 'Internal server error updating financial data',
      errorId: `ERR-${Date.now()}`,
    });
  }
};

export const deleteFinancial = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { company_id } = req.params;

    const financial = await Financial.findOneAndDelete({ company_id });
    if (!financial) {
      res.status(404).json({
        success: false,
        code: 404,
        message: 'Financial data not found',
        details: { company_id },
      });
      return;
    }

    await invalidateCompanyCache(company_id as string, financial.ticker_symbol);

    res.status(200).json({
      success: true,
      code: 200,
      message: 'Financial data deleted successfully',
      data: {
        company_id: financial.company_id,
        company_name: financial.company_name,
      },
    });
  } catch (error: any) {
    console.error('Delete financial error:', error);
    res.status(500).json({
      success: false,
      code: 500,
      message: 'Internal server error deleting financial data',
      errorId: `ERR-${Date.now()}`,
    });
  }
};

export const createHolders = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { company_id } = req.body;
    if (!company_id) {
      res.status(400).json({
        success: false,
        code: 400,
        message: 'Company ID is required',
        details: { required: ['company_id'] },
      });
      return;
    }

    const existingHolders = await Holders.findOne({ company_id });
    if (existingHolders) {
      res.status(400).json({
        success: false,
        code: 400,
        message: 'Holders data already exists for this company',
        details: { company_id },
      });
      return;
    }

    const holders = await Holders.create(req.body);

    if (
      (holders as any).addOwnershipToHistory &&
      typeof (holders as any).addOwnershipToHistory === 'function'
    ) {
      (holders as any).addOwnershipToHistory();
      await holders.save();
    }

    await invalidateCompanyCache(company_id, req.body.ticker_symbol);

    res.status(201).json({
      success: true,
      code: 201,
      message: 'Holders data created successfully',
      data: holders,
    });
  } catch (error: any) {
    if (error.code === 11000) {
      res.status(400).json({
        success: false,
        code: 400,
        message: 'Duplicate entry',
        details: {
          duplicateField: Object.keys(error.keyPattern)[0],
          duplicateValue: error.keyValue[Object.keys(error.keyPattern)[0]],
        },
      });
      return;
    }

    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map((err: any) => ({
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

    console.error('Create holders error:', error);
    res.status(500).json({
      success: false,
      code: 500,
      message: 'Internal server error creating holders data',
      errorId: `ERR-${Date.now()}`,
    });
  }
};

export const getHoldersByCompanyId = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { company_id } = req.params;

    const cacheKey = `equity:holders:company:${company_id}`;
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

    const holders = await Holders.findOne({ company_id });
    if (!holders) {
      res.status(404).json({
        success: false,
        code: 404,
        message: 'Holders data not found',
        details: { company_id },
      });
      return;
    }

    await setCache(cacheKey, holders);

    res.status(200).json({
      success: true,
      code: 200,
      fromCache: false,
      data: holders,
    });
  } catch (error: any) {
    console.error('Get holders error:', error);
    res.status(500).json({
      success: false,
      code: 500,
      message: 'Internal server error fetching holders data',
      errorId: `ERR-${Date.now()}`,
    });
  }
};

export const updateHolders = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { company_id } = req.params;

    const holders = await Holders.findOneAndUpdate(
      { company_id },
      req.body,
      { new: true, runValidators: true },
    );

    if (!holders) {
      res.status(404).json({
        success: false,
        code: 404,
        message: 'Holders data not found',
        details: { company_id },
      });
      return;
    }

    await invalidateCompanyCache(company_id as string, holders.ticker_symbol);

    res.status(200).json({
      success: true,
      code: 200,
      message: 'Holders data updated successfully',
      data: holders,
    });
  } catch (error: any) {
    if (error.code === 11000) {
      res.status(400).json({
        success: false,
        code: 400,
        message: 'Duplicate entry',
        details: {
          duplicateField: Object.keys(error.keyPattern)[0],
          duplicateValue: error.keyValue[Object.keys(error.keyPattern)[0]],
        },
      });
      return;
    }

    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map((err: any) => ({
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

    console.error('Update holders error:', error);
    res.status(500).json({
      success: false,
      code: 500,
      message: 'Internal server error updating holders data',
      errorId: `ERR-${Date.now()}`,
    });
  }
};

export const deleteHolders = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { company_id } = req.params;

    const holders = await Holders.findOneAndDelete({ company_id });
    if (!holders) {
      res.status(404).json({
        success: false,
        code: 404,
        message: 'Holders data not found',
        details: { company_id },
      });
      return;
    }

    await invalidateCompanyCache(company_id as string, holders.ticker_symbol);

    res.status(200).json({
      success: true,
      code: 200,
      message: 'Holders data deleted successfully',
      data: {
        company_id: holders.company_id,
        company_name: holders.company_name,
      },
    });
  } catch (error: any) {
    console.error('Delete holders error:', error);
    res.status(500).json({
      success: false,
      code: 500,
      message: 'Internal server error deleting holders data',
      errorId: `ERR-${Date.now()}`,
    });
  }
};

export const getCompanyAllData = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { company_id } = req.params;

    const cacheKey = `equity:company:${company_id}:all`;
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

    const [profile, statistics, dividends, earnings, financial, holders] =
      await Promise.all([
        Profile.findOne({ company_id }),
        Statistics.findOne({ company_id }),
        Dividends.findOne({ company_id }),
        Earnings.findOne({ company_id }),
        Financial.findOne({ company_id }),
        Holders.findOne({ company_id }),
      ]);

    const companyData = {
      profile: profile || null,
      statistics: statistics || null,
      dividends: dividends || null,
      earnings: earnings || null,
      financial: financial || null,
      holders: holders || null,
    };

    await setCache(cacheKey, companyData, 600);

    res.status(200).json({
      success: true,
      code: 200,
      fromCache: false,
      data: companyData,
    });
  } catch (error: any) {
    console.error('Get company all data error:', error);
    res.status(500).json({
      success: false,
      code: 500,
      message: 'Internal server error fetching company data',
      errorId: `ERR-${Date.now()}`,
    });
  }
};

export const createPriceHistory = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { company_id } = req.body;
    if (!company_id) {
      res.status(400).json({
        success: false,
        code: 400,
        message: 'Company ID is required',
        details: { required: ['company_id'] },
      });
      return;
    }

    const existingPriceHistory = await PriceHistory.findOne({ company_id });
    if (existingPriceHistory) {
      res.status(400).json({
        success: false,
        code: 400,
        message: 'Price history already exists for this company',
        details: { company_id },
      });
      return;
    }

    const priceHistory = await PriceHistory.create(req.body);

    await invalidateCompanyCache(company_id, req.body.ticker_symbol);

    res.status(201).json({
      success: true,
      code: 201,
      message: 'Price history created successfully',
      data: priceHistory,
    });
  } catch (error: any) {
    if (error.code === 11000) {
      res.status(400).json({
        success: false,
        code: 400,
        message: 'Duplicate entry',
        details: {
          duplicateField: Object.keys(error.keyPattern)[0],
          duplicateValue: error.keyValue[Object.keys(error.keyPattern)[0]],
        },
      });
      return;
    }

    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map((err: any) => ({
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

    console.error('Create price history error:', error);
    res.status(500).json({
      success: false,
      code: 500,
      message: 'Internal server error creating price history',
      errorId: `ERR-${Date.now()}`,
    });
  }
};

export const updatePriceHistory = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { company_id } = req.params;

    const priceHistory = await PriceHistory.findOneAndUpdate(
      { company_id },
      req.body,
      { new: true, runValidators: true },
    );

    if (!priceHistory) {
      res.status(404).json({
        success: false,
        code: 404,
        message: 'Price history not found',
        details: { company_id },
      });
      return;
    }

    await invalidateCompanyCache(company_id as string, priceHistory.ticker_symbol);
    publishStockUpdate({ company_id: company_id as string, ticker_symbol: priceHistory.ticker_symbol }, priceHistory);

    res.status(200).json({
      success: true,
      code: 200,
      message: 'Price history updated successfully',
      data: priceHistory,
    });
  } catch (error: any) {
    if (error.code === 11000) {
      res.status(400).json({
        success: false,
        code: 400,
        message: 'Duplicate entry',
        details: {
          duplicateField: Object.keys(error.keyPattern)[0],
          duplicateValue: error.keyValue[Object.keys(error.keyPattern)[0]],
        },
      });
      return;
    }

    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map((err: any) => ({
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

    console.error('Update price history error:', error);
    res.status(500).json({
      success: false,
      code: 500,
      message: 'Internal server error updating price history',
      errorId: `ERR-${Date.now()}`,
    });
  }
};

export const getCompanyPriceHistory = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { company_id } = req.params;

    const cacheKey = `equity:priceHistory:company:${company_id}`;
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

    const priceHistory = await PriceHistory.findOne({ company_id });
    if (!priceHistory) {
      res.status(404).json({
        success: false,
        code: 404,
        message: 'Price history not found',
        details: { company_id },
      });
      return;
    }

    await setCache(cacheKey, priceHistory);

    res.status(200).json({
      success: true,
      code: 200,
      fromCache: false,
      data: priceHistory,
    });
  } catch (error: any) {
    console.error('Get price history error:', error);
    res.status(500).json({
      success: false,
      code: 500,
      message: 'Internal server error fetching price history',
      errorId: `ERR-${Date.now()}`,
    });
  }
};

export const getCompanyPriceHistoryByLast24Hours = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { company_id } = req.params;
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - 24 * 60 * 60 * 1000);

    const cacheKey = `equity:priceHistory:company:${company_id}:24h`;
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

    const priceHistory = await (PriceHistory as any).findOne(
      { company_id },
      {
        company_id: 1,
        company_name: 1,
        ticker_symbol: 1,
        history: {
          $filter: {
            input: '$history',
            as: 'entry',
            cond: {
              $and: [
                { $gte: ['$$entry.date', startDate] },
                { $lte: ['$$entry.date', endDate] },
              ],
            },
          },
        },
      },
    ).sort({ 'history.date': 1 });

    if (!priceHistory) {
      res.status(404).json({
        success: false,
        code: 404,
        message: 'Price history not found',
        details: { company_id },
      });
      return;
    }

    await setCache(cacheKey, priceHistory, 300);

    res.status(200).json({
      success: true,
      code: 200,
      fromCache: false,
      period: '24h',
      startDate,
      endDate,
      data: priceHistory,
    });
  } catch (error: any) {
    console.error('Get 24h price history error:', error);
    res.status(500).json({
      success: false,
      code: 500,
      message: 'Internal server error fetching 24h price history',
      errorId: `ERR-${Date.now()}`,
    });
  }
};

export const getCompanyPriceHistoryByLast1Week = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { company_id } = req.params;
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000);

    const cacheKey = `equity:priceHistory:company:${company_id}:1w`;
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

    const priceHistory = await (PriceHistory as any).findOne(
      { company_id },
      {
        company_id: 1,
        company_name: 1,
        ticker_symbol: 1,
        history: {
          $filter: {
            input: '$history',
            as: 'entry',
            cond: {
              $and: [
                { $gte: ['$$entry.date', startDate] },
                { $lte: ['$$entry.date', endDate] },
              ],
            },
          },
        },
      },
    ).sort({ 'history.date': 1 });

    if (!priceHistory) {
      res.status(404).json({
        success: false,
        code: 404,
        message: 'Price history not found',
        details: { company_id },
      });
      return;
    }

    await setCache(cacheKey, priceHistory, 1800);

    res.status(200).json({
      success: true,
      code: 200,
      fromCache: false,
      period: '1w',
      startDate,
      endDate,
      data: priceHistory,
    });
  } catch (error: any) {
    console.error('Get 1 week price history error:', error);
    res.status(500).json({
      success: false,
      code: 500,
      message: 'Internal server error fetching 1 week price history',
      errorId: `ERR-${Date.now()}`,
    });
  }
};

export const getCompanyPriceHistoryByLast3Months = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { company_id } = req.params;
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - 90 * 24 * 60 * 60 * 1000);

    const cacheKey = `equity:priceHistory:company:${company_id}:3m`;
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

    const priceHistory = await (PriceHistory as any).findOne(
      { company_id },
      {
        company_id: 1,
        company_name: 1,
        ticker_symbol: 1,
        history: {
          $filter: {
            input: '$history',
            as: 'entry',
            cond: {
              $and: [
                { $gte: ['$$entry.date', startDate] },
                { $lte: ['$$entry.date', endDate] },
              ],
            },
          },
        },
      },
    ).sort({ 'history.date': 1 });

    if (!priceHistory) {
      res.status(404).json({
        success: false,
        code: 404,
        message: 'Price history not found',
        details: { company_id },
      });
      return;
    }

    await setCache(cacheKey, priceHistory, 3600);

    res.status(200).json({
      success: true,
      code: 200,
      fromCache: false,
      period: '3m',
      startDate,
      endDate,
      data: priceHistory,
    });
  } catch (error: any) {
    console.error('Get 3 months price history error:', error);
    res.status(500).json({
      success: false,
      code: 500,
      message: 'Internal server error fetching 3 months price history',
      errorId: `ERR-${Date.now()}`,
    });
  }
};

export const getCompanyPriceHistoryByLast6Months = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { company_id } = req.params;
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - 180 * 24 * 60 * 60 * 1000);

    const cacheKey = `equity:priceHistory:company:${company_id}:6m`;
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

    const priceHistory = await (PriceHistory as any).findOne(
      { company_id },
      {
        company_id: 1,
        company_name: 1,
        ticker_symbol: 1,
        history: {
          $filter: {
            input: '$history',
            as: 'entry',
            cond: {
              $and: [
                { $gte: ['$$entry.date', startDate] },
                { $lte: ['$$entry.date', endDate] },
              ],
            },
          },
        },
      },
    ).sort({ 'history.date': 1 });

    if (!priceHistory) {
      res.status(404).json({
        success: false,
        code: 404,
        message: 'Price history not found',
        details: { company_id },
      });
      return;
    }

    await setCache(cacheKey, priceHistory, 3600);

    res.status(200).json({
      success: true,
      code: 200,
      fromCache: false,
      period: '6m',
      startDate,
      endDate,
      data: priceHistory,
    });
  } catch (error: any) {
    console.error('Get 6 months price history error:', error);
    res.status(500).json({
      success: false,
      code: 500,
      message: 'Internal server error fetching 6 months price history',
      errorId: `ERR-${Date.now()}`,
    });
  }
};

export const getCompanyPriceHistoryByYearToDate = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { company_id } = req.params;
    const endDate = new Date();
    const startDate = new Date(endDate.getFullYear(), 0, 1);

    const cacheKey = `equity:priceHistory:company:${company_id}:ytd`;
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

    const priceHistory = await (PriceHistory as any).findOne(
      { company_id },
      {
        company_id: 1,
        company_name: 1,
        ticker_symbol: 1,
        history: {
          $filter: {
            input: '$history',
            as: 'entry',
            cond: {
              $and: [
                { $gte: ['$$entry.date', startDate] },
                { $lte: ['$$entry.date', endDate] },
              ],
            },
          },
        },
      },
    ).sort({ 'history.date': 1 });

    if (!priceHistory) {
      res.status(404).json({
        success: false,
        code: 404,
        message: 'Price history not found',
        details: { company_id },
      });
      return;
    }

    await setCache(cacheKey, priceHistory, 3600);

    res.status(200).json({
      success: true,
      code: 200,
      fromCache: false,
      period: 'ytd',
      startDate,
      endDate,
      data: priceHistory,
    });
  } catch (error: any) {
    console.error('Get YTD price history error:', error);
    res.status(500).json({
      success: false,
      code: 500,
      message: 'Internal server error fetching YTD price history',
      errorId: `ERR-${Date.now()}`,
    });
  }
};

export const getCompanyPriceHistoryByLast1Year = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { company_id } = req.params;
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - 365 * 24 * 60 * 60 * 1000);

    const cacheKey = `equity:priceHistory:company:${company_id}:1y`;
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

    const priceHistory = await (PriceHistory as any).findOne(
      { company_id },
      {
        company_id: 1,
        company_name: 1,
        ticker_symbol: 1,
        history: {
          $filter: {
            input: '$history',
            as: 'entry',
            cond: {
              $and: [
                { $gte: ['$$entry.date', startDate] },
                { $lte: ['$$entry.date', endDate] },
              ],
            },
          },
        },
      },
    ).sort({ 'history.date': 1 });

    if (!priceHistory) {
      res.status(404).json({
        success: false,
        code: 404,
        message: 'Price history not found',
        details: { company_id },
      });
      return;
    }

    await setCache(cacheKey, priceHistory, 7200);

    res.status(200).json({
      success: true,
      code: 200,
      fromCache: false,
      period: '1y',
      startDate,
      endDate,
      data: priceHistory,
    });
  } catch (error: any) {
    console.error('Get 1 year price history error:', error);
    res.status(500).json({
      success: false,
      code: 500,
      message: 'Internal server error fetching 1 year price history',
      errorId: `ERR-${Date.now()}`,
    });
  }
};

export const getCompanyPriceHistoryByLast2Years = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { company_id } = req.params;
    const endDate = new Date();
    const startDate = new Date(
      endDate.getTime() - 2 * 365 * 24 * 60 * 60 * 1000,
    );

    const cacheKey = `equity:priceHistory:company:${company_id}:2y`;
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

    const priceHistory = await (PriceHistory as any).findOne(
      { company_id },
      {
        company_id: 1,
        company_name: 1,
        ticker_symbol: 1,
        history: {
          $filter: {
            input: '$history',
            as: 'entry',
            cond: {
              $and: [
                { $gte: ['$$entry.date', startDate] },
                { $lte: ['$$entry.date', endDate] },
              ],
            },
          },
        },
      },
    ).sort({ 'history.date': 1 });

    if (!priceHistory) {
      res.status(404).json({
        success: false,
        code: 404,
        message: 'Price history not found',
        details: { company_id },
      });
      return;
    }

    await setCache(cacheKey, priceHistory, 14400);

    res.status(200).json({
      success: true,
      code: 200,
      fromCache: false,
      period: '2y',
      startDate,
      endDate,
      data: priceHistory,
    });
  } catch (error: any) {
    console.error('Get 2 years price history error:', error);
    res.status(500).json({
      success: false,
      code: 500,
      message: 'Internal server error fetching 2 years price history',
      errorId: `ERR-${Date.now()}`,
    });
  }
};

export const getCompanyPriceHistoryByLast5Years = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { company_id } = req.params;
    const endDate = new Date();
    const startDate = new Date(
      endDate.getTime() - 5 * 365 * 24 * 60 * 60 * 1000,
    );

    const cacheKey = `equity:priceHistory:company:${company_id}:5y`;
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

    const priceHistory = await (PriceHistory as any).findOne(
      { company_id },
      {
        company_id: 1,
        company_name: 1,
        ticker_symbol: 1,
        history: {
          $filter: {
            input: '$history',
            as: 'entry',
            cond: {
              $and: [
                { $gte: ['$$entry.date', startDate] },
                { $lte: ['$$entry.date', endDate] },
              ],
            },
          },
        },
      },
    ).sort({ 'history.date': 1 });

    if (!priceHistory) {
      res.status(404).json({
        success: false,
        code: 404,
        message: 'Price history not found',
        details: { company_id },
      });
      return;
    }

    await setCache(cacheKey, priceHistory, 28800);

    res.status(200).json({
      success: true,
      code: 200,
      fromCache: false,
      period: '5y',
      startDate,
      endDate,
      data: priceHistory,
    });
  } catch (error: any) {
    console.error('Get 5 years price history error:', error);
    res.status(500).json({
      success: false,
      code: 500,
      message: 'Internal server error fetching 5 years price history',
      errorId: `ERR-${Date.now()}`,
    });
  }
};

export const getCompanyPriceHistoryByLast10Years = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { company_id } = req.params;
    const endDate = new Date();
    const startDate = new Date(
      endDate.getTime() - 10 * 365 * 24 * 60 * 60 * 1000,
    );

    const cacheKey = `equity:priceHistory:company:${company_id}:10y`;
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

    const priceHistory = await (PriceHistory as any).findOne(
      { company_id },
      {
        company_id: 1,
        company_name: 1,
        ticker_symbol: 1,
        history: {
          $filter: {
            input: '$history',
            as: 'entry',
            cond: {
              $and: [
                { $gte: ['$$entry.date', startDate] },
                { $lte: ['$$entry.date', endDate] },
              ],
            },
          },
        },
      },
    ).sort({ 'history.date': 1 });

    if (!priceHistory) {
      res.status(404).json({
        success: false,
        code: 404,
        message: 'Price history not found',
        details: { company_id },
      });
      return;
    }

    await setCache(cacheKey, priceHistory, 43200);

    res.status(200).json({
      success: true,
      code: 200,
      fromCache: false,
      period: '10y',
      startDate,
      endDate,
      data: priceHistory,
    });
  } catch (error: any) {
    console.error('Get 10 years price history error:', error);
    res.status(500).json({
      success: false,
      code: 500,
      message: 'Internal server error fetching 10 years price history',
      errorId: `ERR-${Date.now()}`,
    });
  }
};

export const getCompanyAllTimePriceHistory = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { company_id } = req.params;

    const cacheKey = `equity:priceHistory:company:${company_id}:alltime`;
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

    const priceHistory = await (PriceHistory as any).findOne(
      { company_id },
      {
        company_id: 1,
        company_name: 1,
        ticker_symbol: 1,
        history: 1,
      },
    ).sort({ 'history.date': 1 });

    if (!priceHistory) {
      res.status(404).json({
        success: false,
        code: 404,
        message: 'Price history not found',
        details: { company_id },
      });
      return;
    }

    await setCache(cacheKey, priceHistory, 86400);

    res.status(200).json({
      success: true,
      code: 200,
      fromCache: false,
      period: 'alltime',
      data: priceHistory,
    });
  } catch (error: any) {
    console.error('Get all time price history error:', error);
    res.status(500).json({
      success: false,
      code: 500,
      message: 'Internal server error fetching all time price history',
      errorId: `ERR-${Date.now()}`,
    });
  }
};

export const deletePriceHistory = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { company_id } = req.params;

    const priceHistory = await PriceHistory.findOneAndDelete({ company_id });
    if (!priceHistory) {
      res.status(404).json({
        success: false,
        code: 404,
        message: 'Price history not found',
        details: { company_id },
      });
      return;
    }

    await invalidateCompanyCache(company_id as string, priceHistory.ticker_symbol);

    res.status(200).json({
      success: true,
      code: 200,
      message: 'Price history deleted successfully',
      data: {
        company_id: priceHistory.company_id,
        company_name: priceHistory.company_name,
      },
    });
  } catch (error: any) {
    console.error('Delete price history error:', error);
    res.status(500).json({
      success: false,
      code: 500,
      message: 'Internal server error deleting price history',
      errorId: `ERR-${Date.now()}`,
    });
  }
};

export const addPriceEntry = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { company_id } = req.params;
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

    const priceHistory = await PriceHistory.findOne({ company_id });
    if (!priceHistory) {
      res.status(404).json({
        success: false,
        code: 404,
        message: 'Price history not found',
        details: { company_id },
      });
      return;
    }

    (priceHistory as any).history.push({
      date: new Date(date),
      price: String(price),
    });

    (priceHistory as any).history.sort(
      (a: any, b: any) => b.date - a.date,
    );

    const MAX_HISTORY_ENTRIES = 5000;
    if ((priceHistory as any).history.length > MAX_HISTORY_ENTRIES) {
      (priceHistory as any).history = (priceHistory as any).history.slice(
        0,
        MAX_HISTORY_ENTRIES,
      );
    }

    await priceHistory.save();
    await invalidateCompanyCache(company_id as string, priceHistory.ticker_symbol);
    publishStockUpdate(
      { company_id: company_id as string, ticker_symbol: priceHistory.ticker_symbol },
      { event: 'price_entry_added', newEntry: { date: new Date(date), price: String(price) } }
    );

    res.status(200).json({
      success: true,
      code: 200,
      message: 'Price entry added successfully',
      data: {
        company_id: priceHistory.company_id,
        company_name: priceHistory.company_name,
        newEntry: {
          date: new Date(date),
          price: String(price),
        },
        totalEntries: (priceHistory as any).history.length,
      },
    });
  } catch (error: any) {
    console.error('Add price entry error:', error);
    res.status(500).json({
      success: false,
      code: 500,
      message: 'Internal server error adding price entry',
      errorId: `ERR-${Date.now()}`,
    });
  }
};

export const updateLatestPrice = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { company_id } = req.params;
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

    const priceHistory = await PriceHistory.findOne({ company_id });

    if (!priceHistory) {
      res.status(404).json({
        success: false,
        code: 404,
        message: 'Price history not found',
        details: { company_id },
      });
      return;
    }

    const newEntry = {
      date: new Date(),
      price: String(price),
    };

    (priceHistory as any).history.push(newEntry);

    const MAX_HISTORY_ENTRIES = 5000;
    if ((priceHistory as any).history.length > MAX_HISTORY_ENTRIES) {
      (priceHistory as any).history = (priceHistory as any).history.slice(-MAX_HISTORY_ENTRIES);
    }

    await priceHistory.save();
    await invalidateCompanyCache(company_id as string, priceHistory.ticker_symbol);
    publishStockUpdate(
      { company_id: company_id as string, ticker_symbol: priceHistory.ticker_symbol },
      { event: 'latest_price_updated', latestPrice: newEntry }
    );

    res.status(200).json({
      success: true,
      code: 200,
      message: 'Latest price updated successfully',
      data: {
        company_id: priceHistory.company_id,
        company_name: priceHistory.company_name,
        latestPrice: newEntry,
        totalEntries: (priceHistory as any).history.length,
      },
    });
  } catch (error: any) {
    console.error('Update latest price error:', error);
    res.status(500).json({
      success: false,
      code: 500,
      message: 'Internal server error updating latest price',
      errorId: `ERR-${Date.now()}`,
    });
  }
};

export const getGSEMarketStatus = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const TRADING_START = { hour: 10, minute: 0 };
    const TRADING_END = { hour: 15, minute: 0 };
    const TIMEZONE = 'Africa/Accra';

    const PUBLIC_HOLIDAYS = [
      { month: 1, day: 1 },
      { month: 1, day: 7 },
      { month: 3, day: 6 },
      { month: 3, day: 20 },
      { month: 3, day: 21 },
      { month: 4, day: 3 },
      { month: 4, day: 6 },
      { month: 5, day: 1 },
      { month: 5, day: 27 },
      { month: 7, day: 1 },
      { month: 9, day: 21 },
      { month: 12, day: 4 },
      { month: 12, day: 25 },
      { month: 12, day: 26 },
    ];

    const isPublicHoliday = (date: Date = new Date()): boolean => {
      const ghanaDate = new Date(
        date.toLocaleString('en-US', { timeZone: TIMEZONE }),
      );
      const month = ghanaDate.getMonth() + 1;
      const day = ghanaDate.getDate();
      return PUBLIC_HOLIDAYS.some(
        (holiday) => holiday.month === month && holiday.day === day,
      );
    };

    const isTradingDay = (): boolean => {
      const now = new Date();
      const ghanaDate = new Date(
        now.toLocaleString('en-US', { timeZone: TIMEZONE }),
      );
      const day = ghanaDate.getDay();
      const isWeekday = day >= 1 && day <= 5;
      const isHoliday = isPublicHoliday(now);
      return isWeekday && !isHoliday;
    };

    const getMarketStatus = (): { status: string; message: string } => {
      const now = new Date();
      const ghanaDate = new Date(
        now.toLocaleString('en-US', { timeZone: TIMEZONE }),
      );
      const day = ghanaDate.getDay();
      const hours = ghanaDate.getHours();
      const minutes = ghanaDate.getMinutes();
      const currentTimeInMinutes = hours * 60 + minutes;

      const openTimeInMinutes = TRADING_START.hour * 60 + TRADING_START.minute;
      const closeTimeInMinutes = TRADING_END.hour * 60 + TRADING_END.minute;

      let status = 'closed';
      let message = '';

      if (!isTradingDay()) {
        if (day === 0) {
          message = 'Market closed - Sunday';
        } else if (day === 6) {
          message = 'Market closed - Saturday';
        } else if (isPublicHoliday(now)) {
          message = 'Market closed - Public Holiday';
        }
        return { status, message };
      }

      if (
        currentTimeInMinutes >= openTimeInMinutes &&
        currentTimeInMinutes < closeTimeInMinutes
      ) {
        status = 'open';
        message = 'Market open - Regular trading hours';
      } else if (currentTimeInMinutes < openTimeInMinutes) {
        status = 'closed';
        message = 'Market closed - Pre-market';
      } else if (currentTimeInMinutes >= closeTimeInMinutes) {
        status = 'closed';
        message = 'Market closed - After market hours';
      }

      return { status, message };
    };

    const status = getMarketStatus();

    res.status(200).json({
      success: true,
      code: 200,
      data: status,
    });
  } catch (error: any) {
    console.error('Get GSE market status error:', error);
    res.status(500).json({
      success: false,
      code: 500,
      message: 'Error fetching GSE market status',
      errorId: `ERR-${Date.now()}`,
    });
  }
};

export const manualGSEStatusUpdate = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const TRADING_START = { hour: 10, minute: 0 };
    const TRADING_END = { hour: 15, minute: 0 };
    const TIMEZONE = 'Africa/Accra';

    const PUBLIC_HOLIDAYS = [
      { month: 1, day: 1 },
      { month: 1, day: 7 },
      { month: 3, day: 6 },
      { month: 3, day: 20 },
      { month: 3, day: 21 },
      { month: 4, day: 3 },
      { month: 4, day: 6 },
      { month: 5, day: 1 },
      { month: 5, day: 27 },
      { month: 7, day: 1 },
      { month: 9, day: 21 },
      { month: 12, day: 4 },
      { month: 12, day: 25 },
      { month: 12, day: 26 },
    ];

    const isPublicHoliday = (date: Date = new Date()): boolean => {
      const ghanaDate = new Date(
        date.toLocaleString('en-US', { timeZone: TIMEZONE }),
      );
      const month = ghanaDate.getMonth() + 1;
      const day = ghanaDate.getDate();
      return PUBLIC_HOLIDAYS.some(
        (holiday) => holiday.month === month && holiday.day === day,
      );
    };

    const isTradingDay = (): boolean => {
      const now = new Date();
      const ghanaDate = new Date(
        now.toLocaleString('en-US', { timeZone: TIMEZONE }),
      );
      const day = ghanaDate.getDay();
      const isWeekday = day >= 1 && day <= 5;
      const isHoliday = isPublicHoliday(now);
      return isWeekday && !isHoliday;
    };

    const getMarketStatus = (): { status: string; message: string } => {
      const now = new Date();
      const ghanaDate = new Date(
        now.toLocaleString('en-US', { timeZone: TIMEZONE }),
      );
      const day = ghanaDate.getDay();
      const hours = ghanaDate.getHours();
      const minutes = ghanaDate.getMinutes();
      const currentTimeInMinutes = hours * 60 + minutes;

      const openTimeInMinutes = TRADING_START.hour * 60 + TRADING_START.minute;
      const closeTimeInMinutes = TRADING_END.hour * 60 + TRADING_END.minute;

      let status = 'closed';
      let message = '';

      if (!isTradingDay()) {
        if (day === 0) {
          message = 'Market closed - Sunday';
        } else if (day === 6) {
          message = 'Market closed - Saturday';
        } else if (isPublicHoliday(now)) {
          message = 'Market closed - Public Holiday';
        }
        return { status, message };
      }

      if (
        currentTimeInMinutes >= openTimeInMinutes &&
        currentTimeInMinutes < closeTimeInMinutes
      ) {
        status = 'open';
        message = 'Market open - Regular trading hours';
      } else if (currentTimeInMinutes < openTimeInMinutes) {
        status = 'closed';
        message = 'Market closed - Pre-market';
      } else if (currentTimeInMinutes >= closeTimeInMinutes) {
        status = 'closed';
        message = 'Market closed - After market hours';
      }

      return { status, message };
    };

    const { status, message } = getMarketStatus();

    const Statistics = require('../models/stocks.model').Statistics;

    await Statistics.updateMany(
      {},
      {
        $set: {
          'key_statistics.status': status,
          'key_statistics.status_message': message,
        },
      },
    );

    res.status(200).json({
      success: true,
      code: 200,
      message: 'GSE market status updated successfully',
      data: { status, message },
    });
  } catch (error: any) {
    console.error('Manual GSE status update error:', error);
    res.status(500).json({
      success: false,
      code: 500,
      message: 'Error updating GSE market status',
      errorId: `ERR-${Date.now()}`,
    });
  }
};

export const getTopGainersByExchange = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { exchangeSymbol } = req.params;
    const { limit = 20 } = req.query;

    const cacheKey = `equity:exchange:${exchangeSymbol}:top-gainers:${limit}`;
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

    const profiles = await Profile.find({ 
      'about.exchange_symbol': { $regex: new RegExp(`^${exchangeSymbol}$`, 'i') }
    }).select('company_id about.company_name about.ticker_symbol about.industry');

    if (!profiles.length) {
      res.status(404).json({
        success: false,
        code: 404,
        message: 'No companies found for this exchange',
        details: { exchangeSymbol },
      });
      return;
    }

    const companyIds = profiles.map(p => p.company_id);
    
    const statistics = await Statistics.find({
      company_id: { $in: companyIds },
      'key_statistics.percentage_change': { $exists: true, $ne: null }
    }).select('company_id company_name ticker_symbol key_statistics');

    const gainers = profiles
      .map(profile => {
        const stats = statistics.find(s => s.company_id === profile.company_id);
        if (!stats || !stats.key_statistics || stats.key_statistics.percentage_change === undefined) {
          return null;
        }
        
        return {
          company_id: profile.company_id,
          company_name: profile.about.company_name,
          ticker_symbol: profile.about.ticker_symbol,
          industry: profile.about.industry,
          exchange_symbol: profile.about.exchange_symbol,
          current_price: stats.key_statistics.current_price,
          percentage_change: stats.key_statistics.percentage_change,
          volume: stats.key_statistics.volume,
          market_cap: stats.key_statistics.market_capitalization,
        };
      })
      .filter(item => item !== null && item.percentage_change > 0)
      .sort((a, b) => (b?.percentage_change || 0) - (a?.percentage_change || 0))
      .slice(0, Number(limit));

    await setCache(cacheKey, gainers, 300);

    res.status(200).json({
      success: true,
      code: 200,
      fromCache: false,
      data: {
        exchange: exchangeSymbol.toUpperCase(),
        total: gainers.length,
        gainers,
      },
    });
  } catch (error: any) {
    console.error('Get top gainers error:', error);
    res.status(500).json({
      success: false,
      code: 500,
      message: 'Internal server error fetching top gainers',
      errorId: `ERR-${Date.now()}`,
    });
  }
};

export const getTopLosersByExchange = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { exchangeSymbol } = req.params;
    const { limit = 20 } = req.query;

    const cacheKey = `equity:exchange:${exchangeSymbol}:top-losers:${limit}`;
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

    const profiles = await Profile.find({ 
      'about.exchange_symbol': { $regex: new RegExp(`^${exchangeSymbol}$`, 'i') }
    }).select('company_id about.company_name about.ticker_symbol about.industry');

    if (!profiles.length) {
      res.status(404).json({
        success: false,
        code: 404,
        message: 'No companies found for this exchange',
        details: { exchangeSymbol },
      });
      return;
    }

    const companyIds = profiles.map(p => p.company_id);
    
    const statistics = await Statistics.find({
      company_id: { $in: companyIds },
      'key_statistics.percentage_change': { $exists: true, $ne: null }
    }).select('company_id company_name ticker_symbol key_statistics');

    const losers = profiles
      .map(profile => {
        const stats = statistics.find(s => s.company_id === profile.company_id);
        if (!stats || !stats.key_statistics || stats.key_statistics.percentage_change === undefined) {
          return null;
        }
        
        return {
          company_id: profile.company_id,
          company_name: profile.about.company_name,
          ticker_symbol: profile.about.ticker_symbol,
          industry: profile.about.industry,
          exchange_symbol: profile.about.exchange_symbol,
          current_price: stats.key_statistics.current_price,
          percentage_change: stats.key_statistics.percentage_change,
          volume: stats.key_statistics.volume,
          market_cap: stats.key_statistics.market_capitalization,
        };
      })
      .filter(item => item !== null && item.percentage_change < 0)
      .sort((a, b) => (a?.percentage_change || 0) - (b?.percentage_change || 0))
      .slice(0, Number(limit));

    await setCache(cacheKey, losers, 300);

    res.status(200).json({
      success: true,
      code: 200,
      fromCache: false,
      data: {
        exchange: exchangeSymbol.toUpperCase(),
        total: losers.length,
        losers,
      },
    });
  } catch (error: any) {
    console.error('Get top losers error:', error);
    res.status(500).json({
      success: false,
      code: 500,
      message: 'Internal server error fetching top losers',
      errorId: `ERR-${Date.now()}`,
    });
  }
};

export const getPerformanceByIndustry = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { exchangeSymbol } = req.params;

    const cacheKey = `equity:exchange:${exchangeSymbol}:industry-performance`;
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

    const profiles = await Profile.find({ 
      'about.exchange_symbol': { $regex: new RegExp(`^${exchangeSymbol}$`, 'i') }
    }).select('company_id about.industry about.company_name about.ticker_symbol');

    if (!profiles.length) {
      res.status(404).json({
        success: false,
        code: 404,
        message: 'No companies found for this exchange',
        details: { exchangeSymbol },
      });
      return;
    }

    const companyIds = profiles.map(p => p.company_id);
    
    const statistics = await Statistics.find({
      company_id: { $in: companyIds },
      'key_statistics.percentage_change': { $exists: true, $ne: null }
    }).select('company_id key_statistics');

    const statsMap = new Map();
    statistics.forEach(stat => {
      statsMap.set(stat.company_id, stat.key_statistics);
    });

    const industryMap = new Map();

    profiles.forEach(profile => {
      const industry = profile.about.industry || 'Unknown';
      const stats = statsMap.get(profile.company_id);
      
      if (!stats || stats.percentage_change === undefined) {
        return;
      }

      if (!industryMap.has(industry)) {
        industryMap.set(industry, {
          industry,
          companies: [],
          total_companies: 0,
          avg_percentage_change: 0,
          total_volume: 0,
          gainers_count: 0,
          losers_count: 0,
          unchanged_count: 0,
          market_cap_sum: 0,
        });
      }

      const industryData = industryMap.get(industry);
      industryData.companies.push({
        company_name: profile.about.company_name,
        ticker_symbol: profile.about.ticker_symbol,
        current_price: stats.current_price,
        percentage_change: stats.percentage_change,
        volume: stats.volume,
        market_cap: stats.market_capitalization,
      });

      industryData.total_companies++;
      industryData.avg_percentage_change += stats.percentage_change;
      industryData.total_volume += stats.volume || 0;
      
      if (stats.percentage_change > 0) industryData.gainers_count++;
      else if (stats.percentage_change < 0) industryData.losers_count++;
      else industryData.unchanged_count++;

      if (stats.market_capitalization) {
        const marketCapValue = parseMarketCap(stats.market_capitalization);
        industryData.market_cap_sum += marketCapValue;
      }
    });

    const industries = Array.from(industryMap.values()).map(industry => {
      industry.avg_percentage_change = industry.avg_percentage_change / industry.total_companies;
      
      industry.companies.sort((a, b) => 
        (b.percentage_change || 0) - (a.percentage_change || 0)
      );
      
      industry.companies = industry.companies.slice(0, 10);
      
      return industry;
    });

    industries.sort((a, b) => b.avg_percentage_change - a.avg_percentage_change);

    const response = {
      exchange: exchangeSymbol.toUpperCase(),
      last_updated: new Date(),
      summary: {
        total_industries: industries.length,
        total_companies: profiles.length,
        industries_with_data: industries.length,
      },
      industries: industries,
    };

    await setCache(cacheKey, response, 1800);

    res.status(200).json({
      success: true,
      code: 200,
      fromCache: false,
      data: response,
    });
  } catch (error: any) {
    console.error('Get industry performance error:', error);
    res.status(500).json({
      success: false,
      code: 500,
      message: 'Internal server error fetching industry performance',
      errorId: `ERR-${Date.now()}`,
    });
  }
};

const parseMarketCap = (marketCap: string): number => {
  if (!marketCap) return 0;
  
  const value = parseFloat(marketCap.replace(/[^0-9.-]/g, ''));
  if (marketCap.includes('B') || marketCap.includes('b')) {
    return value * 1000000000;
  } else if (marketCap.includes('M') || marketCap.includes('m')) {
    return value * 1000000;
  } else if (marketCap.includes('K') || marketCap.includes('k')) {
    return value * 1000;
  }
  return value;
};

export const getMarketMoversByExchange = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { exchangeSymbol } = req.params;
    const { gainersLimit = 10, losersLimit = 10 } = req.query;

    const cacheKey = `equity:exchange:${exchangeSymbol}:market-movers:${gainersLimit}:${losersLimit}`;
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

    const profiles = await Profile.find({ 
      'about.exchange_symbol': { $regex: new RegExp(`^${exchangeSymbol}$`, 'i') }
    }).select('company_id about.company_name about.ticker_symbol about.industry');

    if (!profiles.length) {
      res.status(404).json({
        success: false,
        code: 404,
        message: 'No companies found for this exchange',
        details: { exchangeSymbol },
      });
      return;
    }

    const companyIds = profiles.map(p => p.company_id);
    
    const statistics = await Statistics.find({
      company_id: { $in: companyIds },
      'key_statistics.percentage_change': { $exists: true, $ne: null }
    }).select('company_id company_name ticker_symbol key_statistics');

    const stocksWithPerformance = profiles
      .map(profile => {
        const stats = statistics.find(s => s.company_id === profile.company_id);
        if (!stats || !stats.key_statistics || stats.key_statistics.percentage_change === undefined) {
          return null;
        }
        
        return {
          company_id: profile.company_id,
          company_name: profile.about.company_name,
          ticker_symbol: profile.about.ticker_symbol,
          industry: profile.about.industry,
          exchange_symbol: profile.about.exchange_symbol,
          current_price: stats.key_statistics.current_price,
          percentage_change: stats.key_statistics.percentage_change,
          volume: stats.key_statistics.volume,
          market_cap: stats.key_statistics.market_capitalization,
        };
      })
      .filter(item => item !== null);

    const gainers = stocksWithPerformance
      .filter(item => item!.percentage_change > 0)
      .sort((a, b) => (b?.percentage_change || 0) - (a?.percentage_change || 0))
      .slice(0, Number(gainersLimit));

    const losers = stocksWithPerformance
      .filter(item => item!.percentage_change < 0)
      .sort((a, b) => (a?.percentage_change || 0) - (b?.percentage_change || 0))
      .slice(0, Number(losersLimit));

    const response = {
      exchange: exchangeSymbol.toUpperCase(),
      last_updated: new Date(),
      summary: {
        total_stocks_tracked: stocksWithPerformance.length,
        total_gainers: stocksWithPerformance.filter(s => s!.percentage_change > 0).length,
        total_losers: stocksWithPerformance.filter(s => s!.percentage_change < 0).length,
        total_unchanged: stocksWithPerformance.filter(s => s!.percentage_change === 0).length,
      },
      gainers,
      losers,
    };

    await setCache(cacheKey, response, 300);

    res.status(200).json({
      success: true,
      code: 200,
      fromCache: false,
      data: response,
    });
  } catch (error: any) {
    console.error('Get market movers error:', error);
    res.status(500).json({
      success: false,
      code: 500,
      message: 'Internal server error fetching market movers',
      errorId: `ERR-${Date.now()}`,
    });
  }
};

export const bulkCreateProfiles = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { companies } = req.body;
    
    if (!companies || !Array.isArray(companies) || companies.length === 0) {
      res.status(400).json({
        success: false,
        code: 400,
        message: 'Companies array is required and must not be empty',
        details: { required: ['companies'] },
      });
      return;
    }

    const result: BulkCreateResult = {
      successful: [],
      failed: [],
    };

    for (const company of companies) {
      try {
        const { company_id } = company;
        
        if (!company_id) {
          result.failed.push({
            operation: 'create_profile',
            error: 'Company ID is required',
            data: company,
          });
          continue;
        }

        const existingProfile = await Profile.findOne({ company_id });
        if (existingProfile) {
          result.failed.push({
            company_id,
            operation: 'create_profile',
            error: 'Profile already exists for this company',
            data: company,
          });
          continue;
        }

        const profile = await Profile.create(company);
        await invalidateCompanyCache(company_id, company.about?.ticker_symbol);
        
        result.successful.push({
          company_id,
          operation: 'create_profile',
          id: profile._id.toString(),
        });
      } catch (error: any) {
        result.failed.push({
          company_id: company.company_id,
          operation: 'create_profile',
          error: error.message,
          data: company,
        });
      }
    }

    res.status(201).json({
      success: true,
      code: 201,
      message: `Bulk profile creation completed: ${result.successful.length} successful, ${result.failed.length} failed`,
      data: result,
    });
  } catch (error: any) {
    console.error('Bulk create profiles error:', error);
    res.status(500).json({
      success: false,
      code: 500,
      message: 'Internal server error during bulk profile creation',
      errorId: `ERR-${Date.now()}`,
    });
  }
};

export const bulkCreateStatistics = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { statistics } = req.body;
    
    if (!statistics || !Array.isArray(statistics) || statistics.length === 0) {
      res.status(400).json({
        success: false,
        code: 400,
        message: 'Statistics array is required and must not be empty',
        details: { required: ['statistics'] },
      });
      return;
    }

    const result: BulkCreateResult = {
      successful: [],
      failed: [],
    };

    for (const stat of statistics) {
      try {
        const { company_id } = stat;
        
        if (!company_id) {
          result.failed.push({
            operation: 'create_statistics',
            error: 'Company ID is required',
            data: stat,
          });
          continue;
        }

        const existingStats = await Statistics.findOne({ company_id });
        if (existingStats) {
          result.failed.push({
            company_id,
            operation: 'create_statistics',
            error: 'Statistics already exists for this company',
            data: stat,
          });
          continue;
        }

        const statisticsDoc = await Statistics.create(stat);
        
        if ((statisticsDoc as any).addToKeyStatsHistory) {
          (statisticsDoc as any).addToKeyStatsHistory();
          await statisticsDoc.save();
        }

        await invalidateCompanyCache(company_id, stat.ticker_symbol);
        
        result.successful.push({
          company_id,
          operation: 'create_statistics',
          id: statisticsDoc._id.toString(),
        });
      } catch (error: any) {
        result.failed.push({
          company_id: stat.company_id,
          operation: 'create_statistics',
          error: error.message,
          data: stat,
        });
      }
    }

    res.status(201).json({
      success: true,
      code: 201,
      message: `Bulk statistics creation completed: ${result.successful.length} successful, ${result.failed.length} failed`,
      data: result,
    });
  } catch (error: any) {
    console.error('Bulk create statistics error:', error);
    res.status(500).json({
      success: false,
      code: 500,
      message: 'Internal server error during bulk statistics creation',
      errorId: `ERR-${Date.now()}`,
    });
  }
};

export const bulkCreatePriceHistory = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { priceHistories } = req.body;
    
    if (!priceHistories || !Array.isArray(priceHistories) || priceHistories.length === 0) {
      res.status(400).json({
        success: false,
        code: 400,
        message: 'Price histories array is required and must not be empty',
        details: { required: ['priceHistories'] },
      });
      return;
    }

    const result: BulkCreateResult = {
      successful: [],
      failed: [],
    };

    for (const history of priceHistories) {
      try {
        const { company_id } = history;
        
        if (!company_id) {
          result.failed.push({
            operation: 'create_price_history',
            error: 'Company ID is required',
            data: history,
          });
          continue;
        }

        const existingHistory = await PriceHistory.findOne({ company_id });
        if (existingHistory) {
          result.failed.push({
            company_id,
            operation: 'create_price_history',
            error: 'Price history already exists for this company',
            data: history,
          });
          continue;
        }

        const priceHistory = await PriceHistory.create(history);
        await invalidateCompanyCache(company_id, history.ticker_symbol);
        
        result.successful.push({
          company_id,
          operation: 'create_price_history',
          id: priceHistory._id.toString(),
        });
      } catch (error: any) {
        result.failed.push({
          company_id: history.company_id,
          operation: 'create_price_history',
          error: error.message,
          data: history,
        });
      }
    }

    res.status(201).json({
      success: true,
      code: 201,
      message: `Bulk price history creation completed: ${result.successful.length} successful, ${result.failed.length} failed`,
      data: result,
    });
  } catch (error: any) {
    console.error('Bulk create price history error:', error);
    res.status(500).json({
      success: false,
      code: 500,
      message: 'Internal server error during bulk price history creation',
      errorId: `ERR-${Date.now()}`,
    });
  }
};

export const bulkAddPriceEntries = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { entries } = req.body;
    
    if (!entries || !Array.isArray(entries) || entries.length === 0) {
      res.status(400).json({
        success: false,
        code: 400,
        message: 'Entries array is required and must not be empty',
        details: { 
          required: ['entries'],
          entryFormat: { company_id: 'string', date: 'Date', price: 'string' }
        },
      });
      return;
    }

    const result: BulkUpdateResult = {
      successful: [],
      failed: [],
    };

    for (const entry of entries) {
      try {
        const { company_id, date, price } = entry;
        
        if (!company_id || !date || !price) {
          result.failed.push({
            company_id,
            operation: 'add_price_entry',
            error: 'Company ID, date, and price are required',
          });
          continue;
        }

        const priceHistory = await PriceHistory.findOne({ company_id });
        if (!priceHistory) {
          result.failed.push({
            company_id,
            operation: 'add_price_entry',
            error: 'Price history not found for this company',
          });
          continue;
        }

        (priceHistory as any).history.push({
          date: new Date(date),
          price: String(price),
        });

        (priceHistory as any).history.sort(
          (a: any, b: any) => b.date - a.date,
        );

        const MAX_HISTORY_ENTRIES = 5000;
        if ((priceHistory as any).history.length > MAX_HISTORY_ENTRIES) {
          (priceHistory as any).history = (priceHistory as any).history.slice(0, MAX_HISTORY_ENTRIES);
        }

        await priceHistory.save();
        await invalidateCompanyCache(company_id, priceHistory.ticker_symbol);
        
        result.successful.push({
          company_id,
          operation: 'add_price_entry',
        });
      } catch (error: any) {
        result.failed.push({
          company_id: entry.company_id,
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
  } catch (error: any) {
    console.error('Bulk add price entries error:', error);
    res.status(500).json({
      success: false,
      code: 500,
      message: 'Internal server error during bulk price entry addition',
      errorId: `ERR-${Date.now()}`,
    });
  }
};

export const bulkUpdateStatistics = async (
  req: Request,
  res: Response,
): Promise<void> => {
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

    const result: BulkUpdateResult = {
      successful: [],
      failed: [],
    };

    for (const update of updates) {
      try {
        const { company_id, data } = update;
        
        if (!company_id || !data) {
          result.failed.push({
            company_id,
            operation: 'update_statistics',
            error: 'Company ID and update data are required',
          });
          continue;
        }

        const statistics = await Statistics.findOneAndUpdate(
          { company_id },
          data,
          { new: true, runValidators: true },
        );

        if (!statistics) {
          result.failed.push({
            company_id,
            operation: 'update_statistics',
            error: 'Statistics not found for this company',
          });
          continue;
        }

        await invalidateCompanyCache(company_id, statistics.ticker_symbol);
        
        result.successful.push({
          company_id,
          operation: 'update_statistics',
        });
      } catch (error: any) {
        result.failed.push({
          company_id: update.company_id,
          operation: 'update_statistics',
          error: error.message,
        });
      }
    }

    res.status(200).json({
      success: true,
      code: 200,
      message: `Bulk statistics update completed: ${result.successful.length} successful, ${result.failed.length} failed`,
      data: result,
    });
  } catch (error: any) {
    console.error('Bulk update statistics error:', error);
    res.status(500).json({
      success: false,
      code: 500,
      message: 'Internal server error during bulk statistics update',
      errorId: `ERR-${Date.now()}`,
    });
  }
};

export const bulkUpdateProfiles = async (
  req: Request,
  res: Response,
): Promise<void> => {
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

    const result: BulkUpdateResult = {
      successful: [],
      failed: [],
    };

    for (const update of updates) {
      try {
        const { company_id, data } = update;
        
        if (!company_id || !data) {
          result.failed.push({
            company_id,
            operation: 'update_profile',
            error: 'Company ID and update data are required',
          });
          continue;
        }

        const profile = await Profile.findOneAndUpdate(
          { company_id },
          data,
          { new: true, runValidators: true },
        );

        if (!profile) {
          result.failed.push({
            company_id,
            operation: 'update_profile',
            error: 'Profile not found for this company',
          });
          continue;
        }

        await invalidateCompanyCache(company_id, profile.about?.ticker_symbol);
        
        result.successful.push({
          company_id,
          operation: 'update_profile',
        });
      } catch (error: any) {
        result.failed.push({
          company_id: update.company_id,
          operation: 'update_profile',
          error: error.message,
        });
      }
    }

    res.status(200).json({
      success: true,
      code: 200,
      message: `Bulk profile update completed: ${result.successful.length} successful, ${result.failed.length} failed`,
      data: result,
    });
  } catch (error: any) {
    console.error('Bulk update profiles error:', error);
    res.status(500).json({
      success: false,
      code: 500,
      message: 'Internal server error during bulk profile update',
      errorId: `ERR-${Date.now()}`,
    });
  }
};

export const bulkUpsertCollection = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { collection, items } = req.body;
    
    if (!collection || !items || !Array.isArray(items) || items.length === 0) {
      res.status(400).json({
        success: false,
        code: 400,
        message: 'Collection name and items array are required',
        details: { 
          required: ['collection', 'items'],
          validCollections: ['profiles', 'statistics', 'dividends', 'earnings', 'financial', 'holders', 'priceHistory']
        },
      });
      return;
    }

    const validCollections = ['profiles', 'statistics', 'dividends', 'earnings', 'financial', 'holders', 'priceHistory'];
    if (!validCollections.includes(collection)) {
      res.status(400).json({
        success: false,
        code: 400,
        message: 'Invalid collection name',
        details: { validCollections },
      });
      return;
    }

    let Model: any;
    switch (collection) {
      case 'profiles':
        Model = Profile;
        break;
      case 'statistics':
        Model = Statistics;
        break;
      case 'dividends':
        Model = Dividends;
        break;
      case 'earnings':
        Model = Earnings;
        break;
      case 'financial':
        Model = Financial;
        break;
      case 'holders':
        Model = Holders;
        break;
      case 'priceHistory':
        Model = PriceHistory;
        break;
    }

    const result: BulkCreateResult = {
      successful: [],
      failed: [],
    };

    for (const item of items) {
      try {
        const { company_id } = item;
        
        if (!company_id) {
          result.failed.push({
            operation: `upsert_${collection}`,
            error: 'Company ID is required',
            data: item,
          });
          continue;
        }

        const existing = await Model.findOne({ company_id });
        let operation = 'updated';
        
        if (existing) {
          await Model.findOneAndUpdate(
            { company_id },
            item,
            { new: true, runValidators: true }
          );
        } else {
          await Model.create(item);
          operation = 'created';
        }

        await invalidateCompanyCache(company_id, item.ticker_symbol);
        
        result.successful.push({
          company_id,
          operation: `${operation}_${collection}`,
        });
      } catch (error: any) {
        result.failed.push({
          company_id: item.company_id,
          operation: `upsert_${collection}`,
          error: error.message,
          data: item,
        });
      }
    }

    res.status(200).json({
      success: true,
      code: 200,
      message: `Bulk upsert for ${collection} completed: ${result.successful.length} successful, ${result.failed.length} failed`,
      data: result,
    });
  } catch (error: any) {
    console.error('Bulk upsert error:', error);
    res.status(500).json({
      success: false,
      code: 500,
      message: 'Internal server error during bulk upsert',
      errorId: `ERR-${Date.now()}`,
    });
  }
};

export const bulkDeleteCompanies = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { company_ids, collections } = req.body;
    
    if (!company_ids || !Array.isArray(company_ids) || company_ids.length === 0) {
      res.status(400).json({
        success: false,
        code: 400,
        message: 'Company IDs array is required and must not be empty',
        details: { required: ['company_ids'] },
      });
      return;
    }

    const collectionsToDelete = collections || [
      'profiles', 'statistics', 'dividends', 'earnings', 'financial', 'holders', 'priceHistory'
    ];
    
    const validCollections = ['profiles', 'statistics', 'dividends', 'earnings', 'financial', 'holders', 'priceHistory'];
    const invalidCollections = collectionsToDelete.filter((c: string) => !validCollections.includes(c));
    
    if (invalidCollections.length > 0) {
      res.status(400).json({
        success: false,
        code: 400,
        message: 'Invalid collection names provided',
        details: { invalidCollections, validCollections },
      });
      return;
    }

    const result: {
      successful: Array<{ company_id: string; deleted_from: string[] }>;
      failed: Array<{ company_id: string; error: string }>;
    } = {
      successful: [],
      failed: [],
    };

    for (const company_id of company_ids) {
      try {
        const deletedFrom: string[] = [];
        
        if (collectionsToDelete.includes('profiles')) {
          const profile = await Profile.findOneAndDelete({ company_id });
          if (profile) deletedFrom.push('profiles');
        }
        
        if (collectionsToDelete.includes('statistics')) {
          const stats = await Statistics.findOneAndDelete({ company_id });
          if (stats) deletedFrom.push('statistics');
        }
        
        if (collectionsToDelete.includes('dividends')) {
          const dividends = await Dividends.findOneAndDelete({ company_id });
          if (dividends) deletedFrom.push('dividends');
        }
        
        if (collectionsToDelete.includes('earnings')) {
          const earnings = await Earnings.findOneAndDelete({ company_id });
          if (earnings) deletedFrom.push('earnings');
        }
        
        if (collectionsToDelete.includes('financial')) {
          const financial = await Financial.findOneAndDelete({ company_id });
          if (financial) deletedFrom.push('financial');
        }
        
        if (collectionsToDelete.includes('holders')) {
          const holders = await Holders.findOneAndDelete({ company_id });
          if (holders) deletedFrom.push('holders');
        }
        
        if (collectionsToDelete.includes('priceHistory')) {
          const priceHistory = await PriceHistory.findOneAndDelete({ company_id });
          if (priceHistory) deletedFrom.push('priceHistory');
        }
        
        if (deletedFrom.length > 0) {
          await invalidateCompanyCache(company_id);
          result.successful.push({ company_id, deleted_from: deletedFrom });
        } else {
          result.failed.push({ company_id, error: 'No data found for this company in specified collections' });
        }
      } catch (error: any) {
        result.failed.push({ company_id, error: error.message });
      }
    }

    res.status(200).json({
      success: true,
      code: 200,
      message: `Bulk deletion completed: ${result.successful.length} successful, ${result.failed.length} failed`,
      data: result,
    });
  } catch (error: any) {
    console.error('Bulk delete error:', error);
    res.status(500).json({
      success: false,
      code: 500,
      message: 'Internal server error during bulk deletion',
      errorId: `ERR-${Date.now()}`,
    });
  }
};

export const bulkImportCompanies = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { companies } = req.body;
    
    if (!companies || !Array.isArray(companies) || companies.length === 0) {
      res.status(400).json({
        success: false,
        code: 400,
        message: 'Companies array is required and must not be empty',
        details: {
          required: ['companies'],
          companyFormat: {
            company_id: 'string',
            profile: 'object',
            statistics: 'object',
            dividends: 'object',
            earnings: 'object',
            financial: 'object',
            holders: 'object',
            priceHistory: 'object'
          }
        },
      });
      return;
    }

    const result: {
      successful: Array<{ company_id: string; collections_created: string[] }>;
      failed: Array<{ company_id: string; error: string; details?: any }>;
    } = {
      successful: [],
      failed: [],
    };

    for (const company of companies) {
      const { company_id, profile, statistics, dividends, earnings, financial, holders, priceHistory } = company;
      
      if (!company_id) {
        result.failed.push({
          company_id: 'unknown',
          error: 'Company ID is required for each company',
          details: company,
        });
        continue;
      }

      const collectionsCreated: string[] = [];

      try {
        if (profile) {
          const existingProfile = await Profile.findOne({ company_id });
          if (!existingProfile) {
            await Profile.create({ company_id, ...profile });
            collectionsCreated.push('profile');
          } else {
            collectionsCreated.push('profile (already exists)');
          }
        }

        if (statistics) {
          const existingStats = await Statistics.findOne({ company_id });
          if (!existingStats) {
            const statsDoc = await Statistics.create({ company_id, ...statistics });
            if ((statsDoc as any).addToKeyStatsHistory) {
              (statsDoc as any).addToKeyStatsHistory();
              await statsDoc.save();
            }
            collectionsCreated.push('statistics');
          } else {
            collectionsCreated.push('statistics (already exists)');
          }
        }

        if (dividends) {
          const existingDividends = await Dividends.findOne({ company_id });
          if (!existingDividends) {
            const divDoc = await Dividends.create({ company_id, ...dividends });
            if ((divDoc as any).addDividendToHistory) {
              (divDoc as any).addDividendToHistory();
              await divDoc.save();
            }
            collectionsCreated.push('dividends');
          } else {
            collectionsCreated.push('dividends (already exists)');
          }
        }

        if (earnings) {
          const existingEarnings = await Earnings.findOne({ company_id });
          if (!existingEarnings) {
            const earnDoc = await Earnings.create({ company_id, ...earnings });
            if ((earnDoc as any).addEarningsToHistory) {
              (earnDoc as any).addEarningsToHistory('quarterly');
              await earnDoc.save();
            }
            collectionsCreated.push('earnings');
          } else {
            collectionsCreated.push('earnings (already exists)');
          }
        }

        if (financial) {
          const existingFinancial = await Financial.findOne({ company_id });
          if (!existingFinancial) {
            const finDoc = await Financial.create({ company_id, ...financial });
            if ((finDoc as any).addRevenueToHistory) {
              (finDoc as any).addRevenueToHistory('quarterly');
              (finDoc as any).addNetMarginToHistory('quarterly');
              (finDoc as any).addDebtToHistory('quarterly');
              await finDoc.save();
            }
            collectionsCreated.push('financial');
          } else {
            collectionsCreated.push('financial (already exists)');
          }
        }

        if (holders) {
          const existingHolders = await Holders.findOne({ company_id });
          if (!existingHolders) {
            const holdDoc = await Holders.create({ company_id, ...holders });
            if ((holdDoc as any).addOwnershipToHistory) {
              (holdDoc as any).addOwnershipToHistory();
              await holdDoc.save();
            }
            collectionsCreated.push('holders');
          } else {
            collectionsCreated.push('holders (already exists)');
          }
        }

        if (priceHistory) {
          const existingPriceHistory = await PriceHistory.findOne({ company_id });
          if (!existingPriceHistory) {
            await PriceHistory.create({ company_id, ...priceHistory });
            collectionsCreated.push('priceHistory');
          } else {
            collectionsCreated.push('priceHistory (already exists)');
          }
        }

        await invalidateCompanyCache(company_id);
        
        result.successful.push({
          company_id,
          collections_created: collectionsCreated,
        });
      } catch (error: any) {
        result.failed.push({
          company_id,
          error: error.message,
          details: { collections_created_before_error: collectionsCreated },
        });
      }
    }

    res.status(201).json({
      success: true,
      code: 201,
      message: `Bulk import completed: ${result.successful.length} successful, ${result.failed.length} failed`,
      data: result,
    });
  } catch (error: any) {
    console.error('Bulk import error:', error);
    res.status(500).json({
      success: false,
      code: 500,
      message: 'Internal server error during bulk import',
      errorId: `ERR-${Date.now()}`,
    });
  }
};