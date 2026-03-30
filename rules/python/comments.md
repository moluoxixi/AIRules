# Python Comment Rules

适用于 Python 项目的文档字符串和注释规范。

> **注释语言**：注释语言跟随项目所在地区，详见 [common/comments.md](../common/comments.md)。代码示例使用中文注释。

## Docstring Format

推荐 Google Style，也接受 NumPy Style。使用类型注解时，docstring 可省略类型说明。

```python
def fetch_user(user_id: int, include_deleted: bool = False) -> User | None:
    """根据 ID 获取用户

    Args:
        user_id: 用户的唯一标识符
        include_deleted: 是否包含已软删除的用户

    Returns:
        找到则返回用户，否则返回 None

    Raises:
        DatabaseError: 数据库连接失败时抛出
    """
```

## Module-Level Docstring

```python
"""用户认证服务

提供认证和授权功能，包括密码哈希、token 生成和会话管理
"""
```

## Class Docstring

```python
class TokenManager:
    """管理 JWT token 生命周期

    处理 token 创建、验证和刷新操作
    支持并发访问，线程安全

    Attributes:
        secret_key: 用于签名 token 的密钥
        algorithm: JWT 算法（默认：HS256）
    """
```

## Function/Method Docstring

```python
async def validate_token(self, token: str) -> TokenPayload:
    """验证 JWT token 并返回其 payload

    Args:
        token: 待验证的 JWT 字符串

    Returns:
        包含用户声明的解码后 token payload

    Raises:
        TokenExpiredError: token 已过期时抛出
        InvalidTokenError: token 签名无效时抛出
    """
```

## Inline Comments

```python
# 根据查询参数计算缓存键
# 确保跨请求的一致性查找
cache_key = f"users:{hash(query_params)}"

# type: ignore[return-value]  # mypy 对泛型的误报
```

## Type Ignore

```python
# 抑制特定错误码
result = some_third_party_lib()  # type: ignore[no-any-return]

# 模块级忽略（谨慎使用）
# type: ignore[attr-defined]  # 遗留模块缺少 stub 文件
```

## Avoid

- 重复类型注解已表达的信息
- 逐行翻译代码的注释
- 用注释掩盖糟糕命名
