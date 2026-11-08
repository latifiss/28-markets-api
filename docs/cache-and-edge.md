# Cache, edge delivery and usage worker

Anonymous GET responses under /api use a conservative 15-second shared cache, except auth and account. Requests carrying Authorization, x-api-key or Cookie bypass it. The application cache uses bounded process-local L1 and Upstash Redis L2, namespaced keys and TTL jitter. This is not a substitute for endpoint-specific domain cache policies; migrate controller caches incrementally.

Cloudflare Cache Rule: cache GET requests under /api only when Authorization, x-api-key and Cookie are absent; exclude /api/v1/auth/*, /api/v1/account/*, /api/v1/usage/* and /api/v1/economy/*; respect origin Cache-Control. The economic routes have their own IP limiter and are excluded from the application response cache. Do not enable Cache Everything for the full API hostname. Use WAF managed rules and edge abuse controls. Origin quota enforcement remains authoritative.

Request admission uses atomic Redis token buckets, with IP protection before credential parsing and per-identity limits after authentication. Usage audit events are queued in Redis and batch-persisted by the Render usage worker. Monitor queue depth, worker lag and Redis availability. Requests fail closed with 503 when Redis cannot enforce quotas.

Run the k6 staged profile from load-tests/public-api.js against staging first. It is a test plan, not evidence of capacity. Validate sustained traffic, cold cache, Redis/Mongo outages and multi-instance behavior.

Market-data ingestion requires provider adapters, normalized events, idempotency, retries and dead-letter handling. Existing domain controllers do not yet expose a safe generic provider refresh contract; do not schedule cron calls against public mutation routes.
