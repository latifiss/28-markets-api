import express from 'express';
import * as eventController from '../controllers/event.controller';

const router = express.Router();

router.get('/', eventController.getAllEvents);
router.get('/latest', eventController.getLatestEvents);
router.get('/upcoming', eventController.getUpcomingEvents);
router.get('/past', eventController.getPastEvents);
router.get('/search', eventController.searchEvents);
router.get('/date-range', eventController.getEventsByDateRange);
router.get('/types/:type', eventController.getEventsByType);
router.get('/states/:state', eventController.getEventsByState);
router.get('/types/:type/states', eventController.getStateOptionsByType);
router.get('/feed', eventController.getFeedEvents);
router.get('/codes/:code', eventController.getEventByCode);
router.get('/:id', eventController.getEventById);
router.post('/', eventController.createEvent);
router.put('/codes/:code', eventController.updateEventByCode);
router.delete('/codes/:code', eventController.deleteEventByCode);
router.put('/:id', eventController.updateEvent);
router.delete('/:id', eventController.deleteEvent);

export default router;
