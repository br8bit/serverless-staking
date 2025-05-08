import postgres from 'postgres';
import { DatabaseError } from './utils/errors';

// Define interfaces for our data
export interface Stake {
  id: number;
  amount: number;
  period: number;
  userId: number;
  createdAt: Date;
}

// Global/static connection pool that persists between serverless function invocations
let sqlClient: ReturnType<typeof postgres> | null = null;
let lastConnectionTime = Date.now();
const CONNECTION_MAX_AGE = 30 * 60 * 1000; // 30 minutes in milliseconds
let connectionAttempts = 0;
const MAX_CONNECTION_ATTEMPTS = 3;

export class DbService {
  private sql: ReturnType<typeof postgres>;

  constructor(connectionString: string) {
    try {
      // Check if we need to refresh the connection pool
      const now = Date.now();
      const connectionAge = now - lastConnectionTime;

      // Create a new connection pool if one doesn't exist or if it's too old
      if (!sqlClient || connectionAge > CONNECTION_MAX_AGE) {
        // Close the old connection if it exists
        if (sqlClient) {
          try {
            console.log('Closing old database connection pool');
            sqlClient
              .end()
              .catch((err) =>
                console.error('Error closing old connection pool:', err)
              );
          } catch (err) {
            console.error('Error closing old connection pool:', err);
          }
        }

        // Create a new connection pool
        console.log('Creating new database connection pool');
        sqlClient = postgres(connectionString, {
          max: 5, // Increased for better concurrency
          idle_timeout: 30, // Increased to reduce connection churn
          connect_timeout: 10,
          fetch_types: false,
          ssl: true,
        });

        lastConnectionTime = now;
        connectionAttempts = 0;
      }

      this.sql = sqlClient;
    } catch (error) {
      console.error('Error setting up database connection:', error);
      throw new DatabaseError('Failed to set up database connection');
    }
  }

  /**
   * Initialize the database by creating necessary tables.
   * This should be called during application startup, not on every request.
   */
  async init() {
    // Create tables if they don't exist
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        await this.sql.unsafe(`
          CREATE TABLE IF NOT EXISTS stakes (
            id SERIAL PRIMARY KEY,
            amount DECIMAL NOT NULL,
            period INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
          )
        `);
        console.log('Database initialized successfully');
        return;
      } catch (error) {
        console.error(
          `Error initializing database (attempt ${attempt}/3):`,
          error
        );

        // If this is the last attempt, throw the error
        if (attempt === 3) {
          throw new DatabaseError(
            'Failed to initialize database after multiple attempts'
          );
        }

        // Wait before retrying
        await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
      }
    }
  }

  /**
   * Create a new stake in the database.
   * Optimized for serverless with timeout to prevent hanging connections.
   */
  async createStake(
    userId: number,
    amount: number,
    period: number
  ): Promise<Stake> {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        // Use parameterized query for better security and performance
        const result = await this.sql.unsafe(
          `
          INSERT INTO stakes (amount, period, user_id)
          VALUES ($1, $2, $3)
          RETURNING id, amount, period, user_id as "userId", created_at as "createdAt"
          `,
          [amount, period, userId]
        );

        if (!result || result.length === 0) {
          throw new DatabaseError('Failed to create stake: No result returned');
        }

        // Convert the database result to match our Stake interface
        const stake: Stake = {
          id: result[0].id,
          amount: result[0].amount,
          period: result[0].period,
          userId: result[0].userId,
          createdAt: result[0].createdAt,
        };

        return stake;
      } catch (error) {
        console.error(
          `Error creating stake in database (attempt ${attempt}/3):`,
          error
        );

        // If this is the last attempt, throw the error
        if (attempt === 3) {
          throw new DatabaseError(
            'Failed to create stake in database after multiple attempts'
          );
        }

        // Wait before retrying
        await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
      }
    }

    // This should never be reached due to the throw in the loop
    throw new DatabaseError('Failed to create stake in database');
  }

  /**
   * Get stakes for a user with pagination.
   * Optimized for serverless with parameterized queries.
   */
  async getStakes(
    userId: number,
    page: number,
    limit: number
  ): Promise<Stake[]> {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const offset = (page - 1) * limit;

        // Use parameterized query for better security and performance
        const result = await this.sql.unsafe(
          `
          SELECT id, amount, period, user_id as "userId", created_at as "createdAt"
          FROM stakes
          WHERE user_id = $1
          ORDER BY created_at DESC
          LIMIT $2 OFFSET $3
        `,
          [userId, limit, offset]
        );

        // Map each row to our Stake interface
        const stakes: Stake[] = result.map((row) => ({
          id: row.id,
          amount: row.amount,
          period: row.period,
          userId: row.userId,
          createdAt: row.createdAt,
        }));

        return stakes;
      } catch (error) {
        console.error(
          `Error retrieving stakes from database (attempt ${attempt}/3):`,
          error
        );

        // If this is the last attempt, throw the error
        if (attempt === 3) {
          throw new DatabaseError(
            'Failed to retrieve stakes from database after multiple attempts'
          );
        }

        // Wait before retrying
        await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
      }
    }

    // This should never be reached due to the throw in the loop
    throw new DatabaseError('Failed to retrieve stakes from database');
  }

  /**
   * Check database connection health
   * @returns True if the connection is healthy
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Simple query to check if the connection is working
      await this.sql.unsafe('SELECT 1');
      return true;
    } catch (error) {
      console.error('Database health check failed:', error);
      return false;
    }
  }

  /**
   * Close the database connection.
   * Note: In serverless environments, you typically don't want to close the connection
   * after each operation to allow for connection reuse between invocations.
   */
  async close() {
    // Only close the connection if we're sure we won't need it again
    if (sqlClient) {
      await sqlClient.end();
      sqlClient = null;
    }
  }
}
