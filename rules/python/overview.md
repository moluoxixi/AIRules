# Python Rules Overview

Applicable to Python 3.10+ projects, including web services, CLI tools, and data processing applications.

- Type hints prioritized, use `typing.Protocol` to define contracts for key interfaces
- Project structure follows src layout, `pyproject.toml` for unified configuration management
- Async code uniformly uses `asyncio`, explicit propagation of `async`/`await`
- Clear module boundaries, avoid circular imports, dependencies injected via constructors
- Documentation and type annotations maintained in sync

## Type Hints

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

## Project Structure

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
│           ├── __init__.py
│           └── validators.py
├── tests/
│   ├── __init__.py
│   ├── conftest.py
│   └── test_services/
├── pyproject.toml
└── README.md
```

## Async Patterns

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
