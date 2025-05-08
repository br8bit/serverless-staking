import { Redis } from '@upstash/redis/cloudflare';
import { generateToken } from '../auth/jwt';
import { validateAuthRequest } from '../auth/validation';
import { findUserByUsername } from '../user/repository';
import {
  AuthenticationError,
  MethodNotAllowedError,
  handleError,
} from '../utils/errors';
import { applyRateLimit } from '../utils/rate-limit';

/**
 * Handle authentication requests
 * @param request The request
 * @param env The environment variables
 * @param redis Redis client
 * @returns The response
 */
export const handleAuth = async (
  request: Request,
  env: any,
  redis: Redis
): Promise<Response> => {
  try {
    // Check method
    if (request.method !== 'POST') {
      throw new MethodNotAllowedError();
    }

    // Apply rate limiting
    await applyRateLimit(request, redis, null, 'auth');

    // Parse and validate request body
    const body = await request.json();
    const { username, password } = validateAuthRequest(body);

    // In a real app, we would validate credentials
    // For demo, we'll just return a token for the first user
    const user = findUserByUsername('testuser');
    if (!user) {
      throw new AuthenticationError('Invalid credentials');
    }

    const token = generateToken(user, env.JWT_SECRET);

    return new Response(JSON.stringify({ token }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return handleError(error);
  }
};
