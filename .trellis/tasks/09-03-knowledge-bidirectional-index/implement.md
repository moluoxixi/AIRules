# 双角色知识关系索引实施计划

## Steps

- [x] 在 Trellis runtime 中定义并解析 `relations.json`，校验 schema 与安全路径。
- [x] 将 state 升级为兼容读取 v1、写入 v2，并把关系内容纳入 batch ID。
- [x] 扩展 status 结果，计算 source 变更对应的 asset 并生成关系完整性错误。
- [x] 扩展 Hook 上下文，输出有界的 impacted asset 与关系错误。
- [x] 为 acknowledge 增加关系门禁，并在成功后原子保存关系快照。
- [x] 同步相同实现到 moluoxixi runtime，仅保留知识根目录和文案命名差异。
- [x] 更新两套 knowledge Skill、组织规范、初始化说明和项目知识模板。
- [x] 扩展两套角色测试，覆盖新增、修改、删除、悬空 page/source、过期哈希、无效 JSON、v1 迁移和 re-init 保留。
- [x] 对两套 runtime 做结构差异检查，确认差异仅为角色命名空间。

## Validation

```powershell
pnpm vitest run roles/trellis/__test__/trellis-knowledge-extension.test.ts
pnpm vitest run roles/moluoxixi/__test__/knowledge-extension.test.ts
pnpm vitest run roles/trellis/__test__/init-project.test.ts roles/moluoxixi/__test__/init-project.test.ts
```

随后运行仓库提供的 lint/type-check 或等价质量门禁，并检查 `git diff --check`。

## Risk And Rollback Points

- `common/knowledge.py` 是 scanner、Hook 和 CLI 的共享边界，每一步先在 Trellis 副本实现并跑定向测试，再同步 moluoxixi。
- batch ID 合同变化会使进行中的旧批次失效，这是预期并发保护；测试必须锁定行为。
- 不修改用户已有的 `sources/`、`library/` 或 `index.md`，测试使用临时项目。
- 不触碰当前工作区中用户已修改的 `scripts/migrate-project.mjs` 与对应测试。
