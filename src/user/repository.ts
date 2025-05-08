import { User } from './types';

// In-memory storage for demo purposes
// In a real application, this would be replaced with a database
const users: User[] = [{ id: 1, username: 'testuser' }];

/**
 * Find a user by ID
 * @param id The user ID
 * @returns The user or undefined if not found
 */
export const findUserById = (id: number): User | undefined => {
  return users.find(user => user.id === id);
};

/**
 * Find a user by username
 * @param username The username
 * @returns The user or undefined if not found
 */
export const findUserByUsername = (username: string): User | undefined => {
  return users.find(user => user.username === username);
};
