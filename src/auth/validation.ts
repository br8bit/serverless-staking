import { z } from 'zod';
import { ValidationError } from '../utils/errors';

/**
 * Schema for authentication requests
 */
export const authSchema = z.object({
  username: z.string({
    required_error: 'Username is required',
    invalid_type_error: 'Username must be a string',
  }).min(3, 'Username must be at least 3 characters long'),
  
  password: z.string({
    required_error: 'Password is required',
    invalid_type_error: 'Password must be a string',
  }).min(6, 'Password must be at least 6 characters long'),
});

/**
 * Type for authentication requests
 */
export type AuthRequest = z.infer<typeof authSchema>;

/**
 * Validate authentication request data
 * @param data The data to validate
 * @returns The validated data
 * @throws ValidationError if validation fails
 */
export const validateAuthRequest = (data: unknown): AuthRequest => {
  try {
    return authSchema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors = error.errors.map(err => err.message);
      throw new ValidationError('Validation failed', errors);
    }
    throw error;
  }
};
