# Common Testing Standards

Cross-language principles for writing effective tests.

## Test Pyramid

- Prioritize tests by: Unit > Integration > E2E
- Unit tests: fast, isolated, test business logic
- Integration tests: verify component interactions
- E2E tests: cover critical user paths only
- Focus on critical paths first; not all code needs equal coverage

## Test Structure

- Follow Arrange-Act-Assert pattern
- One logical assertion per test (single concept)
- Test names describe behavior: `should_do_something_when_condition`
- Group related tests logically
- Keep test setup simple and explicit

## Coverage Goals

- Core business logic: minimum 80% coverage
- Utility functions: 100% coverage
- Infrastructure/boilerplate: coverage optional
- Focus on meaningful assertions, not just line coverage

## Test Data

- Use factory functions or builders for test data
- Avoid shared mutable test state
- Prefer deterministic data over random values
- Document non-obvious test data choices

## Mocking

- Mock external dependencies (databases, APIs, file system)
- Minimize mocking of internal code
- Never mock what you don't own without abstraction
- Verify interactions only when behavior depends on them

## Snapshot Testing

- Limit to stable UI components or API contracts
- Review snapshot diffs carefully in code review
- Avoid snapshots for frequently changing data
- Document when snapshots need updating

## MCP Test Integration

- Leverage MCP tools to execute tests in target environments
- Use MCP to retrieve and analyze test reports
- Establish automated feedback loop: test results → analysis → fixes
- Document MCP test execution steps for reproducibility
