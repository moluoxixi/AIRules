# Go Testing Rules

适用于 Go 项目的测试规范。

## Table-Driven Tests

```go
func TestValidateEmail(t *testing.T) {
    tests := []struct {
        name    string
        email   string
        wantErr bool
    }{
        {"valid email", "user@example.com", false},
        {"missing @", "userexample.com", true},
        {"empty string", "", true},
        {"valid with plus", "user+tag@example.com", false},
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            err := ValidateEmail(tt.email)
            if (err != nil) != tt.wantErr {
                t.Errorf("ValidateEmail(%q) error = %v, wantErr %v", 
                    tt.email, err, tt.wantErr)
            }
        })
    }
}
```

## Testify Assertions

```go
import (
    "testing"
    "github.com/stretchr/testify/assert"
    "github.com/stretchr/testify/require"
)

func TestUserService_Create(t *testing.T) {
    svc := NewUserService(mockStore)
    
    user, err := svc.Create(context.Background(), "alice@example.com")
    
    require.NoError(t, err)           // Fatal if error
    assert.Equal(t, "alice@example.com", user.Email)
    assert.NotZero(t, user.ID)
    assert.WithinDuration(t, time.Now(), user.CreatedAt, time.Second)
}
```

## Parallel Tests

```go
func TestUserRepository_GetByID(t *testing.T) {
    t.Parallel() // Enable parallel execution
    
    tests := []struct{ name string; id int64 }{
        {"existing user", 1},
        {"non-existing user", 999},
    }
    
    for _, tt := range tests {
        tt := tt // Capture range variable
        t.Run(tt.name, func(t *testing.T) {
            t.Parallel()
            
            repo := setupTestRepo(t)
            _, err := repo.GetByID(context.Background(), tt.id)
            // assertions...
        })
    }
}
```

## Test Helpers

```go
func setupTestRepo(t *testing.T) *UserRepository {
    t.Helper() // Mark as helper for better error reporting
    
    db := testutil.NewTestDB(t)
    t.Cleanup(func() { db.Close() })
    
    return NewUserRepository(db)
}

func mustCreateUser(t *testing.T, svc *UserService, email string) *User {
    t.Helper()
    
    user, err := svc.Create(context.Background(), email)
    require.NoError(t, err, "failed to create user")
    return user
}
```

## Mock Generation

```go
//go:generate mockgen -source=store.go -destination=mocks/store_mock.go -package=mocks

type UserStore interface {
    GetByID(ctx context.Context, id int64) (*User, error)
    Save(ctx context.Context, user *User) error
}

// Usage in test
func TestUserService_GetUser(t *testing.T) {
    ctrl := gomock.NewController(t)
    defer ctrl.Finish()
    
    mockStore := mocks.NewMockUserStore(ctrl)
    mockStore.EXPECT().
        GetByID(gomock.Any(), int64(1)).
        Return(&User{ID: 1, Email: "test@example.com"}, nil)
    
    svc := NewUserService(mockStore, nil, nil)
    user, err := svc.GetUser(context.Background(), 1)
    
    require.NoError(t, err)
    assert.Equal(t, "test@example.com", user.Email)
}
```

## Integration Tests

```go
//go:build integration

package repository_test

func TestUserRepository_Integration(t *testing.T) {
    if testing.Short() {
        t.Skip("skipping integration test")
    }
    
    db := setupTestDatabase(t)
    repo := NewUserRepository(db)
    
    ctx := context.Background()
    user, err := repo.Create(ctx, &User{Email: "test@example.com"})
    
    require.NoError(t, err)
    assert.NotZero(t, user.ID)
}
```

## Benchmark Tests

```go
func BenchmarkHashPassword(b *testing.B) {
    password := []byte("my-secret-password")
    
    b.ResetTimer()
    for i := 0; i < b.N; i++ {
        _, err := HashPassword(password)
        if err != nil {
            b.Fatal(err)
        }
    }
}

func BenchmarkValidateToken(b *testing.B) {
    tm, _ := NewTokenManager([]byte("secret-key-32-bytes-long!!!!!"))
    token, _ := tm.GenerateToken(&Claims{UserID: 1})
    
    b.ResetTimer()
    for i := 0; i < b.N; i++ {
        _, _ = tm.ValidateToken(token)
    }
}
```
