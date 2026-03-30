# Go Rules Overview

适用于 Go 1.21+ 项目，包括微服务、CLI 工具和库开发。

- 标准项目布局：`cmd/`（入口）、`internal/`（私有包）、`pkg/`（公共库）
- 错误处理显式化，使用 `errors.Is/As` 进行错误判断和类型断言
- 并发模式统一：goroutine + channel + `sync` 包，`context` 显式传播
- 接口设计遵循小接口原则，消费者侧定义，组合优于继承
- 依赖注入通过构造函数实现，避免全局状态

## Standard Project Layout

```
myproject/
├── cmd/
│   ├── server/
│   │   └── main.go          # API server entry
│   └── cli/
│       └── main.go          # CLI tool entry
├── internal/
│   ├── domain/              # Business logic (private)
│   ├── infrastructure/      # DB, cache, external clients
│   └── application/         # Use cases, services
├── pkg/
│   ├── validator/           # Public reusable packages
│   └── logger/
├── api/                     # API definitions, proto files
├── configs/                 # Configuration files
├── go.mod
├── go.sum
└── README.md
```

## Error Handling

```go
// Custom error types
var ErrUserNotFound = errors.New("user not found")
var ErrInvalidCredentials = errors.New("invalid credentials")

// Error wrapping with context
if err != nil {
    return fmt.Errorf("failed to fetch user %d: %w", userID, err)
}

// Error checking
if errors.Is(err, ErrUserNotFound) {
    return http.StatusNotFound
}

// Error type assertion
var validationErr *ValidationError
if errors.As(err, &validationErr) {
    return validationErr.Fields
}
```

## Concurrency Patterns

```go
// Worker pool pattern
func ProcessBatch(ctx context.Context, items []Item) error {
    ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
    defer cancel()

    var wg sync.WaitGroup
    errChan := make(chan error, len(items))
    semaphore := make(chan struct{}, 10) // Limit concurrency

    for _, item := range items {
        wg.Add(1)
        go func(i Item) {
            defer wg.Done()
            semaphore <- struct{}{}
            defer func() { <-semaphore }()

            if err := processItem(ctx, i); err != nil {
                errChan <- err
            }
        }(item)
    }

    wg.Wait()
    close(errChan)

    for err := range errChan {
        if err != nil {
            return err
        }
    }
    return nil
}
```

## Interface Design

```go
// Small, focused interfaces (consumer-side definition)
type UserStore interface {
    GetByID(ctx context.Context, id int64) (*User, error)
    Save(ctx context.Context, user *User) error
}

// Constructor injection
type UserService struct {
    store  UserStore
    cache  Cache
    logger *slog.Logger
}

func NewUserService(store UserStore, cache Cache, logger *slog.Logger) *UserService {
    return &UserService{store: store, cache: cache, logger: logger}
}
```
