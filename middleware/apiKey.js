"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticateApiKey = exports.revokeApiKey = exports.generateApiKey = void 0;
const apiKey_1 = __importDefault(require("../models/apiKey"));
const crypto_1 = __importDefault(require("crypto"));
const user_1 = __importDefault(require("../models/user"));
const generateApiKey = async (userId, description) => {
    const key = crypto_1.default.randomBytes(32).toString('hex');
    await apiKey_1.default.create({ userId, key, description });
    return key;
};
exports.generateApiKey = generateApiKey;
const revokeApiKey = async (key) => {
    const result = await apiKey_1.default.findOneAndUpdate({ key, revoked: false }, { revoked: true });
    return !!result;
};
exports.revokeApiKey = revokeApiKey;
const authenticateApiKey = async (req, res, next) => {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey)
        return res.status(401).json({ error: 'API key required' });
    const keyData = await apiKey_1.default.findOne({ key: apiKey, revoked: false });
    if (!keyData)
        return res.status(403).json({ error: 'Invalid API key' });
    const user = await user_1.default.findById(keyData.userId);
    if (!user)
        return res.status(403).json({ error: 'User not found' });
    req.apiKey = apiKey;
    req.apiKeyId = String(keyData._id);
    req.user = { userId: keyData.userId.toString(), email: user.email };
    req.tier = user.tier;
    next();
};
exports.authenticateApiKey = authenticateApiKey;
//# sourceMappingURL=apiKey.js.map