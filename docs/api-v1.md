# API endpoint contract

The canonical prefix is `/api/v1`. Route methods are classified centrally:

- `GET`, `HEAD`, `OPTIONS`: public market-data reads.
- `POST`, `PUT`, `PATCH`, `DELETE`: administrator-only market-data operations.
- `/auth/*`: account authentication and API-key management.
- `/account/usage`: authenticated usage analytics; it is not a billing or quota endpoint.

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

Equity company overview is `/equities/companies/:company_id/overview`; exchange analytics are under `/equities/exchanges/:exchangeSymbol`; market status is `/equities/market/status`.

## API key lifecycle

Keys are 256-bit random secrets. The database stores only SHA-256 hashes. The raw secret is returned only during creation. List endpoints return key IDs, descriptions and timestamps, never key material. Revocation is by key ID scoped to the owning user and invalidates cached authentication metadata.

## Error shape

Infrastructure and rate-limit errors use stable machine-readable codes. Rate limits return 429; Redis admission failure returns 503; unauthenticated mutations return 401; authenticated non-admin mutations return 403.

## Rate limit configuration

| Variable | Default | Scope |
|---|---:|---|
| `API_RATE_LIMIT_MAX` | 600 | requests/minute per authenticated identity for reads |
| `API_WRITE_RATE_LIMIT_MAX` | 60 | requests/minute per authenticated identity for writes |
| `API_IP_RATE_LIMIT_MAX` | 1200 | requests/minute per source IP, before authentication |
| `AUTH_RATE_LIMIT_MAX` | 10 | login/registration attempts per 15-minute window |

Token buckets are atomic Lua scripts in shared Redis. Limits are independent of account role and do not impose monthly quotas.
