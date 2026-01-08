# Serverless Staking Application

A high-performance, serverless staking application built with Cloudflare Workers, Upstash Redis, and CockroachDB. This application demonstrates best practices for building serverless applications with a focus on performance, reliability, and scalability.

## 🚀 Features

- **User Authentication**: JWT-based authentication system
- **Stake Management**: Create and retrieve stakes with different periods
- **Rate Limiting**: Protect API endpoints from abuse with Redis-based rate limiting
- **Caching**: Efficient caching with stale-while-revalidate pattern
- **Pagination**: Efficient data retrieval with pagination support
- **Input Validation**: Comprehensive input validation with Zod
- **Error Handling**: Robust error handling with custom error types
- **Database Connection Pooling**: Optimized database connections for serverless environments
- **Retry Logic**: Resilient operations with retry logic for database and cache operations

## 🏗️ Architecture & Technologies

The application follows a serverless architecture with the following components:

### Backend Services & Technologies

- **TypeScript**: Type-safe JavaScript for better developer experience
- **Cloudflare Workers**: Serverless compute platform for running the application logic
- **Upstash Redis**: Serverless Redis for caching and rate limiting
- **CockroachDB**: Distributed SQL database for persistent storage
- **Zod**: Schema validation library
- **JWT**: JSON Web Tokens for authentication
- **Wrangler**: CLI tool for developing and deploying Cloudflare Workers

### Key Components

- **Authentication Service**: Handles user authentication and JWT token generation
- **Stake Service**: Manages stake creation and retrieval
- **Database Service**: Provides an interface to CockroachDB with connection pooling and retry logic
- **Cache Utility**: Implements efficient caching strategies with Redis
- **Rate Limiting Utility**: Protects API endpoints from abuse with Redis-based rate limiting
- **Error Handling**: Centralized error handling with custom error types
- **Input Validation**: Schema-based input validation with Zod

## 📊 API Endpoints

### Authentication

```http
POST /api/auth
```

Request body:

```json
{
  "username": "testuser",
  "password": "password123"
}
```

Response:

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### Create Stake

```http
POST /api/stake
```

Headers:

```http
Authorization: Bearer <token>
```

Request body:

```json
{
  "amount": 1000,
  "period": 12
}
```

Response:

```json
{
  "success": true,
  "stakeId": "1234567890"
}
```

### Get Stakes

```http
GET /api/stake?page=1&limit=10
```

Headers:

```http
Authorization: Bearer <token>
```

Response:

```json
{
  "items": [
    {
      "id": "1234567890",
      "amount": "1000",
      "period": "12"
    },
    ...
  ],
  "fromCache": true
}
```

## �️ Implementation Details

### �🔒 Rate Limiting

The application implements rate limiting to protect API endpoints from abuse:

- **Authentication**: 10 requests per minute
- **Stake Creation**: 20 requests per minute
- **Stake Retrieval**: 60 requests per minute
- **Global**: 100 requests per minute

Rate limits are tracked per user (if authenticated) or per IP address (if not authenticated).

### 📦 Caching Strategy

The application implements a sophisticated caching strategy:

- **Stake Data**: 5-minute TTL with 5-minute stale time
- **User Data**: 10-minute TTL with 10-minute stale time
- **Short-lived Data**: 1-minute TTL

The caching implementation includes stale-while-revalidate pattern, cache invalidation, retry logic, and Redis pipelining for better performance.

### 🔄 Database Connection Pooling

The application optimizes database connections for serverless environments with:

- Connection reuse between serverless function invocations
- Connection age tracking and refresh logic
- Retry logic for database operations
- Health checks for database connections

### 🚦 Error Handling

The application implements robust error handling with custom error types:

- **ValidationError**: For input validation failures
- **AuthenticationError**: For authentication failures
- **NotFoundError**: For resource not found errors
- **DatabaseError**: For database operation failures
- **RateLimitError**: For rate limit exceeded errors
- **ExternalServiceError**: For external service failures

## 🧪 Development and Deployment

### Prerequisites

- Node.js 16+
- npm or yarn
- Wrangler CLI
- Upstash Redis account
- CockroachDB instance

### Environment Variables

- `JWT_SECRET`: Secret for JWT token generation
- `UPSTASH_REDIS_REST_URL`: Upstash Redis REST URL
- `UPSTASH_REDIS_REST_TOKEN`: Upstash Redis REST token
- `DATABASE_URL`: CockroachDB connection string

### Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Deploy to Cloudflare Workers
npm run deploy
```

## 🔍 Future Improvements

Potential future improvements include:

- **Monitoring and Observability**: Add detailed logging, distributed tracing, and metrics
- **Horizontal Scaling**: Ensure stateless request handling and consistent hashing for distributed caching
- **Performance Optimization**: Implement request queuing and backpressure mechanisms
- **Testing**: Add comprehensive unit and integration tests
- **Documentation**: Add API documentation with OpenAPI/Swagger
