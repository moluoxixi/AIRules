# 收紧安装、同步与宿主投影边界

## 目标

让 moluoxixi 的用户文档只提供 package 安装方式，把外部基线同步及同步后 identity 检查完整收回 ignored `.sync` 维护区，并让原生支持 `.agents` 的 AI 平台直接复用 canonical 资产，避免重复投影到平台私有安装目录。

## 已确认事实

- 根 `README.md` 与 `README-zh.md` 各有四处 `npm link`，并同时描述 moluoxixi、trellis、matt 的源码安装。
- moluoxixi 已发布 CLI package 名为 `@moluoxixi/airules-moluoxixi-cli`，公开 bin 为 `moluoxixi` 和 `tl`。
- 仓库中不存在字面上的 `moluoxixi-identify` 命令；实际入口是根 `verify:moluoxixi-identity`、角色 `verify:identity` 和 `scripts/verify-moluoxixi-identity.mjs`。
- `.sync/scripts/sync-moluoxixi-upstream.mjs` 在显式 `--export` 后调用根 `verify:moluoxixi-identity`；该 scanner 属于同步后维护检查。
- `.sync/rebuild/packages` 是唯一适配工作树，`roles/moluoxixi/packages` 只接受完整导出，不直接承担同步决策。
- AIRules 当前始终建立 canonical `.agents/skills`，随后仍按 host 配置向 11 个平台私有目录投影 skills；MCP 使用独立的 host 配置写入。
- OpenAI 官方文档明确 Codex 会扫描仓库级和用户级 `.agents/skills`；该证据只覆盖 skills，不等同于 `.agents` 内 MCP 配置支持。
- 官方资料确认 Cursor、OpenCode 也默认扫描用户级 `~/.agents/skills`；Codex、Cursor、OpenCode 可直接复用 AIRules 已建立的 canonical skills。
- 用户确认 Qoder 支持当前 canonical skills；尽管官方发布说明未明确 scope，本次按兼容处理。QoderWork 未确认，继续保留私有投影。
- Claude 不支持 `.agents/skills`；Hermes 用户级需显式配置；TRAE 普通版只确认项目级且需开关；TRAE SOLO 未确认支持。
- 所有已登记 host 均无官方证据从 `.agents` 读取 MCP 配置，现有 MCP 私有路径仍需保留。

## 需求

- 同步改写中英文 README，仅描述通过已发布 npm package 安装 AIRules CLI/角色和 Moluoxixi CLI，不再提供源码 clone、build、`npm link` 或源码 checkout 路径。
- 删除根 `verify:moluoxixi-identity` 和角色 `verify:identity` 公开入口，并从 `verify:publish` 移除 identity gate。
- 将 `scripts/verify-moluoxixi-identity.mjs` 迁入 `roles/moluoxixi/.sync/scripts/`，修正其路径解析。
- 让 `.sync/scripts/sync-moluoxixi-upstream.mjs` 直接调用 `.sync` 内 scanner，导出后检查不再绕经根 npm script。
- 删除依赖 ignored `.sync` 维护实现的常规角色测试；保留不依赖 `.sync` 的真实产物边界回归。
- 保持只读源码镜像、rebuild 本地提交、完整替换导出的现有语义不变。
- 调研所有已登记 host 对 `.agents` 的官方原生支持，分别记录 skills 与 MCP 能力、支持范围和证据等级。
- 对官方确认会原生读取 `.agents/skills` 的 host，停止向该 host 私有 skills 目录重复投影和验证。
- 按用户确认，将 Qoder 纳入停止私有 skills 投影的 host 集合。
- 更新安装时只清理由 AIRules 创建且仍指向内部资产的旧 host skills 链接，保留用户自有文件、目录和外部链接。
- 只有在官方确认会原生读取 `.agents` 内 MCP 配置时，才停止对应 host 的私有 MCP 投影；skills 与 MCP 必须独立判断。

## 验收标准

- [x] `README.md` 与 `README-zh.md` 不含 `npm link` 或从源码安装流程，且包含已发布 package 的可执行安装命令。
- [x] 根和角色 `package.json` 不再暴露 identity/identify verify script，角色 `verify:publish` 仍保留测试、构建、类型、发布 lint 和 packed CLI 校验。
- [x] identity scanner 只存在于 `.sync/scripts`，同步导出后由 `.sync` 内流程直接执行。
- [x] tracked 真实产物不包含同步、导出、rename 或 identity scanner，也不暴露 `moluoxixi-identify`。
- [x] `.sync/trellis` 源码镜像保持干净且固定 revision 不变；`.sync/rebuild` 不因本次边界调整产生无关变更。
- [x] 相关 lint、类型检查和角色测试通过。
- [x] 形成覆盖全部已登记 host 的 `.agents` skills/MCP 支持矩阵，并保留可复核的官方来源 URL 与关键原文。
- [x] 原生支持 canonical skills 的 host 不再收到私有 skills 副本；不支持或证据不足的 host 保持现有投影。
- [x] Codex、Cursor、Qoder、OpenCode 复用 `~/.agents/skills`；QoderWork 与其它未确认 host 保持现有行为。
- [x] 升级清理不会删除 host skills 目录中的普通文件、真实目录或指向 AIRules 外部的链接。
- [x] MCP 投影不会仅因平台支持 `.agents/skills` 而被误删，且官方确认支持 canonical MCP 的 host 不再收到重复私有配置。

## 范围外

- 不修改固定上游版本、revision、rebuild 历史或 packages 运行时功能。
- 不迁移或删除公共 `scripts/role-packages.ts` 发布能力和 packed CLI 校验。
- 不处理或改动许可证、NOTICE、COPYRIGHT 等法律文件。
- 不依据社区帖子、搜索摘要或目录命名推断平台能力；官方证据不足的平台按不支持处理。

## 技术备注

- `.sync` 是 ignored 本地维护边界，迁入其中的 scanner 不作为 AIRules tracked 产物提交；tracked 侧只记录旧 scanner 和公开入口的删除。
- `roles/moluoxixi/__test__/` 继续只承载无需 `.sync` 即可运行的角色产物测试。
- 平台原生能力按 asset 类型建模，不能用单个 host 级布尔值同时代表 skills 和 MCP。
