import { Redis } from '@upstash/redis';

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export async function acquireLock(key: string, ttlSeconds = 10): Promise<boolean> {
  // @ts-ignore
  const result = await redis.set(key, 'locked', { nx: true, ex: ttlSeconds });
  return result === 'OK';
}

export async function releaseLock(key: string): Promise<void> {
  await redis.del(key);
}
