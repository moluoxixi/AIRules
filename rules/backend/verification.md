# Backend Verification

Cross-framework quality gates for backend projects.

## Static Analysis

| Tool | Purpose | Languages |
|------|---------|-----------|
| ESLint | Code linting | Node.js |
| Checkstyle/SpotBugs | Code quality | Java |
| Clippy | Linting | Rust |
| golangci-lint | Linting | Go |

## API Specification Validation

```bash
# Validate OpenAPI spec
swagger-codegen validate -i api.yaml

# Check for breaking changes
oasdiff diff base.yaml revision.yaml
```

## Database Migration Validation

```bash
# Check migrations are reversible
npm run migration:up
npm run migration:down
npm run migration:up

# Validate schema matches entities
npm run schema:validate
```

## Security Scanning

```bash
# Dependency vulnerabilities
npm audit

# Static security analysis
npm run security:scan

# Secret detection
git-secrets --scan
```

## Build Verification

```bash
# TypeScript compilation
npx tsc --noEmit

# Java compilation
mvn compile

# Rust compilation
cargo build --release
```

## Pre-Commit Checklist

- [ ] Lint passes with zero errors
- [ ] Type check passes
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] API spec is valid
- [ ] No security vulnerabilities (high/critical)
- [ ] Database migrations are reversible

## Container Security

```bash
# Scan Docker image
trivy image myapp:latest

# Check for misconfigurations
docker-bench-security
```

## Performance Checks

```bash
# Load testing
k6 run load-test.js

# Database query analysis
EXPLAIN ANALYZE SELECT * FROM users WHERE email = 'test@example.com';
```

## CI Pipeline

```yaml
verify:
  steps:
    - lint
    - type-check
    - unit-tests
    - integration-tests
    - security-scan
    - build
    - migration-check
```
