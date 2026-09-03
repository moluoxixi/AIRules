# Knowledge Extension Contract

## 1. Scope / Trigger

修改 Trellis 或 moluoxixi 的项目知识 scanner、Hook、Skill、初始化安装器或
`knowledge/` 模板时，必须遵循本契约。两套角色行为必须同构，仅允许角色根目录、
Skill 名称和上下文 XML 标签不同。

知识扩展属于 AIRules-owned `init-project` 资产，不进入
`roles/moluoxixi/packages` 外部基线。宿主 Hook 负责检测和上下文注入；语义整理由
`trellis-knowledge` 或 `moluoxixi-knowledge` Skill 完成。

## 2. Signatures

角色根目录为 `.trellis` 或 `.moluoxixi`，公共 CLI 合同为：

```powershell
python <role-root>/scripts/knowledge.py status --json
python <role-root>/scripts/knowledge.py sources --json
python <role-root>/scripts/knowledge.py context
python <role-root>/scripts/knowledge.py acknowledge --batch <batch-id>
```

持久关系账本为 `<role-root>/knowledge/relations.json`：

```json
{
  "version": 1,
  "assets": {
    "api:payments:create": {
      "page": "library/payments/create.md",
      "sources": [
        {
          "path": "payments.yaml",
          "selector": "#/paths/~1payments/post",
          "sha256": "<64 lowercase hex>"
        }
      ]
    }
  }
}
```

成功确认写入 ignored 的 `<role-root>/knowledge/.state.json` v2，保存
`processed` source 快照和 `assets` 关系快照。读取器必须继续接受 v1 state。

## 3. Contracts

- `relations.json` 是唯一机器可读关系事实源；只持久化 asset 到 source，source 到
  asset 在运行时反向派生。
- `page` 是知识根下 `library/` 内的规范 POSIX 相对路径；`path` 是 `sources/`
  内的规范 POSIX 相对路径。两者必须指向非 symlink 普通文件且不能越界。
- 每项 source 关系保存整理者最后审查版本的 SHA-256；source 修改但语义不变时，
  也必须更新该哈希以显式确认审查。
- `status --json` 返回 source 差异、`impacted`、`relation_errors`、
  `relations_modified`、`state_upgrade_required`、`batch_id` 和 `pending`。
- `impacted` 使用当前关系与上次确认关系的并集，因此 source 或当前关系先被删除后，
  仍能定位此前受影响的 asset。
- `batch_id` 同时绑定当前 source、上次 source、当前关系文件指纹和上次关系快照；
  整理期间任一输入变化都会使旧 batch 失效。
- Hook 不启动 AI、不写 `library/`、`index.md` 或 `relations.json`。它调用集中式
  runtime 并注入不超过 24 KiB 的不可信项目上下文；关系账本读取上限为 1 MiB。
- 初始化和 `--force` 必须保留 `sources/`、`library/`、`index.md`、
  `relations.json` 和 `.state.json`。已有关系目标是 symlink 或非文件时报告 conflict。

## 4. Validation & Error Matrix

| 条件 | 状态错误 / 行为 |
| --- | --- |
| 关系 JSON 无效或版本不支持 | `relations_json_invalid` / `relations_schema_unsupported` |
| 关系文件缺失且已有 source 或历史关系 | `relations_file_missing` |
| 关系文件是 symlink 或超过 1 MiB | `relations_path_unsafe` / `relations_too_large` |
| page 路径非法、缺失、重复或未映射 | `relations_page_invalid`、`asset_page_missing`、`asset_page_duplicate` 或 `library_page_unmapped` |
| source 路径非法、缺失或哈希过期 | `relations_source_path_invalid`、`relation_source_missing` 或 `relation_source_hash_stale` |
| 本批新增/修改 source 没有 asset | `source_unmapped` |
| source 扫描不支持、不可读、越界或过大 | 保留 source error；`acknowledge` 拒绝 |
| batch ID 已变化 | `acknowledge` 拒绝并要求重新运行 status |
| 任一 relation error 存在 | `acknowledge` 拒绝，不更新 state |
| 校验全部通过 | 原子写入 state v2；再次 status 为 `pending: false` |

## 5. Good / Base / Bad Cases

- Good：修改 source 后，Skill 更新页面、frontmatter 和关系哈希，再用最新 batch 确认。
- Base：删除 source 后，同时删除仅由它支持的 asset 页面和关系；历史 state 仍在确认前
  报告受影响 asset。
- Bad：只改 `library/` 页面或只运行 `acknowledge`，让关系仍引用旧哈希或已删除 source。

## 6. Tests Required

- 两个角色各自在 `roles/<role>/__test__/` 覆盖 source 新增、修改、删除及反向影响。
- 断言无映射 source、缺失/重复/未映射 page、悬空 source、过期哈希、无效 JSON 和
  symlink 关系文件会产生稳定错误并阻止确认。
- 断言 v1 state 可读，下一次成功确认升级为含关系快照的 v2。
- 断言 re-init、`--force` 和 dry-run 对知识数据的创建、保留、冲突行为。
- 通过真实 `knowledge-hook.py` JSON 输出测量 `additionalContext` 的 UTF-8 字节数，
  避免 Windows 控制台把 `\n` 转成 `\r\n` 后误测 CLI 文本。
- 规范化角色路径和 Skill 名称后，两套 `common/knowledge.py` 必须一致。

## 7. Wrong vs Correct

Wrong：在 Hook 中启动另一个模型，或维护第二份持久化 source 到 asset 索引。

```text
UserPromptSubmit -> Hook -> AI organizer -> rewrite library
relations.json + reverse-relations.json
```

Correct：Hook 只做确定性检测与注入，Skill 维护单一关系事实，反向关系运行时派生。

```text
UserPromptSubmit -> Hook -> status/impact context -> current AI invokes Skill
relations.json (asset -> sources) -> runtime derives source -> assets
```
