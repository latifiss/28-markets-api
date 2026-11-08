# API endpoint contract

The canonical prefix is `/api/v1`. Route methods are classified centrally:

- Every `/api/v1` route requires a valid API key or bearer JWT, regardless of HTTP method.
- `POST /auth/register` and `POST /auth/login` are the only API route exceptions, because they bootstrap credentials. Operational health checks outside `/api/v1` remain public; CORS `OPTIONS` preflight requests are also public.
- Market-data writes (`POST`, `PUT`, `PATCH`, `DELETE`) require an authenticated administrator.
- Explicitly read-only POST routes (Forex bulk query/export and treasury return calculation) require authentication but do not require administrator privileges.
- `/auth/*`: account authentication and API-key management; management operations remain bearer-JWT-only.
- `/account/usage`: authenticated usage analytics; accepts either JWT or API key.

## Canonical resource prefixes

```text
/api/v1/crypto
/api/v1/indices
/api/v1/forex/pairs
/api/v1/forex/interbank-pairs
/api/v1/commodities
/api/v1/gold/prices
/api/v1/economic-indicators
/api/v1/treasury/bonds
/api/v1/equities
/api/v1/events
```

Crypto collection and detail routes use explicit resource names: `/crypto`, `/crypto/symbols/:symbol`, `/crypto/ids/:id`, `/crypto/symbols/:symbol/history`, and `/crypto/symbols/:symbol/overview`. Gainers, losers and history use `/crypto/gainers`, `/crypto/losers` and `/crypto/history`.

Equity company overview is `/equities/companies/:company_id/overview`; exchange analytics are under `/equities/exchanges/:exchangeSymbol`; market status is `/equities/market/status`. Gold history uses `/gold/prices/:code/history`. Event resources use `/events/:id`, `/events/codes/:code`, `/events/types/:type`, and `/events/states/:state`.

The Forex bulk query and export operations are read-only POST endpoints because they accept structured filters in the request body. Treasury return calculation is also read-only. These endpoints still require a valid API key or bearer JWT. Other market-data POST/PUT/PATCH/DELETE operations require administrator credentials.

## API key lifecycle

Keys are 256-bit random secrets. The database stores only SHA-256 hashes. The raw secret is returned only during creation. List endpoints return key IDs, descriptions and timestamps, never key material. Revocation is by key ID scoped to the owning user and invalidates cached authentication metadata.

## Error shape

Infrastructure and rate-limit errors use stable machine-readable codes. Rate limits return 429; Redis admission failure returns 503; unauthenticated API requests return 401; authenticated non-admin mutations return 403.

## Rate limit configuration

| Variable | Default | Scope |
|---|---:|---|
| `API_RATE_LIMIT_MAX` | 600 | requests/minute per account for reads |
| `API_WRITE_RATE_LIMIT_MAX` | 60 | requests/minute per account for writes |
| `API_IP_RATE_LIMIT_MAX` | 1200 | requests/minute per source IP, before authentication |
| `AUTH_RATE_LIMIT_MAX` | 10 | login/registration attempts per 15-minute window |

Token buckets are atomic Lua scripts in shared Redis. Authenticated API keys and JWTs share one account bucket, preventing additional keys from multiplying an account's allowance. Anonymous callers are limited by source IP.
