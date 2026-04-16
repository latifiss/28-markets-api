import type { Request, Response } from 'express';
import Forex, { PriceHistory } from '../models/forex.model';
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