import type { Request, Response } from 'express';
import Event from '../models/event.model';

export const getAllEvents = async (req: Request, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    const sortOrder = req.query.sort === 'asc' ? 1 : -1;
    const sortField = req.query.sortBy === 'title' ? 'title' : 'date';

    const events = await Event.find()
      .sort({ [sortField]: sortOrder })
      .skip(skip)
      .limit(limit);

    const total = await Event.countDocuments();

    res.status(200).json({
      events,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalEvents: total,
        hasNextPage: page < Math.ceil(total / limit),
        hasPrevPage: page > 1,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getEventById = async (req: Request, res: Response): Promise<void> => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) {
      res.status(404).json({ error: 'Event not found' });
      return;
    }
    res.status(200).json(event);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getEventByCode = async (req: Request, res: Response): Promise<void> => {
  try {
    const event = await Event.findOne({ code: req.params.code });
    if (!event) {
      res.status(404).json({ error: 'Event not found' });
      return;
    }
    res.status(200).json(event);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const createEvent = async (req: Request, res: Response): Promise<void> => {
  try {
    const eventData = {
      ...req.body,
      last_updated: new Date(),
    };

    const event = await Event.create(eventData);
    res.status(201).json(event);
  } catch (error: any) {
    if (error.code === 11000) {
      res.status(400).json({ error: 'Event code already exists' });
      return;
    }
    res.status(400).json({ error: error.message });
  }
};

export const updateEvent = async (req: Request, res: Response): Promise<void> => {
  try {
    const updateData = {
      ...req.body,
      last_updated: new Date(),
    };

    const event = await Event.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
      runValidators: true,
    });

    if (!event) {
      res.status(404).json({ error: 'Event not found' });
      return;
    }

    res.status(200).json(event);
  } catch (error: any) {
    if (error.code === 11000) {
      res.status(400).json({ error: 'Event code already exists' });
      return;
    }
    res.status(400).json({ error: error.message });
  }
};

export const updateEventByCode = async (req: Request, res: Response): Promise<void> => {
  try {
    const updateData = {
      ...req.body,
      last_updated: new Date(),
    };

    const event = await Event.findOneAndUpdate(
      { code: req.params.code },
      updateData,
      { new: true, runValidators: true }
    );

    if (!event) {
      res.status(404).json({ error: 'Event not found' });
      return;
    }

    res.status(200).json(event);
  } catch (error: any) {
    if (error.code === 11000) {
      res.status(400).json({ error: 'Event code already exists' });
      return;
    }
    res.status(400).json({ error: error.message });
  }
};

export const deleteEvent = async (req: Request, res: Response): Promise<void> => {
  try {
    const event = await Event.findByIdAndDelete(req.params.id);

    if (!event) {
      res.status(404).json({ error: 'Event not found' });
      return;
    }

    res.status(200).json({ message: 'Event deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteEventByCode = async (req: Request, res: Response): Promise<void> => {
  try {
    const event = await Event.findOneAndDelete({ code: req.params.code });

    if (!event) {
      res.status(404).json({ error: 'Event not found' });
      return;
    }

    res.status(200).json({ message: 'Event deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getEventsByType = async (req: Request, res: Response): Promise<void> => {
  try {
    const { type } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    const events = await Event.find({ type })
      .sort({ date: 1 })
      .skip(skip)
      .limit(limit);

    const total = await Event.countDocuments({ type });

    res.status(200).json({
      events,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalEvents: total,
        hasNextPage: page < Math.ceil(total / limit),
        hasPrevPage: page > 1,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getFeedEvents = async (req: Request, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    const today = new Date();
    const fourDaysAgo = new Date();
    fourDaysAgo.setDate(today.getDate() - 4);
    fourDaysAgo.setHours(0, 0, 0, 0);

    const events = await Event.find({
      $or: [
        { date: { $gte: fourDaysAgo, $lte: today } },
        { date: { $gt: today } },
      ],
    })
      .sort({
        date: -1,
      })
      .skip(skip)
      .limit(limit);

    const total = await Event.countDocuments({
      $or: [
        { date: { $gte: fourDaysAgo, $lte: today } },
        { date: { $gt: today } },
      ],
    });

    res.status(200).json({
      events,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalEvents: total,
        hasNextPage: page < Math.ceil(total / limit),
        hasPrevPage: page > 1,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getEventsByDateRange = async (req: Request, res: Response): Promise<void> => {
  try {
    const { startDate, endDate } = req.query;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    if (!startDate || !endDate) {
      res
        .status(400)
        .json({ error: 'startDate and endDate are required' });
      return;
    }

    const events = await Event.find({
      date: {
        $gte: new Date(startDate as string),
        $lte: new Date(endDate as string),
      },
    })
      .sort({ date: 1 })
      .skip(skip)
      .limit(limit);

    const total = await Event.countDocuments({
      date: {
        $gte: new Date(startDate as string),
        $lte: new Date(endDate as string),
      },
    });

    res.status(200).json({
      events,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalEvents: total,
        hasNextPage: page < Math.ceil(total / limit),
        hasPrevPage: page > 1,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getEventsByState = async (req: Request, res: Response): Promise<void> => {
  try {
    const { state } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    const events = await Event.find({ state })
      .sort({ date: 1 })
      .skip(skip)
      .limit(limit);

    const total = await Event.countDocuments({ state });

    res.status(200).json({
      events,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalEvents: total,
        hasNextPage: page < Math.ceil(total / limit),
        hasPrevPage: page > 1,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getStateOptionsByType = async (req: Request, res: Response): Promise<void> => {
  try {
    const { type } = req.params;

    const stateOptionsMap: { [key: string]: string[] } = {
      economic: ['pending', 'confirmed', 'cancelled'],
      earnings: ['pending', 'announced', 'oversubscribed'],
      dividend: ['pending', 'announced', 'paid'],
      ipo: ['pending', 'oversubscribed', 'closed'],
      treasury: ['pending', 'announced', 'settled'],
    };

    const stateOptions = stateOptionsMap[type as keyof typeof stateOptionsMap] || [];

    if (stateOptions.length === 0) {
      res
        .status(404)
        .json({ error: 'Type not found or has no state options' });
      return;
    }

    res.status(200).json({
      type,
      stateOptions,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getUpcomingEvents = async (req: Request, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    const events = await Event.find({
      date: { $gte: new Date() },
    })
      .sort({ date: 1 })
      .skip(skip)
      .limit(limit);

    const total = await Event.countDocuments({
      date: { $gte: new Date() },
    });

    res.status(200).json({
      events,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalEvents: total,
        hasNextPage: page < Math.ceil(total / limit),
        hasPrevPage: page > 1,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getPastEvents = async (req: Request, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    const events = await Event.find({
      date: { $lt: new Date() },
    })
      .sort({ date: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Event.countDocuments({
      date: { $lt: new Date() },
    });

    res.status(200).json({
      events,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalEvents: total,
        hasNextPage: page < Math.ceil(total / limit),
        hasPrevPage: page > 1,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getLatestEvents = async (req: Request, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    const events = await Event.find().sort({ date: 1 }).skip(skip).limit(limit);

    const total = await Event.countDocuments();

    res.status(200).json({
      events,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalEvents: total,
        hasNextPage: page < Math.ceil(total / limit),
        hasPrevPage: page > 1,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const searchEvents = async (req: Request, res: Response): Promise<void> => {
  try {
    const q = req.query.q as string;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    if (!q) {
      res.status(400).json({ error: 'Search query is required' });
      return;
    }

    const searchQuery = {
      $or: [
        { title: { $regex: q, $options: 'i' } },
        { code: { $regex: q, $options: 'i' } },
      ]
    };

    const events = await Event.find(searchQuery)
      .sort({ date: 1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await Event.countDocuments(searchQuery);

    res.status(200).json({
      success: true,
      events,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalEvents: total,
        hasNextPage: page < Math.ceil(total / limit),
        hasPrevPage: page > 1,
      },
    });
  } catch (error: any) {
    console.error('Search events error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
};
