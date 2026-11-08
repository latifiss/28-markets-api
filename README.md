# 28 Markets API

A versioned financial-market data API for currencies, equities, indices, commodities, economic indicators, treasury securities, crypto assets and market events.

## API base URL

`https://<your-render-service>.onrender.com/api/v1`

All market-data reads are public. An API key is optional for attribution and per-key rate limiting:

```http
X-API-Key: <your-api-key>
```

Create and manage API keys using an account JWT:

- `POST /auth/register`
- `POST /auth/login`
- `GET /auth/me`
- `GET /auth/api-keys`
- `POST /auth/api-keys`
- `DELETE /auth/api-keys/:keyId`

The API key is displayed once when created. Only a SHA-256 hash is stored. Never send API keys in query parameters or URLs.

## Market-data resources

| Resource | Base path | Examples |
|---|---|---|
| Crypto assets | `/crypto` | `GET /`, `GET /symbols/:symbol`, `GET /symbols/:symbol/history` |
| Market indices | `/indices` | `GET /`, `GET /:code`, `GET /:code/history` |
| FX pairs | `/forex/pairs` | `GET /`, `GET /:code`, `GET /:code/history` |
| Interbank FX | `/forex/interbank-pairs` | `GET /`, `GET /:id`, `GET /:id/history` |
| Commodities | `/commodities` | `GET /`, `GET /:code`, `GET /:code/history` |
| Gold prices | `/gold/prices` | `GET /`, `GET /:code`, `GET /price-history/:code` |
| Economic indicators | `/economic-indicators` | `GET /interest-rate`, `GET /inflation-rate/latest`, `GET /indicators/latest-all` |
| Treasury bonds | `/treasury/bonds` | `GET /`, `GET /active`, `GET /highest-yielding`, `GET /:id` |
| Equities | `/equities` | `GET /profiles/:company_id`, `GET /price-history/:company_id`, `GET /exchanges/:exchangeSymbol/market-movers`, `GET /companies/:company_id/overview` |
| Market events | `/events` | `GET /`, `GET /latest`, `GET /upcoming`, `GET /search`, `GET /:id`, `GET /codes/:code` |

The route modules also expose history, statistics, dividends, earnings, financials, holders, bulk-ingestion and administrative operations. See `docs/api-v1.md` and the route files for the complete method/path inventory.

## Authentication and authorization

- Public GET/HEAD requests do not require credentials.
- API keys and bearer JWTs are optional on public reads.
- All market-data mutations (POST/PUT/PATCH/DELETE) require an authenticated administrator.
- Administrator access is granted by the account `role: admin` or the `MARKET_DATA_ADMIN_USER_IDS` allowlist.
- Account and API-key management endpoints require a bearer JWT.

## Rate limits

Redis-backed token buckets apply across all Render instances:

- Public and authenticated reads: 600 requests/minute per identity by default.
- Mutations: 60 requests/minute per identity by default.
- IP ingress guard: 1,200 requests/minute per source IP by default.
- Login and registration: 10 attempts per 15 minutes per IP by default.

Tune with `API_RATE_LIMIT_MAX`, `API_WRITE_RATE_LIMIT_MAX`, `API_IP_RATE_LIMIT_MAX`, and `AUTH_RATE_LIMIT_MAX`. Limits are global service-abuse controls and apply consistently to every API consumer. Redis failure returns HTTP 503 rather than silently disabling protection.

Rate-limited responses use HTTP 429 with `Retry-After`, `RateLimit-Limit`, `RateLimit-Remaining`, and a machine-readable error code.

## Response and operational behavior

- JSON responses; resource handlers retain their existing domain-specific response fields during this route migration.
- `/health/live` is process liveness; `/health/ready` checks MongoDB readiness.
- Anonymous cache-safe GET responses may be served from the shared response cache.
- Requests with credentials or cookies bypass shared public response caching.
- Mutations are protected centrally before they reach route handlers.

## Compatibility

The versioned `/api/v1` namespace is the canonical interface. The old unversioned `/api/*` routes are intentionally not mounted in this versioned router. Update clients to the paths above before deploying this branch.
