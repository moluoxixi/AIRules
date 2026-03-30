# Rust Testing

Testing standards for Rust projects.

## Test Organization

```
src/
  lib.rs
  parser.rs
tests/
  integration_tests.rs    # Integration tests
  fixtures/
    sample_data.json
```

## Unit Tests

Use `#[test]` for synchronous tests:

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn should_parse_valid_email() {
        let result = Email::parse("user@example.com");
        assert!(result.is_ok());
    }

    #[test]
    fn should_reject_invalid_email() {
        let result = Email::parse("not-an-email");
        assert!(result.is_err());
    }
}
```

## Async Tests

Use `#[tokio::test]` for async tests:

```rust
#[tokio::test]
async fn should_fetch_user_from_api() {
    let client = ApiClient::new("https://api.example.com");
    let user = client.get_user(1).await.unwrap();

    assert_eq!(user.id, 1);
}
```

## Property-Based Testing

Use `proptest` for property tests:

```rust
use proptest::prelude::*;

proptest! {
    #[test]
    fn reverse_reverse_is_identity(s in "\\PC*") {
        let reversed: String = s.chars().rev().collect();
        let double_reversed: String = reversed.chars().rev().collect();
        prop_assert_eq!(s, double_reversed);
    }
}
```

## Integration Tests

Place in `tests/` directory:

```rust
// tests/api_tests.rs
use mycrate::ApiClient;

#[tokio::test]
async fn health_check_returns_ok() {
    let client = ApiClient::new("http://localhost:8080");
    let response = client.health_check().await;

    assert!(response.is_ok());
}
```

## Test Helpers

```rust
#[cfg(test)]
pub mod test_helpers {
    use super::*;

    pub fn create_test_user() -> User {
        User {
            id: 1,
            name: "Test User".to_string(),
            email: "test@example.com".to_string(),
        }
    }
}
```

## Test Commands

```bash
# Run all tests
cargo test

# Run with output
cargo test -- --nocapture

# Run specific test
cargo test should_parse_valid_email

# Run integration tests only
cargo test --test integration_tests

# Run with coverage
cargo tarpaulin --out Html
```
