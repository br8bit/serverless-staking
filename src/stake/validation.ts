import { z } from 'zod';
import { ValidationError } from '../utils/errors';
import { CreateStakeDto } from './types';

/**
 * Schema for stake creation requests
 */
export const createStakeSchema = z.object({
  amount: z
    .number({
      required_error: 'Amount is required',
      invalid_type_error: 'Amount must be a number',
    })
    .positive('Amount must be a positive number'),

  period: z
    .number({
      required_error: 'Period is required',
      invalid_type_error: 'Period must be a number',
    })
    .refine((val) => [1, 3, 6, 12].includes(val), {
      message: 'Period must be one of: 1, 3, 6, or 12 months',
    }),
});

/**
 * Type for validated stake creation requests
 * This ensures the validated data matches the CreateStakeDto interface
 */
export type ValidatedStakeRequest = z.infer<typeof createStakeSchema>;

/**
 * Schema for pagination parameters
 */
export const paginationSchema = z.object({
  page: z.coerce
    .number({
      invalid_type_error: 'Page must be a number',
    })
    .int('Page must be an integer')
    .positive('Page must be a positive number')
    .default(1),

  limit: z.coerce
    .number({
      invalid_type_error: 'Limit must be a number',
    })
    .int('Limit must be an integer')
    .positive('Limit must be a positive number')
    .max(100, 'Limit cannot exceed 100')
    .default(20),
});

/**
 * Type for pagination parameters
 */
export type PaginationParams = z.infer<typeof paginationSchema>;

/**
 * Validate stake creation request data
 * @param data The data to validate
 * @returns The validated data as CreateStakeDto
 * @throws ValidationError if validation fails
 */
export const validateCreateStakeRequest = (data: unknown): CreateStakeDto => {
  try {
    // Parse and validate the data
    const validated = createStakeSchema.parse(data);

    // Ensure the data matches the CreateStakeDto interface
    return {
      amount: validated.amount,
      period: validated.period,
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors = error.errors.map((err) => err.message);
      throw new ValidationError('Validation failed', errors);
    }
    throw error;
  }
};

/**
 * Validate pagination parameters
 * @param params The parameters to validate
 * @returns The validated parameters
 * @throws ValidationError if validation fails
 */
export const validatePaginationParams = (
  params: Record<string, string | null>
): PaginationParams => {
  try {
    return paginationSchema.parse({
      page: params.page || undefined,
      limit: params.limit || undefined,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors = error.errors.map((err) => err.message);
      throw new ValidationError('Validation failed', errors);
    }
    throw error;
  }
};
