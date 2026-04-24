"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const mongoose_1 = __importDefault(require("mongoose"));
const cors_1 = __importDefault(require("cors"));
const morgan_1 = __importDefault(require("morgan"));
const http_1 = __importDefault(require("http"));
const index_1 = require("./db/index");
const auth_1 = __importDefault(require("./routes/auth"));
const usage_1 = __importDefault(require("./routes/usage"));
const crypto_routes_1 = __importDefault(require("./routes/crypto.routes"));
const index_routes_1 = __importDefault(require("./routes/index.routes"));
const forex_routes_1 = __importDefault(require("./routes/forex.routes"));
const forexInterbank_routes_1 = __importDefault(require("./routes/forexInterbank.routes"));
const commodity_routes_1 = __importDefault(require("./routes/commodity.routes"));
const goldbod_routes_1 = __importDefault(require("./routes/goldbod.routes"));
const economic_routes_1 = __importDefault(require("./routes/economic.routes"));
const treasury_routes_1 = __importDefault(require("./routes/treasury.routes"));
const stocks_routes_1 = __importDefault(require("./routes/stocks.routes"));
const event_routes_1 = __importDefault(require("./routes/event.routes"));
const billing_1 = __importDefault(require("./routes/billing"));
const ws_1 = require("./lib/realtime/ws");
(0, index_1.connectDB)();
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use('/api/billing/webhook', express_1.default.raw({ type: 'application/json' }));
const allowedOrigins = [
    'http://localhost:4000',
    'http://localhost:3000',
    'http://localhost:3001',
];
const server = http_1.default.createServer(app);
app.use(express_1.default.json({ limit: '50mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '50mb' }));
app.use((0, morgan_1.default)('dev'));
app.use((0, cors_1.default)({
    origin: function (origin, callback) {
        if (!origin)
            return callback(null, true);
        if (allowedOrigins.includes(origin)) {
            return callback(null, true);
        }
        else {
            return callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
}));
app.use('/api/auth', auth_1.default);
app.use('/api/usage', usage_1.default);
app.use('/api/crypto', crypto_routes_1.default);
app.use('/api/index', index_routes_1.default);
app.use('/api/forex', forex_routes_1.default);
app.use('/api/forex-interbank-rates', forexInterbank_routes_1.default);
app.use('/api/commodity', commodity_routes_1.default);
app.use('/api/goldbod', goldbod_routes_1.default);
app.use('/api/economy', economic_routes_1.default);
app.use('/api/treasury', treasury_routes_1.default);
app.use('/api/stocks', stocks_routes_1.default);
app.use('/api/event', event_routes_1.default);
app.use('/api/billing', billing_1.default);
app.get('/', (req, res) => {
    res.send('Hello World!');
});
const PORT = process.env.PORT || 6060;
mongoose_1.default.connect(process.env.MONGODB_URI)
    .then(() => {
    console.log('Connected to MongoDB');
    (0, ws_1.initRealtimeWebsocketServer)(server, {
        path: process.env.WS_PATH || '/ws',
        allowedOrigins,
    });
    server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
})
    .catch(err => console.error(err));
//# sourceMappingURL=index.js.map