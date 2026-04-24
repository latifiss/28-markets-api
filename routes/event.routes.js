"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const eventController = __importStar(require("../controllers/event.controller"));
const router = express_1.default.Router();
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
exports.default = router;
//# sourceMappingURL=event.routes.js.map