# Rust Comments

Documentation conventions for Rust projects.

## Module Documentation

Use `//!` for crate/module-level documentation:

```rust
//! User authentication and authorization module.
//!
//! Provides JWT token generation, validation, and refresh.
//! All tokens expire after 24 hours by default.

pub mod token;
pub mod validator;
```

## Item Documentation

Use `///` for function, struct, and trait documentation:

```rust
/// Validates a JWT token and extracts user claims.
///
/// # Arguments
///
/// * `token` - The JWT string to validate
/// * `secret` - The HMAC secret used for signing
///
/// # Returns
///
/// Returns `Ok(Claims)` if token is valid, or `Err(AuthError)` if:
/// - Token is expired
/// - Signature is invalid
/// - Token format is malformed
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
/// Configuration for the HTTP server.
///
/// Use `ServerConfig::default()` for development,
/// or load from environment variables in production.
#[derive(Debug, Clone)]
pub struct ServerConfig {
    /// Bind address (e.g., "127.0.0.1:8080")
    pub bind_addr: String,

    /// Request timeout in seconds
    pub timeout_secs: u64,

    /// Maximum concurrent connections
    pub max_connections: usize,
}
```

## Code Examples

All public API items should include runnable examples:

```rust
/// Parses a date string in ISO 8601 format.
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
/// Invalid dates return an error:
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
/// Divides two numbers.
///
/// # Panics
///
/// Panics if `divisor` is zero.
pub fn divide(dividend: f64, divisor: f64) -> f64 {
    assert!(divisor != 0.0, "division by zero");
    dividend / divisor
}
```
