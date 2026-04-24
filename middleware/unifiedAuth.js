"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.unifiedAuth = void 0;
const apiKey_1 = require("./apiKey");
const auth_1 = require("./auth");
const unifiedAuth = async (req, res, next) => {
    const hasApiKey = req.headers['x-api-key'];
    const hasToken = req.headers['authorization'];
    if (hasApiKey) {
        return (0, apiKey_1.authenticateApiKey)(req, res, next);
    }
    if (hasToken) {
        return (0, auth_1.authenticateToken)(req, res, next);
    }
    return res.status(401).json({ error: 'Authentication required. Provide JWT token or API key' });
};
exports.unifiedAuth = unifiedAuth;
//# sourceMappingURL=unifiedAuth.js.map