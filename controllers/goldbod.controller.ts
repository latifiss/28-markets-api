import type { Request, Response } from 'express';
import Goldbod, { PriceHistory } from '../models/golbod.model';
import { getRedisClient } from '../lib/redis';

const setCache = async (key: string, data: any, expirationInSeconds = 86400): Promise<void> => {
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

export const getAllGoldbod = async (req: Request, res: Response): Promise<void> => {
  try {
    const cacheKey = 'goldbod:all';
    const cached = await getCache(cacheKey);
    if (cached) {
      res.status(200).json(cached);
      return;
    }
    const goldbod = await Goldbod.find();
    await setCache(cacheKey, goldbod);
    res.status(200).json(goldbod);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getGoldbodByCode = async (req: Request, res: Response): Promise<void> => {
  try {
    const cacheKey = `goldbod:${req.params.code}`;
    const cached = await getCache(cacheKey);
    if (cached) {
      res.status(200).json(cached);
      return;
    }
    const goldbod = await Goldbod.findOne({ code: req.params.code });
    if (!goldbod) {
      res.status(404).json({ message: 'Goldbod not found' });
      return;
    }
    await setCache(cacheKey, goldbod);
    res.status(200).json(goldbod);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const createGoldbod = async (req: Request, res: Response): Promise<void> => {
  try {
    const existingGoldbod = await Goldbod.findOne({ code: 'goldbod' });
    if (existingGoldbod) {
      res.status(400).json({ message: 'Goldbod already exists' });
      return;
    }

    const goldbod = new Goldbod({
      code: 'goldbod',
      name: 'Goldbod',
      unit: 'pounds',
      currentPrice: req.body.currentPrice,
      percentage_change: 0,
      last_updated: new Date(),
    });

    await goldbod.save();
    
    await PriceHistory.create({
      goldbod_id: goldbod.code,
      history: [{
        date: new Date(),
        price: req.body.currentPrice,
      }],
    });

    await deleteCacheByPattern('goldbod:*');
    res.status(201).json(goldbod);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const updateGoldbod = async (req: Request, res: Response): Promise<void> => {
  try {
    const goldbod = await Goldbod.findOne({ code: 'goldbod' });
    if (!goldbod) {
      res.status(404).json({ message: 'Goldbod not found' });
      return;
    }

    const oldPrice = goldbod.currentPrice;
    const newPrice = req.body.currentPrice;
    const percentageChange = ((newPrice - oldPrice) / oldPrice) * 100;

    const updatedGoldbod = await Goldbod.findOneAndUpdate(
      { code: 'goldbod' },
      {
        $set: {
          currentPrice: newPrice,
          percentage_change: percentageChange,
          last_updated: new Date(),
        },
      },
      { new: true }
    );

    await PriceHistory.findOneAndUpdate(
      { goldbod_id: 'goldbod' },
      {
        $push: {
          history: {
            $each: [{ date: new Date(), price: newPrice }],
            $position: 0,
          },
        },
      },
      { upsert: true }
    );

    await deleteCacheByPattern('goldbod:*');
    res.status(200).json(updatedGoldbod);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteGoldbod = async (req: Request, res: Response): Promise<void> => {
  try {
    const goldbod = await Goldbod.findOneAndDelete({ code: 'goldbod' });
    if (!goldbod) {
      res.status(404).json({ message: 'Goldbod not found' });
      return;
    }

    await PriceHistory.findOneAndDelete({ goldbod_id: 'goldbod' });
    await deleteCacheByPattern('goldbod:*');
    res.status(200).json({ message: 'Goldbod deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const addPriceHistory = async (req: Request, res: Response): Promise<void> => {
  try {
    const { price, date } = req.body;
    
    if (!price) {
      res.status(400).json({ message: 'Price is required' });
      return;
    }

    const goldbod = await Goldbod.findOne({ code: 'goldbod' });
    if (!goldbod) {
      res.status(404).json({ message: 'Goldbod not found' });
      return;
    }

    const priceHistory = await PriceHistory.findOneAndUpdate(
      { goldbod_id: 'goldbod' },
      {
        $push: {
          history: {
            $each: [{ 
              date: date ? new Date(date) : new Date(), 
              price: Number(price) 
            }],
            $position: 0,
          },
        },
      },
      { upsert: true, new: true }
    );

    const MAX_HISTORY_ENTRIES = 1000;
    if (priceHistory.history.length > MAX_HISTORY_ENTRIES) {
      priceHistory.history = priceHistory.history.slice(0, MAX_HISTORY_ENTRIES);
      await priceHistory.save();
    }

    await deleteCacheByPattern('goldbod:price-history:*');
    res.status(201).json({ 
      message: 'Price history added successfully',
      data: {
        goldbod_id: 'goldbod',
        entry: {
          date: date ? new Date(date) : new Date(),
          price: Number(price),
        },
        total_entries: priceHistory.history.length,
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const updatePriceHistory = async (req: Request, res: Response): Promise<void> => {
  try {
    const { entryId } = req.params;
    const { price, date } = req.body;

    const priceHistory = await PriceHistory.findOne({ goldbod_id: 'goldbod' });
    if (!priceHistory) {
      res.status(404).json({ message: 'Price history not found' });
      return;
    }

    const entryIndex = priceHistory.history.findIndex(
      (entry: any) => entry._id.toString() === entryId
    );

    if (entryIndex === -1) {
      res.status(404).json({ message: 'Price history entry not found' });
      return;
    }

    if (price) priceHistory.history[entryIndex].price = Number(price);
    if (date) priceHistory.history[entryIndex].date = new Date(date);

    await priceHistory.save();
    await deleteCacheByPattern('goldbod:price-history:*');

    res.status(200).json({
      message: 'Price history entry updated successfully',
      data: {
        goldbod_id: 'goldbod',
        entry: priceHistory.history[entryIndex],
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getPriceHistory = async (req: Request, res: Response): Promise<void> => {
  try {
    const { limit = 100, days } = req.query;
    const cacheKey = `goldbod:price-history:limit=${limit}:days=${days}`;
    
    const cached = await getCache(cacheKey);
    if (cached) {
      res.status(200).json(cached);
      return;
    }

    let query: any = { goldbod_id: 'goldbod' };
    
    if (days) {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - Number(days));
      query['history.date'] = { $gte: startDate };
    }

    const priceHistory = await PriceHistory.aggregate([
      { $match: { goldbod_id: 'goldbod' } },
      { $unwind: '$history' },
      ...(days ? [{ $match: { 'history.date': { $gte: new Date(Date.now() - Number(days) * 24 * 60 * 60 * 1000) } } }] : []),
      { $sort: { 'history.date': -1 } },
      { $limit: Number(limit) },
      { $group: {
        _id: '$_id',
        goldbod_id: { $first: '$goldbod_id' },
        history: { $push: '$history' },
        createdAt: { $first: '$createdAt' },
        updatedAt: { $first: '$updatedAt' }
      }}
    ]);

    if (!priceHistory.length) {
      res.status(404).json({ message: 'Price history not found' });
      return;
    }

    const result = priceHistory[0];
    await setCache(cacheKey, result, 300);
    
    res.status(200).json({
      goldbod_id: result.goldbod_id,
      total_entries: result.history.length,
      history: result.history,
      metadata: {
        limit: Number(limit),
        days: days ? Number(days) : null,
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getLatestPriceHistory = async (req: Request, res: Response): Promise<void> => {
  try {
    const cacheKey = 'goldbod:price-history:latest';
    const cached = await getCache(cacheKey);
    if (cached) {
      res.status(200).json(cached);
      return;
    }

    const priceHistory = await PriceHistory.findOne(
      { goldbod_id: 'goldbod' },
      { 'history': { $slice: 30 } }
    ).sort({ updatedAt: -1 });

    if (!priceHistory) {
      res.status(404).json({ message: 'Price history not found' });
      return;
    }

    await setCache(cacheKey, priceHistory, 300);
    res.status(200).json(priceHistory);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const deletePriceHistoryEntry = async (req: Request, res: Response): Promise<void> => {
  try {
    const { entryId } = req.params;

    const priceHistory = await PriceHistory.findOneAndUpdate(
      { goldbod_id: 'goldbod' },
      { $pull: { history: { _id: entryId } } },
      { new: true }
    );

    if (!priceHistory) {
      res.status(404).json({ message: 'Price history or entry not found' });
      return;
    }

    await deleteCacheByPattern('goldbod:price-history:*');
    res.status(200).json({ 
      message: 'Price history entry deleted successfully',
      total_entries: priceHistory.history.length
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const clearPriceHistory = async (req: Request, res: Response): Promise<void> => {
  try {
    const priceHistory = await PriceHistory.findOneAndUpdate(
      { goldbod_id: 'goldbod' },
      { $set: { history: [] } },
      { new: true }
    );

    if (!priceHistory) {
      res.status(404).json({ message: 'Price history not found' });
      return;
    }

    await deleteCacheByPattern('goldbod:price-history:*');
    res.status(200).json({ 
      message: 'Price history cleared successfully',
      goldbod_id: 'goldbod'
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};