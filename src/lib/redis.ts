import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});

const redisReadOnly = process.env.KV_REST_API_READ_ONLY_TOKEN
  ? new Redis({
      url: process.env.KV_REST_API_URL!,
      token: process.env.KV_REST_API_READ_ONLY_TOKEN!,
    })
  : redis;

export async function get<T>(key: string): Promise<T | null> {
  return redisReadOnly.get<T>(key);
}

export async function set<T>(key: string, value: T): Promise<string | null> {
  return (await redis.set(key, value)) as string | null;
}

export { redis };
