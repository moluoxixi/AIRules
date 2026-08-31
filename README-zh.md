# Moluoxixi AIRules

AIRules 为受支持的 AI 编程宿主分发 skills、MCP 配置和角色资产。

## 安装 package

全局安装已发布的 package：

```bash
npm install --global moluoxixi-ai-rules
```

检查已安装的 CLI：

```bash
airules --version
```

## 安装角色

为所有受支持的宿主安装或更新角色：

```bash
airules install moluoxixi --host all
```

其他角色使用相同的 package 命令：

```bash
airules install trellis --host all
airules install matt --host all
```

不修改安装内容，仅验证已安装的角色：

```bash
airules verify moluoxixi --host all
```

安装是用户级操作。角色安装完成后，在目标项目中执行项目初始化命令。

## Moluoxixi package CLI

Moluoxixi 角色还发布了独立 CLI package `@moluoxixi/airules-moluoxixi-cli`：

```bash
npm install --global @moluoxixi/airules-moluoxixi-cli
moluoxixi --version
```

使用 `moluoxixi --help` 查看已安装 package 提供的命令。

## 共享 skills

AIRules 将 canonical skills 维护在 `~/.agents/skills`。Codex、Cursor、Qoder、Trae、Trae CN、Trae Solo、Trae Solo CN、Hermes 和 OpenCode 会直接发现该目录，因此 AIRules 不会再向这些宿主的私有目录创建重复 skills。MCP 配置仍按宿主分别管理。

## 角色能力

角色只声明需要的公共 capability，由 registry 统一组合对应的 skills 与 MCP：

| 角色 | Capabilities |
|---|---|
| `trellis` | `common`, `coding`, `productivity`, `frontend` |
| `moluoxixi` | `common`, `coding`, `productivity`, `frontend` |
| `matt` | `engineering`, `productivity` |

`frontend` 固定安装 Anthropic `frontend-design` 与 Playwright MCP。详细映射见 [capabilities/README.md](capabilities/README.md)。

## 版本

```bash
airules --version
```

English documentation: [README.md](README.md)

## 许可证

MIT

<!-- AIRULES:TRELLIS:START -->

## Trellis 工作流

本项目使用 Trellis 管理 AI 辅助开发流程。在 AI 编程助手中可以发送：

```text
请使用 Trellis 开始处理这个需求：<描述需求>
请使用 Trellis 继续当前任务。
请使用 Trellis 检查当前改动。
请使用 Trellis 完成本次工作。
```

项目的工作流、任务和规范状态位于 `.trellis/`。

<!-- AIRULES:TRELLIS:END -->
