# Go Comment Rules

适用于 Go 项目的 godoc 注释规范。

## Godoc Format

Go 使用 `godoc` 约定：包注释、导出符号必须注释，注释以被注释对象名称开头。

## Package Comments

```go
// Package auth provides authentication and authorization functionality.
//
// It supports multiple authentication methods including JWT tokens,
// API keys, and OAuth2. The package handles token validation,
// refresh, and revocation.
package auth
```

## Exported Symbols

```go
// TokenManager handles JWT token lifecycle operations.
// It is safe for concurrent use by multiple goroutines.
type TokenManager struct {
    // secretKey is the HMAC secret used for signing tokens.
    secretKey []byte
    
    // ttl defines the default token expiration duration.
    ttl time.Duration
}

// NewTokenManager creates a new TokenManager with the given secret key.
// The secret must be at least 32 bytes for HS256 algorithm.
func NewTokenManager(secret []byte) (*TokenManager, error) {
    if len(secret) < 32 {
        return nil, errors.New("secret key must be at least 32 bytes")
    }
    return &TokenManager{secretKey: secret, ttl: time.Hour}, nil
}

// ValidateToken validates the given token string and returns the claims.
// It returns ErrInvalidToken if the signature is invalid or the token is expired.
func (tm *TokenManager) ValidateToken(token string) (*Claims, error) {
    // implementation
}
```

## Example Functions

```go
// ExampleTokenManager_ValidateToken demonstrates token validation.
func ExampleTokenManager_ValidateToken() {
    tm, _ := NewTokenManager([]byte("super-secret-key-that-is-32-bytes!"))
    
    claims, err := tm.ValidateToken("eyJhbGciOiJIUzI1NiIs...")
    if err != nil {
        log.Fatal(err)
    }
    
    fmt.Println(claims.UserID)
    // Output: 123
}
```

## Inline Comments

```go
// Calculate cache key using consistent hashing
// to ensure even distribution across cache nodes.
key := fmt.Sprintf("user:%d:%s", userID, hash(email))

//nolint:gosec // This is a test-only random generator
nonce := make([]byte, 16)
```

## Nolint Directives

```go
// Single line suppression
result := unsafe.Pointer(ptr) //nolint:unsafe

// Block-level suppression
//nolint:gocyclo // Complex validation logic is intentional
func validateComplexInput(input *ComplexStruct) error {
    // ...
}

// Multiple linters
//nolint:gosec,gocritic // Known issue, accepted risk
password := "hardcoded-for-test"
```

## Avoid

- 重复函数签名已表达的信息
- 注释不以被注释对象名称开头
- 为非导出符号写冗长文档注释
- 用注释掩盖糟糕命名
