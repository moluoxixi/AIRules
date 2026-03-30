# Common Git Conventions

Version control standards for all projects.

## Commit Messages

Follow Conventional Commits specification:

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation changes
- `style:` - Formatting, missing semicolons, etc; no code change
- `refactor:` - Code refactoring
- `perf:` - Performance improvements
- `test:` - Adding or updating tests
- `chore:` - Build process, dependencies, tooling

### Subject Rules

- Use imperative mood ("add" not "added" or "adds")
- Don't capitalize first letter
- No period at the end
- Maximum 50 characters

### Body Rules

- Explain what and why, not how
- Wrap at 72 characters
- Reference issues/tickets when applicable

## Branch Naming

Format: `<type>/<description>`

Prefixes:
- `feature/` - New features
- `fix/` - Bug fixes
- `refactor/` - Code refactoring
- `docs/` - Documentation updates
- `chore/` - Maintenance tasks

Examples:
- `feature/user-authentication`
- `fix/login-redirect-loop`
- `docs/api-endpoints`

## Pull Request Requirements

### Title

- Same format as commit subject: `type: description`
- Clear summary of changes

### Description Template

```markdown
## Summary
Brief description of changes

## Changes
- List of specific changes made

## Testing
- How changes were tested
- Test results

## Related
- Links to related issues/tickets
```

### Review Checklist

- [ ] Code follows project conventions
- [ ] Tests added/updated and passing
- [ ] Documentation updated if needed
- [ ] No lint/type errors
- [ ] Self-review completed

## Merge Strategy

- Prefer squash merge for feature branches
- Keep commit history clean on main branch
- Delete branches after merge
