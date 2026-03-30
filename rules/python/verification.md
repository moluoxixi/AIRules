# Python Verification Rules

适用于 Python 项目的代码质量校验工具配置。

## Type Checking

### mypy (Recommended)

```toml
# pyproject.toml
[tool.mypy]
python_version = "3.11"
strict = true
warn_return_any = true
warn_unused_configs = true
disallow_untyped_defs = true
disallow_incomplete_defs = true
check_untyped_defs = true
ignore_missing_imports = true
```

```bash
mypy src/ tests/
```

### pyright (Alternative)

```bash
pyright --pythonversion 3.11 src/ tests/
```

## Linting

### ruff (Recommended)

```toml
# pyproject.toml
[tool.ruff]
target-version = "py311"
select = ["E", "F", "I", "N", "W", "UP", "B", "C4", "SIM"]
ignore = ["E501"]

[tool.ruff.pydocstyle]
convention = "google"
```

```bash
ruff check src/ tests/
ruff check --fix src/ tests/
```

### flake8 (Legacy)

```bash
flake8 src/ tests/ --max-line-length=88 --extend-ignore=E203
```

## Formatting

### black

```toml
# pyproject.toml
[tool.black]
line-length = 88
target-version = ['py311']
```

```bash
black src/ tests/
```

### ruff format

```bash
ruff format src/ tests/
```

## Import Sorting

### isort

```toml
# pyproject.toml
[tool.isort]
profile = "black"
multi_line_output = 3
line_length = 88
```

```bash
isort src/ tests/
```

## Security Scanning

### bandit

```bash
bandit -r src/ -f json -o bandit-report.json
```

### pip-audit

```bash
pip-audit --desc --format=json --output=audit-report.json
```

## Pre-commit Checklist

```bash
#!/bin/bash
# run-checks.sh

set -e

echo "Running ruff check..."
ruff check src/ tests/

echo "Running ruff format check..."
ruff format --check src/ tests/

echo "Running mypy..."
mypy src/ tests/

echo "Running bandit..."
bandit -r src/ -ll

echo "Running tests..."
pytest tests/ -q

echo "All checks passed!"
```

## CI Integration

```yaml
# .github/workflows/ci.yml
- name: Run verification
  run: |
    ruff check src/ tests/
    ruff format --check src/ tests/
    mypy src/ tests/
    pytest tests/ --cov=src --cov-report=xml
```
