# Rust Comments

Documentation conventions for Rust projects.

> **注释语言**：注释语言跟随项目所在地区，详见 [common/comments.md](../common/comments.md)。代码示例使用中文注释。

## Module Documentation

Use `//!` for crate/module-level documentation:

```rust
//! 用户认证和授权模块
//!
//! 提供 JWT token 生成、验证和刷新功能
//! 默认所有 token 24 小时后过期

pub mod token;
pub mod validator;
```

## Item Documentation

Use `///` for function, struct, and trait documentation:

```rust
/// 验证 JWT token 并提取用户声明
///
/// # Arguments
///
/// * `token` - 待验证的 JWT 字符串
/// * `secret` - 用于签名的 HMAC 密钥
///
/// # Returns
///
/// 如果 token 有效返回 `Ok(Claims)`，否则返回 `Err(AuthError)`：
/// - Token 已过期
/// - 签名无效
/// - Token 格式错误
///
/// # Examples
///
/// ```
/// use auth::validate_token;
///
/// let claims = validate_token(token, &secret)?;
/// println!("User: {}", claims.sub);
/// ```
pub fn validate_token(token: &str, secret: &[u8]) -> Result<Claims, AuthError> {
```

## Struct Documentation

```rust
/// HTTP 服务器配置
///
/// 开发环境使用 `ServerConfig::default()`，
/// 生产环境从环境变量加载
#[derive(Debug, Clone)]
pub struct ServerConfig {
    /// 绑定地址（如 "127.0.0.1:8080"）
    pub bind_addr: String,

    /// 请求超时时间（秒）
    pub timeout_secs: u64,

    /// 最大并发连接数
    pub max_connections: usize,
}
```

## Code Examples

All public API items should include runnable examples:

```rust
/// 解析 ISO 8601 格式的日期字符串
///
/// # Examples
///
/// ```
/// use mycrate::parse_date;
///
/// let date = parse_date("2024-01-15").unwrap();
/// assert_eq!(date.year(), 2024);
/// ```
///
/// 无效日期返回错误：
///
/// ```
/// use mycrate::parse_date;
///
/// assert!(parse_date("not-a-date").is_err());
/// ```
pub fn parse_date(input: &str) -> Result<Date, ParseError> {
```

## Panic Documentation

Document panic conditions with `# Panics`:

```rust
/// 两数相除
///
/// # Panics
///
/// 当 `divisor` 为零时 panic
pub fn divide(dividend: f64, divisor: f64) -> f64 {
    assert!(divisor != 0.0, "division by zero");
    dividend / divisor
}
```
