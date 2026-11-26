# Requirement Flow

让人理解业务，让下一位能继续，让交付结论有依据。官方 Ponytail 默认 full 提供最小完整实现的工程取向，宿主负责计划、执行与协作，requirement-flow 补充业务规则、上下文接续和证据意义。

## 安装与使用

```bash
airules install requirement-flow --host codex
python3 ~/.agents/skills/requirement-flow/scripts/ponytail.py setup --default full
python3 ~/.agents/skills/requirement-flow/scripts/ponytail.py doctor
airules verify requirement-flow --host codex
```

`setup` 通过 Codex 原生插件机制安装或复用官方完整 Ponytail，并调用上游配置函数设置默认 full。若提示 hooks 待审查，先在该宿主的原生 `/hooks` 界面检查并信任，再运行 `doctor`、开启新会话。`doctor` 只读检查安装、默认档位及 hook 信任；`configuration_ready` 不证明新会话实际运行或业务验收通过。上游资源保持原样，会话内切档与关闭沿用 Ponytail 自身能力。

`--codex-home /path/to/codex-home` 只选择 Codex 的插件与配置目录。Ponytail 默认档位仍按上游规则从 `PONYTAIL_DEFAULT_MODE`、`$XDG_CONFIG_HOME/ponytail/config.json` 或 `~/.config/ponytail/config.json` 解析（Windows 回退到 APPDATA）。需要隔离默认配置时一并指定 XDG_CONFIG_HOME；设置只在安装、升级或诊断时检查，日常任务直接使用。

`ponytail-review`、`ponytail-audit`、`ultra` 等专项能力按实际需要使用，不是 RF 的必经阶段。日常从需求继续自主执行；RF 可自动发现，也可显式调用 `$requirement-flow`：

```text
让第一次接手的人看懂当前库存业务及这次改动的影响。
继续这个分支，核对已有结论仍适用，补足剩余工作。
检查保存后的回读证据能否证明需求已经满足。
```

RF 不要求项目初始化。已有且有依据的状态、权限、接口契约和例外属于完整范围；出现新的业务约束或证据缺口时，随之调整调查与验法。缺失的业务决定或授权只阻塞依赖部分。

## 项目里保留什么

优先复用已有文档、issue 和 PR。只有需要长期理解或接续上下文而没有约定时，才使用下列普通文件：

| 材料 | 回答的问题 | 默认位置 |
| --- | --- | --- |
| 业务说明 | 当前如何运作，哪些规则与例外重要，依据是什么 | `docs/business/index.md`，必要时链接专题 |
| 变更与接手记录 | 本次差异、重要决定、实际实现、缺口和下一步 | `docs/changes/<id>.md` 或已有 issue/PR |
| 验证依据 | 指定代码、环境和数据下实际观察到了什么 | 链接在变更记录内，原始日志与附件沿项目约定保存 |

现行规则、拟议目标和实测结果各有来源及适用范围；本地实现或测试通过不自动更新生产现状。简单任务可由修改、相关检查与简短交付说明完成。

具体写法按需读取[业务说明](skills/requirement-flow/references/business.md)、[工作记录](skills/requirement-flow/references/work.md)及[验证与证据](skills/requirement-flow/references/verification.md)。

## Markdown 网页阅读

```bash
python3 ~/.agents/skills/requirement-flow/scripts/reader.py --project /path/to/project \
  --entry docs/business/index.md --tasks docs/changes --port 8765
```

从项目已有 Markdown 入口读取导航，沿链接阅读普通文档、规范和任务。页面提供查询、Mermaid 流程/状态图、原文及来源查看、任务互跳与反向关联；引用的 Markdown 也能查来源。内容只维护在 Markdown，刷新即可读取改动。

`[现状]`、`[拟议变更]`、`[实测结果]` 是原文语义标记，不认证政策生效或验收完成。入口与任务位置、格式及读取边界见[阅读器说明](skills/requirement-flow/references/reader.md)。阅读服务按需启动，只监听本机且只读，运行时仅需 Python 3.9+；离线浏览器资源随技能分发。

在本仓库用保留的合成样例查阅：选择尚不存在的输出目录，准备后启动服务。

```bash
python3 roles/requirement-flow/__test__/prepare_reader_example.py --output /tmp/requirement-flow-reader-example
python3 roles/requirement-flow/skills/requirement-flow/scripts/reader.py \
  --project /tmp/requirement-flow-reader-example --entry docs/business/index.md \
  --tasks inventory/docs/copy-decision.md --tasks library/docs/changes --port 8765
```

使用完关闭服务并清理自己创建的样例目录。浏览器程序资产的准备配置位于 `reader-build/`，仅维护这些资产时需要 Node。

## 可复核的证据

需要保存命令输出或复核输入是否变化时，使用可选的 `scripts/evidence.py`。它只报告执行与显式输入状态，不能代替实际断言或业务验收；原始输出与输入范围、人工环境记录和复验规则见[验证与证据](skills/requirement-flow/references/verification.md)。

当前职责及历史取舍见[设计记录](DESIGN.md)。实际检查、演练和未验证范围见[验证记录](VERIFICATION.md)；文档与组件组合本身不证明跨模型效果。
