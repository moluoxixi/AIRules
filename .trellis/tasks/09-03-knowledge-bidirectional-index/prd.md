# 为双角色知识库增加双向关系与一致性门禁

## Goal

为 Trellis 与 moluoxixi 的知识扩展建立可追踪的 source 与 library asset 关系，使 source 新增、修改或删除后能够立即定位受影响资产，并在关系未修复时阻止错误确认。

## Background

- 两个角色已有同构知识扩展，分别使用 `.trellis/knowledge/` 和 `.moluoxixi/knowledge/`。
- 当前扫描器只把 source 路径、SHA-256 和大小写入 `.state.json`；library 页面中的 `sources` 仅是 Skill 文档约定，没有运行时解析或反向查询。
- 当前 `acknowledge` 不校验 library，因此即使页面继续引用已删除 source，批次仍可被确认并转为 `pending: false`。
- Hook 的职责是自动检测并向 AI 注入上下文；语义整理继续由对应 knowledge Skill 完成。

## Requirements

- Trellis 与 moluoxixi 必须提供相同的关系、影响分析和校验行为，仅根目录和 Skill 名称不同。
- 每个角色的知识根目录增加一个受版本控制的 `relations.json`，作为唯一机器可读关系账本。
- 关系账本按稳定 asset ID 记录 library 页面、source 相对路径、可选 selector 和整理时确认的 source SHA-256；source 到 asset 的反向关系必须由运行时派生，不维护第二份独立事实源。
- `.state.json` 保存上次成功确认的 source 快照和关系快照，使 source 或当前关系先被删除时仍能定位此前受影响的资产。
- `status --json` 和 Hook 上下文必须报告 source 变更对应的受影响 asset，并报告关系完整性问题。
- `acknowledge` 必须拒绝以下状态：变更 source 未被任何 asset 表示、asset 页面不存在、关系引用不存在的 source、关系中的 source 哈希过期、关系路径越出知识根目录、关系文件格式或版本无效。
- source 修改但知识语义不变时，整理者仍须显式更新关系中的 source 哈希，表示已审查该版本。
- source 删除后，整理者必须删除对应关系、删除整个 asset，或保留 asset 的其它有效 source；不得留下悬空关系。
- Hook 保持自动触发和上下文注入，不在 Hook 进程中启动另一个 AI，也不直接执行语义改写。
- 现有集中式 runtime 布局保持不变；宿主 Hook 配置继续调用角色目录中的 `knowledge-hook.py`。
- 版本 1 的 `.state.json` 必须可读取并平滑升级，重复初始化和 `--force` 必须保留 `sources/`、`library/`、`index.md` 和 `relations.json`。
- 对应 knowledge Skill 和组织规范必须说明关系账本的维护步骤、删除语义及确认门禁。
- 角色专属测试继续放在 `roles/trellis/__test__/` 与 `roles/moluoxixi/__test__/`。

## Acceptance Criteria

- [x] 新增 source 时，状态列出该 source；在建立带当前哈希的 asset 关系前，`acknowledge` 失败。
- [x] 修改 source 时，状态同时列出 source 和所有关联 asset；在相关关系更新到当前哈希前，`acknowledge` 失败。
- [x] 删除 source 时，即使当前关系也被提前删除，状态仍能依据上次确认快照列出此前关联 asset。
- [x] asset 页面缺失、source 悬空、哈希过期或关系账本无效时，状态给出稳定、可测试的错误，`acknowledge` 失败。
- [x] 修复 library 与 `relations.json` 后可以确认批次，第二次状态检查返回 `pending: false` 且无完整性问题。
- [x] Hook 注入内容包含受影响 asset 和关系错误，不复制执行语义整理。
- [x] 版本 1 状态文件继续可读；成功确认后写为新版本并包含关系快照。
- [x] Trellis 与 moluoxixi 的定向测试全部通过，并验证两套模板行为一致。

## Out of Scope

- 向量数据库、全文检索、embedding 或后台常驻 watcher。
- claim/段落级依赖图；本次最小粒度为 canonical library asset 页面。
- 自动判断知识内容是否在语义上正确；门禁验证可追踪性、显式审查版本和结构一致性。
- 修改 `roles/moluoxixi/packages` 外部基线或改变宿主原生 Hook 协议。
- 自动修改 `sources/`；它始终是用户或外部同步流程管理的输入。
