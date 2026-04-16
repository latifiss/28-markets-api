import express from 'express';
import * as eventController from '../controllers/event.controller';

const router = express.Router();

router.get('/', eventController.getAllEvents);
router.get('/latest', eventController.getLatestEvents);
router.get('/upcoming', eventController.getUpcomingEvents);
router.get('/past', eventController.getPastEvents);
router.get('/search', eventController.searchEvents);
router.get('/date-range', eventController.getEventsByDateRange);
router.get('/type/:type', eventController.getEventsByType);
router.get('/state/:state', eventController.getEventsByState);
router.get('/state-options/:type', eventController.getStateOptionsByType);
router.get('/feed', eventController.getFeedEvents);
router.get('/id/:id', eventController.getEventById);
router.get('/code/:code', eventController.getEventByCode);
router.post('/', eventController.createEvent);
router.put('/id/:id', eventController.updateEvent);
router.put('/code/:code', eventController.updateEventByCode);
router.delete('/id/:id', eventController.deleteEvent);
router.delete('/code/:code', eventController.deleteEventByCode);

export default router;
