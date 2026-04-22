"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.searchEvents = exports.getLatestEvents = exports.getPastEvents = exports.getUpcomingEvents = exports.getStateOptionsByType = exports.getEventsByState = exports.getEventsByDateRange = exports.getFeedEvents = exports.getEventsByType = exports.deleteEventByCode = exports.deleteEvent = exports.updateEventByCode = exports.updateEvent = exports.createEvent = exports.getEventByCode = exports.getEventById = exports.getAllEvents = void 0;
const event_model_1 = __importDefault(require("../models/event.model"));
const getAllEvents = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;
        const sortOrder = req.query.sort === 'asc' ? 1 : -1;
        const sortField = req.query.sortBy === 'title' ? 'title' : 'date';
        const events = await event_model_1.default.find()
            .sort({ [sortField]: sortOrder })
            .skip(skip)
            .limit(limit);
        const total = await event_model_1.default.countDocuments();
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
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.getAllEvents = getAllEvents;
const getEventById = async (req, res) => {
    try {
        const event = await event_model_1.default.findById(req.params.id);
        if (!event) {
            res.status(404).json({ error: 'Event not found' });
            return;
        }
        res.status(200).json(event);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.getEventById = getEventById;
const getEventByCode = async (req, res) => {
    try {
        const event = await event_model_1.default.findOne({ code: req.params.code });
        if (!event) {
            res.status(404).json({ error: 'Event not found' });
            return;
        }
        res.status(200).json(event);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.getEventByCode = getEventByCode;
const createEvent = async (req, res) => {
    try {
        const eventData = {
            ...req.body,
            last_updated: new Date(),
        };
        const event = await event_model_1.default.create(eventData);
        res.status(201).json(event);
    }
    catch (error) {
        if (error.code === 11000) {
            res.status(400).json({ error: 'Event code already exists' });
            return;
        }
        res.status(400).json({ error: error.message });
    }
};
exports.createEvent = createEvent;
const updateEvent = async (req, res) => {
    try {
        const updateData = {
            ...req.body,
            last_updated: new Date(),
        };
        const event = await event_model_1.default.findByIdAndUpdate(req.params.id, updateData, {
            new: true,
            runValidators: true,
        });
        if (!event) {
            res.status(404).json({ error: 'Event not found' });
            return;
        }
        res.status(200).json(event);
    }
    catch (error) {
        if (error.code === 11000) {
            res.status(400).json({ error: 'Event code already exists' });
            return;
        }
        res.status(400).json({ error: error.message });
    }
};
exports.updateEvent = updateEvent;
const updateEventByCode = async (req, res) => {
    try {
        const updateData = {
            ...req.body,
            last_updated: new Date(),
        };
        const event = await event_model_1.default.findOneAndUpdate({ code: req.params.code }, updateData, { new: true, runValidators: true });
        if (!event) {
            res.status(404).json({ error: 'Event not found' });
            return;
        }
        res.status(200).json(event);
    }
    catch (error) {
        if (error.code === 11000) {
            res.status(400).json({ error: 'Event code already exists' });
            return;
        }
        res.status(400).json({ error: error.message });
    }
};
exports.updateEventByCode = updateEventByCode;
const deleteEvent = async (req, res) => {
    try {
        const event = await event_model_1.default.findByIdAndDelete(req.params.id);
        if (!event) {
            res.status(404).json({ error: 'Event not found' });
            return;
        }
        res.status(200).json({ message: 'Event deleted successfully' });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.deleteEvent = deleteEvent;
const deleteEventByCode = async (req, res) => {
    try {
        const event = await event_model_1.default.findOneAndDelete({ code: req.params.code });
        if (!event) {
            res.status(404).json({ error: 'Event not found' });
            return;
        }
        res.status(200).json({ message: 'Event deleted successfully' });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.deleteEventByCode = deleteEventByCode;
const getEventsByType = async (req, res) => {
    try {
        const { type } = req.params;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;
        const events = await event_model_1.default.find({ type })
            .sort({ date: 1 })
            .skip(skip)
            .limit(limit);
        const total = await event_model_1.default.countDocuments({ type });
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
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.getEventsByType = getEventsByType;
const getFeedEvents = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;
        const today = new Date();
        const fourDaysAgo = new Date();
        fourDaysAgo.setDate(today.getDate() - 4);
        fourDaysAgo.setHours(0, 0, 0, 0);
        const events = await event_model_1.default.find({
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
        const total = await event_model_1.default.countDocuments({
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
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.getFeedEvents = getFeedEvents;
const getEventsByDateRange = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;
        if (!startDate || !endDate) {
            res
                .status(400)
                .json({ error: 'startDate and endDate are required' });
            return;
        }
        const events = await event_model_1.default.find({
            date: {
                $gte: new Date(startDate),
                $lte: new Date(endDate),
            },
        })
            .sort({ date: 1 })
            .skip(skip)
            .limit(limit);
        const total = await event_model_1.default.countDocuments({
            date: {
                $gte: new Date(startDate),
                $lte: new Date(endDate),
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
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.getEventsByDateRange = getEventsByDateRange;
const getEventsByState = async (req, res) => {
    try {
        const { state } = req.params;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;
        const events = await event_model_1.default.find({ state })
            .sort({ date: 1 })
            .skip(skip)
            .limit(limit);
        const total = await event_model_1.default.countDocuments({ state });
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
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.getEventsByState = getEventsByState;
const getStateOptionsByType = async (req, res) => {
    try {
        const { type } = req.params;
        const stateOptionsMap = {
            economic: ['pending', 'confirmed', 'cancelled'],
            earnings: ['pending', 'announced', 'oversubscribed'],
            dividend: ['pending', 'announced', 'paid'],
            ipo: ['pending', 'oversubscribed', 'closed'],
            treasury: ['pending', 'announced', 'settled'],
        };
        const stateOptions = stateOptionsMap[type] || [];
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
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.getStateOptionsByType = getStateOptionsByType;
const getUpcomingEvents = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;
        const events = await event_model_1.default.find({
            date: { $gte: new Date() },
        })
            .sort({ date: 1 })
            .skip(skip)
            .limit(limit);
        const total = await event_model_1.default.countDocuments({
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
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.getUpcomingEvents = getUpcomingEvents;
const getPastEvents = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;
        const events = await event_model_1.default.find({
            date: { $lt: new Date() },
        })
            .sort({ date: -1 })
            .skip(skip)
            .limit(limit);
        const total = await event_model_1.default.countDocuments({
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
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.getPastEvents = getPastEvents;
const getLatestEvents = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;
        const events = await event_model_1.default.find().sort({ date: 1 }).skip(skip).limit(limit);
        const total = await event_model_1.default.countDocuments();
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
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.getLatestEvents = getLatestEvents;
const searchEvents = async (req, res) => {
    try {
        const q = req.query.q;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
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
        const events = await event_model_1.default.find(searchQuery)
            .sort({ date: 1 })
            .skip(skip)
            .limit(limit)
            .lean();
        const total = await event_model_1.default.countDocuments(searchQuery);
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
    }
    catch (error) {
        console.error('Search events error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};
exports.searchEvents = searchEvents;
//# sourceMappingURL=event.controller.js.map