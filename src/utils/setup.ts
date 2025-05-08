import { Redis } from '@upstash/redis/cloudflare';
import { DbService } from '../db-service';

/**
 * Set up the database service
 * @param env The environment variables
 * @returns The database service
 */
export const setupDatabase = (env: any): DbService => {
  const db = new DbService(env.DATABASE_URL);
  return db;
};

/**
 * Set up the Redis client
 * @param env The environment variables
 * @returns The Redis client
 */
export const setupRedis = (env: any): Redis => {
  return new Redis({
    url: env.UPSTASH_REDIS_REST_URL,
    token: env.UPSTASH_REDIS_REST_TOKEN,
  });
};
