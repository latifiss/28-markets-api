"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRedisClient = void 0;
const redis_1 = require("redis");
const redisConfig = {
    username: process.env.REDIS_USERNAME,
    password: process.env.REDIS_PASSWORD,
    socket: {
        host: process.env.REDIS_HOST,
        port: Number(process.env.REDIS_PORT),
    },
};
let client = null;
let isConnecting = false;
let connectionPromise = null;
const getRedisClient = async () => {
    if (client && client.isReady) {
        return client;
    }
    if (isConnecting && connectionPromise) {
        return connectionPromise;
    }
    isConnecting = true;
    console.log('🔌 Connecting to Redis...');
    connectionPromise = new Promise(async (resolve, reject) => {
        try {
            client = (0, redis_1.createClient)(redisConfig);
            client.on('error', (err) => {
                console.error('❌ Redis Client Error:', err);
                isConnecting = false;
                reject(err);
            });
            client.on('ready', () => {
                console.log('✅ Redis connected successfully!');
                isConnecting = false;
                resolve(client);
            });
            await client.connect();
        }
        catch (error) {
            console.error('❌ Failed to connect to Redis:', error);
            isConnecting = false;
            client = null;
            connectionPromise = null;
            reject(error);
        }
    });
    return connectionPromise;
};
exports.getRedisClient = getRedisClient;
//# sourceMappingURL=redis.js.map