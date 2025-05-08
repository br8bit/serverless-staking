import { Redis } from '@upstash/redis/cloudflare';
import { Stake } from '../db-service';

// Maximum number of retry attempts for cache operations
const MAX_CACHE_RETRIES = 2;

/**
 * Cache configuration
 */
export interface CacheConfig {
  /** Time-to-live in seconds */
  ttl: number;
  /** Whether to use stale-while-revalidate pattern */
  staleWhileRevalidate: boolean;
  /** Additional time (in seconds) to keep stale data while revalidating */
  staleTime?: number;
}

/**
 * Default cache configurations
 */
export const defaultCacheConfigs: Record<string, CacheConfig> = {
  // Stake data - 5 minutes with stale-while-revalidate
  stake: {
    ttl: 300, // 5 minutes
    staleWhileRevalidate: true,
    staleTime: 300, // Additional 5 minutes for stale data
  },
  // User data - 10 minutes with stale-while-revalidate
  user: {
    ttl: 600, // 10 minutes
    staleWhileRevalidate: true,
    staleTime: 600, // Additional 10 minutes for stale data
  },
  // Short-lived data - 1 minute, no stale-while-revalidate
  shortLived: {
    ttl: 60, // 1 minute
    staleWhileRevalidate: false,
  },
};

/**
 * Cache a stake in Redis with retry logic
 * @param redis Redis client
 * @param stake Stake to cache
 * @param config Cache configuration
 */
export async function cacheStake(
  redis: Redis,
  stake: Stake,
  config: CacheConfig = defaultCacheConfigs.stake
): Promise<void> {
  const stakeKey = `stake:${stake.id}`;

  for (let attempt = 0; attempt <= MAX_CACHE_RETRIES; attempt++) {
    try {
      // Use a pipeline to reduce network round trips
      const pipeline = redis.pipeline();

      // Store stake data as a hash
      pipeline.hset(stakeKey, {
        id: stake.id.toString(),
        amount: stake.amount.toString(),
        period: stake.period.toString(),
        userId: stake.userId.toString(),
        createdAt: stake.createdAt.toISOString(),
        // Add cache metadata
        _cached_at: Date.now().toString(),
      });

      // Set expiry
      if (config.staleWhileRevalidate && config.staleTime) {
        // Set a longer expiry for stale-while-revalidate
        pipeline.expire(stakeKey, config.ttl + config.staleTime);
      } else {
        pipeline.expire(stakeKey, config.ttl);
      }

      // Execute the pipeline
      await pipeline.exec();

      // Add to user's stake list if not already there
      const userStakesKey = `user:${stake.userId}:stake_ids`;
      const exists = await redis.lpos(userStakesKey, stake.id.toString());

      if (exists === null) {
        await redis.lpush(userStakesKey, stake.id.toString());
      }

      // If we get here, the operation was successful
      return;
    } catch (error) {
      console.error(
        `Error caching stake (attempt ${attempt + 1}/${
          MAX_CACHE_RETRIES + 1
        }):`,
        error
      );

      // If this is the last attempt, just log the error and continue
      // We don't want cache failures to break the application
      if (attempt === MAX_CACHE_RETRIES) {
        console.error('Failed to cache stake after multiple attempts:', error);
        return;
      }

      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, 200 * (attempt + 1)));
    }
  }
}

/**
 * Get a stake from Redis cache with retry logic
 * @param redis Redis client
 * @param stakeId Stake ID
 * @param config Cache configuration
 * @returns The stake or null if not found
 */
export async function getCachedStake(
  redis: Redis,
  stakeId: string | number,
  config: CacheConfig = defaultCacheConfigs.stake
): Promise<{ stake: Stake | null; isStale: boolean }> {
  const stakeKey = `stake:${stakeId}`;

  for (let attempt = 0; attempt <= MAX_CACHE_RETRIES; attempt++) {
    try {
      // Get stake data from Redis
      const data = await redis.hgetall(stakeKey);

      if (!data || Object.keys(data).length === 0) {
        return { stake: null, isStale: false };
      }

      // Check if data is stale
      let isStale = false;
      if (config.staleWhileRevalidate && data._cached_at) {
        const cachedAt = parseInt(data._cached_at as string);
        const now = Date.now();
        isStale = now - cachedAt > config.ttl * 1000;
      }

      // Convert to Stake object
      const stake: Stake = {
        id: parseInt(data.id as string),
        amount: parseFloat(data.amount as string),
        period: parseInt(data.period as string),
        userId: parseInt(data.userId as string),
        createdAt: new Date(data.createdAt as string),
      };

      return { stake, isStale };
    } catch (error) {
      console.error(
        `Error getting cached stake (attempt ${attempt + 1}/${
          MAX_CACHE_RETRIES + 1
        }):`,
        error
      );

      // If this is the last attempt, return null
      if (attempt === MAX_CACHE_RETRIES) {
        console.error(
          'Failed to get cached stake after multiple attempts:',
          error
        );
        return { stake: null, isStale: false };
      }

      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, 200 * (attempt + 1)));
    }
  }

  // This should never be reached due to the return in the loop
  return { stake: null, isStale: false };
}

/**
 * Cache multiple stakes in Redis with retry logic
 * @param redis Redis client
 * @param stakes Stakes to cache
 * @param userId User ID
 * @param page Page number (optional)
 * @param limit Items per page (optional)
 * @param config Cache configuration
 */
export async function cacheStakes(
  redis: Redis,
  stakes: Stake[],
  userId: number,
  page: number = 1,
  limit: number = 20,
  config: CacheConfig = defaultCacheConfigs.stake
): Promise<void> {
  // Cache each stake
  const promises = stakes.map((stake) => cacheStake(redis, stake, config));
  await Promise.all(promises);

  // Cache the list of stakes for this page
  const pageKey = `user:${userId}:stakes:page:${page}:limit:${limit}`;
  const stakeIds = stakes.map((stake) => stake.id.toString());

  for (let attempt = 0; attempt <= MAX_CACHE_RETRIES; attempt++) {
    try {
      // Use a pipeline to reduce network round trips
      const pipeline = redis.pipeline();

      // Clear existing data
      pipeline.del(pageKey);

      // Store the list of stake IDs
      if (stakeIds.length > 0) {
        pipeline.rpush(pageKey, ...stakeIds);

        // Set expiry
        if (config.staleWhileRevalidate && config.staleTime) {
          pipeline.expire(pageKey, config.ttl + config.staleTime);
        } else {
          pipeline.expire(pageKey, config.ttl);
        }
      }

      // Execute the pipeline
      await pipeline.exec();

      // If we get here, the operation was successful
      return;
    } catch (error) {
      console.error(
        `Error caching stakes list (attempt ${attempt + 1}/${
          MAX_CACHE_RETRIES + 1
        }):`,
        error
      );

      // If this is the last attempt, just log the error and continue
      if (attempt === MAX_CACHE_RETRIES) {
        console.error(
          'Failed to cache stakes list after multiple attempts:',
          error
        );
        return;
      }

      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, 200 * (attempt + 1)));
    }
  }
}
