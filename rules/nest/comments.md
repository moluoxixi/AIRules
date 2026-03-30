# NestJS Comments

TSDoc conventions for NestJS projects.

## Controller Documentation

Document HTTP endpoints with purpose and status codes:

```typescript
/**
 * Handles user authentication endpoints.
 */
@Controller('auth')
export class AuthController {

  /**
   * Authenticates user with email and password.
   * Returns JWT token on success.
   *
   * @param credentials - User login credentials
   * @returns Access token and user profile
   * @throws UnauthorizedException if credentials are invalid
   */
  @Post('login')
  async login(@Body() credentials: LoginDto): Promise<AuthResponse> {
```

## Service Documentation

```typescript
/**
 * Manages user data persistence and retrieval.
 */
@Injectable()
export class UserService {

  /**
   * Finds user by unique identifier.
   *
   * @param id - User UUID
   * @returns User entity or null if not found
   */
  async findById(id: string): Promise<User | null> {
```

## DTO Field Documentation

Document validation constraints and semantics:

```typescript
export class CreateUserDto {
  /**
   * User's email address for authentication.
   * Must be unique across the system.
   *
   * @example "user@example.com"
   */
  @IsEmail()
  email: string;

  /**
   * Password with minimum security requirements.
   * Will be hashed before storage.
   *
   * @minLength 8
   */
  @MinLength(8)
  password: string;
}
```

## Decorator Comments

Explain custom decorators:

```typescript
/**
 * Extracts current authenticated user from JWT payload.
 * Requires JwtAuthGuard to be applied on the route.
 */
export const CurrentUser = createParamDecorator(
  (data: keyof User, ctx: ExecutionContext) => {
    // Implementation
  }
);
```
