import type { Request, Response } from 'express';
import mongoose from 'mongoose';
import {
  Crypto,
  CoinGainers,
  CoinLosers,
  syncWithCrypto,
  getComprehensiveCoinData,
  CoinHistory,
  getTopGainers as getTopGainersFromModel,
  getTopLosers as getTopLosersFromModel,
} from '../models/crypto.model';
import { getRedisClient } from '../lib/redis';
import { publishCryptoUpdate, broadcast } from '../lib/realtime/ws';

const ensureString = (value: any): string => {
  if (Array.isArray(value)) {
    return value[0] || '';
  }
  if (typeof value === 'string') {
    return value;
  }
  return '';
};

const ensureNumber = (value: any, defaultValue: number): number => {
  const str = ensureString(value);
  const parsed = parseInt(str, 10);
  return isNaN(parsed) ? defaultValue : parsed;
};

const ensureFloat = (value: any, defaultValue: number): number => {
  const str = ensureString(value);
  const parsed = parseFloat(str);
  return isNaN(parsed) ? defaultValue : parsed;
};

const ensureBoolean = (value: any): boolean => {
  const str = ensureString(value).toLowerCase();
  return str === 'true' || str === '1' || str === 'yes';
};

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

const invalidateCryptoCache = async (symbol: string | null = null): Promise<void> => {
  await deleteCacheByPattern('crypto:*');
  await deleteCacheByPattern('coingainers:*');
  await deleteCacheByPattern('coinlosers:*');

  if (symbol) {
    await deleteCacheByPattern(`crypto:symbol:${symbol}`);
    await deleteCacheByPattern(`crypto:symbol:${symbol}:*`);
    await deleteCacheByPattern(`coingainers:symbol:${symbol}`);
    await deleteCacheByPattern(`coingainers:symbol:${symbol}:*`);
    await deleteCacheByPattern(`coinlosers:symbol:${symbol}`);
    await deleteCacheByPattern(`coinlosers:symbol:${symbol}:*`);
  }
};

export const createCrypto = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const {
      id,
      symbol,
      name,
      image,
      current_price,
      market_cap,
      market_cap_rank,
      fully_diluted_valuation,
      total_volume,
      high_24h,
      low_24h,
      price_change_24h,
      price_change_percentage_24h,
      market_cap_change_24h,
      market_cap_change_percentage_24h,
    } = req.body;

    const symbolStr = ensureString(symbol);
    
    if (!symbolStr || symbolStr.length < 2 || symbolStr.length > 10) {
      res.status(400).json({
        success: false,
        code: 400,
        message: 'Symbol must be between 2 and 10 characters',
        details: {
          symbol: symbolStr || 'missing',
          expected: '2-10 characters',
        },
      });
      return;
    }

    const requiredFields = ['id', 'symbol', 'name', 'current_price'];
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

    const existingCrypto = await (Crypto as any).findOne({
      $or: [{ id }, { symbol: symbolStr.toUpperCase() }],
    });

    if (existingCrypto) {
      res.status(409).json({
        success: false,
        code: 409,
        message: 'Crypto already exists',
        details: {
          existingId: existingCrypto.id,
          existingSymbol: existingCrypto.symbol,
        },
      });
      return;
    }

    const newCrypto = new (Crypto as any)({
      id,
      symbol: symbolStr.toLowerCase(),
      name,
      image,
      current_price,
      market_cap,
      market_cap_rank,
      fully_diluted_valuation,
      total_volume,
      high_24h,
      low_24h,
      price_change_24h,
      price_change_percentage_24h,
      market_cap_change_24h,
      market_cap_change_percentage_24h,
      price_history: [
        {
          date: new Date(),
          price: current_price,
        },
      ],
      last_updated: new Date(),
    });

    const savedCrypto = await newCrypto.save();
    await invalidateCryptoCache(savedCrypto.symbol);
    publishCryptoUpdate(savedCrypto.symbol, savedCrypto);

    res.status(201).json({
      success: true,
      code: 201,
      message: 'Crypto created successfully',
      data: savedCrypto,
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

    console.error('Create crypto error:', error);
    res.status(500).json({
      success: false,
      code: 500,
      message: 'Internal server error creating crypto',
      errorId: `CRYPTO-ERR-${Date.now()}`,
    });
  }
};

export const getCryptoById = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;

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

    const cacheKey = `crypto:id:${id}`;
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

    const crypto = await (Crypto as any).findOne({ 
      $or: [
        { id: id },
        { id: { $regex: new RegExp(`^${id}$`, 'i') } }
      ]
    });

    if (!crypto) {
      res.status(404).json({
        success: false,
        code: 404,
        message: 'Crypto not found',
        details: { id },
      });
      return;
    }

    await setCache(cacheKey, crypto, 300);

    res.status(200).json({
      success: true,
      code: 200,
      fromCache: false,
      data: crypto,
    });
  } catch (error: any) {
    console.error('Get crypto by id error:', error);
    res.status(500).json({
      success: false,
      code: 500,
      message: 'Internal server error fetching crypto',
      errorId: `CRYPTO-ERR-${Date.now()}`,
    });
  }
};

export const updateCryptoById = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;
    const { current_price, ...updateData } = req.body;

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

    const crypto = await (Crypto as any).findOne({ 
      $or: [
        { id: id },
        { id: { $regex: new RegExp(`^${id}$`, 'i') } }
      ]
    });

    if (!crypto) {
      res.status(404).json({
        success: false,
        code: 404,
        message: 'Crypto not found',
        details: { id },
      });
      return;
    }

    const updateOperations: any = {
      $set: {
        ...updateData,
        last_updated: new Date(),
      },
    };

    if (
      current_price !== undefined &&
      current_price !== crypto.current_price
    ) {
      const price_change_24h = current_price - crypto.current_price;
      const price_change_percentage_24h =
        (price_change_24h / crypto.current_price) * 100;

      updateOperations.$set.current_price = current_price;
      updateOperations.$set.price_change_24h = parseFloat(
        price_change_24h.toFixed(4),
      );
      updateOperations.$set.price_change_percentage_24h = parseFloat(
        price_change_percentage_24h.toFixed(4),
      );

      updateOperations.$push = {
        price_history: {
          $each: [
            {
              date: new Date(),
              price: crypto.current_price,
            },
          ],
          $position: 0,
          $slice: 1000,
        },
      };
    }

    const updatedCrypto = await (Crypto as any).findOneAndUpdate(
      { id: crypto.id },
      updateOperations,
      { new: true, runValidators: true },
    );

    await invalidateCryptoCache(updatedCrypto.symbol);
    publishCryptoUpdate(updatedCrypto.symbol, updatedCrypto);

    res.status(200).json({
      success: true,
      code: 200,
      message: 'Crypto updated successfully',
      data: updatedCrypto,
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

    console.error('Update crypto error:', error);
    res.status(500).json({
      success: false,
      code: 500,
      message: 'Internal server error updating crypto',
      errorId: `CRYPTO-ERR-${Date.now()}`,
    });
  }
};

export const getAllCryptos = async (
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

    const page = ensureNumber(req.query.page, 1);
    const limit = ensureNumber(req.query.limit, 50);
    const sortBy = ensureString(req.query.sortBy) || 'market_cap_rank';
    const sortOrder = ensureString(req.query.sortOrder) || 'asc';
    const search = ensureString(req.query.search);
    const minPrice = ensureFloat(req.query.minPrice, 0);
    const maxPrice = ensureFloat(req.query.maxPrice, Infinity);
    const minMarketCap = ensureFloat(req.query.minMarketCap, 0);
    const maxMarketCap = ensureFloat(req.query.maxMarketCap, Infinity);

    const cacheKey = `crypto:all:${page}:${limit}:${sortBy}:${sortOrder}:${search}:${minPrice}:${maxPrice}:${minMarketCap}:${maxMarketCap}`;
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

    if (search) {
      query.$or = [
        { symbol: { $regex: search, $options: 'i' } },
        { name: { $regex: search, $options: 'i' } },
        { id: { $regex: search, $options: 'i' } },
      ];
    }

    if (minPrice > 0 || maxPrice < Infinity) {
      query.current_price = {};
      if (minPrice > 0) query.current_price.$gte = minPrice;
      if (maxPrice < Infinity) query.current_price.$lte = maxPrice;
    }

    if (minMarketCap > 0 || maxMarketCap < Infinity) {
      query.market_cap = {};
      if (minMarketCap > 0) query.market_cap.$gte = minMarketCap;
      if (maxMarketCap < Infinity) query.market_cap.$lte = maxMarketCap;
    }

    const skip = (page - 1) * limit;
    const total = await (Crypto as any).countDocuments(query);

    const sort: any = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const cryptos = await (Crypto as any)
      .find(query)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean();

    const result = {
      success: true,
      code: 200,
      fromCache: false,
      data: cryptos,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
        hasNext: skip + cryptos.length < total,
        hasPrev: page > 1,
      },
      filters: {
        search,
        minPrice: minPrice > 0 ? minPrice : undefined,
        maxPrice: maxPrice < Infinity ? maxPrice : undefined,
        minMarketCap: minMarketCap > 0 ? minMarketCap : undefined,
        maxMarketCap: maxMarketCap < Infinity ? maxMarketCap : undefined,
        sortBy,
        sortOrder,
      },
    };

    await setCache(cacheKey, result, 300);

    res.status(200).json(result);
  } catch (error: any) {
    console.error('Get all cryptos error:', error);
    res.status(500).json({
      success: false,
      code: 500,
      message: 'Internal server error fetching cryptos',
      errorId: `CRYPTO-ERR-${Date.now()}`,
    });
  }
};

export const getCryptoBySymbol = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const symbolParam = req.params.symbol;
    const symbol = ensureString(symbolParam).toLowerCase();

    if (!symbol) {
      res.status(400).json({
        success: false,
        code: 400,
        message: 'Symbol parameter is required',
      });
      return;
    }

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

    const cacheKey = `crypto:symbol:${symbol}`;
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

    const crypto = await (Crypto as any).findOne({
      symbol: symbol,
    });

    if (!crypto) {
      res.status(404).json({
        success: false,
        code: 404,
        message: 'Crypto not found',
        details: { symbol },
      });
      return;
    }

    await setCache(cacheKey, crypto, 300);

    res.status(200).json({
      success: true,
      code: 200,
      fromCache: false,
      data: crypto,
    });
  } catch (error: any) {
    console.error('Get crypto error:', error);
    res.status(500).json({
      success: false,
      code: 500,
      message: 'Internal server error fetching crypto',
      errorId: `CRYPTO-ERR-${Date.now()}`,
    });
  }
};

export const updateCryptoBySymbol = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey || apiKey !== process.env.API_KEY) {
      res.status(401).json({
        success: false,
        code: 401,
        message: 'Invalid or missing API key',
      });
      return;
    }

    const symbolParam = req.params.symbol;
    const symbol = ensureString(symbolParam).toUpperCase();
    const { current_price, ...updateData } = req.body;

    if (!symbol) {
      res.status(400).json({
        success: false,
        code: 400,
        message: 'Symbol parameter is required',
      });
      return;
    }

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

    const crypto = await (Crypto as any).findOne({
      symbol: symbol,
    });

    if (!crypto) {
      res.status(404).json({
        success: false,
        code: 404,
        message: 'Crypto not found',
        details: { symbol },
      });
      return;
    }

    const updateOperations: any = {
      $set: {
        ...updateData,
        last_updated: new Date(),
      },
    };

    if (
      current_price !== undefined &&
      current_price !== crypto.current_price
    ) {
      const price_change_24h = current_price - crypto.current_price;
      const price_change_percentage_24h =
        (price_change_24h / crypto.current_price) * 100;

      updateOperations.$set.current_price = current_price;
      updateOperations.$set.price_change_24h = parseFloat(
        price_change_24h.toFixed(4),
      );
      updateOperations.$set.price_change_percentage_24h = parseFloat(
        price_change_percentage_24h.toFixed(4),
      );

      updateOperations.$push = {
        price_history: {
          $each: [
            {
              date: new Date(),
              price: crypto.current_price,
            },
          ],
          $position: 0,
          $slice: 1000,
        },
      };
    }

    const updatedCrypto = await (Crypto as any).findOneAndUpdate(
      { symbol: symbol },
      updateOperations,
      { new: true, runValidators: true },
    );

    await invalidateCryptoCache(symbol);
    publishCryptoUpdate(updatedCrypto.symbol ?? symbol, updatedCrypto);

    res.status(200).json({
      success: true,
      code: 200,
      message: 'Crypto updated successfully',
      data: updatedCrypto,
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

    console.error('Update crypto error:', error);
    res.status(500).json({
      success: false,
      code: 500,
      message: 'Internal server error updating crypto',
      errorId: `CRYPTO-ERR-${Date.now()}`,
    });
  }
};

export const deleteCrypto = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey || apiKey !== process.env.API_KEY) {
      res.status(401).json({
        success: false,
        code: 401,
        message: 'Invalid or missing API key',
      });
      return;
    }

    const symbolParam = req.params.symbol;
    const symbol = ensureString(symbolParam).toUpperCase();

    if (!symbol) {
      res.status(400).json({
        success: false,
        code: 400,
        message: 'Symbol parameter is required',
      });
      return;
    }

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

    const deletedCrypto = await (Crypto as any).findOneAndDelete({
      symbol: symbol,
    });

    if (!deletedCrypto) {
      res.status(404).json({
        success: false,
        code: 404,
        message: 'Crypto not found',
        details: { symbol },
      });
      return;
    }

    await (CoinGainers as any).findOneAndDelete({
      symbol: symbol,
    });

    await (CoinLosers as any).findOneAndDelete({
      symbol: symbol,
    });

    await invalidateCryptoCache(symbol);

    res.status(200).json({
      success: true,
      code: 200,
      message: 'Crypto deleted successfully',
      data: {
        symbol: deletedCrypto.symbol,
        name: deletedCrypto.name,
        id: deletedCrypto.id,
      },
    });
  } catch (error: any) {
    console.error('Delete crypto error:', error);
    res.status(500).json({
      success: false,
      code: 500,
      message: 'Internal server error deleting crypto',
      errorId: `CRYPTO-ERR-${Date.now()}`,
    });
  }
};

export const getCryptoHistory = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const symbolParam = req.params.symbol;
    const searchTerm = ensureString(symbolParam).toLowerCase();
    const startDate = ensureString(req.query.startDate);
    const endDate = ensureString(req.query.endDate);
    const limit = ensureNumber(req.query.limit, 100);

    if (!searchTerm) {
      res.status(400).json({
        success: false,
        code: 400,
        message: 'Symbol parameter is required',
      });
      return;
    }

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

    const cacheKey = `crypto:history:${searchTerm}:${startDate}:${endDate}:${limit}`;
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

    const crypto = await (Crypto as any)
      .findOne({
        $or: [
          { symbol: { $regex: new RegExp(`^${searchTerm}$`, 'i') } },
          { symbol: searchTerm },
          { symbol: searchTerm.toUpperCase() },
          { symbol: searchTerm.toLowerCase() },
          { id: searchTerm },
          { id: { $regex: new RegExp(`^${searchTerm}$`, 'i') } },
          { name: { $regex: new RegExp(`^${searchTerm}$`, 'i') } }
        ]
      })
      .select('symbol name price_history');

    if (!crypto) {
      res.status(404).json({
        success: false,
        code: 404,
        message: 'Crypto not found',
        details: { symbol: searchTerm },
      });
      return;
    }

    let priceHistory = crypto.price_history || [];

    if (startDate || endDate) {
      const start = startDate ? new Date(startDate) : new Date(0);
      const end = endDate ? new Date(endDate) : new Date();

      priceHistory = priceHistory.filter((entry: any) => {
        const entryDate = new Date(entry.date);
        return entryDate >= start && entryDate <= end;
      });
    }

    priceHistory = priceHistory.slice(0, limit);

    priceHistory.sort(
      (a: any, b: any) =>
        new Date(a.date).getTime() - new Date(b.date).getTime(),
    );

    const result = {
      symbol: crypto.symbol,
      name: crypto.name,
      price_history: priceHistory,
      total_entries: priceHistory.length,
    };

    await setCache(cacheKey, result, 600);

    res.status(200).json({
      success: true,
      code: 200,
      fromCache: false,
      data: result,
    });
  } catch (error: any) {
    console.error('Get crypto history error:', error);
    res.status(500).json({
      success: false,
      code: 500,
      message: 'Internal server error fetching crypto history',
      errorId: `CRYPTO-ERR-${Date.now()}`,
    });
  }
};

export const addCryptoHistory = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const id = req.params.symbol;
    const { date, price } = req.body;

    if (!id) {
      res.status(400).json({
        success: false,
        code: 400,
        message: 'ID parameter is required',
      });
      return;
    }

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

    const crypto = await (Crypto as any).findOne({
      $or: [
        { id: id },
        { id: { $regex: new RegExp(`^${id}$`, 'i') } }
      ]
    });

    if (!crypto) {
      res.status(404).json({
        success: false,
        code: 404,
        message: 'Crypto not found',
        details: { id },
      });
      return;
    }

    const newPriceEntry = {
      date: date || new Date(),
      price: parseFloat(price),
    };

    const updatedCrypto = await (Crypto as any).findOneAndUpdate(
      { id: crypto.id },
      {
        $push: {
          price_history: {
            $each: [newPriceEntry],
            $position: 0,
            $slice: 1000,
          },
        },
        $set: { last_updated: new Date() },
      },
      { new: true },
    );

    await invalidateCryptoCache(crypto.symbol);

    res.status(200).json({
      success: true,
      code: 200,
      message: 'Price history added successfully',
      data: {
        id: updatedCrypto.id,
        symbol: updatedCrypto.symbol,
        new_price_entry: newPriceEntry,
        total_history_entries: updatedCrypto.price_history.length,
      },
    });
  } catch (error: any) {
    console.error('Add crypto history error:', error);
    res.status(500).json({
      success: false,
      code: 500,
      message: 'Internal server error adding price history',
      errorId: `CRYPTO-ERR-${Date.now()}`,
    });
  }
};

export const updateCryptoPrice = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey || apiKey !== process.env.API_KEY) {
      res.status(401).json({
        success: false,
        code: 401,
        message: 'Invalid or missing API key',
      });
      return;
    }

    const symbolParam = req.params.symbol;
    const symbol = ensureString(symbolParam).toUpperCase();
    const { current_price } = req.body;

    if (!symbol) {
      res.status(400).json({
        success: false,
        code: 400,
        message: 'Symbol parameter is required',
      });
      return;
    }

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

    if (!current_price) {
      res.status(400).json({
        success: false,
        code: 400,
        message: 'Current price is required',
        details: {
          required: ['current_price'],
        },
      });
      return;
    }

    const crypto = await (Crypto as any).findOne({
      symbol: symbol,
    });

    if (!crypto) {
      res.status(404).json({
        success: false,
        code: 404,
        message: 'Crypto not found',
        details: { symbol },
      });
      return;
    }

    const updateOperations: any = {
      $set: {
        last_updated: new Date(),
      },
      $push: {
        price_history: {
          $each: [
            {
              date: new Date(),
              price: crypto.current_price,
            },
          ],
          $position: 0,
          $slice: 1000,
        },
      },
    };

    if (current_price !== crypto.current_price) {
      const price_change_24h = current_price - crypto.current_price;
      const price_change_percentage_24h =
        (price_change_24h / crypto.current_price) * 100;

      updateOperations.$set.current_price = current_price;
      updateOperations.$set.price_change_24h = parseFloat(
        price_change_24h.toFixed(4),
      );
      updateOperations.$set.price_change_percentage_24h = parseFloat(
        price_change_percentage_24h.toFixed(4),
      );
    }

    const updatedCrypto = await (Crypto as any).findOneAndUpdate(
      { symbol: symbol },
      updateOperations,
      { new: true },
    );

    await invalidateCryptoCache(symbol);
    publishCryptoUpdate(updatedCrypto.symbol ?? symbol, updatedCrypto);

    res.status(200).json({
      success: true,
      code: 200,
      message: 'Crypto price updated successfully',
      data: updatedCrypto,
    });
  } catch (error: any) {
    console.error('Update crypto price error:', error);
    res.status(500).json({
      success: false,
      code: 500,
      message: 'Internal server error updating crypto price',
      errorId: `CRYPTO-ERR-${Date.now()}`,
    });
  }
};

export const createCoinGainer = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey || apiKey !== process.env.API_KEY) {
      res.status(401).json({
        success: false,
        code: 401,
        message: 'Invalid or missing API key',
      });
      return;
    }

    const coinGainerData = req.body;

    const requiredFields = [
      'rank',
      'id',
      'symbol',
      'name',
      'current_price',
      'market_cap',
      'market_cap_rank',
      'total_volume',
      'high_24h',
      'low_24h',
      'price_change_24h',
      'price_change_percentage_24h',
      'market_cap_change_24h',
      'market_cap_change_percentage_24h',
      'circulating_supply',
    ];

    const missingFields = requiredFields.filter(
      (field) => !coinGainerData[field],
    );
    if (missingFields.length > 0) {
      res.status(400).json({
        success: false,
        code: 400,
        message: 'Missing required fields for CoinGainer',
        details: { missingFields },
      });
      return;
    }

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

    const symbolValue = ensureString(coinGainerData.symbol);

    const existingGainer = await (CoinGainers as any).findOne({
      $or: [
        { rank: coinGainerData.rank },
        { symbol: symbolValue.toUpperCase() },
      ],
    });

    if (existingGainer) {
      res.status(409).json({
        success: false,
        code: 409,
        message: 'CoinGainer already exists',
        details: {
          existingRank: existingGainer.rank,
          existingSymbol: existingGainer.symbol,
        },
      });
      return;
    }

    const syncResult = await syncWithCrypto();

    await invalidateCryptoCache(symbolValue);

    res.status(201).json({
      success: true,
      code: 201,
      message: 'CoinGainer created and synced successfully',
      data: syncResult,
    });
  } catch (error: any) {
    if (error.code === 11000) {
      res.status(400).json({
        success: false,
        code: 400,
        message: 'Duplicate entry for CoinGainer',
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
        message: 'Validation failed for CoinGainer',
        details: { errors },
      });
      return;
    }

    console.error('Create CoinGainer error:', error);
    res.status(500).json({
      success: false,
      code: 500,
      message: 'Internal server error creating CoinGainer',
      errorId: `COINGAINER-ERR-${Date.now()}`,
    });
  }
};

export const createCoinLoser = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey || apiKey !== process.env.API_KEY) {
      res.status(401).json({
        success: false,
        code: 401,
        message: 'Invalid or missing API key',
      });
      return;
    }

    const coinLoserData = req.body;

    const requiredFields = [
      'symbol',
      'name',
      'percentage_change_24h',
      'current_price',
    ];

    const missingFields = requiredFields.filter(
      (field) => !coinLoserData[field],
    );
    if (missingFields.length > 0) {
      res.status(400).json({
        success: false,
        code: 400,
        message: 'Missing required fields for CoinLoser',
        details: { missingFields },
      });
      return;
    }

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

    const symbolValue = ensureString(coinLoserData.symbol).toUpperCase();

    if (coinLoserData.percentage_change_24h >= 0) {
      res.status(400).json({
        success: false,
        code: 400,
        message: 'CoinLoser must have negative percentage change',
        details: {
          provided: coinLoserData.percentage_change_24h,
          expected: '< 0',
        },
      });
      return;
    }

    const existingLoser = await (CoinLosers as any).findOne({
      symbol: symbolValue,
    });

    if (existingLoser) {
      const updatedLoser = await (CoinLosers as any).findOneAndUpdate(
        { symbol: symbolValue },
        {
          ...coinLoserData,
          symbol: symbolValue,
          last_updated: new Date(),
        },
        { new: true, runValidators: true }
      );

      await invalidateCryptoCache(symbolValue);

      res.status(200).json({
        success: true,
        code: 200,
        message: 'CoinLoser updated successfully',
        data: updatedLoser,
      });
      return;
    }

    const newCoinLoser = new (CoinLosers as any)({
      ...coinLoserData,
      symbol: symbolValue,
      last_updated: new Date(),
    });

    const savedLoser = await newCoinLoser.save();
    await invalidateCryptoCache(symbolValue);

    res.status(201).json({
      success: true,
      code: 201,
      message: 'CoinLoser created successfully',
      data: savedLoser,
    });
  } catch (error: any) {
    if (error.code === 11000) {
      res.status(400).json({
        success: false,
        code: 400,
        message: 'Duplicate entry for CoinLoser',
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
        message: 'Validation failed for CoinLoser',
        details: { errors },
      });
      return;
    }

    console.error('Create CoinLoser error:', error);
    res.status(500).json({
      success: false,
      code: 500,
      message: 'Internal server error creating CoinLoser',
      errorId: `COINLOSER-ERR-${Date.now()}`,
    });
  }
};

export const getAllCoinLosers = async (
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

    const page = ensureNumber(req.query.page, 1);
    const limit = ensureNumber(req.query.limit, 100);
    const sortBy = ensureString(req.query.sortBy) || 'percentage_change_24h';
    const sortOrder = ensureString(req.query.sortOrder) || 'asc'; 
    const search = ensureString(req.query.search);
    const minPrice = ensureFloat(req.query.minPrice, 0);
    const maxPrice = ensureFloat(req.query.maxPrice, Infinity);
    const minChange = ensureFloat(req.query.minChange, -Infinity);
    const maxChange = ensureFloat(req.query.maxChange, 0); 

    const cacheKey = `coinlosers:all:${page}:${limit}:${sortBy}:${sortOrder}:${search}:${minPrice}:${maxPrice}:${minChange}:${maxChange}`;
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

    if (search) {
      query.$or = [
        { symbol: { $regex: search, $options: 'i' } },
        { name: { $regex: search, $options: 'i' } },
      ];
    }

    query.percentage_change_24h = { $lt: 0 };

    if (minChange > -Infinity) {
      query.percentage_change_24h.$gte = minChange;
    }
    if (maxChange < 0) {
      query.percentage_change_24h.$lte = maxChange;
    }

    if (minPrice > 0 || maxPrice < Infinity) {
      query.current_price = {};
      if (minPrice > 0) query.current_price.$gte = minPrice;
      if (maxPrice < Infinity) query.current_price.$lte = maxPrice;
    }

    const skip = (page - 1) * limit;
    const total = await (CoinLosers as any).countDocuments(query);

    const sort: any = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const coinLosers = await (CoinLosers as any)
      .find(query)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean();

    const result = {
      success: true,
      code: 200,
      fromCache: false,
      data: coinLosers,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
        hasNext: skip + coinLosers.length < total,
        hasPrev: page > 1,
      },
      filters: {
        search,
        sortBy,
        sortOrder,
        minPrice: minPrice > 0 ? minPrice : undefined,
        maxPrice: maxPrice < Infinity ? maxPrice : undefined,
        minChange: minChange > -Infinity ? minChange : undefined,
        maxChange: maxChange < 0 ? maxChange : undefined,
      },
    };

    await setCache(cacheKey, result, 180);

    res.status(200).json(result);
  } catch (error: any) {
    console.error('Get all CoinLosers error:', error);
    res.status(500).json({
      success: false,
      code: 500,
      message: 'Internal server error fetching CoinLosers',
      errorId: `COINLOSER-ERR-${Date.now()}`,
    });
  }
};

export const getCoinLoser = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const symbolParam = req.params.symbol;
    const symbol = ensureString(symbolParam).toUpperCase();

    if (!symbol) {
      res.status(400).json({
        success: false,
        code: 400,
        message: 'Symbol parameter is required',
      });
      return;
    }

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

    const cacheKey = `coinlosers:symbol:${symbol}`;
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

    const coinLoser = await (CoinLosers as any).findOne({
      symbol: symbol,
    });

    if (!coinLoser) {
      res.status(404).json({
        success: false,
        code: 404,
        message: 'CoinLoser not found',
        details: { symbol },
      });
      return;
    }

    await setCache(cacheKey, coinLoser, 180);

    res.status(200).json({
      success: true,
      code: 200,
      fromCache: false,
      data: coinLoser,
    });
  } catch (error: any) {
    console.error('Get CoinLoser error:', error);
    res.status(500).json({
      success: false,
      code: 500,
      message: 'Internal server error fetching CoinLoser',
      errorId: `COINLOSER-ERR-${Date.now()}`,
    });
  }
};

export const updateCoinLoser = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey || apiKey !== process.env.API_KEY) {
      res.status(401).json({
        success: false,
        code: 401,
        message: 'Invalid or missing API key',
      });
      return;
    }

    const symbolParam = req.params.symbol;
    const symbol = ensureString(symbolParam).toUpperCase();
    const updateData = req.body;

    if (!symbol) {
      res.status(400).json({
        success: false,
        code: 400,
        message: 'Symbol parameter is required',
      });
      return;
    }

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

    if (updateData.percentage_change_24h !== undefined && updateData.percentage_change_24h >= 0) {
      res.status(400).json({
        success: false,
        code: 400,
        message: 'CoinLoser must maintain negative percentage change',
        details: {
          provided: updateData.percentage_change_24h,
          expected: '< 0',
        },
      });
      return;
    }

    const updatedLoser = await (CoinLosers as any).findOneAndUpdate(
      { symbol: symbol },
      {
        ...updateData,
        last_updated: new Date(),
      },
      { new: true, runValidators: true }
    );

    if (!updatedLoser) {
      res.status(404).json({
        success: false,
        code: 404,
        message: 'CoinLoser not found',
        details: { symbol },
      });
      return;
    }

    await invalidateCryptoCache(symbol);

    res.status(200).json({
      success: true,
      code: 200,
      message: 'CoinLoser updated successfully',
      data: updatedLoser,
    });
  } catch (error: any) {
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map((err: any) => ({
        field: err.path,
        message: err.message,
      }));
      res.status(400).json({
        success: false,
        code: 400,
        message: 'Validation failed for CoinLoser',
        details: { errors },
      });
      return;
    }

    console.error('Update CoinLoser error:', error);
    res.status(500).json({
      success: false,
      code: 500,
      message: 'Internal server error updating CoinLoser',
      errorId: `COINLOSER-ERR-${Date.now()}`,
    });
  }
};

export const deleteCoinLoser = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey || apiKey !== process.env.API_KEY) {
      res.status(401).json({
        success: false,
        code: 401,
        message: 'Invalid or missing API key',
      });
      return;
    }

    const symbolParam = req.params.symbol;
    const symbol = ensureString(symbolParam).toUpperCase();

    if (!symbol) {
      res.status(400).json({
        success: false,
        code: 400,
        message: 'Symbol parameter is required',
      });
      return;
    }

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

    const deletedLoser = await (CoinLosers as any).findOneAndDelete({
      symbol: symbol,
    });

    if (!deletedLoser) {
      res.status(404).json({
        success: false,
        code: 404,
        message: 'CoinLoser not found',
        details: { symbol },
      });
      return;
    }

    await invalidateCryptoCache(symbol);

    res.status(200).json({
      success: true,
      code: 200,
      message: 'CoinLoser deleted successfully',
      data: {
        symbol: deletedLoser.symbol,
        name: deletedLoser.name,
      },
    });
  } catch (error: any) {
    console.error('Delete CoinLoser error:', error);
    res.status(500).json({
      success: false,
      code: 500,
      message: 'Internal server error deleting CoinLoser',
      errorId: `COINLOSER-ERR-${Date.now()}`,
    });
  }
};

export const bulkUpdateCoinLosers = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey || apiKey !== process.env.API_KEY) {
      res.status(401).json({
        success: false,
        code: 401,
        message: 'Invalid or missing API key',
      });
      return;
    }

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

    const coinLosersData = req.body;

    if (!Array.isArray(coinLosersData)) {
      res.status(400).json({
        success: false,
        code: 400,
        message: 'Request body must be an array of CoinLoser objects',
      });
      return;
    }

    if (coinLosersData.length > 1000) {
      res.status(400).json({
        success: false,
        code: 400,
        message: 'Maximum 1000 CoinLosers can be updated in a single request',
      });
      return;
    }

    const validationErrors: { index: number; message: string; }[] = [];
    coinLosersData.forEach((entry: any, index: number) => {
      const errors = [];
      if (!entry.symbol) errors.push('symbol');
      if (!entry.name) errors.push('name');
      if (entry.percentage_change_24h === undefined) errors.push('percentage_change_24h');
      if (!entry.current_price) errors.push('current_price');
      
      if (errors.length > 0) {
        validationErrors.push({
          index,
          message: `Missing required fields: ${errors.join(', ')}`,
        });
      } else if (entry.percentage_change_24h >= 0) {
        validationErrors.push({
          index,
          message: 'percentage_change_24h must be negative for CoinLoser',
        });
      }
    });

    if (validationErrors.length > 0) {
      res.status(400).json({
        success: false,
        code: 400,
        message: 'Validation errors in CoinLosers data',
        details: { errors: validationErrors },
      });
      return;
    }

    const operations = coinLosersData.map((loserData) => ({
      updateOne: {
        filter: { symbol: loserData.symbol.toUpperCase() },
        update: {
          $set: {
            ...loserData,
            symbol: loserData.symbol.toUpperCase(),
            last_updated: new Date(),
          },
        },
        upsert: true,
      },
    }));

    const result = await (CoinLosers as any).bulkWrite(operations);

    await invalidateCryptoCache();

    res.status(200).json({
      success: true,
      code: 200,
      message: 'CoinLosers bulk update completed',
      data: {
        matchedCount: result.matchedCount,
        modifiedCount: result.modifiedCount,
        upsertedCount: result.upsertedCount,
        totalProcessed: coinLosersData.length,
      },
    });
  } catch (error: any) {
    console.error('Bulk update CoinLosers error:', error);
    res.status(500).json({
      success: false,
      code: 500,
      message: 'Internal server error bulk updating CoinLosers',
      errorId: `COINLOSER-ERR-${Date.now()}`,
    });
  }
};

export const syncCoinLosers = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey || apiKey !== process.env.API_KEY) {
      res.status(401).json({
        success: false,
        code: 401,
        message: 'Invalid or missing API key',
      });
      return;
    }

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

    const syncResult = await syncWithCrypto();

    await invalidateCryptoCache();

    res.status(200).json({
      success: true,
      code: 200,
      message: 'CoinLosers synced successfully',
      data: syncResult,
    });
  } catch (error: any) {
    console.error('Sync CoinLosers error:', error);
    res.status(500).json({
      success: false,
      code: 500,
      message: 'Internal server error syncing CoinLosers',
      errorId: `COINLOSER-ERR-${Date.now()}`,
    });
  }
};

export const getTopLosers = async (
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

    const limit = ensureNumber(req.query.limit, 10);
    const cacheKey = `coinlosers:top:${limit}`;

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

    const topLosers = await (CoinLosers as any)
      .find()
      .sort({ percentage_change_24h: 1 }) 
      .limit(limit)
      .lean();

    await setCache(cacheKey, topLosers, 120);

    res.status(200).json({
      success: true,
      code: 200,
      fromCache: false,
      data: topLosers,
    });
  } catch (error: any) {
    console.error('Get top losers error:', error);
    res.status(500).json({
      success: false,
      code: 500,
      message: 'Internal server error fetching top losers',
      errorId: `COINLOSER-ERR-${Date.now()}`,
    });
  }
};

export const getComprehensiveData = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const symbolParam = req.params.symbol;
    const symbol = ensureString(symbolParam).toUpperCase();

    if (!symbol) {
      res.status(400).json({
        success: false,
        code: 400,
        message: 'Symbol parameter is required',
      });
      return;
    }

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

    const cacheKey = `crypto:comprehensive:${symbol}`;
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

    const comprehensiveData = await getComprehensiveCoinData(symbol);

    if (!comprehensiveData) {
      res.status(404).json({
        success: false,
        code: 404,
        message: 'Crypto data not found',
        details: { symbol },
      });
      return;
    }

    await setCache(cacheKey, comprehensiveData, 300);

    res.status(200).json({
      success: true,
      code: 200,
      fromCache: false,
      data: comprehensiveData,
    });
  } catch (error: any) {
    console.error('Get comprehensive data error:', error);
    res.status(500).json({
      success: false,
      code: 500,
      message: 'Internal server error fetching comprehensive crypto data',
      errorId: `CRYPTO-ERR-${Date.now()}`,
    });
  }
};

export const getAllCoinGainers = async (
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

    const page = ensureNumber(req.query.page, 1);
    const limit = ensureNumber(req.query.limit, 100);
    const sortBy = ensureString(req.query.sortBy) || 'percentage_change_24h';
    const sortOrder = ensureString(req.query.sortOrder) || 'desc';
    const search = ensureString(req.query.search);
    const minPrice = ensureFloat(req.query.minPrice, 0);
    const maxPrice = ensureFloat(req.query.maxPrice, Infinity);
    const minChange = ensureFloat(req.query.minChange, 0);
    const maxChange = ensureFloat(req.query.maxChange, Infinity);

    const cacheKey = `coingainers:all:${page}:${limit}:${sortBy}:${sortOrder}:${search}:${minPrice}:${maxPrice}:${minChange}:${maxChange}`;
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

    if (search) {
      query.$or = [
        { symbol: { $regex: search, $options: 'i' } },
        { name: { $regex: search, $options: 'i' } },
      ];
    }

    query.percentage_change_24h = { $gt: 0 };

    if (minChange > 0) {
      query.percentage_change_24h.$gte = minChange;
    }
    if (maxChange < Infinity) {
      query.percentage_change_24h.$lte = maxChange;
    }

    if (minPrice > 0 || maxPrice < Infinity) {
      query.current_price = {};
      if (minPrice > 0) query.current_price.$gte = minPrice;
      if (maxPrice < Infinity) query.current_price.$lte = maxPrice;
    }

    const skip = (page - 1) * limit;
    const total = await (CoinGainers as any).countDocuments(query);

    const sort: any = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const coinGainers = await (CoinGainers as any)
      .find(query)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean();

    const result = {
      success: true,
      code: 200,
      fromCache: false,
      data: coinGainers,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
        hasNext: skip + coinGainers.length < total,
        hasPrev: page > 1,
      },
      filters: {
        search,
        sortBy,
        sortOrder,
        minPrice: minPrice > 0 ? minPrice : undefined,
        maxPrice: maxPrice < Infinity ? maxPrice : undefined,
        minChange: minChange > 0 ? minChange : undefined,
        maxChange: maxChange < Infinity ? maxChange : undefined,
      },
    };

    await setCache(cacheKey, result, 180);

    res.status(200).json(result);
  } catch (error: any) {
    console.error('Get all CoinGainers error:', error);
    res.status(500).json({
      success: false,
      code: 500,
      message: 'Internal server error fetching CoinGainers',
      errorId: `COINGAINER-ERR-${Date.now()}`,
    });
  }
};

export const getCoinGainer = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const symbolParam = req.params.symbol;
    const symbol = ensureString(symbolParam).toUpperCase();

    if (!symbol) {
      res.status(400).json({
        success: false,
        code: 400,
        message: 'Symbol parameter is required',
      });
      return;
    }

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

    const cacheKey = `coingainers:symbol:${symbol}`;
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

    const coinGainer = await (CoinGainers as any).findOne({
      symbol: symbol,
    });

    if (!coinGainer) {
      res.status(404).json({
        success: false,
        code: 404,
        message: 'CoinGainer not found',
        details: { symbol },
      });
      return;
    }

    await setCache(cacheKey, coinGainer, 180);

    res.status(200).json({
      success: true,
      code: 200,
      fromCache: false,
      data: coinGainer,
    });
  } catch (error: any) {
    console.error('Get CoinGainer error:', error);
    res.status(500).json({
      success: false,
      code: 500,
      message: 'Internal server error fetching CoinGainer',
      errorId: `COINGAINER-ERR-${Date.now()}`,
    });
  }
};

export const getTopGainers = async (
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

    const limit = ensureNumber(req.query.limit, 10);
    const cacheKey = `coingainers:top:${limit}`;

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

    const topGainers = await (CoinGainers as any)
      .find()
      .sort({ percentage_change_24h: -1 })
      .limit(limit)
      .lean();

    await setCache(cacheKey, topGainers, 120);

    res.status(200).json({
      success: true,
      code: 200,
      fromCache: false,
      data: topGainers,
    });
  } catch (error: any) {
    console.error('Get top gainers error:', error);
    res.status(500).json({
      success: false,
      code: 500,
      message: 'Internal server error fetching top gainers',
      errorId: `COINGAINER-ERR-${Date.now()}`,
    });
  }
};

export const bulkUpdateCoinGainers = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey || apiKey !== process.env.API_KEY) {
      res.status(401).json({
        success: false,
        code: 401,
        message: 'Invalid or missing API key',
      });
      return;
    }

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

    const coinGainersData = req.body;

    if (!Array.isArray(coinGainersData)) {
      res.status(400).json({
        success: false,
        code: 400,
        message: 'Request body must be an array of CoinGainer objects',
      });
      return;
    }

    if (coinGainersData.length > 1000) {
      res.status(400).json({
        success: false,
        code: 400,
        message: 'Maximum 1000 CoinGainers can be updated in a single request',
      });
      return;
    }

    const validationErrors: { index: number; message: string; }[] = [];
    coinGainersData.forEach((entry: any, index: number) => {
      const errors = [];
      if (!entry.symbol) errors.push('symbol');
      if (!entry.name) errors.push('name');
      if (entry.percentage_change_24h === undefined) errors.push('percentage_change_24h');
      if (!entry.current_price) errors.push('current_price');
      
      if (errors.length > 0) {
        validationErrors.push({
          index,
          message: `Missing required fields: ${errors.join(', ')}`,
        });
      } else if (entry.percentage_change_24h <= 0) {
        validationErrors.push({
          index,
          message: 'percentage_change_24h must be positive for CoinGainer',
        });
      }
    });

    if (validationErrors.length > 0) {
      res.status(400).json({
        success: false,
        code: 400,
        message: 'Validation errors in CoinGainers data',
        details: { errors: validationErrors },
      });
      return;
    }

    const operations = coinGainersData.map((gainerData) => ({
      updateOne: {
        filter: { symbol: gainerData.symbol.toUpperCase() },
        update: {
          $set: {
            ...gainerData,
            symbol: gainerData.symbol.toUpperCase(),
            last_updated: new Date(),
          },
        },
        upsert: true,
      },
    }));

    const result = await (CoinGainers as any).bulkWrite(operations);

    await invalidateCryptoCache();

    res.status(200).json({
      success: true,
      code: 200,
      message: 'CoinGainers bulk update completed',
      data: {
        matchedCount: result.matchedCount,
        modifiedCount: result.modifiedCount,
        upsertedCount: result.upsertedCount,
        totalProcessed: coinGainersData.length,
      },
    });
  } catch (error: any) {
    console.error('Bulk update CoinGainers error:', error);
    res.status(500).json({
      success: false,
      code: 500,
      message: 'Internal server error bulk updating CoinGainers',
      errorId: `COINGAINER-ERR-${Date.now()}`,
    });
  }
};

const invalidateCoinHistoryCache = async (symbol: string | null = null): Promise<void> => {
  await deleteCacheByPattern('coinhistory:*');
  if (symbol) {
    await deleteCacheByPattern(`coinhistory:${symbol}:*`);
  }
};

export const createCoinHistory = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey || apiKey !== process.env.API_KEY) {
      res.status(401).json({
        success: false,
        code: 401,
        message: 'Invalid or missing API key',
      });
      return;
    }

    const { symbol, name, market_data, timeframe, vs_currency } = req.body;

    if (!symbol || !name || !market_data || !market_data.prices || !timeframe) {
      res.status(400).json({
        success: false,
        code: 400,
        message: 'Missing required fields',
        details: {
          required: ['symbol', 'name', 'market_data.prices', 'timeframe'],
        },
      });
      return;
    }

    if (!Array.isArray(market_data.prices) || market_data.prices.length === 0) {
      res.status(400).json({
        success: false,
        code: 400,
        message: 'market_data.prices must be a non-empty array',
      });
      return;
    }

    market_data.prices.forEach((pricePoint: any, index: number) => {
      if (!Array.isArray(pricePoint) || pricePoint.length !== 2) {
        res.status(400).json({
          success: false,
          code: 400,
          message: `Invalid price point at index ${index}. Must be [timestamp, price]`,
        });
        return;
      }
    });

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

    const formattedPrices = market_data.prices.map(([timestamp, price]: [number, number]) => ({
      timestamp,
      price,
    }));

    const existingHistory = await CoinHistory.findOne({
      symbol: symbol.toUpperCase(),
      timeframe,
      vs_currency: vs_currency || 'usd',
    });

    if (existingHistory) {
      const updatedHistory = await CoinHistory.findOneAndUpdate(
        {
          symbol: symbol.toUpperCase(),
          timeframe,
          vs_currency: vs_currency || 'usd',
        },
        {
          name,
          market_data: { prices: formattedPrices },
          last_updated: new Date(),
        },
        { new: true }
      );

      await invalidateCoinHistoryCache(symbol.toUpperCase());

      res.status(200).json({
        success: true,
        code: 200,
        message: 'Coin history updated successfully',
        data: updatedHistory,
      });
      return;
    }

    const newCoinHistory = new CoinHistory({
      symbol: symbol.toUpperCase(),
      name,
      market_data: { prices: formattedPrices },
      timeframe,
      vs_currency: vs_currency || 'usd',
      last_updated: new Date(),
    });

    const savedHistory = await newCoinHistory.save();
    await invalidateCoinHistoryCache(symbol.toUpperCase());

    res.status(201).json({
      success: true,
      code: 201,
      message: 'Coin history created successfully',
      data: savedHistory,
    });
  } catch (error: any) {
    if (error.code === 11000) {
      res.status(400).json({
        success: false,
        code: 400,
        message: 'Duplicate entry. History for this symbol, timeframe, and currency already exists',
        details: error.keyValue,
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

    console.error('Create coin history error:', error);
    res.status(500).json({
      success: false,
      code: 500,
      message: 'Internal server error creating coin history',
      errorId: `COINHISTORY-ERR-${Date.now()}`,
    });
  }
};

export const getCoinHistory = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const symbolParam = req.params.symbol;
    const symbol = ensureString(symbolParam).toUpperCase();
    const timeframe = ensureString(req.query.timeframe) || '30';
    const vs_currency = ensureString(req.query.currency) || 'usd';
    const startDate = ensureNumber(req.query.startDate, 0);
    const endDate = ensureNumber(req.query.endDate, Date.now());
    const limit = ensureNumber(req.query.limit, 1000);

    if (!symbol) {
      res.status(400).json({
        success: false,
        code: 400,
        message: 'Symbol parameter is required',
      });
      return;
    }

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

    const cacheKey = `coinhistory:${symbol}:${timeframe}:${vs_currency}:${startDate}:${endDate}:${limit}`;
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

    const coinHistory = await CoinHistory.findOne({
      symbol,
      timeframe,
      vs_currency,
    });

    if (!coinHistory) {
      res.status(404).json({
        success: false,
        code: 404,
        message: 'Coin history not found',
        details: { symbol, timeframe, vs_currency },
      });
      return;
    }

    let prices = coinHistory.market_data.prices;

    if (startDate > 0 || endDate < Date.now()) {
      prices = prices.filter(
        (point) => point.timestamp >= startDate && point.timestamp <= endDate
      );
    }

    if (prices.length > limit) {
      const step = Math.floor(prices.length / limit);
      prices = prices.filter((_, index) => index % step === 0);
    }

    const result = {
      symbol: coinHistory.symbol,
      name: coinHistory.name,
      timeframe: coinHistory.timeframe,
      vs_currency: coinHistory.vs_currency,
      market_data: {
        prices: prices.map(p => [p.timestamp, p.price]),
      },
      total_points: prices.length,
      last_updated: coinHistory.last_updated,
    };

    await setCache(cacheKey, result, 300);

    res.status(200).json({
      success: true,
      code: 200,
      fromCache: false,
      data: result,
    });
  } catch (error: any) {
    console.error('Get coin history error:', error);
    res.status(500).json({
      success: false,
      code: 500,
      message: 'Internal server error fetching coin history',
      errorId: `COINHISTORY-ERR-${Date.now()}`,
    });
  }
};

export const getAllCoinHistories = async (
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

    const page = ensureNumber(req.query.page, 1);
    const limit = ensureNumber(req.query.limit, 50);
    const symbol = ensureString(req.query.symbol).toUpperCase();
    const timeframe = ensureString(req.query.timeframe);

    const query: any = {};
    if (symbol) query.symbol = symbol;
    if (timeframe) query.timeframe = timeframe;

    const cacheKey = `coinhistory:all:${page}:${limit}:${symbol}:${timeframe}`;
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

    const skip = (page - 1) * limit;
    const total = await CoinHistory.countDocuments(query);

    const histories = await CoinHistory.find(query)
      .select('-market_data.prices')
      .sort({ symbol: 1, timeframe: 1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const result = {
      success: true,
      code: 200,
      fromCache: false,
      data: histories,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
        hasNext: skip + histories.length < total,
        hasPrev: page > 1,
      },
      filters: {
        symbol: symbol || undefined,
        timeframe: timeframe || undefined,
      },
    };

    await setCache(cacheKey, result, 300);

    res.status(200).json(result);
  } catch (error: any) {
    console.error('Get all coin histories error:', error);
    res.status(500).json({
      success: false,
      code: 500,
      message: 'Internal server error fetching coin histories',
      errorId: `COINHISTORY-ERR-${Date.now()}`,
    });
  }
};

export const deleteCoinHistory = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey || apiKey !== process.env.API_KEY) {
      res.status(401).json({
        success: false,
        code: 401,
        message: 'Invalid or missing API key',
      });
      return;
    }

    const { id } = req.params;

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

    const deletedHistory = await CoinHistory.findByIdAndDelete(id);

    if (!deletedHistory) {
      res.status(404).json({
        success: false,
        code: 404,
        message: 'Coin history not found',
        details: { id },
      });
      return;
    }

    await invalidateCoinHistoryCache(deletedHistory.symbol);

    res.status(200).json({
      success: true,
      code: 200,
      message: 'Coin history deleted successfully',
      data: {
        id: deletedHistory._id,
        symbol: deletedHistory.symbol,
        timeframe: deletedHistory.timeframe,
      },
    });
  } catch (error: any) {
    console.error('Delete coin history error:', error);
    res.status(500).json({
      success: false,
      code: 500,
      message: 'Internal server error deleting coin history',
      errorId: `COINHISTORY-ERR-${Date.now()}`,
    });
  }
};

export const getCoinHistoryStats = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const symbolParam = req.params.symbol;
    const symbol = ensureString(symbolParam).toUpperCase();
    const timeframe = ensureString(req.query.timeframe) || '30';
    const vs_currency = ensureString(req.query.currency) || 'usd';

    if (!symbol) {
      res.status(400).json({
        success: false,
        code: 400,
        message: 'Symbol parameter is required',
      });
      return;
    }

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

    const cacheKey = `coinhistory:stats:${symbol}:${timeframe}:${vs_currency}`;
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

    const coinHistory = await CoinHistory.findOne({
      symbol,
      timeframe,
      vs_currency,
    });

    if (!coinHistory) {
      res.status(404).json({
        success: false,
        code: 404,
        message: 'Coin history not found',
        details: { symbol, timeframe, vs_currency },
      });
      return;
    }

    const prices = coinHistory.market_data.prices;
    const priceValues = prices.map(p => p.price);

    const firstPrice = priceValues[0];
    const lastPrice = priceValues[priceValues.length - 1];
    const highest = Math.max(...priceValues);
    const lowest = Math.min(...priceValues);
    const average = priceValues.reduce((a, b) => a + b, 0) / priceValues.length;

    const priceChange = lastPrice - firstPrice;
    const percentChange = (priceChange / firstPrice) * 100;

    const stats = {
      symbol: coinHistory.symbol,
      name: coinHistory.name,
      timeframe: coinHistory.timeframe,
      vs_currency: coinHistory.vs_currency,
      first_price: firstPrice,
      last_price: lastPrice,
      highest_price: highest,
      lowest_price: lowest,
      average_price: average,
      price_change: priceChange,
      price_change_percentage: percentChange,
      volatility: calculateVolatility(priceValues),
      total_data_points: prices.length,
      date_range: {
        from: new Date(prices[0].timestamp).toISOString(),
        to: new Date(prices[prices.length - 1].timestamp).toISOString(),
      },
    };

    await setCache(cacheKey, stats, 300);

    res.status(200).json({
      success: true,
      code: 200,
      fromCache: false,
      data: stats,
    });
  } catch (error: any) {
    console.error('Get coin history stats error:', error);
    res.status(500).json({
      success: false,
      code: 500,
      message: 'Internal server error fetching coin history stats',
      errorId: `COINHISTORY-ERR-${Date.now()}`,
    });
  }
};

export const bulkUpsertCryptos = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { cryptos } = req.body;

    if (!cryptos || !Array.isArray(cryptos) || cryptos.length === 0) {
      res.status(400).json({
        success: false,
        code: 400,
        message: 'Cryptos array is required and must not be empty',
      });
      return;
    }

    const results: {
      created: Array<{ id: any; symbol: any }>;
      updated: Array<{ id: any; symbol: any }>;
      failed: Array<{ id: any; symbol: any; error: string }>;
    } = {
      created: [],
      updated: [],
      failed: [],
    };

    for (const cryptoData of cryptos) {
      try {
        const existingCrypto = await (Crypto as any).findOne({ id: cryptoData.id });

        if (existingCrypto) {
          const updated = await (Crypto as any).findOneAndUpdate(
            { id: cryptoData.id },
            {
              ...cryptoData,
              symbol: cryptoData.symbol.toLowerCase(),
              last_updated: new Date(),
              $push: {
                price_history: {
                  $each: [{
                    date: new Date(),
                    price: cryptoData.current_price,
                  }],
                  $position: 0,
                  $slice: 1000,
                },
              },
            },
            { new: true }
          );
          results.updated.push({ id: cryptoData.id, symbol: cryptoData.symbol });
          publishCryptoUpdate(updated?.symbol ?? cryptoData.symbol, updated ?? cryptoData);
        } else {
          const newCrypto = new (Crypto as any)({
            ...cryptoData,
            symbol: cryptoData.symbol.toLowerCase(),
            price_history: [{
              date: new Date(),
              price: cryptoData.current_price,
            }],
            last_updated: new Date(),
          });
          await newCrypto.save();
          results.created.push({ id: cryptoData.id, symbol: cryptoData.symbol });
          publishCryptoUpdate(newCrypto.symbol ?? cryptoData.symbol, newCrypto);
        }

        await invalidateCryptoCache(cryptoData.symbol);
      } catch (error: any) {
        results.failed.push({
          id: cryptoData.id,
          symbol: cryptoData.symbol,
          error: error.message,
        });
      }
    }

    res.status(200).json({
      success: true,
      code: 200,
      message: `Bulk upsert completed: ${results.created.length} created, ${results.updated.length} updated, ${results.failed.length} failed`,
      data: results,
    });

    // A light summary event for clients that only care about "something changed".
    broadcast('crypto', 'bulk_upsert_completed', results);
  } catch (error: any) {
    console.error('Bulk upsert cryptos error:', error);
    res.status(500).json({
      success: false,
      code: 500,
      message: 'Internal server error during bulk upsert',
    });
  }
};

function calculateVolatility(prices: number[]): number {
  if (prices.length < 2) return 0;
  
  const returns = [];
  for (let i = 1; i < prices.length; i++) {
    returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
  }
  
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const squaredDiffs = returns.map(r => Math.pow(r - mean, 2));
  const variance = squaredDiffs.reduce((a, b) => a + b, 0) / returns.length;
  
  return Math.sqrt(variance);
}