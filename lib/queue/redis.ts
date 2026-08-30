import { Redis } from "ioredis";

const globalForRedis = globalThis as unknown as {
  redisConnection: Redis | undefined;
};

export const redisConnection =
  globalForRedis.redisConnection ??
  new Redis(process.env.REDIS_URL!, {
    maxRetriesPerRequest: null,
  });

if (process.env.NODE_ENV !== "production") {
  globalForRedis.redisConnection = redisConnection;
}
