---
name: go-patterns
description: "Use when building or refactoring Go applications, including project layout, error handling, concurrency patterns, and testing"
---

# Go Patterns

## Overview

Best practices for Go 1.21+ applications: standard project layout, explicit error handling, concurrency patterns, and interface design.

## When to Use

- Building new Go services, CLIs, or libraries
- Refactoring Go codebases
- Implementing concurrent operations
- Designing Go interfaces

## Core Patterns

### Standard Project Layout

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
│   └── validator/           # Public reusable packages
├── api/                     # API definitions
├── go.mod
└── go.sum
```

### Error Handling

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

### Concurrency Patterns

```go
// Worker pool pattern
func ProcessBatch(ctx context.Context, items []Item) error {
    ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
    defer cancel()

    var wg sync.WaitGroup
    errChan := make(chan error, len(items))
    semaphore := make(chan struct{}, 10)

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

### Interface Design

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

## Review Checklist

- Are errors wrapped with sufficient context?
- Is context propagated through the call chain?
- Are goroutines properly synchronized?
- Are interfaces small and focused?
- Is dependency injection used instead of globals?

## Related Rules

- `rules/go/overview.md` - Go architecture principles
- `rules/go/comments.md` - Go doc comment conventions
- `rules/go/testing.md` - Standard testing patterns
- `rules/go/verification.md` - golangci-lint configuration

## Verification Requirements

- golangci-lint passes with zero errors
- go test ./... passes
- gosec security scan passes
- go mod tidy produces no changes
- gofmt formatting applied
