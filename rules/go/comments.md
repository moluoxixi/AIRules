# Go Comment Rules

适用于 Go 项目的 godoc 注释规范。

> **注释语言**：注释语言跟随项目所在地区，详见 [common/comments.md](../common/comments.md)。代码示例使用中文注释。

## Godoc Format

Go 使用 `godoc` 约定：包注释、导出符号必须注释，注释以被注释对象名称开头。

## Package Comments

```go
// Package auth 提供认证和授权功能
//
// 支持多种认证方式，包括 JWT token、API key 和 OAuth2
// 处理 token 验证、刷新和撤销
package auth
```

## Exported Symbols

```go
// TokenManager 处理 JWT token 生命周期操作
// 可安全地用于多个 goroutine 并发访问
type TokenManager struct {
    // secretKey 用于签名 token 的 HMAC 密钥
    secretKey []byte
    
    // ttl 定义默认的 token 过期时长
    ttl time.Duration
}

// NewTokenManager 使用给定的密钥创建新的 TokenManager
// 密钥长度必须至少为 32 字节，用于 HS256 算法
func NewTokenManager(secret []byte) (*TokenManager, error) {
    if len(secret) < 32 {
        return nil, errors.New("secret key must be at least 32 bytes")
    }
    return &TokenManager{secretKey: secret, ttl: time.Hour}, nil
}

// ValidateToken 验证给定的 token 字符串并返回声明信息
// 如果签名无效或 token 已过期，返回 ErrInvalidToken
func (tm *TokenManager) ValidateToken(token string) (*Claims, error) {
    // implementation
}
```

## Example Functions

```go
// ExampleTokenManager_ValidateToken 演示 token 验证
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
// 使用一致性哈希计算缓存键
// 确保在缓存节点间均匀分布
key := fmt.Sprintf("user:%d:%s", userID, hash(email))

//nolint:gosec // 仅用于测试的随机数生成器
nonce := make([]byte, 16)
```

## Nolint Directives

```go
// 单行抑制
result := unsafe.Pointer(ptr) //nolint:unsafe

// 块级抑制
//nolint:gocyclo // 复杂的验证逻辑是故意设计的
func validateComplexInput(input *ComplexStruct) error {
    // ...
}

// 多个 linter
//nolint:gosec,gocritic // 已知问题，已接受风险
password := "hardcoded-for-test"
```

## Avoid

- 重复函数签名已表达的信息
- 注释不以被注释对象名称开头（英文规则，中文注释可灵活处理）
- 为非导出符号写冗长文档注释
- 用注释掩盖糟糕命名
