# General

`general` 提供长期记忆、skill 编写和知识整理等通用能力。角色在 [`role.yaml`](role.yaml) 中选择 `common`，资产从远程供应商同步。

## 安装

```bash
npm install --global moluoxixi-ai-rules
airules install general --host all
airules verify general --host all
```

安装后可在宿主中直接使用以下能力：

| Skill | 用途 |
|---|---|
| `hindsight-memory` | 按项目回忆和保存已确认的信息，查看记忆控制台 |
| `hindsight-docs` | 查询 Hindsight API、部署和高级配置 |
| `create-skill` | 编写或修订通用 skill |
| `spec-organization` | 整理文档目录、索引和链接 |

唯一 MCP 是 Hindsight，默认地址为 `http://localhost:8888/mcp/`。安装器分发连接配置和可视化部署资产，运行记忆服务需要配置模型。

## 使用

```text
请整理这个项目的文档目录、索引和链接。
请记住我们已确认的结论、理由和下一步验证条件。
回忆这个项目之前的决定，并核对是否仍适用。
打开当前项目的记忆可视化，查看保存的事实和实体关系图。
```

记忆控制台默认位于 `http://localhost:9999`。在控制台选择与 MCP 相同的项目 bank，查看事实、来源文档、实体关系图和异步操作状态。已有 Hindsight API 时只需添加控制台；首次部署可使用随 `hindsight-memory` skill 分发的 Docker Compose。操作步骤见 [记忆可视化](../../capabilities/common/skills/hindsight-memory/references/visualization.md)。

候选方案与已确认结论分别标注状态；只有确认保存成功后才报告记忆已写入。

## 作为基础角色

[`development`](../development/README.md) 通过 `extends_roles: [general]` 继承通用能力，并集中选择共享开发能力。`moluoxixi`、`trellis` 和 `matt` 再继承 `development`。新增开发角色使用同一模板：

```yaml
extends_roles: [development]
capabilities: []
```

角色仅支持单继承，可以沿单个父角色形成多层继承链；相同能力自动去重。规则见 [角色继承](../../capabilities/README.md#角色继承)。
