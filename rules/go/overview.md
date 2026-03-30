# Go Rules Overview

Applicable to Go 1.21+ projects, including microservices, CLI tools, and library development.

- Standard project layout: `cmd/` (entry points), `internal/` (private packages), `pkg/` (public libraries)
- Explicit error handling, use `errors.Is/As` for error checking and type assertions
- Unified concurrency patterns: goroutine + channel + `sync` package, `context` explicit propagation
- Interface design follows small interface principle, consumer-side definition, composition over inheritance
- Dependency injection via constructors, avoid global state

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
