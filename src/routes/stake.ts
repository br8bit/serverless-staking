import { Redis } from '@upstash/redis/cloudflare';
import { DbService } from '../db-service';
import { User } from '../user/types';
import { createStake, getStakes } from '../stake/service';
import {
  validateCreateStakeRequest,
  validatePaginationParams,
} from '../stake/validation';
import { handleError, MethodNotAllowedError } from '../utils/errors';
import { applyRateLimit } from '../utils/rate-limit';

/**
 * Handle stake creation requests
 * @param request The request
 * @param env The environment variables
 * @param user The authenticated user
 * @param db The database service
 * @param redis The Redis client
 * @returns The response
 */
export const handleStakePost = async (
  request: Request,
  env: any,
  user: User,
  db: DbService,
  redis: Redis
): Promise<Response> => {
  try {
    console.log(`Creating stake for user ${user.id}`);

    // Check method
    if (request.method !== 'POST') {
      throw new MethodNotAllowedError();
    }

    // Apply rate limiting
    await applyRateLimit(request, redis, user.id, 'stakeCreate');

    // Parse and validate request body
    const body = await request.json();
    const validatedData = validateCreateStakeRequest(body);

    // Create stake
    const result = await createStake(user.id, validatedData, db, redis);

    // Return success response
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error creating stake:', error);
    return handleError(error);
  }
};

/**
 * Handle stake retrieval requests
 * @param request The request
 * @param env The environment variables
 * @param user The authenticated user
 * @param db The database service
 * @param redis The Redis client
 * @returns The response
 */
export const handleStakeGet = async (
  request: Request,
  env: any,
  user: User,
  db: DbService,
  redis: Redis
): Promise<Response> => {
  try {
    console.log(`Retrieving stakes for user ${user.id}`);

    // Check method
    if (request.method !== 'GET') {
      throw new MethodNotAllowedError();
    }

    // Apply rate limiting
    await applyRateLimit(request, redis, user.id, 'stakeGet');

    // Parse and validate pagination parameters
    const url = new URL(request.url);
    const params = Object.fromEntries(url.searchParams.entries());
    const { page, limit } = validatePaginationParams(params);

    // Get stakes
    const result = await getStakes(user.id, { page, limit }, db, redis);

    // Return success response
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error retrieving stakes:', error);
    return handleError(error);
  }
};
