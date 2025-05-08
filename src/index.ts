import { authenticate } from './middleware/auth';
import { handleAuth } from './routes/auth';
import { handleStakeGet, handleStakePost } from './routes/stake';
import { addCorsHeaders, corsHeaders } from './utils/cors';
import {
  handleError,
  MethodNotAllowedError,
  NotFoundError,
} from './utils/errors';
import { setupDatabase, setupRedis } from './utils/setup';

// Main worker handler
export default {
  async fetch(request: Request, env: any, _ctx: any): Promise<Response> {
    // Handle preflight requests
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: corsHeaders,
      });
    }

    try {
      const url = new URL(request.url);
      const path = url.pathname;

      // Set up database and Redis connections
      const db = setupDatabase(env);
      const redis = setupRedis(env);

      // Route handling
      if (path === '/api/auth') {
        return addCorsHeaders(await handleAuth(request, env, redis));
      } else if (path === '/api/stake') {
        try {
          // Authenticate user
          const user = await authenticate(request, env);

          // Handle request based on method
          if (request.method === 'POST') {
            return addCorsHeaders(
              await handleStakePost(request, env, user, db, redis)
            );
          } else if (request.method === 'GET') {
            return addCorsHeaders(
              await handleStakeGet(request, env, user, db, redis)
            );
          } else {
            throw new MethodNotAllowedError();
          }
        } catch (error) {
          return addCorsHeaders(handleError(error));
        }
      } else {
        // Not found
        throw new NotFoundError(`Route ${path} not found`);
      }
    } catch (error) {
      // Handle all errors
      return addCorsHeaders(handleError(error));
    }
  },
};
