/**
 * Base error class for the application
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode: number, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;

    // Capture stack trace
    Error.captureStackTrace(this, this.constructor);

    // Set the prototype explicitly
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

/**
 * Error for validation failures
 */
export class ValidationError extends AppError {
  public readonly errors: string[];

  constructor(message: string, errors: string[]) {
    super(message, 400, true);
    this.errors = errors;

    // Set the prototype explicitly
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

/**
 * Error for authentication failures
 */
export class AuthenticationError extends AppError {
  constructor(message = 'Authentication failed') {
    super(message, 401, true);

    // Set the prototype explicitly
    Object.setPrototypeOf(this, AuthenticationError.prototype);
  }
}

/**
 * Error for authorization failures
 */
export class AuthorizationError extends AppError {
  constructor(message = 'Not authorized') {
    super(message, 403, true);

    // Set the prototype explicitly
    Object.setPrototypeOf(this, AuthorizationError.prototype);
  }
}

/**
 * Error for not found resources
 */
export class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(message, 404, true);

    // Set the prototype explicitly
    Object.setPrototypeOf(this, NotFoundError.prototype);
  }
}

/**
 * Error for method not allowed
 */
export class MethodNotAllowedError extends AppError {
  constructor(message = 'Method not allowed') {
    super(message, 405, true);

    // Set the prototype explicitly
    Object.setPrototypeOf(this, MethodNotAllowedError.prototype);
  }
}

/**
 * Error for database operations
 */
export class DatabaseError extends AppError {
  constructor(message = 'Database operation failed') {
    super(message, 500, true);

    // Set the prototype explicitly
    Object.setPrototypeOf(this, DatabaseError.prototype);
  }
}

/**
 * Error for external service failures
 */
export class ExternalServiceError extends AppError {
  constructor(message = 'External service failed') {
    super(message, 502, true);

    // Set the prototype explicitly
    Object.setPrototypeOf(this, ExternalServiceError.prototype);
  }
}

/**
 * Error for rate limiting
 */
export class RateLimitError extends AppError {
  constructor(message = 'Too many requests') {
    super(message, 429, true);

    // Set the prototype explicitly
    Object.setPrototypeOf(this, RateLimitError.prototype);
  }
}

/**
 * Handle errors and return appropriate responses
 * @param error The error to handle
 * @returns A Response object
 */
export const handleError = (error: unknown): Response => {
  // If it's an AppError, use its status code and message
  if (error instanceof AppError) {
    // For validation errors, include the validation errors
    if (error instanceof ValidationError) {
      return new Response(
        JSON.stringify({
          error: error.message,
          errors: error.errors,
        }),
        {
          status: error.statusCode,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // For other AppErrors, just use the message
    return new Response(
      JSON.stringify({
        error: error.message,
      }),
      {
        status: error.statusCode,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  // For unknown errors, log them and return a generic error
  console.error('Unexpected error:', error);

  return new Response(
    JSON.stringify({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    }),
    {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    }
  );
};
