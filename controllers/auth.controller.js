"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getProfile = exports.getApiKeys = exports.generateNewApiKey = exports.login = exports.register = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const user_1 = __importDefault(require("../models/user"));
const apiKey_1 = __importDefault(require("../models/apiKey"));
const auth_1 = require("../middleware/auth");
const apiKey_2 = require("../middleware/apiKey");
const register = async (req, res) => {
    try {
        const { email, password, name } = req.body;
        const existingUser = await user_1.default.findOne({ email });
        if (existingUser) {
            res.status(400).json({ error: 'User already exists' });
            return;
        }
        const hashedPassword = await bcryptjs_1.default.hash(password, 12);
        const user = new user_1.default({ email, password: hashedPassword, name });
        await user.save();
        const token = (0, auth_1.generateToken)({ userId: String(user._id), email: user.email });
        res.status(201).json({
            message: 'User created successfully',
            token,
            user: { id: user._id, email: user.email, name: user.name },
        });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.register = register;
const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await user_1.default.findOne({ email });
        if (!user || !user.isActive) {
            res.status(401).json({ error: 'Invalid credentials' });
            return;
        }
        const isPasswordValid = await bcryptjs_1.default.compare(password, user.password);
        if (!isPasswordValid) {
            res.status(401).json({ error: 'Invalid credentials' });
            return;
        }
        const token = (0, auth_1.generateToken)({ userId: String(user._id), email: user.email });
        res.json({
            message: 'Login successful',
            token,
            user: { id: user._id, email: user.email, name: user.name },
        });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.login = login;
const generateNewApiKey = async (req, res) => {
    try {
        const userId = req.user.userId;
        const apiKey = await (0, apiKey_2.generateApiKey)(userId);
        res.json({ message: 'API key generated successfully', apiKey, createdAt: new Date() });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.generateNewApiKey = generateNewApiKey;
const getApiKeys = async (req, res) => {
    try {
        const userId = req.user.userId;
        const keys = await apiKey_1.default.find({ userId, revoked: false }).select('-__v');
        res.json({ apiKeys: keys });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.getApiKeys = getApiKeys;
const getProfile = async (req, res) => {
    try {
        const user = await user_1.default.findById(req.user.userId).select('-password');
        if (!user) {
            res.status(404).json({ error: 'User not found' });
            return;
        }
        res.json({
            user: {
                id: user._id,
                email: user.email,
                name: user.name,
                isActive: user.isActive,
                tier: user.tier,
                stripeCustomerId: user.stripeCustomerId,
                subscriptionStatus: user.subscriptionStatus,
                currentPeriodEnd: user.currentPeriodEnd,
                createdAt: user.createdAt,
                updatedAt: user.updatedAt
            }
        });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.getProfile = getProfile;
//# sourceMappingURL=auth.controller.js.map