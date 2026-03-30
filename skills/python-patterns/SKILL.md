---
name: python-patterns
description: "Use when building or refactoring Python applications, including project structure, type hints, async patterns, and testing"
---

# Python Patterns

## Overview

Best practices for Python 3.10+ applications: project structure, type hints, async patterns, and testing strategies.

## When to Use

- Building new Python services or tools
- Refactoring Python codebases
- Setting up Python project structure
- Implementing async code

## Core Patterns

### Project Structure (src layout)

```
myproject/
├── src/
│   └── myproject/
│       ├── __init__.py
│       ├── models.py
│       ├── services/
│       │   ├── __init__.py
│       │   └── user_service.py
│       └── utils/
│           └── validators.py
├── tests/
│   ├── __init__.py
│   ├── conftest.py
│   └── test_services/
├── pyproject.toml
└── README.md
```

### Type Hints

```python
from typing import Protocol, TypeVar, TypeAlias

# Protocol for structural subtyping
class CacheBackend(Protocol):
    async def get(self, key: str) -> bytes | None: ...
    async def set(self, key: str, value: bytes, ttl: int) -> None: ...

# TypeVar with constraints
T = TypeVar("T", bound="BaseModel")

# TypeAlias for complex types
JSONValue: TypeAlias = dict[str, "JSONValue"] | list["JSONValue"] | str | int | float | bool | None
```

### Async Patterns

```python
from contextlib import asynccontextmanager

@asynccontextmanager
async def managed_resource():
    resource = await create_resource()
    try:
        yield resource
    finally:
        await resource.close()

# Use in async context
async with managed_resource() as res:
    await res.process()
```

### Error Handling

```python
# Custom exceptions
class ValidationError(Exception):
    def __init__(self, field: str, message: str):
        self.field = field
        self.message = message
        super().__init__(f"{field}: {message}")

# Explicit error propagation
def process_data(data: dict) -> Result:
    if not data.get("required_field"):
        raise ValidationError("required_field", "Missing required field")
    return transform(data)
```

## Review Checklist

- Are type hints used for public APIs?
- Is project structure following src layout?
- Are async contexts properly managed?
- Are custom exceptions meaningful?
- Can business logic be tested without I/O?

## Related Rules

- `rules/python/overview.md` - Python architecture principles
- `rules/python/comments.md` - Python docstring conventions
- `rules/python/testing.md` - pytest patterns
- `rules/python/verification.md` - ruff/mypy configuration

## Verification Requirements

- ruff passes with zero errors
- mypy/pyright type check passes
- pytest tests pass
- bandit security scan passes
- No unused imports
