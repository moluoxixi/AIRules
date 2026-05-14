# API 与契约验证

## API 行为

可验证受变更影响的 API 表面：
- route 和 method；
- request shape；
- validation failures；
- response shape；
- status code；
- error body；
- 相关 headers 或 cookies；
- pagination、sorting、filtering 或 idempotency 语义。

## 契约测试

当客户端依赖稳定行为时，可使用契约或集成测试，尤其是 public APIs、microservice boundaries、webhooks、SDK-facing endpoints 或跨团队契约。

更新 snapshot 或 schema 前，应确认 API 变化是有意设计。

## 错误契约

失败响应应足够显式和稳定，便于客户端处理。除非 API 契约明确规定，不要把后端失败转换成带空数据的 HTTP 200。
