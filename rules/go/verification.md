# Go Verification Rules

适用于 Go 项目的代码质量校验工具配置。

## Built-in Tools

### go vet

```bash
go vet ./...
```

### go fmt

```bash
go fmt ./...
```

### goimports

```bash
goimports -w -local github.com/myorg/myproject .
```

## golangci-lint

### Configuration

```yaml
# .golangci.yml
run:
  timeout: 5m
  go: "1.21"

linters:
  enable:
    - errcheck      # Unchecked errors
    - gosimple      # Simplify code
    - govet         # Vet analysis
    - ineffassign   # Unused assignments
    - staticcheck   # Advanced analysis
    - unused        # Unused code
    - gocritic      # Style and performance
    - gosec         # Security issues
    - revive        # Drop-in replacement for golint
    - misspell      # Misspelled words
    - gofmt         # Formatting
    - goimports     # Import formatting

linters-settings:
  gocritic:
    enabled-tags:
      - performance
      - style
      - experimental
  gosec:
    excludes:
      - G104  # Audit errors not checked

issues:
  exclude-use-default: false
  max-issues-per-linter: 0
  max-same-issues: 0
```

### Commands

```bash
# Run all linters
golangci-lint run

# Run with auto-fix
golangci-lint run --fix

# Run on specific path
golangci-lint run ./internal/... ./pkg/...
```

## staticcheck

```bash
# Install
 go install honnef.co/go/tools/cmd/staticcheck@latest

# Run
staticcheck ./...
```

## govulncheck

```bash
# Install
go install golang.org/x/vuln/cmd/govulncheck@latest

# Run
govulncheck ./...

# With verbose output
govulncheck -show verbose ./...
```

## Pre-commit Checklist

```bash
#!/bin/bash
# run-checks.sh

set -e

echo "Running go fmt..."
go fmt ./...

echo "Running goimports..."
goimports -w -local github.com/myorg/myproject .

echo "Running go vet..."
go vet ./...

echo "Running golangci-lint..."
golangci-lint run

echo "Running staticcheck..."
staticcheck ./...

echo "Running govulncheck..."
govulncheck ./...

echo "Running tests..."
go test -race -coverprofile=coverage.out ./...

echo "All checks passed!"
```

## CI Integration

```yaml
# .github/workflows/ci.yml
name: CI

on: [push, pull_request]

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - uses: actions/setup-go@v5
        with:
          go-version: '1.21'
      
      - name: Run go vet
        run: go vet ./...
      
      - name: Run golangci-lint
        uses: golangci/golangci-lint-action@v3
        with:
          version: latest
      
      - name: Run govulncheck
        run: |
          go install golang.org/x/vuln/cmd/govulncheck@latest
          govulncheck ./...
      
      - name: Run tests
        run: go test -race -coverprofile=coverage.out ./...
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          file: ./coverage.out
```

## Makefile Targets

```makefile
.PHONY: lint test verify

lint:
	gofmt -w .
	goimports -w -local github.com/myorg/myproject .
	golangci-lint run

test:
	go test -v -race -coverprofile=coverage.out ./...

test-integration:
	go test -v -tags=integration ./...

verify: lint test
	go vet ./...
	staticcheck ./...
	govulncheck ./...
```
