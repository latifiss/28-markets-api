"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initRealtimeWebsocketServer = initRealtimeWebsocketServer;
exports.broadcast = broadcast;
exports.publishForexUpdate = publishForexUpdate;
exports.publishCommodityUpdate = publishCommodityUpdate;
exports.publishCryptoUpdate = publishCryptoUpdate;
exports.publishForexInterbankUpdate = publishForexInterbankUpdate;
exports.publishStockUpdate = publishStockUpdate;
const ws_1 = require("ws");
let wss = null;
const clientState = new WeakMap();
function initRealtimeWebsocketServer(server, opts) {
    var _a, _b;
    if (wss)
        return wss;
    const path = (_a = opts === null || opts === void 0 ? void 0 : opts.path) !== null && _a !== void 0 ? _a : '/ws';
    const allowedOrigins = (_b = opts === null || opts === void 0 ? void 0 : opts.allowedOrigins) !== null && _b !== void 0 ? _b : [];
    wss = new ws_1.WebSocketServer({
        server,
        path,
        verifyClient: (info, done) => {
            // If you don't set Origin in a WS client (e.g. some backends), allow it.
            const origin = info.origin;
            if (!origin || allowedOrigins.length === 0)
                return done(true);
            return done(allowedOrigins.includes(origin));
        },
    });
    wss.on('connection', (ws, req) => {
        var _a, _b;
        const url = new URL((_a = req.url) !== null && _a !== void 0 ? _a : path, 'http://localhost');
        const topicsParam = (_b = url.searchParams.get('topics')) !== null && _b !== void 0 ? _b : '';
        const initialTopics = topicsParam
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean);
        clientState.set(ws, { topics: new Set(initialTopics) });
        ws.send(JSON.stringify({
            event: 'connected',
            path,
            subscribedTopics: initialTopics,
            now: new Date().toISOString(),
        }));
        ws.on('message', (raw) => {
            const state = clientState.get(ws);
            if (!state)
                return;
            let msg;
            try {
                msg = JSON.parse(raw.toString());
            }
            catch {
                ws.send(JSON.stringify({ event: 'error', message: 'Invalid JSON message' }));
                return;
            }
            if (msg.type === 'ping') {
                ws.send(JSON.stringify({ event: 'pong', now: new Date().toISOString() }));
                return;
            }
            if (msg.type === 'subscribe') {
                state.topics.add(msg.topic);
                ws.send(JSON.stringify({ event: 'subscribed', topic: msg.topic }));
                return;
            }
            if (msg.type === 'unsubscribe') {
                state.topics.delete(msg.topic);
                ws.send(JSON.stringify({ event: 'unsubscribed', topic: msg.topic }));
            }
        });
    });
    return wss;
}
function broadcast(topic, event, data) {
    if (!wss)
        return;
    const payload = {
        topic,
        event,
        publishedAt: new Date().toISOString(),
        data,
    };
    const msg = JSON.stringify(payload);
    for (const ws of wss.clients) {
        if (ws.readyState !== ws.OPEN)
            continue;
        const state = clientState.get(ws);
        if (!state)
            continue;
        // Match either exact topic or a wildcard "forex" style subscription.
        if (!state.topics.has(topic) && !state.topics.has(topic.split(':')[0]))
            continue;
        ws.send(msg);
    }
}
function publishForexUpdate(code, forex) {
    try {
        broadcast('forex', 'updated', { code, forex });
        broadcast(`forex:${code}`, 'updated', forex);
    }
    catch {
        // Never fail the main HTTP request because realtime couldn't publish.
    }
}
function publishCommodityUpdate(code, commodity) {
    try {
        broadcast('commodity', 'updated', { code, commodity });
        broadcast(`commodity:${code}`, 'updated', commodity);
    }
    catch {
        // Never fail the main HTTP request because realtime couldn't publish.
    }
}
function publishCryptoUpdate(symbol, crypto) {
    try {
        const sym = String(symbol).toUpperCase();
        broadcast('crypto', 'updated', { symbol: sym, crypto });
        broadcast(`crypto:${sym}`, 'updated', crypto);
    }
    catch {
        // Never fail the main HTTP request because realtime couldn't publish.
    }
}
function publishForexInterbankUpdate(key, pair) {
    try {
        broadcast('forexInterbank', 'updated', { ...key, pair });
        if (key.bankCode)
            broadcast(`forexInterbank:${key.bankCode}`, 'updated', pair);
        if (key.code)
            broadcast(`forexInterbank:code:${key.code}`, 'updated', pair);
    }
    catch {
        // Never fail the main HTTP request because realtime couldn't publish.
    }
}
function publishStockUpdate(key, payload) {
    try {
        broadcast('stocks', 'updated', { ...key, payload });
        if (key.company_id)
            broadcast(`stocks:${key.company_id}`, 'updated', payload);
        if (key.ticker_symbol)
            broadcast(`stocks:ticker:${key.ticker_symbol}`, 'updated', payload);
    }
    catch {
        // Never fail the main HTTP request because realtime couldn't publish.
    }
}
//# sourceMappingURL=ws.js.map