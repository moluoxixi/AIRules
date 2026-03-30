# Backend Comments

Cross-framework documentation conventions for backend projects.

## API Endpoint Documentation

Document HTTP contracts clearly:

```typescript
/**
 * POST /api/v1/orders
 *
 * Creates a new order for the authenticated user.
 *
 * ## Request Body
 * - items: Array of { productId, quantity }
 * - shippingAddress: Valid address object
 *
 * ## Response
 * - 201: Order created successfully
 * - 400: Invalid request data
 * - 401: Authentication required
 * - 422: Insufficient inventory
 *
 * ## Side Effects
 * - Reserves inventory
 * - Sends confirmation email
 * - Creates payment intent
 */
```

## Database Model Documentation

```typescript
/**
 * User entity representing authenticated application users.
 *
 * ## Constraints
 * - email must be unique across the system
 * - password_hash is bcrypt with cost factor 12
 * - last_login is null until first successful authentication
 *
 * ## Indexes
 * - email (unique)
 * - created_at (for sorting)
 */
@Entity()
class User {
  @PrimaryKey()
  id: string;

  /** User's primary email for login and notifications */
  @Property({ unique: true })
  email: string;
}
```

## Service Method Documentation

```typescript
/**
 * Processes payment through external gateway.
 *
 * ## Transaction Behavior
 * - Creates payment record in PENDING state
 * - Calls Stripe API
 * - Updates record to SUCCESS or FAILED
 * - Emits PaymentCompleted event on success
 *
 * ## Idempotency
 * Duplicate calls with same idempotencyKey return cached result.
 *
 * @param request - Payment details
 * @param idempotencyKey - Unique key for deduplication
 * @returns Payment result with transaction ID
 * @throws PaymentGatewayError if provider is unavailable
 */
async function processPayment(
  request: PaymentRequest,
  idempotencyKey: string
): Promise<PaymentResult> {
```

## Middleware Documentation

```typescript
/**
 * Authentication middleware.
 *
 * ## Behavior
 * - Extracts JWT from Authorization header
 * - Validates token signature and expiration
 * - Attaches user object to request context
 *
 * ## Error Responses
 * - 401: Missing or malformed token
 * - 403: Token expired or invalid
 */
function authMiddleware(req: Request, res: Response, next: NextFunction) {
```

## Configuration Documentation

```typescript
/**
 * Database connection configuration.
 *
 * ## Environment Variables
 * - DATABASE_URL: Full connection string (overrides individual settings)
 * - DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD: Component settings
 *
 * ## Defaults
 * - poolSize: 10 connections
 * - timeout: 30 seconds
 */
interface DatabaseConfig {
  url?: string;
  host?: string;
  port?: number;
}
```
