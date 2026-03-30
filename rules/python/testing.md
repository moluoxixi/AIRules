# Python Testing Rules

适用于 Python 项目的测试规范，基于 pytest 框架。

## Test Framework

使用 pytest 作为默认测试框架：

```bash
pytest -v --tb=short tests/
```

## Fixtures

```python
# conftest.py
import pytest
from typing import AsyncGenerator

@pytest.fixture(scope="session")
def event_loop():
    """Create an instance of the default event loop for session."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()

@pytest.fixture
async def db_connection() -> AsyncGenerator[Connection, None]:
    """Provide a database connection for tests."""
    conn = await create_connection()
    yield conn
    await conn.close()

@pytest.fixture(autouse=True)
def reset_mocks():
    """Automatically reset mocks after each test."""
    yield
    mock_registry.clear()
```

## Parametrize

```python
@pytest.mark.parametrize(
    "input_value,expected",
    [
        ("hello", 5),
        ("world", 5),
        ("", 0),
    ],
)
def test_string_length(input_value: str, expected: int) -> None:
    assert len(input_value) == expected
```

## Async Tests

```python
import pytest

@pytest.mark.asyncio
async def test_should_fetch_user_when_id_exists(db_connection: Connection) -> None:
    user = await UserService(db_connection).get_by_id(1)
    assert user is not None
    assert user.id == 1
```

## Mock Usage

```python
from unittest.mock import Mock, patch, AsyncMock

# Monkeypatch fixture
def test_should_retry_when_network_fails(monkeypatch) -> None:
    mock_fetch = AsyncMock(side_effect=[NetworkError(), "success"])
    monkeypatch.setattr("mymodule.fetch_data", mock_fetch)
    
    result = await resilient_fetch()
    assert result == "success"
    assert mock_fetch.call_count == 2

# Context manager patching
with patch("mymodule.time.time") as mock_time:
    mock_time.return_value = 1234567890
    assert get_timestamp() == 1234567890
```

## Test Naming

```python
# Pattern: test_should_<expected>_when_<condition>
def test_should_return_none_when_user_not_found() -> None:
    ...

def test_should_raise_validation_error_when_email_invalid() -> None:
    ...

# Alternative: test_<action>_given_<condition>
def test_create_user_given_duplicate_email() -> None:
    ...
```

## Directory Structure

```
tests/
├── conftest.py          # Shared fixtures
├── unit/
│   ├── test_models.py
│   └── test_services/
│       └── test_user_service.py
├── integration/
│   └── test_api/
│       └── test_users_endpoint.py
└── e2e/
    └── test_workflows.py
```

## Assertions

```python
# Use pytest's built-in assertions
def test_user_equality():
    user = User(id=1, name="Alice")
    assert user.name == "Alice"
    assert user.id > 0
    assert "Alice" in repr(user)
```
