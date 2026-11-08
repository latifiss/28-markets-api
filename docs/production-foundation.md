# Production foundation (Render)

This repository is being prepared for a stateless, horizontally scalable API deployment on Render.

## Current deployment shape

- `28-markets-api`: Render web service serving HTTP and WebSocket traffic.
- MongoDB: durable source of truth. Configure `MONGODB_URI` as a Render secret.
- Upstash Redis: shared cache and coordination layer. Configure the TLS `REDIS_URL` as a Render secret.
- Cloudflare: recommended in front of Render for CDN caching of explicitly public, cache-safe GET endpoints, WAF and edge protection.

The Blueprint provisions the API web service and a dedicated usage-analytics worker. Market-data ingestion workers should be added only after provider adapters and refresh jobs have explicit, tested entry points.

## Required Render environment

Set these values in the Render dashboard:

- `MONGODB_URI`: MongoDB connection string.
- `JWT_SECRET`: unique random secret, at least 32 characters.
- `REDIS_URL`: Upstash TLS connection URL beginning with `rediss://`.
- `CORS_ORIGINS`: comma-separated trusted browser origins, if additional origins are required.

The Blueprint sets `NODE_ENV=production`, `PORT=10000`, and a MongoDB pool-size starting point. Pool size must be tuned against the selected Render instance count and MongoDB connection limits.

## Health checks and shutdown

- `GET /health/live` indicates that the Node process is alive.
- `GET /health/ready` returns 200 only when MongoDB is connected.
- The process listens on `0.0.0.0` and the Render-provided port.
- SIGTERM/SIGINT initiate graceful HTTP shutdown and close MongoDB and Redis connections.

Redis is required for API request admission and is included in readiness checks. If Redis is unavailable, API requests fail closed with HTTP 503 and `/health/ready` returns 503; `/health/live` remains independent. Monitor Redis connectivity and rate-limit errors.

## Cache and scaling direction

1. Cloudflare may cache only explicitly configured health-independent public assets. Authenticated API responses must bypass shared CDN caching unless a carefully reviewed authorization-aware cache design is implemented.
2. Render API instances remain stateless. Do not use process-local state for distributed rate limits, locks, usage enforcement or cross-instance events.
3. Upstash Redis is the shared L2 cache and coordination layer; an in-process cache is only an optional short-lived L1.
4. MongoDB remains authoritative. A cache hit must not issue a MongoDB read.
5. Refresh and ingestion work belongs in dedicated workers, not in request handlers.

Suggested initial TTLs are documented as policies to validate against provider update cadence, not guarantees of data freshness. Price and quote endpoints need short TTLs; static company metadata and historical data can use longer TTLs.

## Operational gates before production traffic

- Protect and audit every mutation/admin route across all market-data modules.
- Apply Mongoose schema validators to query-based update operations so updates do not silently bypass model validators.
- Migrate API-key storage to hashes with a compatibility/revocation plan.
- Replace process-local rate limiting and synchronous usage writes with shared, atomic counters and asynchronous aggregation.
- Implement centralized cache keys, TTL policy, stampede protection, invalidation and cache warming.
- Add request IDs, structured logs, latency/error metrics and cache/DB/Redis telemetry.
- Run sustained k6 tests and dependency-failure tests before claiming a requests-per-second capacity.


## Market-data write authorization

All market-data writes under the API prefixes are protected centrally. A valid JWT or API key is required, and the account must currently be active and have `role: "admin"` (or be in the explicit admin ID allowlist). Administrator status is re-read from MongoDB for each write rather than trusting a stale JWT role claim. The Forex bulk query/export and treasury return-calculation POST routes are explicitly read-only and require a valid API key or bearer token, but do not require administrator privileges. The optional `MARKET_DATA_ADMIN_USER_IDS` environment variable supports a comma-separated allowlist while existing accounts are migrated. New accounts default to the `user` role. Promote trusted operators explicitly in the database; do not grant admin role to ordinary API consumers.

New API keys are stored as SHA-256 hashes. Existing plaintext keys are migrated to hashes on their next successful authentication, then the legacy plaintext field is unset. Revoke and reissue keys if any legacy key has been exposed.

## Cache namespaces

Controllers use the shared cache module. Keys are namespaced and versioned; invalidation increments a namespace version rather than scanning Redis keys. L1 entries expire after one second to bound cross-instance staleness. Default TTLs are selected by data domain and can be overridden per call. The generic public response cache bypasses all authenticated API requests; all `/api/v1` data access requires credentials.


## Public API operating model

The canonical interface is versioned under `/api/v1`. Every API route requires a valid API key or bearer token, with only registration/login exempt for credential bootstrap. Market-data mutations additionally require an administrator. A single shared rate-limit policy protects the service.

## Distributed rate limiting

A Redis token bucket is applied twice: an IP ingress guard before credential parsing, then an identity bucket after required JWT/API-key authentication. This protects invalid API-key attempts while allowing authenticated callers to receive per-account limits. Writes have a lower default capacity than reads. Redis admission failure is fail-closed with HTTP 503.

Defaults are configurable through `API_RATE_LIMIT_MAX`, `API_WRITE_RATE_LIMIT_MAX`, `API_IP_RATE_LIMIT_MAX`, and `AUTH_RATE_LIMIT_MAX`.

## Endpoint migration

The new canonical route namespace is `/api/v1`. Old unversioned routes are not mounted by the new application router. Update consumers to the paths in `README.md` and `docs/api-v1.md` before deploying. Account usage remains analytics-only and does not gate access.


## 50-million-requests/day capacity validation

50,000,000 requests/day averages approximately 579 requests/second. The authenticated k6 scenario in `load-tests/public-api.js` defaults to 600 sustained requests/second for 30 minutes, followed by a 1,000-to-2,000 requests/second burst. Run it against a production-like deployment with a dedicated least-privilege test key:

```bash
BASE_URL=https://your-service.onrender.com \
API_KEY=<dedicated-load-test-api-key> \
TARGET_RPS=580 DURATION=24h \
k6 run load-tests/public-api.js
```

The default API limits (600 requests/minute per account and 1,200/minute per IP) are intentionally conservative and will throttle a single account/IP far below this target. Before a capacity test, set `API_RATE_LIMIT_MAX` and `API_IP_RATE_LIMIT_MAX` to values that match the planned traffic distribution; set `API_WRITE_RATE_LIMIT_MAX` separately if the workload includes substantial ingestion. Do not simply remove limits. Test with the real number of API instances, realistic MongoDB/Redis tiers, cache hit/miss ratios, cold-cache bursts, and dependency failures. Record achieved throughput, p50/p95/p99 latency, error/429/503 rates, CPU/memory, database pool saturation, Redis operations and cost.

A successful 30-minute test is not proof of 24-hour capacity. Do not claim 50-million/day readiness until a sustained 24-hour run and burst/failure tests pass on the intended production topology. Render Starter sizing and default Redis quotas must not be assumed sufficient.

## Legacy account-field cleanup

The application schema no longer reads paid-plan or payment-provider fields. After taking a database backup, run `npm run migrate:remove-legacy-plan-fields` once to unset `tier`, `stripeCustomerId`, `subscriptionStatus` and `currentPeriodEnd` from user documents. The script does not delete historical subscription records; retain or archive those according to your data-retention requirements.
