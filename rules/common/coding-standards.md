# Common Coding Standards

Cross-language principles that apply to all code regardless of technology stack.

## Naming & Semantics

- Names describe intent, not implementation details
- Avoid abbreviations; clarity over brevity
- Use consistent vocabulary across the codebase
- Boolean names should imply true/false (isValid, hasPermission)
- Collection names should be plural (users, not userList)

## Function Design

- Single Responsibility: one function does one thing
- Early returns to reduce nesting depth
- Maximum nesting depth: 3 levels
- Functions should be short enough to fit on screen
- Pure functions preferred; minimize side effects
- Avoid flag parameters that change function behavior

## Type Safety

- Prefer explicit types over implicit coercion
- Null/undefined checks at boundaries
- Fail fast on invalid inputs
- Use type system to make invalid states unrepresentable

## Error Handling

- Explicit error handling over silent failures
- Never swallow exceptions without logging
- Distinguish between recoverable and fatal errors
- Provide meaningful error messages with context
- Validate inputs at public API boundaries

## Security

- Validate all external inputs
- Sanitize data before persistence
- Protect against injection attacks
- Never log sensitive information (credentials, tokens, PII)
- Use parameterized queries for database access
- Apply principle of least privilege

## Code Structure

- Related code should be close together
- Dependencies should point inward (stable → unstable)
- Minimize global/shared mutable state
- Prefer immutability where possible
- Separate I/O from business logic
