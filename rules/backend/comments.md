# Backend Comments

Cross-framework documentation conventions for backend projects.

> **注释语言**：注释语言跟随项目所在地区，详见 [common/comments.md](../common/comments.md)。代码示例使用中文注释。

## API Endpoint Documentation

Document HTTP contracts clearly:

```typescript
/**
 * POST /api/v1/orders
 *
 * 为认证用户创建新订单
 *
 * ## Request Body
 * - items: { productId, quantity } 数组
 * - shippingAddress: 有效地址对象
 *
 * ## Response
 * - 201: 订单创建成功
 * - 400: 请求数据无效
 * - 401: 需要认证
 * - 422: 库存不足
 *
 * ## Side Effects
 * - 预留库存
 * - 发送确认邮件
 * - 创建支付意图
 */
```

## Database Model Documentation

```typescript
/**
 * 用户实体，代表已认证的应用用户
 *
 * ## Constraints
 * - email 必须在系统中唯一
 * - password_hash 使用 bcrypt，cost factor 为 12
 * - last_login 在首次成功认证前为 null
 *
 * ## Indexes
 * - email (unique)
 * - created_at (用于排序)
 */
@Entity()
class User {
  @PrimaryKey()
  id: string;

  /** 用户用于登录和通知的主邮箱 */
  @Property({ unique: true })
  email: string;
}
```

## Service Method Documentation

```typescript
/**
 * 通过外部网关处理支付
 *
 * ## Transaction Behavior
 * - 创建 PENDING 状态的支付记录
 * - 调用 Stripe API
 * - 更新记录为 SUCCESS 或 FAILED
 * - 成功时发出 PaymentCompleted 事件
 *
 * ## Idempotency
 * 使用相同 idempotencyKey 的重复调用返回缓存结果
 *
 * @param request - 支付详情
 * @param idempotencyKey - 用于去重的唯一键
 * @returns 包含交易 ID 的支付结果
 * @throws PaymentGatewayError 服务不可用时抛出
 */
async function processPayment(
  request: PaymentRequest,
  idempotencyKey: string
): Promise<PaymentResult> {
```

## Middleware Documentation

```typescript
/**
 * 认证中间件
 *
 * ## Behavior
 * - 从 Authorization header 提取 JWT
 * - 验证 token 签名和过期时间
 * - 将用户对象附加到请求上下文
 *
 * ## Error Responses
 * - 401: 缺少或格式错误的 token
 * - 403: token 过期或无效
 */
function authMiddleware(req: Request, res: Response, next: NextFunction) {
```

## Configuration Documentation

```typescript
/**
 * 数据库连接配置
 *
 * ## Environment Variables
 * - DATABASE_URL: 完整连接字符串（覆盖单独设置）
 * - DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD: 组件设置
 *
 * ## Defaults
 * - poolSize: 10 个连接
 * - timeout: 30 秒
 */
interface DatabaseConfig {
  url?: string;
  host?: string;
  port?: number;
}
```
