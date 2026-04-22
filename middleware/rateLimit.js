"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.apiKeyRateLimit = exports.authRateLimit = exports.generalRateLimit = void 0;
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
exports.generalRateLimit = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: {
        error: 'Too many requests from this IP, please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false,
});
exports.authRateLimit = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: {
        error: 'Too many authentication attempts, please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false,
});
exports.apiKeyRateLimit = (0, express_rate_limit_1.default)({
    windowMs: 60 * 60 * 1000,
    max: 50,
    message: {
        error: 'API rate limit exceeded, please try again in an hour.'
    },
    standardHeaders: true,
    legacyHeaders: false,
});
//# sourceMappingURL=rateLimit.js.map