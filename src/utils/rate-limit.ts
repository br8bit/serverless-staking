import { Redis } from '@upstash/redis/cloudflare';
import { RateLimitError } from './errors';

/**
 * Rate limiting configuration
 */
export interface RateLimitConfig {
  /** Maximum number of requests allowed in the time window */
  limit: number;
  /** Time window in seconds */
  window: number;
  /** Identifier for the rate limit (e.g., 'auth', 'stake') */
  identifier: string;
}

/**
 * Default rate limit configurations
 */
export const defaultRateLimits: Record<string, RateLimitConfig> = {
  // Authentication endpoint - 10 requests per minute
  auth: {
    limit: 10,
    window: 60,
    identifier: 'auth',
  },
  // Stake creation endpoint - 20 requests per minute
  stakeCreate: {
    limit: 20,
    window: 60,
    identifier: 'stake:create',
  },
  // Stake retrieval endpoint - 60 requests per minute
  stakeGet: {
    limit: 60,
    window: 60,
    identifier: 'stake:get',
  },
  // Global rate limit - 100 requests per minute
  global: {
    limit: 100,
    window: 60,
    identifier: 'global',
  },
};

/**
 * Check if a request is rate limited using a Lua script for atomic operations
 * @param redis Redis client
 * @param ip Client IP address
 * @param userId User ID (optional)
 * @param config Rate limit configuration
 * @returns Promise<void>
 * @throws RateLimitError if rate limit is exceeded
 */
export async function checkRateLimit(
  redis: Redis,
  ip: string,
  userId: number | null,
  config: RateLimitConfig
): Promise<void> {
  // Create a unique key for this rate limit
  // Include user ID if available, otherwise use IP
  const key = userId
    ? `ratelimit:${config.identifier}:user:${userId}`
    : `ratelimit:${config.identifier}:ip:${ip}`;

  // Lua script for atomic rate limiting
  // This script:
  // 1. Gets the current count
  // 2. Checks if it exceeds the limit
  // 3. If not, increments the counter and sets expiry if needed
  // 4. Returns the new count and whether the limit was exceeded
  const luaScript = `
    local key = KEYS[1]
    local limit = tonumber(ARGV[1])
    local window = tonumber(ARGV[2])

    local current = redis.call('get', key)
    local count = 0

    if current then
      count = tonumber(current)
    end

    local exceeded = 0
    if count >= limit then
      exceeded = 1
    else
      count = redis.call('incr', key)
      if count == 1 then
        redis.call('expire', key, window)
      end
    end

    return {count, exceeded}
  `;

  try {
    // Execute the Lua script
    const result = await redis.eval(
      luaScript,
      [key],
      [config.limit.toString(), config.window.toString()]
    );

    // Parse the result
    const exceeded = result[1] === 1;

    if (exceeded) {
      throw new RateLimitError(`Rate limit exceeded for ${config.identifier}`);
    }
  } catch (error) {
    // If the error is already a RateLimitError, rethrow it
    if (error instanceof RateLimitError) {
      throw error;
    }

    // For other errors (e.g., Redis connection issues), log and continue
    // This is a fail-open approach for rate limiting
    console.error('Error checking rate limit:', error);

    // In production, you might want to fail-closed instead:
    // throw new RateLimitError(`Rate limit check failed for ${config.identifier}`);
  }
}

/**
 * Apply rate limiting to a request
 * @param request The request
 * @param redis Redis client
 * @param userId User ID (optional)
 * @param configKey Key for the rate limit configuration
 * @returns Promise<void>
 * @throws RateLimitError if rate limit is exceeded
 */
export async function applyRateLimit(
  request: Request,
  redis: Redis,
  userId: number | null,
  configKey: keyof typeof defaultRateLimits
): Promise<void> {
  // Get client IP
  const ip =
    request.headers.get('CF-Connecting-IP') ||
    request.headers.get('X-Forwarded-For') ||
    'unknown';

  // Get rate limit configuration
  const config = defaultRateLimits[configKey];

  // Check global rate limit first
  await checkRateLimit(redis, ip, userId, defaultRateLimits.global);

  // Then check specific endpoint rate limit
  await checkRateLimit(redis, ip, userId, config);
}
