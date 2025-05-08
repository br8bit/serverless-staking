import { Redis } from '@upstash/redis/cloudflare';
import { DbService, Stake } from '../db-service';
import { cacheStake, cacheStakes, getCachedStake } from '../utils/cache';
import { DatabaseError } from '../utils/errors';
import { CreateStakeDto, PaginationDto } from './types';

/**
 * Create a new stake
 * @param userId The user ID
 * @param createStakeDto The stake data
 * @param db The database service
 * @param redis The Redis client
 * @returns The created stake
 */
export const createStake = async (
  userId: number,
  createStakeDto: CreateStakeDto,
  db: DbService,
  redis: Redis
) => {
  try {
    // Initialize the database
    await db.init();

    // Create stake in CockroachDB
    const dbStake = await db.createStake(
      userId,
      createStakeDto.amount,
      createStakeDto.period
    );

    // Cache the stake in Redis
    await cacheStake(redis, dbStake);

    // Increment counter in Redis (as per requirements)
    const counterKey = `user:${userId}:stakes`;
    await redis.incr(counterKey);

    // Invalidate any cached stake lists for this user
    const userStakeListsPattern = `user:${userId}:stakes:page:*`;
    const keys = await redis.keys(userStakeListsPattern);
    if (keys.length > 0) {
      await redis.del(...keys);
      console.log(
        `Invalidated ${keys.length} cached stake lists for user ${userId}`
      );
    }

    return { success: true, stakeId: dbStake.id };
  } catch (error) {
    if (error instanceof DatabaseError) {
      throw error;
    }
    throw new Error('Failed to create stake. Please try again later.');
  }
};

/**
 * Get stakes for a user
 * @param userId The user ID
 * @param paginationDto The pagination parameters
 * @param db The database service
 * @param redis The Redis client
 * @returns The stakes
 */
export const getStakes = async (
  userId: number,
  paginationDto: PaginationDto,
  db: DbService,
  redis: Redis
) => {
  try {
    const { page = 1, limit = 20 } = paginationDto;

    // Check if we have a cached page of stakes
    const pageKey = `user:${userId}:stakes:page:${page}:limit:${limit}`;
    const cachedStakeIds = await redis.lrange(pageKey, 0, limit - 1);

    let stakes: Stake[] = [];
    let needsRefresh = false;

    if (cachedStakeIds.length > 0) {
      // Get each stake from cache
      const stakePromises = cachedStakeIds.map((id) =>
        getCachedStake(redis, id)
      );
      const cachedStakes = await Promise.all(stakePromises);

      // Filter out null stakes and check if any are stale
      stakes = cachedStakes
        .filter((result) => result.stake !== null)
        .map((result) => {
          if (result.isStale) {
            needsRefresh = true;
          }
          return result.stake!;
        });

      // If we have all the stakes and none are stale, return them
      if (stakes.length === cachedStakeIds.length && !needsRefresh) {
        // Format response
        const items = stakes.map((stake) => ({
          id: stake.id,
          amount: stake.amount,
          period: stake.period,
        }));

        return { items, fromCache: true };
      }
    }

    // Initialize the database
    await db.init();

    // Query the database for stakes belonging to this user
    const dbStakes = await db.getStakes(userId, page, limit);

    // Cache the stakes in Redis
    await cacheStakes(redis, dbStakes, userId, page, limit);

    // Format response
    const items = dbStakes.map((stake) => ({
      id: stake.id,
      amount: stake.amount,
      period: stake.period,
    }));

    return { items, fromCache: false };
  } catch (error) {
    if (error instanceof DatabaseError) {
      throw error;
    }
    throw new Error('Failed to retrieve stakes. Please try again later.');
  }
};
