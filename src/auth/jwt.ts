import { sign, verify } from 'jsonwebtoken';
import { User } from '../user/types';

/**
 * Generate a JWT token for a user
 * @param user The user to generate a token for
 * @param secret The secret to sign the token with
 * @returns The generated JWT token
 */
export const generateToken = (user: User, secret: string): string => {
  return sign({ sub: user.id, username: user.username }, secret, {
    expiresIn: '1h',
  });
};

/**
 * Verify a JWT token
 * @param token The token to verify
 * @param secret The secret to verify the token with
 * @returns The decoded token payload or null if invalid
 */
export const verifyToken = (token: string, secret: string): any => {
  try {
    return verify(token, secret);
  } catch (error) {
    return null;
  }
};
