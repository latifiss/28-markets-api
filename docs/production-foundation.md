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

1. Cloudflare should cache only public GET responses whose output is independent of user identity and authorization.
2. Render API instances remain stateless. Do not use process-local state for distributed rate limits, locks, usage enforcement or cross-instance events.
3. Upstash Redis is the shared L2 cache and coordination layer; an in-process cache is only an optional short-lived L1.
4. MongoDB remains authoritative. A cache hit must not issue a MongoDB read.
5. Refresh and ingestion work belongs in dedicated workers, not in request handlers.

Suggested initial TTLs are documented as policies to validate against provider update cadence, not guarantees of data freshness. Price and quote endpoints need short TTLs; static company metadata and historical data can use longer TTLs.

## Operational gates before production traffic

- Protect and audit every mutation/admin route across all market-data modules.
- Migrate API-key storage to hashes with a compatibility/revocation plan.
- Replace process-local rate limiting and synchronous usage writes with shared, atomic counters and asynchronous aggregation.
- Implement centralized cache keys, TTL policy, stampede protection, invalidation and cache warming.
- Add request IDs, structured logs, latency/error metrics and cache/DB/Redis telemetry.
- Run sustained k6 tests and dependency-failure tests before claiming a requests-per-second capacity.


## Market-data write authorization

All market-data writes under the API prefixes are protected centrally. A valid JWT or API key is required, and the authenticated account must have `role: "admin"`. The Forex bulk query/export and treasury return-calculation POST routes are explicitly read-only and require a valid API key or bearer token, but do not require administrator privileges. The optional `MARKET_DATA_ADMIN_USER_IDS` environment variable supports a comma-separated allowlist while existing accounts are migrated. New accounts default to the `user` role. Promote trusted operators explicitly in the database; do not grant admin role to ordinary API consumers.

New API keys are stored as SHA-256 hashes. Existing plaintext keys are migrated to hashes on their next successful authentication, then the legacy plaintext field is unset. Revoke and reissue keys if any legacy key has been exposed.

## Cache namespaces

Controllers use the shared cache module. Keys are namespaced and versioned; invalidation increments a namespace version rather than scanning Redis keys. L1 entries expire after one second to bound cross-instance staleness. Default TTLs are selected by data domain and can be overridden per call. The generic public response cache bypasses authenticated, cookie-bearing and account-management requests.


## Public API operating model

The canonical interface is versioned under `/api/v1`. Every API route requires a valid API key or bearer token, with only registration/login exempt for credential bootstrap. Market-data mutations additionally require an administrator. A single shared rate-limit policy protects the service.

## Distributed rate limiting

A Redis token bucket is applied twice: an IP ingress guard before credential parsing, then an identity bucket after optional JWT/API-key authentication. This protects invalid API-key attempts while allowing authenticated callers to receive per-key limits. Writes have a lower default capacity than reads. Redis admission failure is fail-closed with HTTP 503.

Defaults are configurable through `API_RATE_LIMIT_MAX`, `API_WRITE_RATE_LIMIT_MAX`, `API_IP_RATE_LIMIT_MAX`, and `AUTH_RATE_LIMIT_MAX`.

## Endpoint migration

The new canonical route namespace is `/api/v1`. Old unversioned routes are not mounted by the new application router. Update consumers to the paths in `README.md` and `docs/api-v1.md` before deploying. Account usage remains analytics-only and does not gate access.


## Legacy account-field cleanup

The application schema no longer reads paid-plan or payment-provider fields. After taking a database backup, run `npm run migrate:remove-legacy-plan-fields` once to unset `tier`, `stripeCustomerId`, `subscriptionStatus` and `currentPeriodEnd` from user documents. The script does not delete historical subscription records; retain or archive those according to your data-retention requirements.
