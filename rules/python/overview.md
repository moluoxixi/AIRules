# Python Rules Overview

适用于 Python 3.10+ 项目，包括 Web 服务、CLI 工具和数据处理应用。

- 类型提示优先，关键接口使用 `typing.Protocol` 定义契约
- 项目结构遵循 src layout，`pyproject.toml` 统一管理配置
- 异步代码统一使用 `asyncio`，显式传播 `async`/`await`
- 模块边界清晰，避免循环导入，依赖通过构造函数注入
- 文档与类型注解同步维护

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
