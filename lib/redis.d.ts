export interface RedisClient {
  set(key: string, value: string, options?: { EX?: number }): Promise<void>;
  get(key: string): Promise<string | null>;
  del(key: string): Promise<number>;
  scanIterator(options: { MATCH: string }): AsyncIterable<string>;
}

export function getRedisClient(): Promise<RedisClient | null>;