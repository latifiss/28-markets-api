import type { Request, Response } from 'express';
import mongoose from 'mongoose';
import {
  GDPGrowthQuarterly,
  GDPGrowthAnnual,
  GovernmentGDPValue,
  InterestRate,
  InflationRate,
  UnemploymentRate,
  BalanceOfTrade,
  GovernmentDebtToGDP,
  GovernmentDebtValue,
  GovernmentBudgetValue,
  GovernmentRevenues,
  FiscalExpenditure,
  GovernmentSpending,
} from '../models/economic.model';
import { getRedisClient } from '../lib/redis';

export const setCache = async (
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

export const getCache = async (key: string): Promise<any> => {
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

const invalidateCache = async (
  indicatorName: string,
  specificKey?: string,
): Promise<void> => {
  await deleteCacheByPattern(`economic:${indicatorName}:*`);
  if (specificKey) {
    await deleteCacheByPattern(`economic:${indicatorName}:${specificKey}`);
  }
};

const createHandler = async (
  Model: any,
  req: Request,
  res: Response,
  indicatorName: string,
): Promise<void> => {
  try {
    if ((req as any).rateLimit && (req as any).rateLimit.remaining === 0) {
      res.status(429).json({
        success: false,
        code: 429,
        message: 'Too many requests. Rate limit exceeded',
        details: {
          limit: (req as any).rateLimit.limit,
          resetIn: (req as any).rateLimit.resetIn,
        },
      });
      return;
    }

    const newIndicator = new Model(req.body);
    const savedIndicator = await newIndicator.save();

    if (savedIndicator && typeof (savedIndicator as any).addToHistory === 'function') {
      await (savedIndicator as any).addToHistory();
    }

    await invalidateCache(indicatorName);

    res.status(201).json({
      success: true,
      code: 201,
      message: `${indicatorName} created successfully`,
      data: savedIndicator,
    });
  } catch (error: any) {
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

    console.error(`Create ${indicatorName} error:`, error);
    res.status(500).json({
      success: false,
      code: 500,
      message: `Internal server error creating ${indicatorName}`,
      errorId: `ECON-ERR-${Date.now()}`,
    });
  }
};

const getAllHandler = async (
  Model: any,
  req: Request,
  res: Response,
  indicatorName: string,
): Promise<void> => {
  try {
    if ((req as any).rateLimit && (req as any).rateLimit.remaining === 0) {
      res.status(429).json({
        success: false,
        code: 429,
        message: 'Too many requests. Rate limit exceeded',
        details: {
          limit: (req as any).rateLimit.limit,
          resetIn: (req as any).rateLimit.resetIn,
        },
      });
      return;
    }

    const {
      page = 1,
      limit = 50,
      year,
      sortBy = 'year',
      sortOrder = 'desc',
    } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);

    const cacheKey = `economic:${indicatorName}:all:${pageNum}:${limitNum}:${year}:${sortBy}:${sortOrder}`;
    const cached = await getCache(cacheKey);

    if (cached) {
      res.status(200).json({
        success: true,
        code: 200,
        fromCache: true,
        ...cached,
      });
      return;
    }

    const query: any = {};
    if (year) {
      query.year = parseInt(year as string);
    }

    const skip = (pageNum - 1) * limitNum;
    const total = await Model.countDocuments(query);

    const sort: any = {};
    sort[sortBy as string] = sortOrder === 'desc' ? -1 : 1;

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

    await setCache(cacheKey, result, 300);

    res.status(200).json(result);
  } catch (error: any) {
    console.error(`Get all ${indicatorName} error:`, error);
    res.status(500).json({
      success: false,
      code: 500,
      message: `Internal server error fetching ${indicatorName}`,
      errorId: `ECON-ERR-${Date.now()}`,
    });
  }
};

const getLatestHandler = async (
  Model: any,
  req: Request,
  res: Response,
  indicatorName: string,
): Promise<void> => {
  try {
    if ((req as any).rateLimit && (req as any).rateLimit.remaining === 0) {
      res.status(429).json({
        success: false,
        code: 429,
        message: 'Too many requests. Rate limit exceeded',
        details: {
          limit: (req as any).rateLimit.limit,
          resetIn: (req as any).rateLimit.resetIn,
        },
      });
      return;
    }

    const cacheKey = `economic:${indicatorName}:latest`;
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

    const latest = await (Model.findLatest ? Model.findLatest() : Model.findOne().sort({ year: -1 }));

    if (!latest) {
      res.status(404).json({
        success: false,
        code: 404,
        message: `No ${indicatorName} data found`,
      });
      return;
    }

    await setCache(cacheKey, latest, 300);

    res.status(200).json({
      success: true,
      code: 200,
      fromCache: false,
      data: latest,
    });
  } catch (error: any) {
    console.error(`Get latest ${indicatorName} error:`, error);
    res.status(500).json({
      success: false,
      code: 500,
      message: `Internal server error fetching latest ${indicatorName}`,
      errorId: `ECON-ERR-${Date.now()}`,
    });
  }
};

const updateHandler = async (
  Model: any,
  req: Request,
  res: Response,
  indicatorName: string,
): Promise<void> => {
  try {
    if ((req as any).rateLimit && (req as any).rateLimit.remaining === 0) {
      res.status(429).json({
        success: false,
        code: 429,
        message: 'Too many requests. Rate limit exceeded',
        details: {
          limit: (req as any).rateLimit.limit,
          resetIn: (req as any).rateLimit.resetIn,
        },
      });
      return;
    }

    let { id } = req.params;
    const { current_value, current_balance, ...updateData } = req.body;

    if (Array.isArray(id)) {
      id = id[0];
    }

    let query: any = {};

    if (id && typeof id === 'string' && mongoose.Types.ObjectId.isValid(id)) {
      query._id = new mongoose.Types.ObjectId(id);
    } else if (updateData.quarter && updateData.year) {
      query = { quarter: updateData.quarter, year: updateData.year };
    } else if (updateData.month && updateData.year) {
      query = { month: updateData.month, year: updateData.year };
    } else if (updateData.year) {
      query = { year: updateData.year };
    } else if (Model.modelName.includes('GovernmentDebt')) {
      const latest = await Model.findOne().sort({ year: -1, month: -1, quarter: -1 });
      if (latest) {
        query._id = latest._id;
      } else {
        res.status(404).json({
          success: false,
          code: 404,
          message: 'No record found to update',
        });
        return;
      }
    } else {
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

    const updateOperations: any = { $set: updateData };

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

    if (updated && typeof (updated as any).addToHistory === 'function') {
      await (updated as any).addToHistory();
    }

    await invalidateCache(indicatorName, id);

    res.status(200).json({
      success: true,
      code: 200,
      message: `${indicatorName} updated successfully`,
      data: updated,
    });
  } catch (error: any) {
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

    console.error(`Update ${indicatorName} error:`, error);
    res.status(500).json({
      success: false,
      code: 500,
      message: `Internal server error updating ${indicatorName}`,
      errorId: `ECON-ERR-${Date.now()}`,
    });
  }
};

const deleteHandler = async (
  Model: any,
  req: Request,
  res: Response,
  indicatorName: string,
): Promise<void> => {
  try {
    if ((req as any).rateLimit && (req as any).rateLimit.remaining === 0) {
      res.status(429).json({
        success: false,
        code: 429,
        message: 'Too many requests. Rate limit exceeded',
        details: {
          limit: (req as any).rateLimit.limit,
          resetIn: (req as any).rateLimit.resetIn,
        },
      });
      return;
    }

    let { id } = req.params;

    if (Array.isArray(id)) {
      id = id[0];
    }

    if (!id || typeof id !== 'string' || !mongoose.Types.ObjectId.isValid(id)) {
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

    const response: any = {
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
  } catch (error: any) {
    console.error(`Delete ${indicatorName} error:`, error);
    res.status(500).json({
      success: false,
      code: 500,
      message: `Internal server error deleting ${indicatorName}`,
      errorId: `ECON-ERR-${Date.now()}`,
    });
  }
};

const getHistoryHandler = async (
  Model: any,
  req: Request,
  res: Response,
  indicatorName: string,
): Promise<void> => {
  try {
    if ((req as any).rateLimit && (req as any).rateLimit.remaining === 0) {
      res.status(429).json({
        success: false,
        code: 429,
        message: 'Too many requests. Rate limit exceeded',
        details: {
          limit: (req as any).rateLimit.limit,
          resetIn: (req as any).rateLimit.resetIn,
        },
      });
      return;
    }

    const { startYear, endYear } = req.query;

    const cacheKey = `economic:${indicatorName}:history:${startYear}:${endYear}`;
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

    const query: any = {};

    if (startYear || endYear) {
      query.year = {};
      if (startYear) query.year.$gte = parseInt(startYear as string);
      if (endYear) query.year.$lte = parseInt(endYear as string);
    }

    const history = await Model.find(query)
      .select('year month quarter current_value previous_value current_balance previous_balance')
      .sort({ year: -1, month: -1, quarter: -1 });

    await setCache(cacheKey, history, 600);

    res.status(200).json({
      success: true,
      code: 200,
      fromCache: false,
      data: history,
    });
  } catch (error: any) {
    console.error(`Get ${indicatorName} history error:`, error);
    res.status(500).json({
      success: false,
      code: 500,
      message: `Internal server error fetching ${indicatorName} history`,
      errorId: `ECON-ERR-${Date.now()}`,
    });
  }
};

export const createGDPGrowthQuarterly = async (
  req: Request,
  res: Response,
): Promise<void> => createHandler(GDPGrowthQuarterly, req, res, 'GDP Growth Quarterly');

export const getAllGDPGrowthQuarterly = async (
  req: Request,
  res: Response,
): Promise<void> => getAllHandler(GDPGrowthQuarterly, req, res, 'GDP Growth Quarterly');

export const getLatestGDPGrowthQuarterly = async (
  req: Request,
  res: Response,
): Promise<void> => getLatestHandler(GDPGrowthQuarterly, req, res, 'GDP Growth Quarterly');

export const updateGDPGrowthQuarterly = async (
  req: Request,
  res: Response,
): Promise<void> => updateHandler(GDPGrowthQuarterly, req, res, 'GDP Growth Quarterly');

export const deleteGDPGrowthQuarterly = async (
  req: Request,
  res: Response,
): Promise<void> => deleteHandler(GDPGrowthQuarterly, req, res, 'GDP Growth Quarterly');

export const getGDPGrowthQuarterlyHistory = async (
  req: Request,
  res: Response,
): Promise<void> => getHistoryHandler(GDPGrowthQuarterly, req, res, 'GDP Growth Quarterly');

export const createGDPGrowthAnnual = async (
  req: Request,
  res: Response,
): Promise<void> => createHandler(GDPGrowthAnnual, req, res, 'GDP Growth Annual');

export const getAllGDPGrowthAnnual = async (
  req: Request,
  res: Response,
): Promise<void> => getAllHandler(GDPGrowthAnnual, req, res, 'GDP Growth Annual');

export const getLatestGDPGrowthAnnual = async (
  req: Request,
  res: Response,
): Promise<void> => getLatestHandler(GDPGrowthAnnual, req, res, 'GDP Growth Annual');

export const updateGDPGrowthAnnual = async (
  req: Request,
  res: Response,
): Promise<void> => updateHandler(GDPGrowthAnnual, req, res, 'GDP Growth Annual');

export const deleteGDPGrowthAnnual = async (
  req: Request,
  res: Response,
): Promise<void> => deleteHandler(GDPGrowthAnnual, req, res, 'GDP Growth Annual');

export const getGDPGrowthAnnualHistory = async (
  req: Request,
  res: Response,
): Promise<void> => getHistoryHandler(GDPGrowthAnnual, req, res, 'GDP Growth Annual');

export const createGovernmentGDPValue = async (
  req: Request,
  res: Response,
): Promise<void> => createHandler(GovernmentGDPValue, req, res, 'Government GDP Value');

export const getAllGovernmentGDPValue = async (
  req: Request,
  res: Response,
): Promise<void> => getAllHandler(GovernmentGDPValue, req, res, 'Government GDP Value');

export const getLatestGovernmentGDPValue = async (
  req: Request,
  res: Response,
): Promise<void> => getLatestHandler(GovernmentGDPValue, req, res, 'Government GDP Value');

export const updateGovernmentGDPValue = async (
  req: Request,
  res: Response,
): Promise<void> => updateHandler(GovernmentGDPValue, req, res, 'Government GDP Value');

export const deleteGovernmentGDPValue = async (
  req: Request,
  res: Response,
): Promise<void> => deleteHandler(GovernmentGDPValue, req, res, 'Government GDP Value');

export const getGovernmentGDPValueHistory = async (
  req: Request,
  res: Response,
): Promise<void> => getHistoryHandler(GovernmentGDPValue, req, res, 'Government GDP Value');

export const createInterestRate = async (
  req: Request,
  res: Response,
): Promise<void> => createHandler(InterestRate, req, res, 'Interest Rate');

export const getAllInterestRate = async (
  req: Request,
  res: Response,
): Promise<void> => getAllHandler(InterestRate, req, res, 'Interest Rate');

export const getLatestInterestRate = async (
  req: Request,
  res: Response,
): Promise<void> => getLatestHandler(InterestRate, req, res, 'Interest Rate');

export const updateInterestRate = async (
  req: Request,
  res: Response,
): Promise<void> => updateHandler(InterestRate, req, res, 'Interest Rate');

export const deleteInterestRate = async (
  req: Request,
  res: Response,
): Promise<void> => deleteHandler(InterestRate, req, res, 'Interest Rate');

export const getInterestRateHistory = async (
  req: Request,
  res: Response,
): Promise<void> => getHistoryHandler(InterestRate, req, res, 'Interest Rate');

export const createInflationRate = async (
  req: Request,
  res: Response,
): Promise<void> => createHandler(InflationRate, req, res, 'Inflation Rate');

export const getAllInflationRate = async (
  req: Request,
  res: Response,
): Promise<void> => getAllHandler(InflationRate, req, res, 'Inflation Rate');

export const getLatestInflationRate = async (
  req: Request,
  res: Response,
): Promise<void> => getLatestHandler(InflationRate, req, res, 'Inflation Rate');

export const updateInflationRate = async (
  req: Request,
  res: Response,
): Promise<void> => updateHandler(InflationRate, req, res, 'Inflation Rate');

export const deleteInflationRate = async (
  req: Request,
  res: Response,
): Promise<void> => deleteHandler(InflationRate, req, res, 'Inflation Rate');

export const getInflationRateHistory = async (
  req: Request,
  res: Response,
): Promise<void> => getHistoryHandler(InflationRate, req, res, 'Inflation Rate');

export const createUnemploymentRate = async (
  req: Request,
  res: Response,
): Promise<void> => createHandler(UnemploymentRate, req, res, 'Unemployment Rate');

export const getAllUnemploymentRate = async (
  req: Request,
  res: Response,
): Promise<void> => getAllHandler(UnemploymentRate, req, res, 'Unemployment Rate');

export const getLatestUnemploymentRate = async (
  req: Request,
  res: Response,
): Promise<void> => getLatestHandler(UnemploymentRate, req, res, 'Unemployment Rate');

export const updateUnemploymentRate = async (
  req: Request,
  res: Response,
): Promise<void> => updateHandler(UnemploymentRate, req, res, 'Unemployment Rate');

export const deleteUnemploymentRate = async (
  req: Request,
  res: Response,
): Promise<void> => deleteHandler(UnemploymentRate, req, res, 'Unemployment Rate');

export const getUnemploymentRateHistory = async (
  req: Request,
  res: Response,
): Promise<void> => getHistoryHandler(UnemploymentRate, req, res, 'Unemployment Rate');

export const createBalanceOfTrade = async (
  req: Request,
  res: Response,
): Promise<void> => createHandler(BalanceOfTrade, req, res, 'Balance of Trade');

export const getAllBalanceOfTrade = async (
  req: Request,
  res: Response,
): Promise<void> => getAllHandler(BalanceOfTrade, req, res, 'Balance of Trade');

export const getLatestBalanceOfTrade = async (
  req: Request,
  res: Response,
): Promise<void> => getLatestHandler(BalanceOfTrade, req, res, 'Balance of Trade');

export const updateBalanceOfTrade = async (
  req: Request,
  res: Response,
): Promise<void> => updateHandler(BalanceOfTrade, req, res, 'Balance of Trade');

export const deleteBalanceOfTrade = async (
  req: Request,
  res: Response,
): Promise<void> => deleteHandler(BalanceOfTrade, req, res, 'Balance of Trade');

export const getBalanceOfTradeHistory = async (
  req: Request,
  res: Response,
): Promise<void> => getHistoryHandler(BalanceOfTrade, req, res, 'Balance of Trade');

export const createGovernmentDebtToGDP = async (
  req: Request,
  res: Response,
): Promise<void> => createHandler(GovernmentDebtToGDP, req, res, 'Government Debt to GDP');

export const getAllGovernmentDebtToGDP = async (
  req: Request,
  res: Response,
): Promise<void> => getAllHandler(GovernmentDebtToGDP, req, res, 'Government Debt to GDP');

export const getLatestGovernmentDebtToGDP = async (
  req: Request,
  res: Response,
): Promise<void> => getLatestHandler(GovernmentDebtToGDP, req, res, 'Government Debt to GDP');

export const updateGovernmentDebtToGDP = async (
  req: Request,
  res: Response,
): Promise<void> => updateHandler(GovernmentDebtToGDP, req, res, 'Government Debt to GDP');

export const deleteGovernmentDebtToGDP = async (
  req: Request,
  res: Response,
): Promise<void> => deleteHandler(GovernmentDebtToGDP, req, res, 'Government Debt to GDP');

export const getGovernmentDebtToGDPHistory = async (
  req: Request,
  res: Response,
): Promise<void> => getHistoryHandler(GovernmentDebtToGDP, req, res, 'Government Debt to GDP');

export const createGovernmentDebtValue = async (
  req: Request,
  res: Response,
): Promise<void> => createHandler(GovernmentDebtValue, req, res, 'Government Debt Value');

export const getAllGovernmentDebtValue = async (
  req: Request,
  res: Response,
): Promise<void> => getAllHandler(GovernmentDebtValue, req, res, 'Government Debt Value');

export const getLatestGovernmentDebtValue = async (
  req: Request,
  res: Response,
): Promise<void> => getLatestHandler(GovernmentDebtValue, req, res, 'Government Debt Value');

export const updateGovernmentDebtValue = async (
  req: Request,
  res: Response,
): Promise<void> => updateHandler(GovernmentDebtValue, req, res, 'Government Debt Value');

export const deleteGovernmentDebtValue = async (
  req: Request,
  res: Response,
): Promise<void> => deleteHandler(GovernmentDebtValue, req, res, 'Government Debt Value');

export const getGovernmentDebtValueHistory = async (
  req: Request,
  res: Response,
): Promise<void> => getHistoryHandler(GovernmentDebtValue, req, res, 'Government Debt Value');

export const createGovernmentBudgetValue = async (
  req: Request,
  res: Response,
): Promise<void> => createHandler(GovernmentBudgetValue, req, res, 'Government Budget Value');

export const getAllGovernmentBudgetValue = async (
  req: Request,
  res: Response,
): Promise<void> => getAllHandler(GovernmentBudgetValue, req, res, 'Government Budget Value');

export const getLatestGovernmentBudgetValue = async (
  req: Request,
  res: Response,
): Promise<void> => getLatestHandler(GovernmentBudgetValue, req, res, 'Government Budget Value');

export const updateGovernmentBudgetValue = async (
  req: Request,
  res: Response,
): Promise<void> => updateHandler(GovernmentBudgetValue, req, res, 'Government Budget Value');

export const deleteGovernmentBudgetValue = async (
  req: Request,
  res: Response,
): Promise<void> => deleteHandler(GovernmentBudgetValue, req, res, 'Government Budget Value');

export const getGovernmentBudgetValueHistory = async (
  req: Request,
  res: Response,
): Promise<void> => getHistoryHandler(GovernmentBudgetValue, req, res, 'Government Budget Value');

export const createGovernmentRevenues = async (
  req: Request,
  res: Response,
): Promise<void> => createHandler(GovernmentRevenues, req, res, 'Government Revenues');

export const getAllGovernmentRevenues = async (
  req: Request,
  res: Response,
): Promise<void> => getAllHandler(GovernmentRevenues, req, res, 'Government Revenues');

export const getLatestGovernmentRevenues = async (
  req: Request,
  res: Response,
): Promise<void> => getLatestHandler(GovernmentRevenues, req, res, 'Government Revenues');

export const updateGovernmentRevenues = async (
  req: Request,
  res: Response,
): Promise<void> => updateHandler(GovernmentRevenues, req, res, 'Government Revenues');

export const deleteGovernmentRevenues = async (
  req: Request,
  res: Response,
): Promise<void> => deleteHandler(GovernmentRevenues, req, res, 'Government Revenues');

export const getGovernmentRevenuesHistory = async (
  req: Request,
  res: Response,
): Promise<void> => getHistoryHandler(GovernmentRevenues, req, res, 'Government Revenues');

export const createFiscalExpenditure = async (
  req: Request,
  res: Response,
): Promise<void> => createHandler(FiscalExpenditure, req, res, 'Fiscal Expenditure');

export const getAllFiscalExpenditure = async (
  req: Request,
  res: Response,
): Promise<void> => getAllHandler(FiscalExpenditure, req, res, 'Fiscal Expenditure');

export const getLatestFiscalExpenditure = async (
  req: Request,
  res: Response,
): Promise<void> => getLatestHandler(FiscalExpenditure, req, res, 'Fiscal Expenditure');

export const updateFiscalExpenditure = async (
  req: Request,
  res: Response,
): Promise<void> => updateHandler(FiscalExpenditure, req, res, 'Fiscal Expenditure');

export const deleteFiscalExpenditure = async (
  req: Request,
  res: Response,
): Promise<void> => deleteHandler(FiscalExpenditure, req, res, 'Fiscal Expenditure');

export const getFiscalExpenditureHistory = async (
  req: Request,
  res: Response,
): Promise<void> => getHistoryHandler(FiscalExpenditure, req, res, 'Fiscal Expenditure');

export const createGovernmentSpending = async (
  req: Request,
  res: Response,
): Promise<void> => createHandler(GovernmentSpending, req, res, 'Government Spending');

export const getAllGovernmentSpending = async (
  req: Request,
  res: Response,
): Promise<void> => getAllHandler(GovernmentSpending, req, res, 'Government Spending');

export const getLatestGovernmentSpending = async (
  req: Request,
  res: Response,
): Promise<void> => getLatestHandler(GovernmentSpending, req, res, 'Government Spending');

export const updateGovernmentSpending = async (
  req: Request,
  res: Response,
): Promise<void> => updateHandler(GovernmentSpending, req, res, 'Government Spending');

export const deleteGovernmentSpending = async (
  req: Request,
  res: Response,
): Promise<void> => deleteHandler(GovernmentSpending, req, res, 'Government Spending');

export const getGovernmentSpendingHistory = async (
  req: Request,
  res: Response,
): Promise<void> => getHistoryHandler(GovernmentSpending, req, res, 'Government Spending');

export const bulkUpdateIndicators = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    if ((req as any).rateLimit && (req as any).rateLimit.remaining === 0) {
      res.status(429).json({
        success: false,
        code: 429,
        message: 'Too many requests. Rate limit exceeded',
        details: {
          limit: (req as any).rateLimit.limit,
          resetIn: (req as any).rateLimit.resetIn,
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

    const results: any[] = [];
    const errors: any[] = [];

    for (const indicator of indicatorsData) {
      try {
        const { type, id, ...data } = indicator;

        let ModelToUse: any;
        let indicatorName: string;

        switch (type) {
          case 'gdp_growth_quarterly':
            ModelToUse = GDPGrowthQuarterly;
            indicatorName = 'GDP Growth Quarterly';
            break;
          case 'gdp_growth_annual':
            ModelToUse = GDPGrowthAnnual;
            indicatorName = 'GDP Growth Annual';
            break;
          case 'government_gdp_value':
            ModelToUse = GovernmentGDPValue;
            indicatorName = 'Government GDP Value';
            break;
          case 'interest_rate':
            ModelToUse = InterestRate;
            indicatorName = 'Interest Rate';
            break;
          case 'inflation_rate':
            ModelToUse = InflationRate;
            indicatorName = 'Inflation Rate';
            break;
          case 'unemployment_rate':
            ModelToUse = UnemploymentRate;
            indicatorName = 'Unemployment Rate';
            break;
          case 'balance_of_trade':
            ModelToUse = BalanceOfTrade;
            indicatorName = 'Balance of Trade';
            break;
          case 'government_debt_to_gdp':
            ModelToUse = GovernmentDebtToGDP;
            indicatorName = 'Government Debt to GDP';
            break;
          case 'government_debt_value':
            ModelToUse = GovernmentDebtValue;
            indicatorName = 'Government Debt Value';
            break;
          case 'government_budget_value':
            ModelToUse = GovernmentBudgetValue;
            indicatorName = 'Government Budget Value';
            break;
          case 'government_revenues':
            ModelToUse = GovernmentRevenues;
            indicatorName = 'Government Revenues';
            break;
          case 'fiscal_expenditure':
            ModelToUse = FiscalExpenditure;
            indicatorName = 'Fiscal Expenditure';
            break;
          case 'government_spending':
            ModelToUse = GovernmentSpending;
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

        let query: any = {};

        let idStr = id;
        if (Array.isArray(idStr)) {
          idStr = idStr[0];
        }

        if (idStr && typeof idStr === 'string' && mongoose.Types.ObjectId.isValid(idStr)) {
          query._id = new mongoose.Types.ObjectId(idStr);
        } else if (data.quarter && data.year) {
          query = { quarter: data.quarter, year: data.year };
        } else if (data.month && data.year) {
          query = { month: data.month, year: data.year };
        } else if (data.year) {
          query = { year: data.year };
        } else {
          errors.push({
            type,
            id,
            error: 'Missing required query parameters (id or year/month/quarter)',
          });
          continue;
        }

        const existing = await ModelToUse.findOne(query);

        if (existing) {
          const updateOps: any = { $set: data };

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
        } else {
          const newRecord = await new ModelToUse(data).save();
          results.push({
            type,
            id: newRecord._id,
            status: 'created',
            indicatorName,
          });
        }

        await invalidateCache(indicatorName, id);
      } catch (error: any) {
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
  } catch (error: any) {
    console.error('Bulk update indicators error:', error);
    res.status(500).json({
      success: false,
      code: 500,
      message: 'Internal server error bulk updating indicators',
      errorId: `ECON-ERR-${Date.now()}`,
    });
  }
};
