import { User } from '../user/types';
import { verifyToken } from '../auth/jwt';
import { findUserById } from '../user/repository';
import { AuthenticationError } from '../utils/errors';

/**
 * Authenticate a request
 * @param request The request to authenticate
 * @param env The environment variables
 * @returns The authenticated user
 * @throws AuthenticationError if authentication fails
 */
export const authenticate = async (
  request: Request,
  env: any
): Promise<User> => {
  // Check for Authorization header
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new AuthenticationError('Missing or invalid Authorization header');
  }

  // Extract and verify token
  const token = authHeader.split(' ')[1];
  const payload = verifyToken(token, env.JWT_SECRET);

  if (!payload) {
    throw new AuthenticationError('Invalid or expired token');
  }

  // Find user
  const user = findUserById(payload.sub);
  if (!user) {
    throw new AuthenticationError('User not found');
  }

  return user;
};
