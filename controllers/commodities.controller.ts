import type { Request, Response } from 'express';
import Commodity, { PriceHistory } from '../models/commodity.model';
import { getRedisClient } from '../lib/redis';
import { publishCommodityUpdate } from '../lib/realtime/ws';

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
        if (key && typeof key === 'string') {
          await client.del(key);
        }
      }
    }
  } catch (error: any) {
    console.error('Error deleting cache by pattern:', error.message);
  }
};

const invalidateCache = async (code: string | null = null): Promise<void> => {
  await deleteCacheByPattern('commodities:*');
  if (code) {
    await deleteCacheByPattern(`commodity:code:${code}`);
    await deleteCacheByPattern(`commodity:pricehistory:${code}`);
  }
};

const paramToString = (param: string | string[]): string => {
  return Array.isArray(param) ? param[0] : param;
};

const getDateRange = (period: string): Date | null => {
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

export const getAllCommodities = async (req: Request, res: Response): Promise<void> => {
  try {
    const cacheKey = 'commodities:all';
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

    const commodities = await Commodity.find();
    await setCache(cacheKey, commodities);

    res.status(200).json({
      success: true,
      code: 200,
      fromCache: false,
      data: commodities,
    });
  } catch (error: any) {
    console.error('Get all commodities error:', error);
    res.status(500).json({
      success: false,
      code: 500,
      message: 'Internal server error fetching commodities',
      errorId: `ERR-${Date.now()}`,
    });
  }
};

export const getCommodityByCode = async (req: Request, res: Response): Promise<void> => {
  try {
    const code = paramToString(req.params.code);

    const cacheKey = `commodity:code:${code}`;
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

    const commodity = await Commodity.findOne({ code });
    if (!commodity) {
      res.status(404).json({
        success: false,
        code: 404,
        message: 'Commodity not found',
        details: { code },
      });
      return;
    }

    await setCache(cacheKey, commodity);

    res.status(200).json({
      success: true,
      code: 200,
      fromCache: false,
      data: commodity,
    });
  } catch (error: any) {
    console.error('Get commodity error:', error);
    res.status(500).json({
      success: false,
      code: 500,
      message: 'Internal server error fetching commodity',
      errorId: `ERR-${Date.now()}`,
    });
  }
};

export const createCommodity = async (req: Request, res: Response): Promise<void> => {
  try {
    const { code, name, unit, category, currentPrice, percentage_change } = req.body;

    const requiredFields = ['code', 'name', 'unit', 'category', 'currentPrice'];
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

    const existingCommodity = await Commodity.findOne({ code });
    if (existingCommodity) {
      res.status(400).json({
        success: false,
        code: 400,
        message: 'Commodity with this code already exists',
        details: {
          duplicateField: 'code',
          duplicateValue: code,
        },
      });
      return;
    }

    const commodity = await Commodity.create({
      code,
      name,
      unit,
      category,
      currentPrice,
      percentage_change: percentage_change || 0,
      last_updated: new Date(),
    });

    await PriceHistory.create({
      commodity_code: code,
      history: [{
        date: new Date(),
        price: currentPrice,
      }],
    });

    await invalidateCache(code);
    publishCommodityUpdate(code, commodity);

    res.status(201).json({
      success: true,
      code: 201,
      message: 'Commodity created successfully',
      data: commodity,
    });
  } catch (error: any) {
    if (error.code === 11000) {
      res.status(400).json({
        success: false,
        code: 400,
        message: 'Duplicate entry. Commodity code already exists',
        details: {
          duplicateField: 'code',
          duplicateValue: error.keyValue.code,
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

    console.error('Create commodity error:', error);
    res.status(500).json({
      success: false,
      code: 500,
      message: 'Internal server error creating commodity',
      errorId: `ERR-${Date.now()}`,
    });
  }
};

export const updateCommodity = async (req: Request, res: Response): Promise<void> => {
  try {
    const code = paramToString(req.params.code);
    const { currentPrice, ...updateData } = req.body;

    const commodity = await Commodity.findOne({ code });
    if (!commodity) {
      res.status(404).json({
        success: false,
        code: 404,
        message: 'Commodity not found',
        details: { code },
      });
      return;
    }

    const updateOperations: any = {
      $set: {
        ...updateData,
        last_updated: new Date(),
      },
    };

    const oldPrice = commodity.currentPrice;

    if (currentPrice !== undefined && currentPrice !== oldPrice) {
      const percentage_change =
        ((currentPrice - oldPrice) / oldPrice) * 100;

      updateOperations.$set.currentPrice = currentPrice;
      updateOperations.$set.percentage_change = parseFloat(
        percentage_change.toFixed(4),
      );
    }

    const updatedCommodity = await Commodity.findOneAndUpdate(
      { code },
      updateOperations,
      { new: true, runValidators: true },
    );

    if (currentPrice !== undefined && currentPrice !== oldPrice) {
      await PriceHistory.findOneAndUpdate(
        { commodity_code: code },
        {
          $push: {
            history: {
              $each: [{
                date: new Date(),
                price: currentPrice,
              }],
              $position: 0,
            },
          },
        },
        { upsert: true }
      );
    }

    await invalidateCache(code);
    publishCommodityUpdate(code, updatedCommodity);

    res.status(200).json({
      success: true,
      code: 200,
      message: 'Commodity updated successfully',
      data: updatedCommodity,
    });
  } catch (error: any) {
    if (error.code === 11000) {
      res.status(400).json({
        success: false,
        code: 400,
        message: 'Duplicate entry. Commodity code already exists',
        details: {
          duplicateField: 'code',
          duplicateValue: error.keyValue.code,
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

    console.error('Update commodity error:', error);
    res.status(500).json({
      success: false,
      code: 500,
      message: 'Internal server error updating commodity',
      errorId: `ERR-${Date.now()}`,
    });
  }
};

export const deleteCommodity = async (req: Request, res: Response): Promise<void> => {
  try {
    const code = paramToString(req.params.code);

    const deletedCommodity = await Commodity.findOneAndDelete({ code });
    if (!deletedCommodity) {
      res.status(404).json({
        success: false,
        code: 404,
        message: 'Commodity not found',
        details: { code },
      });
      return;
    }

    await PriceHistory.findOneAndDelete({ commodity_code: code });
    await invalidateCache(code);

    res.status(200).json({
      success: true,
      code: 200,
      message: 'Commodity deleted successfully',
      data: {
        code: deletedCommodity.code,
        name: deletedCommodity.name,
      },
    });
  } catch (error: any) {
    console.error('Delete commodity error:', error);
    res.status(500).json({
      success: false,
      code: 500,
      message: 'Internal server error deleting commodity',
      errorId: `ERR-${Date.now()}`,
    });
  }
};

export const getCommodityHistory = async (req: Request, res: Response): Promise<void> => {
  try {
    const code = paramToString(req.params.code);
    const { period = 'all', limit = 100 } = req.query;

    const cacheKey = `commodity:pricehistory:${code}:${period}:${limit}`;
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

    const commodity = await Commodity.findOne({ code });
    if (!commodity) {
      res.status(404).json({
        success: false,
        code: 404,
        message: 'Commodity not found',
        details: { code },
      });
      return;
    }

    const startDate = getDateRange(period as string);
    
    let query: any = { commodity_code: code };
    
    if (startDate) {
      query['history.date'] = { $gte: startDate };
    }

    const priceHistory = await PriceHistory.aggregate([
      { $match: { commodity_code: code } },
      { $unwind: '$history' },
      ...(startDate ? [{ $match: { 'history.date': { $gte: startDate } } }] : []),
      { $sort: { 'history.date': -1 } },
      { $limit: Number(limit) },
      { $group: {
        _id: '$_id',
        commodity_code: { $first: '$commodity_code' },
        history: { $push: '$history' },
        createdAt: { $first: '$createdAt' },
        updatedAt: { $first: '$updatedAt' }
      }}
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
      code: commodity.code,
      name: commodity.name,
      unit: commodity.unit,
      category: commodity.category,
      currentPrice: commodity.currentPrice,
      percentage_change: commodity.percentage_change,
      ...priceHistory[0]
    };

    await setCache(cacheKey, result, 300);

    res.status(200).json({
      success: true,
      code: 200,
      fromCache: false,
      data: result,
    });
  } catch (error: any) {
    console.error('Get commodity history error:', error);
    res.status(500).json({
      success: false,
      code: 500,
      message: 'Internal server error fetching commodity history',
      errorId: `ERR-${Date.now()}`,
    });
  }
};

export const addCommodityHistory = async (req: Request, res: Response): Promise<void> => {
  try {
    const code = paramToString(req.params.code);
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

    const commodity = await Commodity.findOne({ code });
    if (!commodity) {
      res.status(404).json({
        success: false,
        code: 404,
        message: 'Commodity not found',
        details: { code },
      });
      return;
    }

    const newPriceEntry = {
      date: date ? new Date(date) : new Date(),
      price: Number(price),
    };

    const priceHistory = await PriceHistory.findOneAndUpdate(
      { commodity_code: code },
      {
        $push: {
          history: {
            $each: [newPriceEntry],
            $position: 0,
          },
        },
      },
      { upsert: true, new: true }
    );

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
        code: commodity.code,
        name: commodity.name,
        new_price_entry: newPriceEntry,
        total_history_entries: priceHistory.history.length,
      },
    });
  } catch (error: any) {
    console.error('Add commodity history error:', error);
    res.status(500).json({
      success: false,
      code: 500,
      message: 'Internal server error adding price history',
      errorId: `ERR-${Date.now()}`,
    });
  }
};

export const updateCommodityPrice = async (req: Request, res: Response): Promise<void> => {
  try {
    const code = paramToString(req.params.code);
    const { currentPrice } = req.body;

    if (!currentPrice) {
      res.status(400).json({
        success: false,
        code: 400,
        message: 'Current price is required',
        details: { required: ['currentPrice'] },
      });
      return;
    }

    const commodity = await Commodity.findOne({ code });
    if (!commodity) {
      res.status(404).json({
        success: false,
        code: 404,
        message: 'Commodity not found',
        details: { code },
      });
      return;
    }

    const updateOperations: any = {
      $set: {
        last_updated: new Date(),
      },
    };

    if (currentPrice !== commodity.currentPrice) {
      const percentage_change =
        ((currentPrice - commodity.currentPrice) / commodity.currentPrice) * 100;
      updateOperations.$set.currentPrice = currentPrice;
      updateOperations.$set.percentage_change = parseFloat(
        percentage_change.toFixed(4),
      );

      await PriceHistory.findOneAndUpdate(
        { commodity_code: code },
        {
          $push: {
            history: {
              $each: [{
                date: new Date(),
                price: currentPrice,
              }],
              $position: 0,
            },
          },
        },
        { upsert: true }
      );
    }

    const updatedCommodity = await Commodity.findOneAndUpdate(
      { code },
      updateOperations,
      { new: true },
    );

    await invalidateCache(code);
    publishCommodityUpdate(code, updatedCommodity);

    res.status(200).json({
      success: true,
      code: 200,
      message: 'Commodity price updated successfully',
      data: updatedCommodity,
    });
  } catch (error: any) {
    console.error('Update commodity price error:', error);
    res.status(500).json({
      success: false,
      code: 500,
      message: 'Internal server error updating commodity price',
      errorId: `ERR-${Date.now()}`,
    });
  }
};

export const addPriceEntry = async (req: Request, res: Response): Promise<void> => {
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

    const commodity = await Commodity.findOne({ code });
    if (!commodity) {
      res.status(404).json({
        success: false,
        code: 404,
        message: 'Commodity not found',
        details: { code },
      });
      return;
    }

    const newEntry = {
      date: new Date(date),
      price: Number(price),
    };

    const priceHistory = await PriceHistory.findOneAndUpdate(
      { commodity_code: code },
      {
        $push: {
          history: {
            $each: [newEntry],
            $position: 0,
          },
        },
      },
      { upsert: true, new: true }
    );

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
        code: commodity.code,
        name: commodity.name,
        newEntry,
        totalEntries: priceHistory.history.length,
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

export const updateLatestPrice = async (req: Request, res: Response): Promise<void> => {
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

    const commodity = await Commodity.findOne({ code });

    if (!commodity) {
      res.status(404).json({
        success: false,
        code: 404,
        message: 'Commodity not found',
        details: { code },
      });
      return;
    }

    const priceHistory = await PriceHistory.findOne({ commodity_code: code });
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

    commodity.currentPrice = Number(price);
    commodity.percentage_change = parseFloat(percentage_change.toFixed(4));
    commodity.last_updated = new Date();
    await commodity.save();

    await invalidateCache(code);
    publishCommodityUpdate(code, commodity);

    res.status(200).json({
      success: true,
      code: 200,
      message: 'Latest price updated successfully',
      data: {
        code: commodity.code,
        name: commodity.name,
        latestPrice: {
          date: priceHistory.history[0].date,
          price: priceHistory.history[0].price,
        },
        currentPrice: commodity.currentPrice,
        percentage_change: commodity.percentage_change,
        totalEntries: priceHistory.history.length,
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

export const getCommodityHistoryByPeriod = async (req: Request, res: Response): Promise<void> => {
  try {
    const code = paramToString(req.params.code);
    const { period } = req.params;
    const { limit = 100 } = req.query;

    const validPeriods = ['1d', '1w', '1m', '3m', '6m', '1y', '5y', '10y', '20y', 'all'];
    
    if (!validPeriods.includes(period as string)) {
      res.status(400).json({
        success: false,
        code: 400,
        message: 'Invalid period. Must be one of: 1d, 1w, 1m, 3m, 6m, 1y, 5y, 10y, 20y, all',
        details: { period },
      });
      return;
    }

    const cacheKey = `commodity:pricehistory:${code}:${period}:${limit}`;
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

    const commodity = await Commodity.findOne({ code });
    if (!commodity) {
      res.status(404).json({
        success: false,
        code: 404,
        message: 'Commodity not found',
        details: { code },
      });
      return;
    }

    const startDate = getDateRange(period as string);
    
    let query: any = { commodity_code: code };
    
    if (startDate) {
      query['history.date'] = { $gte: startDate };
    }

    const priceHistory = await PriceHistory.aggregate([
      { $match: { commodity_code: code } },
      { $unwind: '$history' },
      ...(startDate ? [{ $match: { 'history.date': { $gte: startDate } } }] : []),
      { $sort: { 'history.date': -1 } },
      { $limit: Number(limit) },
      { $group: {
        _id: '$_id',
        commodity_code: { $first: '$commodity_code' },
        history: { $push: '$history' },
        createdAt: { $first: '$createdAt' },
        updatedAt: { $first: '$updatedAt' }
      }}
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
      code: commodity.code,
      name: commodity.name,
      unit: commodity.unit,
      category: commodity.category,
      currentPrice: commodity.currentPrice,
      percentage_change: commodity.percentage_change,
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
  } catch (error: any) {
    console.error('Get commodity history by period error:', error);
    res.status(500).json({
      success: false,
      code: 500,
      message: 'Internal server error fetching commodity history',
      errorId: `ERR-${Date.now()}`,
    });
  }
};

export const getLatestPriceHistory = async (req: Request, res: Response): Promise<void> => {
  try {
    const code = paramToString(req.params.code);
    const { limit = 30 } = req.query;

    const cacheKey = `commodity:pricehistory:${code}:latest:${limit}`;
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

    const commodity = await Commodity.findOne({ code });
    if (!commodity) {
      res.status(404).json({
        success: false,
        code: 404,
        message: 'Commodity not found',
        details: { code },
      });
      return;
    }

    const priceHistory = await PriceHistory.findOne(
      { commodity_code: code },
      { 'history': { $slice: Number(limit) } }
    ).sort({ updatedAt: -1 });

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
      code: commodity.code,
      name: commodity.name,
      unit: commodity.unit,
      category: commodity.category,
      currentPrice: commodity.currentPrice,
      percentage_change: commodity.percentage_change,
      ...priceHistory.toObject()
    };

    await setCache(cacheKey, result, 300);

    res.status(200).json({
      success: true,
      code: 200,
      fromCache: false,
      data: result,
    });
  } catch (error: any) {
    console.error('Get latest price history error:', error);
    res.status(500).json({
      success: false,
      code: 500,
      message: 'Internal server error fetching latest price history',
      errorId: `ERR-${Date.now()}`,
    });
  }
};

export const updatePriceHistoryEntry = async (req: Request, res: Response): Promise<void> => {
  try {
    const { code, entryId } = req.params;
    const codeStr = paramToString(code);
    const { price, date } = req.body;

    const priceHistory = await PriceHistory.findOne({ commodity_code: codeStr });
    if (!priceHistory) {
      res.status(404).json({
        success: false,
        code: 404,
        message: 'Price history not found',
        details: { code: codeStr },
      });
      return;
    }

    const entryIndex = priceHistory.history.findIndex(
      (entry: any) => entry._id.toString() === entryId
    );

    if (entryIndex === -1) {
      res.status(404).json({
        success: false,
        code: 404,
        message: 'Price history entry not found',
        details: { entryId },
      });
      return;
    }

    if (price !== undefined) priceHistory.history[entryIndex].price = Number(price);
    if (date) priceHistory.history[entryIndex].date = new Date(date);

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
  } catch (error: any) {
    console.error('Update price history entry error:', error);
    res.status(500).json({
      success: false,
      code: 500,
      message: 'Internal server error updating price history entry',
      errorId: `ERR-${Date.now()}`,
    });
  }
};

export const deletePriceHistoryEntry = async (req: Request, res: Response): Promise<void> => {
  try {
    const { code, entryId } = req.params;
    const codeStr = paramToString(code);

    const priceHistory = await PriceHistory.findOneAndUpdate(
      { commodity_code: codeStr },
      { $pull: { history: { _id: entryId } } },
      { new: true }
    );

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
  } catch (error: any) {
    console.error('Delete price history entry error:', error);
    res.status(500).json({
      success: false,
      code: 500,
      message: 'Internal server error deleting price history entry',
      errorId: `ERR-${Date.now()}`,
    });
  }
};

export const clearPriceHistory = async (req: Request, res: Response): Promise<void> => {
  try {
    const code = paramToString(req.params.code);

    const priceHistory = await PriceHistory.findOneAndUpdate(
      { commodity_code: code },
      { $set: { history: [] } },
      { new: true }
    );

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
  } catch (error: any) {
    console.error('Clear price history error:', error);
    res.status(500).json({
      success: false,
      code: 500,
      message: 'Internal server error clearing price history',
      errorId: `ERR-${Date.now()}`,
    });
  }
};