import type { Request, Response } from 'express';
import Forex, { PriceHistory } from '../models/forex.model';
import { getRedisClient } from '../lib/redis';
import { publishForexUpdate } from '../lib/realtime/ws';

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

const invalidateCache = async (code: string | null = null): Promise<void> => {
  await deleteCacheByPattern('forex:*');
  if (code) {
    await deleteCacheByPattern(`forex:code:${code}`);
    await deleteCacheByPattern(`forex:pricehistory:${code}`);
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

export const createForex = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      code,
      name,
      from_currency,
      from_code,
      to_currency,
      to_code,
      currentPrice,
      percentage_change,
      monthly_change,
      yearly_change,
    } = req.body;

    if (
      !from_code ||
      from_code.length !== 3 ||
      !to_code ||
      to_code.length !== 3
    ) {
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
      'code',
      'name',
      'from_currency',
      'from_code',
      'to_currency',
      'to_code',
      'currentPrice',
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

    const newForex = new Forex({
      code,
      name,
      from_currency,
      from_code: from_code.toUpperCase(),
      to_currency,
      to_code: to_code.toUpperCase(),
      currentPrice,
      percentage_change: percentage_change || 0,
      monthly_change: monthly_change || 0,
      yearly_change: yearly_change || 0,
      last_updated: new Date(),
    });

    const savedForex = await newForex.save();

    await PriceHistory.create({
      forex_code: code,
      history: [{
        date: new Date(),
        price: currentPrice,
      }],
    });

    await invalidateCache(code);
    publishForexUpdate(code, savedForex);

    res.status(201).json({
      success: true,
      code: 201,
      message: 'Forex pair created successfully',
      data: savedForex,
    });
  } catch (error: any) {
    if (error.code === 11000) {
      res.status(400).json({
        success: false,
        code: 400,
        message: 'Duplicate entry. Forex code already exists',
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

    console.error('Create error:', error);
    res.status(500).json({
      success: false,
      code: 500,
      message: 'Internal server error creating Forex pair',
      errorId: `ERR-${Date.now()}`,
    });
  }
};

export const getAllForex = async (req: Request, res: Response): Promise<void> => {
  try {
    const cacheKey = 'forex:all';
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

    const forexPairs = await Forex.find();
    await setCache(cacheKey, forexPairs);

    res.status(200).json({
      success: true,
      code: 200,
      fromCache: false,
      data: forexPairs,
    });
  } catch (error: any) {
    console.error('Get all error:', error);
    res.status(500).json({
      success: false,
      code: 500,
      message: 'Internal server error fetching Forex pairs',
      errorId: `ERR-${Date.now()}`,
    });
  }
};

export const getForex = async (req: Request, res: Response): Promise<void> => {
  try {
    const code = paramToString(req.params.code);

    const cacheKey = `forex:code:${code}`;
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

    const forex = await Forex.findOne({ code });
    if (!forex) {
      res.status(404).json({
        success: false,
        code: 404,
        message: 'Forex pair not found',
        details: { code },
      });
      return;
    }

    await setCache(cacheKey, forex);

    res.status(200).json({
      success: true,
      code: 200,
      fromCache: false,
      data: forex,
    });
  } catch (error: any) {
    console.error('Get by code error:', error);
    res.status(500).json({
      success: false,
      code: 500,
      message: 'Internal server error fetching Forex pair',
      errorId: `ERR-${Date.now()}`,
    });
  }
};

export const updateForex = async (req: Request, res: Response): Promise<void> => {
  try {
    const code = paramToString(req.params.code);
    const { currentPrice, ...updateData } = req.body;

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

    const forex = await Forex.findOne({ code });
    if (!forex) {
      res.status(404).json({
        success: false,
        code: 404,
        message: 'Forex pair not found',
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

    const oldPrice = forex.currentPrice;

    if (currentPrice !== undefined && currentPrice !== oldPrice) {
      const percentage_change =
        ((currentPrice - oldPrice) / oldPrice) * 100;

      updateOperations.$set.currentPrice = currentPrice;
      updateOperations.$set.percentage_change = parseFloat(
        percentage_change.toFixed(4),
      );
    }

    const updatedForex = await Forex.findOneAndUpdate(
      { code },
      updateOperations,
      { new: true },
    );

    if (currentPrice !== undefined && currentPrice !== oldPrice) {
      await PriceHistory.findOneAndUpdate(
        { forex_code: code },
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
    publishForexUpdate(code, updatedForex);

    res.status(200).json({
      success: true,
      code: 200,
      message: 'Forex pair updated successfully',
      data: updatedForex,
    });
  } catch (error: any) {
    if (error.code === 11000) {
      res.status(400).json({
        success: false,
        code: 400,
        message: 'Duplicate entry. Forex code already exists',
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

    console.error('Update error:', error);
    res.status(500).json({
      success: false,
      code: 500,
      message: 'Internal server error updating Forex pair',
      errorId: `ERR-${Date.now()}`,
    });
  }
};

export const deleteForex = async (req: Request, res: Response): Promise<void> => {
  try {
    const code = paramToString(req.params.code);

    const deletedForex = await Forex.findOneAndDelete({ code });
    if (!deletedForex) {
      res.status(404).json({
        success: false,
        code: 404,
        message: 'Forex pair not found',
        details: { code },
      });
      return;
    }

    await PriceHistory.findOneAndDelete({ forex_code: code });
    await invalidateCache(code);

    res.status(200).json({
      success: true,
      code: 200,
      message: 'Forex pair deleted successfully',
      data: {
        code: deletedForex.code,
        name: deletedForex.name,
      },
    });
  } catch (error: any) {
    console.error('Delete error:', error);
    res.status(500).json({
      success: false,
      code: 500,
      message: 'Internal server error deleting Forex pair',
      errorId: `ERR-${Date.now()}`,
    });
  }
};

export const getForexHistory = async (req: Request, res: Response): Promise<void> => {
  try {
    const code = paramToString(req.params.code);
    const { period = 'all', limit = 100 } = req.query;

    const cacheKey = `forex:pricehistory:${code}:${period}:${limit}`;
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

    const forex = await Forex.findOne({ code });
    if (!forex) {
      res.status(404).json({
        success: false,
        code: 404,
        message: 'Forex pair not found',
        details: { code },
      });
      return;
    }

    const startDate = getDateRange(period as string);
    
    let query: any = { forex_code: code };
    
    if (startDate) {
      query['history.date'] = { $gte: startDate };
    }

    const priceHistory = await PriceHistory.aggregate([
      { $match: { forex_code: code } },
      { $unwind: '$history' },
      ...(startDate ? [{ $match: { 'history.date': { $gte: startDate } } }] : []),
      { $sort: { 'history.date': -1 } },
      { $limit: Number(limit) },
      { $group: {
        _id: '$_id',
        forex_code: { $first: '$forex_code' },
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
      code: forex.code,
      name: forex.name,
      from_currency: forex.from_currency,
      from_code: forex.from_code,
      to_currency: forex.to_currency,
      to_code: forex.to_code,
      currentPrice: forex.currentPrice,
      percentage_change: forex.percentage_change,
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
    console.error('Get history error:', error);
    res.status(500).json({
      success: false,
      code: 500,
      message: 'Internal server error fetching price history',
      errorId: `ERR-${Date.now()}`,
    });
  }
};

export const addForexHistory = async (req: Request, res: Response): Promise<void> => {
  try {
    const code = paramToString(req.params.code);
    const { date, price } = req.body;

    if (!price) {
      res.status(400).json({
        success: false,
        code: 400,
        message: 'Price is required',
        details: {
          required: ['price'],
        },
      });
      return;
    }

    const forex = await Forex.findOne({ code });
    if (!forex) {
      res.status(404).json({
        success: false,
        code: 404,
        message: 'Forex pair not found',
        details: { code },
      });
      return;
    }

    const newPriceEntry = {
      date: date ? new Date(date) : new Date(),
      price: Number(price),
    };

    const priceHistory = await PriceHistory.findOneAndUpdate(
      { forex_code: code },
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
        code: forex.code,
        name: forex.name,
        new_price_entry: newPriceEntry,
        total_history_entries: priceHistory.history.length,
      },
    });
  } catch (error: any) {
    console.error('Add history error:', error);
    res.status(500).json({
      success: false,
      code: 500,
      message: 'Internal server error adding price history',
      errorId: `ERR-${Date.now()}`,
    });
  }
};

export const updateForexPrice = async (req: Request, res: Response): Promise<void> => {
  try {
    const code = paramToString(req.params.code);
    const { currentPrice } = req.body;

    if (!currentPrice) {
      res.status(400).json({
        success: false,
        code: 400,
        message: 'Current price is required',
        details: {
          required: ['currentPrice'],
        },
      });
      return;
    }

    const forex = await Forex.findOne({ code });
    if (!forex) {
      res.status(404).json({
        success: false,
        code: 404,
        message: 'Forex pair not found',
        details: { code },
      });
      return;
    }

    const updateOperations: any = {
      $set: {
        last_updated: new Date(),
      },
    };

    if (currentPrice !== forex.currentPrice) {
      const percentage_change =
        ((currentPrice - forex.currentPrice) / forex.currentPrice) * 100;
      updateOperations.$set.currentPrice = currentPrice;
      updateOperations.$set.percentage_change = parseFloat(
        percentage_change.toFixed(4),
      );

      await PriceHistory.findOneAndUpdate(
        { forex_code: code },
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

    const updatedForex = await Forex.findOneAndUpdate(
      { code },
      updateOperations,
      { new: true },
    );

    await invalidateCache(code);
    publishForexUpdate(code, updatedForex);

    res.status(200).json({
      success: true,
      code: 200,
      message: 'Forex price updated successfully',
      data: updatedForex,
    });
  } catch (error: any) {
    console.error('Update price error:', error);
    res.status(500).json({
      success: false,
      code: 500,
      message: 'Internal server error updating Forex price',
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

    const forex = await Forex.findOne({ code });
    if (!forex) {
      res.status(404).json({
        success: false,
        code: 404,
        message: 'Forex pair not found',
        details: { code },
      });
      return;
    }

    const newEntry = {
      date: new Date(date),
      price: Number(price),
    };

    const priceHistory = await PriceHistory.findOneAndUpdate(
      { forex_code: code },
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
        code: forex.code,
        name: forex.name,
        from_currency: forex.from_currency,
        to_currency: forex.to_currency,
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

    const forex = await Forex.findOne({ code });

    if (!forex) {
      res.status(404).json({
        success: false,
        code: 404,
        message: 'Forex pair not found',
        details: { code },
      });
      return;
    }

    const priceHistory = await PriceHistory.findOne({ forex_code: code });
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

    forex.currentPrice = Number(price);
    forex.percentage_change = parseFloat(percentage_change.toFixed(4));
    forex.last_updated = new Date();
    await forex.save();

    await invalidateCache(code);

    res.status(200).json({
      success: true,
      code: 200,
      message: 'Latest price updated successfully',
      data: {
        code: forex.code,
        name: forex.name,
        from_currency: forex.from_currency,
        to_currency: forex.to_currency,
        latestPrice: {
          date: priceHistory.history[0].date,
          price: priceHistory.history[0].price,
        },
        currentPrice: forex.currentPrice,
        percentage_change: forex.percentage_change,
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

export const getForexHistoryByPeriod = async (req: Request, res: Response): Promise<void> => {
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

    const cacheKey = `forex:pricehistory:${code}:${period}:${limit}`;
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

    const forex = await Forex.findOne({ code });
    if (!forex) {
      res.status(404).json({
        success: false,
        code: 404,
        message: 'Forex pair not found',
        details: { code },
      });
      return;
    }

    const startDate = getDateRange(period as string);
    
    let query: any = { forex_code: code };
    
    if (startDate) {
      query['history.date'] = { $gte: startDate };
    }

    const priceHistory = await PriceHistory.aggregate([
      { $match: { forex_code: code } },
      { $unwind: '$history' },
      ...(startDate ? [{ $match: { 'history.date': { $gte: startDate } } }] : []),
      { $sort: { 'history.date': -1 } },
      { $limit: Number(limit) },
      { $group: {
        _id: '$_id',
        forex_code: { $first: '$forex_code' },
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
      code: forex.code,
      name: forex.name,
      from_currency: forex.from_currency,
      from_code: forex.from_code,
      to_currency: forex.to_currency,
      to_code: forex.to_code,
      currentPrice: forex.currentPrice,
      percentage_change: forex.percentage_change,
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
    console.error('Get history by period error:', error);
    res.status(500).json({
      success: false,
      code: 500,
      message: 'Internal server error fetching price history',
      errorId: `ERR-${Date.now()}`,
    });
  }
};

export const getLatestPriceHistory = async (req: Request, res: Response): Promise<void> => {
  try {
    const code = paramToString(req.params.code);
    const { limit = 30 } = req.query;

    const cacheKey = `forex:pricehistory:${code}:latest:${limit}`;
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

    const forex = await Forex.findOne({ code });
    if (!forex) {
      res.status(404).json({
        success: false,
        code: 404,
        message: 'Forex pair not found',
        details: { code },
      });
      return;
    }

    const priceHistory = await PriceHistory.findOne(
      { forex_code: code },
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
      code: forex.code,
      name: forex.name,
      from_currency: forex.from_currency,
      from_code: forex.from_code,
      to_currency: forex.to_currency,
      to_code: forex.to_code,
      currentPrice: forex.currentPrice,
      percentage_change: forex.percentage_change,
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

    const priceHistory = await PriceHistory.findOne({ forex_code: codeStr });
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
      { forex_code: codeStr },
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
      { forex_code: code },
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
interface BulkCreateResult {
  successful: Array<{ code: string; operation: string; id?: string }>;
  failed: Array<{ code?: string; operation: string; error: string; data?: any }>;
}

interface BulkUpdateResult {
  successful: Array<{ code: string; operation: string }>;
  failed: Array<{ code?: string; operation: string; error: string }>;
}

export const bulkCreateForex = async (req: Request, res: Response): Promise<void> => {
  try {
    const { forexPairs } = req.body;
    
    if (!forexPairs || !Array.isArray(forexPairs) || forexPairs.length === 0) {
      res.status(400).json({
        success: false,
        code: 400,
        message: 'Forex pairs array is required and must not be empty',
        details: { required: ['forexPairs'] },
      });
      return;
    }

    const result: BulkCreateResult = {
      successful: [],
      failed: [],
    };

    for (const forexData of forexPairs) {
      try {
        const { code, currentPrice } = forexData;
        
        if (!code) {
          result.failed.push({
            operation: 'create_forex',
            error: 'Forex code is required',
            data: forexData,
          });
          continue;
        }

        if (!currentPrice) {
          result.failed.push({
            code,
            operation: 'create_forex',
            error: 'Current price is required',
            data: forexData,
          });
          continue;
        }

        const existingForex = await Forex.findOne({ code });
        if (existingForex) {
          result.failed.push({
            code,
            operation: 'create_forex',
            error: 'Forex pair already exists',
            data: forexData,
          });
          continue;
        }

        if (forexData.from_code && forexData.from_code.length !== 3) {
          result.failed.push({
            code,
            operation: 'create_forex',
            error: 'From currency code must be exactly 3 characters',
            data: forexData,
          });
          continue;
        }

        if (forexData.to_code && forexData.to_code.length !== 3) {
          result.failed.push({
            code,
            operation: 'create_forex',
            error: 'To currency code must be exactly 3 characters',
            data: forexData,
          });
          continue;
        }

        const newForex = new Forex({
          ...forexData,
          from_code: forexData.from_code?.toUpperCase(),
          to_code: forexData.to_code?.toUpperCase(),
          percentage_change: forexData.percentage_change || 0,
          last_updated: new Date(),
        });

        const savedForex = await newForex.save();

        await PriceHistory.create({
          forex_code: code,
          history: [{
            date: new Date(),
            price: currentPrice,
          }],
        });

        await invalidateCache(code);
        
        result.successful.push({
          code,
          operation: 'create_forex',
          id: savedForex._id.toString(),
        });
      } catch (error: any) {
        result.failed.push({
          code: forexData.code,
          operation: 'create_forex',
          error: error.message,
          data: forexData,
        });
      }
    }

    res.status(201).json({
      success: true,
      code: 201,
      message: `Bulk forex creation completed: ${result.successful.length} successful, ${result.failed.length} failed`,
      data: result,
    });
  } catch (error: any) {
    console.error('Bulk create forex error:', error);
    res.status(500).json({
      success: false,
      code: 500,
      message: 'Internal server error during bulk forex creation',
      errorId: `ERR-${Date.now()}`,
    });
  }
};

export const bulkUpdateForex = async (req: Request, res: Response): Promise<void> => {
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
        const { code, data } = update;
        
        if (!code || !data) {
          result.failed.push({
            code,
            operation: 'update_forex',
            error: 'Forex code and update data are required',
          });
          continue;
        }

        const forex = await Forex.findOne({ code });
        if (!forex) {
          result.failed.push({
            code,
            operation: 'update_forex',
            error: 'Forex pair not found',
          });
          continue;
        }

        const updateOperations: any = {
          $set: {
            ...data,
            last_updated: new Date(),
          },
        };

        if (data.currentPrice !== undefined && data.currentPrice !== forex.currentPrice) {
          const percentage_change = ((data.currentPrice - forex.currentPrice) / forex.currentPrice) * 100;
          updateOperations.$set.currentPrice = data.currentPrice;
          updateOperations.$set.percentage_change = parseFloat(percentage_change.toFixed(4));

          await PriceHistory.findOneAndUpdate(
            { forex_code: code },
            {
              $push: {
                history: {
                  $each: [{
                    date: new Date(),
                    price: data.currentPrice,
                  }],
                  $position: 0,
                },
              },
            },
            { upsert: true }
          );
        }

        const updatedForex = await Forex.findOneAndUpdate(
          { code },
          updateOperations,
          { new: true }
        );

        await invalidateCache(code);
        
        result.successful.push({
          code,
          operation: 'update_forex',
        });
      } catch (error: any) {
        result.failed.push({
          code: update.code,
          operation: 'update_forex',
          error: error.message,
        });
      }
    }

    res.status(200).json({
      success: true,
      code: 200,
      message: `Bulk forex update completed: ${result.successful.length} successful, ${result.failed.length} failed`,
      data: result,
    });
  } catch (error: any) {
    console.error('Bulk update forex error:', error);
    res.status(500).json({
      success: false,
      code: 500,
      message: 'Internal server error during bulk forex update',
      errorId: `ERR-${Date.now()}`,
    });
  }
};

export const bulkAddPriceHistoryEntries = async (req: Request, res: Response): Promise<void> => {
  try {
    const { entries } = req.body;
    
    if (!entries || !Array.isArray(entries) || entries.length === 0) {
      res.status(400).json({
        success: false,
        code: 400,
        message: 'Entries array is required and must not be empty',
        details: { 
          required: ['entries'],
          entryFormat: { code: 'string', date: 'Date', price: 'number' }
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
        const { code, date, price } = entry;
        
        if (!code || !price) {
          result.failed.push({
            code,
            operation: 'add_price_entry',
            error: 'Forex code and price are required',
          });
          continue;
        }

        const forex = await Forex.findOne({ code });
        if (!forex) {
          result.failed.push({
            code,
            operation: 'add_price_entry',
            error: 'Forex pair not found',
          });
          continue;
        }

        const newPriceEntry = {
          date: date ? new Date(date) : new Date(),
          price: Number(price),
        };

        const priceHistory = await PriceHistory.findOneAndUpdate(
          { forex_code: code },
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
        
        result.successful.push({
          code,
          operation: 'add_price_entry',
        });
      } catch (error: any) {
        result.failed.push({
          code: entry.code,
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

export const bulkDeleteForex = async (req: Request, res: Response): Promise<void> => {
  try {
    const { codes } = req.body;
    
    if (!codes || !Array.isArray(codes) || codes.length === 0) {
      res.status(400).json({
        success: false,
        code: 400,
        message: 'Forex codes array is required and must not be empty',
        details: { required: ['codes'] },
      });
      return;
    }

    const result: {
      successful: Array<{ code: string; deleted_from: string[] }>;
      failed: Array<{ code: string; error: string }>;
    } = {
      successful: [],
      failed: [],
    };

    for (const code of codes) {
      try {
        const deletedFrom: string[] = [];
        
        const deletedForex = await Forex.findOneAndDelete({ code });
        if (deletedForex) {
          deletedFrom.push('forex');
        }
        
        const deletedHistory = await PriceHistory.findOneAndDelete({ forex_code: code });
        if (deletedHistory) {
          deletedFrom.push('priceHistory');
        }
        
        if (deletedFrom.length > 0) {
          await invalidateCache(code);
          result.successful.push({ code, deleted_from: deletedFrom });
        } else {
          result.failed.push({ code, error: 'No forex data found for this code' });
        }
      } catch (error: any) {
        result.failed.push({ code, error: error.message });
      }
    }

    res.status(200).json({
      success: true,
      code: 200,
      message: `Bulk forex deletion completed: ${result.successful.length} successful, ${result.failed.length} failed`,
      data: result,
    });
  } catch (error: any) {
    console.error('Bulk delete forex error:', error);
    res.status(500).json({
      success: false,
      code: 500,
      message: 'Internal server error during bulk forex deletion',
      errorId: `ERR-${Date.now()}`,
    });
  }
};

export const bulkUpsertForex = async (req: Request, res: Response): Promise<void> => {
  try {
    const { items } = req.body;
    
    if (!items || !Array.isArray(items) || items.length === 0) {
      res.status(400).json({
        success: false,
        code: 400,
        message: 'Items array is required and must not be empty',
        details: { required: ['items'] },
      });
      return;
    }

    const result: BulkCreateResult = {
      successful: [],
      failed: [],
    };

    for (const item of items) {
      try {
        const { code, currentPrice } = item;
        
        if (!code) {
          result.failed.push({
            operation: 'upsert_forex',
            error: 'Forex code is required',
            data: item,
          });
          continue;
        }

        const existing = await Forex.findOne({ code });
        let operation = 'updated';
        
        if (existing) {
          const updateOperations: any = {
            $set: {
              ...item,
              last_updated: new Date(),
            },
          };

          if (currentPrice !== undefined && currentPrice !== existing.currentPrice) {
            const percentage_change = ((currentPrice - existing.currentPrice) / existing.currentPrice) * 100;
            updateOperations.$set.currentPrice = currentPrice;
            updateOperations.$set.percentage_change = parseFloat(percentage_change.toFixed(4));

            await PriceHistory.findOneAndUpdate(
              { forex_code: code },
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

          await Forex.findOneAndUpdate(
            { code },
            updateOperations,
            { new: true, runValidators: true }
          );
        } else {
          if (!currentPrice) {
            result.failed.push({
              code,
              operation: 'upsert_forex',
              error: 'Current price is required for new forex pairs',
              data: item,
            });
            continue;
          }

          const newForex = new Forex({
            ...item,
            percentage_change: item.percentage_change || 0,
            last_updated: new Date(),
          });
          
          await newForex.save();

          await PriceHistory.create({
            forex_code: code,
            history: [{
              date: new Date(),
              price: currentPrice,
            }],
          });
          
          operation = 'created';
        }

        await invalidateCache(code);
        
        result.successful.push({
          code,
          operation: `${operation}_forex`,
        });
      } catch (error: any) {
        result.failed.push({
          code: item.code,
          operation: 'upsert_forex',
          error: error.message,
          data: item,
        });
      }
    }

    res.status(200).json({
      success: true,
      code: 200,
      message: `Bulk forex upsert completed: ${result.successful.length} successful, ${result.failed.length} failed`,
      data: result,
    });
  } catch (error: any) {
    console.error('Bulk upsert forex error:', error);
    res.status(500).json({
      success: false,
      code: 500,
      message: 'Internal server error during bulk forex upsert',
      errorId: `ERR-${Date.now()}`,
    });
  }
};

export const bulkUpdateForexPrices = async (req: Request, res: Response): Promise<void> => {
  try {
    const { prices } = req.body;
    
    if (!prices || !Array.isArray(prices) || prices.length === 0) {
      res.status(400).json({
        success: false,
        code: 400,
        message: 'Prices array is required and must not be empty',
        details: { 
          required: ['prices'],
          priceFormat: { code: 'string', currentPrice: 'number' }
        },
      });
      return;
    }

    const result: BulkUpdateResult = {
      successful: [],
      failed: [],
    };

    for (const priceUpdate of prices) {
      try {
        const { code, currentPrice } = priceUpdate;
        
        if (!code || !currentPrice) {
          result.failed.push({
            code,
            operation: 'update_price',
            error: 'Forex code and current price are required',
          });
          continue;
        }

        const forex = await Forex.findOne({ code });
        if (!forex) {
          result.failed.push({
            code,
            operation: 'update_price',
            error: 'Forex pair not found',
          });
          continue;
        }

        const updateOperations: any = {
          $set: {
            last_updated: new Date(),
          },
        };

        if (currentPrice !== forex.currentPrice) {
          const percentage_change = ((currentPrice - forex.currentPrice) / forex.currentPrice) * 100;
          updateOperations.$set.currentPrice = currentPrice;
          updateOperations.$set.percentage_change = parseFloat(percentage_change.toFixed(4));

          await PriceHistory.findOneAndUpdate(
            { forex_code: code },
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

        await Forex.findOneAndUpdate(
          { code },
          updateOperations,
          { new: true }
        );

        await invalidateCache(code);
        
        result.successful.push({
          code,
          operation: 'update_price',
        });
      } catch (error: any) {
        result.failed.push({
          code: priceUpdate.code,
          operation: 'update_price',
          error: error.message,
        });
      }
    }

    res.status(200).json({
      success: true,
      code: 200,
      message: `Bulk price updates completed: ${result.successful.length} successful, ${result.failed.length} failed`,
      data: result,
    });
  } catch (error: any) {
    console.error('Bulk update prices error:', error);
    res.status(500).json({
      success: false,
      code: 500,
      message: 'Internal server error during bulk price updates',
      errorId: `ERR-${Date.now()}`,
    });
  }
};

export const bulkImportForex = async (req: Request, res: Response): Promise<void> => {
  try {
    const { forexList } = req.body;
    
    if (!forexList || !Array.isArray(forexList) || forexList.length === 0) {
      res.status(400).json({
        success: false,
        code: 400,
        message: 'Forex list array is required and must not be empty',
        details: {
          required: ['forexList'],
          forexFormat: {
            code: 'string (required)',
            name: 'string (required)',
            from_currency: 'string (required)',
            from_code: 'string (3 chars, required)',
            to_currency: 'string (required)',
            to_code: 'string (3 chars, required)',
            currentPrice: 'number (required)',
            priceHistory: 'array of {date, price} (optional)'
          }
        },
      });
      return;
    }

    const result: {
      successful: Array<{ code: string; collections_created: string[] }>;
      failed: Array<{ code: string; error: string; details?: any }>;
    } = {
      successful: [],
      failed: [],
    };

    for (const forexData of forexList) {
      const { code, name, from_currency, from_code, to_currency, to_code, currentPrice, priceHistory } = forexData;
      
      if (!code || !name || !from_currency || !from_code || !to_currency || !to_code || !currentPrice) {
        result.failed.push({
          code: code || 'unknown',
          error: 'Missing required fields',
          details: { required: ['code', 'name', 'from_currency', 'from_code', 'to_currency', 'to_code', 'currentPrice'] },
        });
        continue;
      }

      if (from_code.length !== 3 || to_code.length !== 3) {
        result.failed.push({
          code,
          error: 'Currency codes must be exactly 3 characters',
          details: { from_code, to_code },
        });
        continue;
      }

      const collectionsCreated: string[] = [];

      try {
        const existingForex = await Forex.findOne({ code });
        if (!existingForex) {
          const newForex = new Forex({
            code,
            name,
            from_currency,
            from_code: from_code.toUpperCase(),
            to_currency,
            to_code: to_code.toUpperCase(),
            currentPrice,
            percentage_change: forexData.percentage_change || 0,
            monthly_change: forexData.monthly_change || 0,
            yearly_change: forexData.yearly_change || 0,
            last_updated: new Date(),
          });
          await newForex.save();
          collectionsCreated.push('forex');
        } else {
          collectionsCreated.push('forex (already exists)');
        }

        const historyEntries = priceHistory || [{ date: new Date(), price: currentPrice }];
        
        const existingHistory = await PriceHistory.findOne({ forex_code: code });
        if (!existingHistory) {
          await PriceHistory.create({
            forex_code: code,
            history: historyEntries.map((entry: any) => ({
              date: new Date(entry.date),
              price: entry.price,
            })),
          });
          collectionsCreated.push('priceHistory');
        } else {
          const newEntries = historyEntries.map((entry: any) => ({
            date: new Date(entry.date),
            price: entry.price,
          }));
          
          await PriceHistory.findOneAndUpdate(
            { forex_code: code },
            {
              $push: {
                history: {
                  $each: newEntries,
                  $position: 0,
                },
              },
            }
          );
          collectionsCreated.push('priceHistory (updated)');
        }

        const priceHistoryDoc = await PriceHistory.findOne({ forex_code: code });
        if (priceHistoryDoc && priceHistoryDoc.history.length > 5000) {
          priceHistoryDoc.history = priceHistoryDoc.history.slice(0, 5000);
          await priceHistoryDoc.save();
        }

        await invalidateCache(code);
        
        result.successful.push({
          code,
          collections_created: collectionsCreated,
        });
      } catch (error: any) {
        result.failed.push({
          code,
          error: error.message,
          details: { collections_created_before_error: collectionsCreated },
        });
      }
    }

    res.status(201).json({
      success: true,
      code: 201,
      message: `Bulk forex import completed: ${result.successful.length} successful, ${result.failed.length} failed`,
      data: result,
    });
  } catch (error: any) {
    console.error('Bulk import forex error:', error);
    res.status(500).json({
      success: false,
      code: 500,
      message: 'Internal server error during bulk forex import',
      errorId: `ERR-${Date.now()}`,
    });
  }
};

export const bulkGetForex = async (req: Request, res: Response): Promise<void> => {
  try {
    const { codes, from_currency, to_currency, min_price, max_price, limit = 100, page = 1 } = req.body;

    const query: any = {};
    
    if (codes && Array.isArray(codes) && codes.length > 0) {
      query.code = { $in: codes };
    }
    
    if (from_currency) {
      query.from_currency = from_currency;
    }
    
    if (to_currency) {
      query.to_currency = to_currency;
    }
    
    if (min_price !== undefined || max_price !== undefined) {
      query.currentPrice = {};
      if (min_price !== undefined) query.currentPrice.$gte = min_price;
      if (max_price !== undefined) query.currentPrice.$lte = max_price;
    }

    const skip = (page - 1) * limit;
    
    const [forexPairs, total] = await Promise.all([
      Forex.find(query).skip(skip).limit(limit).sort({ code: 1 }),
      Forex.countDocuments(query),
    ]);

    const result = {
      total,
      page,
      limit,
      total_pages: Math.ceil(total / limit),
      data: forexPairs,
    };

    res.status(200).json({
      success: true,
      code: 200,
      data: result,
    });
  } catch (error: any) {
    console.error('Bulk get forex error:', error);
    res.status(500).json({
      success: false,
      code: 500,
      message: 'Internal server error during bulk forex fetch',
      errorId: `ERR-${Date.now()}`,
    });
  }
};

export const bulkExportForex = async (req: Request, res: Response): Promise<void> => {
  try {
    const { codes, includeHistory = false, historyLimit = 100 } = req.body;

    const query: any = {};
    if (codes && Array.isArray(codes) && codes.length > 0) {
      query.code = { $in: codes };
    }

    const forexPairs = await Forex.find(query).sort({ code: 1 });

    if (includeHistory) {
      const exportData = [];
      
      for (const forex of forexPairs) {
        const priceHistory = await PriceHistory.findOne(
          { forex_code: forex.code },
          { history: { $slice: historyLimit } }
        );
        
        exportData.push({
          ...forex.toObject(),
          priceHistory: priceHistory ? priceHistory.history : [],
        });
      }
      
      res.status(200).json({
        success: true,
        code: 200,
        data: exportData,
        metadata: {
          total_exported: exportData.length,
          include_history: includeHistory,
          history_limit: historyLimit,
          export_date: new Date(),
        },
      });
    } else {
      res.status(200).json({
        success: true,
        code: 200,
        data: forexPairs,
        metadata: {
          total_exported: forexPairs.length,
          export_date: new Date(),
        },
      });
    }
  } catch (error: any) {
    console.error('Bulk export forex error:', error);
    res.status(500).json({
      success: false,
      code: 500,
      message: 'Internal server error during bulk forex export',
      errorId: `ERR-${Date.now()}`,
    });
  }
};

export const bulkSyncForexPrices = async (req: Request, res: Response): Promise<void> => {
  try {
    const { priceUpdates } = req.body;
    
    if (!priceUpdates || !Array.isArray(priceUpdates) || priceUpdates.length === 0) {
      res.status(400).json({
        success: false,
        code: 400,
        message: 'Price updates array is required and must not be empty',
        details: { 
          required: ['priceUpdates'],
          updateFormat: { code: 'string', price: 'number', date: 'Date (optional)' }
        },
      });
      return;
    }

    const result: {
      updated: Array<{ code: string; old_price: number; new_price: number; percentage_change: number }>;
      created: Array<{ code: string; price: number }>;
      failed: Array<{ code: string; error: string }>;
    } = {
      updated: [],
      created: [],
      failed: [],
    };

    for (const update of priceUpdates) {
      try {
        const { code, price, date } = update;
        
        if (!code || !price) {
          result.failed.push({
            code: code || 'unknown',
            error: 'Forex code and price are required',
          });
          continue;
        }

        const forex = await Forex.findOne({ code });
        
        if (forex) {
          const oldPrice = forex.currentPrice;
          const percentage_change = ((price - oldPrice) / oldPrice) * 100;
          
          await Forex.findOneAndUpdate(
            { code },
            {
              $set: {
                currentPrice: price,
                percentage_change: parseFloat(percentage_change.toFixed(4)),
                last_updated: new Date(),
              },
            }
          );
          
          await PriceHistory.findOneAndUpdate(
            { forex_code: code },
            {
              $push: {
                history: {
                  $each: [{
                    date: date ? new Date(date) : new Date(),
                    price: price,
                  }],
                  $position: 0,
                },
              },
            },
            { upsert: true }
          );
          
          result.updated.push({
            code,
            old_price: oldPrice,
            new_price: price,
            percentage_change: parseFloat(percentage_change.toFixed(4)),
          });
        } else {
          result.failed.push({
            code,
            error: 'Forex pair not found. Use bulk import to create new pairs.',
          });
        }
        
        await invalidateCache(code);
      } catch (error: any) {
        result.failed.push({
          code: update.code,
          error: error.message,
        });
      }
    }

    res.status(200).json({
      success: true,
      code: 200,
      message: `Bulk forex sync completed: ${result.updated.length} updated, ${result.created.length} created, ${result.failed.length} failed`,
      data: result,
    });
  } catch (error: any) {
    console.error('Bulk sync forex error:', error);
    res.status(500).json({
      success: false,
      code: 500,
      message: 'Internal server error during bulk forex sync',
      errorId: `ERR-${Date.now()}`,
    });
  }
};