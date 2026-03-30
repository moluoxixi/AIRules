# NestJS Comments

TSDoc conventions for NestJS projects.

> **注释语言**：注释语言跟随项目所在地区，详见 [common/comments.md](../common/comments.md)。代码示例使用中文注释。

## Controller Documentation

Document HTTP endpoints with purpose and status codes:

```typescript
/**
 * 处理用户认证相关端点
 */
@Controller('auth')
export class AuthController {

  /**
   * 使用邮箱和密码验证用户身份
   * 验证成功返回 JWT token
   *
   * @param credentials - 用户登录凭证
   * @returns 访问令牌和用户资料
   * @throws UnauthorizedException 凭证无效时抛出
   */
  @Post('login')
  async login(@Body() credentials: LoginDto): Promise<AuthResponse> {
```

## Service Documentation

```typescript
/**
 * 管理用户数据的持久化和查询
 */
@Injectable()
export class UserService {

  /**
   * 根据唯一标识符查找用户
   *
   * @param id - 用户 UUID
   * @returns 用户实体，未找到时返回 null
   */
  async findById(id: string): Promise<User | null> {
```

## DTO Field Documentation

Document validation constraints and semantics:

```typescript
export class CreateUserDto {
  /**
   * 用户用于认证的邮箱地址
   * 必须在系统中唯一
   *
   * @example "user@example.com"
   */
  @IsEmail()
  email: string;

  /**
   * 符合最低安全要求的密码
   * 存储前会进行哈希处理
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
 * 从 JWT payload 中提取当前认证用户
 * 需要在路由上应用 JwtAuthGuard
 */
export const CurrentUser = createParamDecorator(
  (data: keyof User, ctx: ExecutionContext) => {
    // Implementation
  }
);
```
