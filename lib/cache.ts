import crypto from 'crypto';
import { getRedisClient } from './redis';

type CacheEntry = { value: unknown; expiresAt: number };
type VersionEntry = { version: number; expiresAt: number };

const localCache = new Map<string, CacheEntry>();
const localVersions = new Map<string, VersionEntry>();
const inFlight = new Map<string, Promise<unknown>>();
const MAX_LOCAL_ENTRIES = Number(process.env.CACHE_L1_MAX_ENTRIES || 5000);
const PREFIX = '28m:v1:';
const LOCAL_TTL_MS = 1000;

function defaultTtlForKey(key: string): number {
  const namespace = namespaceOf(key);
  const policies: Record<string, number> = {
    crypto: 10,
    forex: 30,
    forexinterbank: 30,
    commodity: 60,
    commodities: 60,
    goldbod: 60,
    index: 15,
    equity: 15,
    economic: 3600,
    treasury: 3600,
    company: 21600,
    companies: 21600,
    http: 15,
  };
  return policies[namespace] || 30;
}

const namespaceOf = (key: string) => key.split(':', 1)[0] || 'default';
const versionKey = (namespace: string) => `${PREFIX}version:${namespace}`;
const dataKey = (namespace: string, version: number, key: string) =>
  `${PREFIX}${namespace}:v${version}:${key}`;
const localKey = (namespace: string, version: number, key: string) =>
  `${namespace}:v${version}:${key}`;

function pruneLocalCache() {
  if (localCache.size <= MAX_LOCAL_ENTRIES) return;
  const now = Date.now();
  for (const [key, entry] of localCache) {
    if (entry.expiresAt <= now || localCache.size > MAX_LOCAL_ENTRIES) {
      localCache.delete(key);
    }
    if (localCache.size <= MAX_LOCAL_ENTRIES) break;
  }
}

async function getNamespaceVersion(namespace: string): Promise<number> {
  const cached = localVersions.get(namespace);
  if (cached && cached.expiresAt > Date.now()) return cached.version;

  try {
    const redis = await getRedisClient();
    if (redis) {
      let raw = await redis.get(versionKey(namespace));
      if (raw === null) {
        await redis.set(versionKey(namespace), '1', { NX: true });
        raw = await redis.get(versionKey(namespace));
      }
      const version = Math.max(1, Number(raw) || 1);
      localVersions.set(namespace, { version, expiresAt: Date.now() + LOCAL_TTL_MS });
      return version;
    }
  } catch (error) {
    console.warn('Cache namespace version lookup failed:', error);
  }

  return cached?.version || 1;
}

export async function getCache<T = any>(key: string): Promise<T | null> {
  const namespace = namespaceOf(key);
  const version = await getNamespaceVersion(namespace);
  const scopedKey = localKey(namespace, version, key);
  const local = localCache.get(scopedKey);

  if (local && local.expiresAt > Date.now()) return local.value as T;
  if (local) localCache.delete(scopedKey);

  try {
    const redis = await getRedisClient();
    if (!redis) return null;
    const serialized = await redis.get(dataKey(namespace, version, key));
    if (!serialized) return null;

    const value = JSON.parse(serialized) as T;
    localCache.set(scopedKey, { value, expiresAt: Date.now() + LOCAL_TTL_MS });
    pruneLocalCache();
    return value;
  } catch (error) {
    console.warn('Cache read failed:', error instanceof Error ? error.message : error);
    return null;
  }
}

export async function setCache(
  key: string,
  value: unknown,
  ttlSeconds?: number,
): Promise<void> {
  const namespace = namespaceOf(key);
  const version = await getNamespaceVersion(namespace);
  const baseTtl = ttlSeconds ?? defaultTtlForKey(key);
  const ttl = Math.max(1, Math.floor(baseTtl * (0.9 + Math.random() * 0.1)));
  const scopedKey = localKey(namespace, version, key);

  localCache.set(scopedKey, { value, expiresAt: Date.now() + LOCAL_TTL_MS });
  pruneLocalCache();

  try {
    const redis = await getRedisClient();
    if (redis) await redis.set(dataKey(namespace, version, key), JSON.stringify(value), { EX: ttl });
  } catch (error) {
    console.warn('Cache write failed:', error instanceof Error ? error.message : error);
  }
}

export async function deleteCache(key: string): Promise<void> {
  const namespace = namespaceOf(key);
  const version = await getNamespaceVersion(namespace);
  localCache.delete(localKey(namespace, version, key));

  try {
    const redis = await getRedisClient();
    if (redis) await redis.del(dataKey(namespace, version, key));
  } catch (error) {
    console.warn('Cache delete failed:', error instanceof Error ? error.message : error);
  }
}

export async function deleteCacheByPattern(pattern: string): Promise<void> {
  const namespace = namespaceOf(pattern);
  try {
    const redis = await getRedisClient();
    if (redis) {
      const version = Number(await redis.incr(versionKey(namespace)));
      localVersions.set(namespace, { version, expiresAt: Date.now() + LOCAL_TTL_MS });
    } else {
      const current = localVersions.get(namespace)?.version || 1;
      localVersions.set(namespace, { version: current + 1, expiresAt: Date.now() + LOCAL_TTL_MS });
    }
  } catch (error) {
    console.warn('Cache namespace invalidation failed:', error instanceof Error ? error.message : error);
    const current = localVersions.get(namespace)?.version || 1;
    localVersions.set(namespace, { version: current + 1, expiresAt: Date.now() + LOCAL_TTL_MS });
  }

  for (const key of localCache.keys()) {
    if (key.startsWith(`${namespace}:v`)) localCache.delete(key);
  }
}

export async function getOrSetCache<T>(
  key: string,
  loader: () => Promise<T>,
  ttlSeconds = 30,
): Promise<T> {
  const cached = await getCache<T>(key);
  if (cached !== null) return cached;

  const namespace = namespaceOf(key);
  const version = await getNamespaceVersion(namespace);
  const scopedKey = localKey(namespace, version, key);
  const pending = inFlight.get(scopedKey);
  if (pending) return pending as Promise<T>;

  const promise = loader()
    .then(async (value) => {
      await setCache(key, value, ttlSeconds);
      return value;
    })
    .finally(() => inFlight.delete(scopedKey));

  inFlight.set(scopedKey, promise);
  return promise;
}

export function publicResponseCacheKey(url: string): string {
  return `http:public:${crypto.createHash('sha256').update(url).digest('hex')}`;
}
