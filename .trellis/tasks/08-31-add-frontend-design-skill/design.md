# 技术设计

## 1. 能力边界

公共 capability 只描述可以跨角色复用、按需组合的 skills 与 MCP。角色自身的 CLI、`init-project`、hooks、agents、packages 和 `role-assets` 继续由角色直接拥有。

| Capability | Skills | MCP | 用途 |
|---|---|---|---|
| `common` | AIRules `skills/common` 下的 `create-skill`、`spec-organization` | 无 | 跨角色基础技能 |
| `coding` | 无 | `codegraph`、`context7`、`sequential-thinking` | 通用代码理解与开发支持 |
| `frontend` | Anthropic `frontend-design` | `playwright` | 前端设计、浏览器检查与 UI 验证 |
| `productivity` | Matt Pocock `skills/productivity` namespace | 无 | 通用工作效率技能 |
| `engineering` | Matt Pocock `skills/engineering` namespace | 无 | Matt 角色的工程技能集合 |

`init-project` 不进入 capability registry：它依赖角色 CLI、workflow 根目录和品牌化路径，是 role-owned orchestration。

## 2. 角色能力矩阵

| Role | Capabilities | Role-owned assets |
|---|---|---|
| `trellis` | `common`, `coding`, `productivity`, `frontend` | Trellis CLI setup、`roles/trellis`、Trellis init-project |
| `moluoxixi` | `common`, `coding`, `productivity`, `frontend` | Moluoxixi packages、`roles/moluoxixi`、Moluoxixi init-project |
| `matt` | `engineering`, `productivity` | `roles/matt` |

每个 `roles/<role>/constants/skills.ts` 显式导出 `capabilities`，并把 role-owned vendor 交给公共 composer。最终仍导出兼容现有安装器的 `vendors: VendorRepo[]`。

## 3. 目录与模块

```text
capabilities/
  types.ts             # CapabilityName / CapabilityDefinition / composer contract
  index.ts             # registry、校验、稳定组合入口
  common.ts
  coding.ts
  frontend.ts
  productivity.ts
  engineering.ts
mcps/
  code/mcps.json       # codegraph、context7、sequential-thinking
  frontend/mcps.json   # playwright
roles/<role>/constants/skills.ts
```

`tsconfig.build.json` 增加 `capabilities/**/*.ts`。capability 模块是仓库内部的共享角色配置，不新增 npm public export。

## 4. 组合数据流

```text
role-owned VendorRepo + role capabilities
  -> capability registry
  -> 将 AIRules 自有 projection 追加到 role vendor
  -> 按 vendor name/source/revision 合并第三方 projection
  -> 稳定顺序的 VendorRepo[]
  -> 现有 loadVendorManifest()
  -> 现有 vendor staging
  -> ~/.agents/skills + host MCP projection
```

composer 不读取文件系统、不执行 setup、不安装资产。它只完成纯配置展开，并满足：

- capability 顺序决定首次出现顺序；同一 capability 不允许重复声明。
- 同名 vendor 的 source/revision/setup 不一致时立即失败。
- 相同 projection 只保留一次；相同目标来自不同源时失败。
- 输入对象不被原地修改，多个角色 import 不会相互污染。
- downstream 的 skill frontmatter、MCP server 名称和路径边界校验继续保留。

## 5. Frontend 能力

`frontend.ts` 固定 Anthropic repo commit `3b3fad96af16a10759d930941b4520ba0c40edae`，使用 `kind: skills` 精确选择 `skills/frontend-design`。Playwright 从 `mcps/code/mcps.json` 移到 `mcps/frontend/mcps.json`，使未声明 frontend 的角色不会获得浏览器 MCP。

Trellis/Moluoxixi 安装后的可观察能力保持不降级：原先已有 Playwright，现在额外获得 `frontend-design`。Matt 不声明 frontend，因此两者都不会出现。

## 6. Init-Project 整理流程

两个 wrapper 在运行 native init 前记录：workflow 根是否存在、`00-bootstrap-guidelines` 是否存在。运行成功后输出 `freshInitialization`、`bootstrapTaskCreated` 和本地化结果。脚本不做语义删除。

两个 `init-project` skill 增加同构的 bootstrap hygiene 分支：

1. **Fresh init + 有真实代码/约定**：读取新生成 task，调用角色原生 `*-spec-bootstrap`；删除不适用模板、按真实包/层重塑 spec、修复 index。满足 spec-bootstrap done criteria 后 finish，并用 `task.py archive --no-commit 00-bootstrap-guidelines` 归档。
2. **Fresh init + 缺少可用证据**：删除本次 init 新建且指纹仍为默认内容的通用 spec 与 `00-bootstrap-guidelines`，报告清理结果并提示以后显式运行 spec-bootstrap；不得编造规范。
3. **Re-init 或 task 已存在/自定义**：只报告发现的问题。用户另行授权前不整理、不归档、不删除。
4. **任何分支**：其它 task、已有 spec、用户修改和当前 Git 变更不属于自动整理范围。

Moluoxixi 增加与 Trellis 等价的 bootstrap 指纹识别/本地化，使两个角色都能证明“这是本次 init 创建且仍为默认内容”。指纹不匹配时一律视为用户内容。

## 7. Skill 文档结构

`init-project/SKILL.md` 只保留编排步骤、分支条件和完成标准。真实 spec 的分析/写作规则继续由原生 `trellis-spec-bootstrap` / `moluoxixi-spec-bootstrap` 单一维护；task 收尾使用现有 task CLI。角色专属脚本只输出可验证状态，不替代 agent 判断。

完成标准从“CLI 与扩展安装成功”提升为：

- native assets 与 AIRules extension 安装成功；
- fresh init 的 spec 已项目化，或按无证据策略清理；
- 本次生成的 bootstrap task 不再无意义地保持 active；
- 所有既有用户内容保持原样；
- 最终变更已报告，但未被隐式提交。

## 8. 兼容、测试与回滚

- 保持 `VendorRepo[]`、`VendorManifest`、宿主安装协议和现有 vendor identity。
- capability 单测覆盖组合顺序、去重、冲突、输入不可变与未知能力。
- 三个角色测试覆盖 capability 声明和展开后的 links；Trellis/Moluoxixi MCP 测试覆盖 Playwright 迁移。
- 两个 init-project 角色测试覆盖 fresh、pre-existing、customized、无证据与 `--no-commit` 收尾。
- 回滚可恢复原角色 vendor 数组和 MCP catalog；init-project 整理是 fresh-init 后置流程，不修改上游 package。

## 9. Review 结论

设计已确认。空仓库或缺少真实规范证据时，只清理本次 fresh init 新建且仍保持默认内容的 spec 与 bootstrap task；既有或已修改内容进入审计分支，不自动覆盖、归档或删除。
