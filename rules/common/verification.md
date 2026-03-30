# Common Verification Standards

Cross-language quality gates that must pass before code is considered complete.

## Static Analysis

- Lint must pass with zero errors
- Target zero warnings; suppress only with documented justification
- No unused variables, imports, or dead code
- Consistent code style across the codebase

## Type Safety

- Type checker must pass with no errors
- No implicit any or equivalent escape hatches
- All public API signatures must be explicitly typed

## Build Verification

- Clean build must succeed
- No build warnings that indicate potential issues
- Output artifacts generated correctly
- Build reproducible (same input produces same output)

## Security Scanning

- Dependency vulnerability scan must pass
- No high or critical severity vulnerabilities in dependencies
- Secrets/credentials must not be committed
- Security-sensitive code paths reviewed

## Formatting

- Consistent formatting across all source files
- Automated formatting applied to all relevant file types
- No manual formatting debates in code review

## Pre-Commit Checklist

Before marking any task complete, verify:

- [ ] Lint passes with zero errors
- [ ] Type check passes
- [ ] Tests pass (unit and relevant integration)
- [ ] Build succeeds
- [ ] Security scan passes
- [ ] Formatting is consistent

## Verification Failure Response

- Fix issues at the source, don't bypass checks
- If suppression is necessary, document why and when it can be removed
- Never commit with "will fix later" assumptions
