# Python Comment Rules

适用于 Python 项目的文档字符串和注释规范。

## Docstring Format

推荐 Google Style，也接受 NumPy Style。使用类型注解时，docstring 可省略类型说明。

```python
def fetch_user(user_id: int, include_deleted: bool = False) -> User | None:
    """Fetch a user by ID.

    Args:
        user_id: The unique identifier of the user.
        include_deleted: Whether to include soft-deleted users.

    Returns:
        The user if found, None otherwise.

    Raises:
        DatabaseError: If the database connection fails.
    """
```

## Module-Level Docstring

```python
"""User authentication service.

This module provides authentication and authorization functionality,
including password hashing, token generation, and session management.
"""
```

## Class Docstring

```python
class TokenManager:
    """Manages JWT token lifecycle.

    Handles token creation, validation, and refresh operations.
    Thread-safe for concurrent access.

    Attributes:
        secret_key: The key used for signing tokens.
        algorithm: The JWT algorithm (default: HS256).
    """
```

## Function/Method Docstring

```python
async def validate_token(self, token: str) -> TokenPayload:
    """Validate a JWT token and return its payload.

    Args:
        token: The JWT string to validate.

    Returns:
        Decoded token payload containing user claims.

    Raises:
        TokenExpiredError: If the token has expired.
        InvalidTokenError: If the token signature is invalid.
    """
```

## Inline Comments

```python
# Calculate cache key based on query parameters
# to ensure consistent lookup across requests
cache_key = f"users:{hash(query_params)}"

# type: ignore[return-value]  # False positive from mypy with generics
```

## Type Ignore

```python
# Specific error code suppression
result = some_third_party_lib()  # type: ignore[no-any-return]

# Module-level ignore (use sparingly)
# type: ignore[attr-defined]  # Missing stub for legacy module
```

## Avoid

- 重复类型注解已表达的信息
- 逐行翻译代码的注释
- 用注释掩盖糟糕命名
