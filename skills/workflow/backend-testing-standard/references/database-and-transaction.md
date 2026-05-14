# 数据库与事务测试

## 持久化行为

当变更影响以下内容时，可测试 repository 或集成行为：
- queries；
- filters；
- sorting；
- pagination；
- unique constraints；
- soft delete；
- tenant isolation；
- optimistic locking；
- migrations 或 schema assumptions。

## 事务

多写操作可验证：
- 成功时所有写入都提交；
- 失败时所有写入都回滚；
- 预期 domain errors 不留下部分状态；
- 除非架构支持 compensation，否则外部调用不被错误当成事务的一部分。

## 测试数据

使用真实但最小的 fixtures。避免测试仅因为所有字段为空或默认值而通过。

使用项目既有隔离方式清理测试之间的数据库状态。
