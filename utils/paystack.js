"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyWebhookSignature = exports.verifyTransaction = exports.initializeTransaction = void 0;
const https_1 = __importDefault(require("https"));
const crypto_1 = __importDefault(require("crypto"));
const getPaystackSecretKey = () => {
    const key = process.env.PAYSTACK_SECRET_KEY;
    if (!key) {
        throw new Error('Missing PAYSTACK_SECRET_KEY environment variable');
    }
    return key;
};
const paystackRequest = async (path, method = 'GET', body) => {
    const PAYSTACK_SECRET_KEY = getPaystackSecretKey();
    const payload = body ? JSON.stringify(body) : undefined;
    const options = {
        hostname: 'api.paystack.co',
        port: 443,
        path,
        method,
        headers: {
            Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
            'Content-Type': 'application/json',
            ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
        },
    };
    return new Promise((resolve, reject) => {
        const req = https_1.default.request(options, (res) => {
            const chunks = [];
            res.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
            res.on('end', () => {
                const responseText = Buffer.concat(chunks).toString('utf8');
                try {
                    const json = JSON.parse(responseText);
                    if (res.statusCode && res.statusCode >= 400) {
                        reject(new Error(json.message || `Paystack error ${res.statusCode}`));
                        return;
                    }
                    resolve(json);
                }
                catch (error) {
                    reject(new Error(`Unable to parse Paystack response: ${error.message}`));
                }
            });
        });
        req.on('error', (error) => reject(error));
        if (payload) {
            req.write(payload);
        }
        req.end();
    });
};
const initializeTransaction = async (email, amount, callbackUrl, metadata = {}) => {
    const response = await paystackRequest('/transaction/initialize', 'POST', {
        email,
        amount,
        callback_url: callbackUrl,
        metadata,
    });
    if (!response.status) {
        throw new Error(response.message || 'Paystack transaction initialization failed');
    }
    return response.data;
};
exports.initializeTransaction = initializeTransaction;
const verifyTransaction = async (reference) => {
    const response = await paystackRequest(`/transaction/verify/${encodeURIComponent(reference)}`);
    if (!response.status) {
        throw new Error(response.message || 'Paystack transaction verification failed');
    }
    return response.data;
};
exports.verifyTransaction = verifyTransaction;
const verifyWebhookSignature = (rawBody, signature) => {
    const PAYSTACK_SECRET_KEY = getPaystackSecretKey();
    const hmac = crypto_1.default.createHmac('sha512', PAYSTACK_SECRET_KEY);
    hmac.update(rawBody);
    const digest = hmac.digest('hex');
    return signature === digest;
};
exports.verifyWebhookSignature = verifyWebhookSignature;
//# sourceMappingURL=paystack.js.map