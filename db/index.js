"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.mongoose = exports.onConnected = exports.connectDB = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
exports.mongoose = mongoose_1.default;
let isDBConnected = false;
const connectionCallbacks = [];
const connectDB = async () => {
    try {
        console.log('🔌 Attempting MongoDB connection...');
        await mongoose_1.default.connect(process.env.MONGODB_URI, {
            dbName: 'api',
            serverSelectionTimeoutMS: 30000,
            socketTimeoutMS: 45000,
            maxPoolSize: 10,
            retryWrites: true,
            retryReads: true,
        });
        isDBConnected = true;
        console.log('✅ MongoDB connected successfully!');
        connectionCallbacks.forEach((cb) => cb());
        connectionCallbacks.length = 0;
    }
    catch (err) {
        console.error('❌ MongoDB connection failed:', err.message);
        console.log('🔄 Retrying in 5 seconds...');
        setTimeout(exports.connectDB, 5000);
    }
};
exports.connectDB = connectDB;
mongoose_1.default.connection.on('disconnected', () => {
    isDBConnected = false;
    console.log('💔 Disconnected from MongoDB');
});
const onConnected = (callback) => {
    if (isDBConnected) {
        callback();
    }
    else {
        connectionCallbacks.push(callback);
    }
};
exports.onConnected = onConnected;
//# sourceMappingURL=index.js.map