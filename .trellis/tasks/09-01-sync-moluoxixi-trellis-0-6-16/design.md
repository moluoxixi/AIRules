# 技术设计：同步 Moluoxixi 至 Trellis 0.6.16

## 边界

| 路径 | 职责 | 规则 |
| --- | --- | --- |
| `roles/moluoxixi/.sync/trellis` | 固定上游输入 | 只读、clean、detached 在目标 commit |
| `roles/moluoxixi/.sync/rebuild` | identity transform 与人工适配 | 唯一允许修改上游产物的 worktree，每次适配用本地 commit 记录 |
| `roles/moluoxixi/.sync/scripts` | 确定性生成与导出 | 可以检查已知契约，不做语义取舍 |
| `roles/moluoxixi/packages` | 正式导出 | 不直接编辑；清空后从 rebuild 完整复制 |
| `.trellis/spec/distribution` | 可执行同步契约 | 约束未来 AI 的范围判断和验证方式 |

## 最小流程

```text
Trellis 0.6.16 / 88f483...
  -> identity transform commit
  -> 人工重放必要 Moluoxixi 适配
  -> 包名/workspace gate 修正
  -> 定向验证
  -> 完整导出
  -> 主仓提交并推送
```

## 保留与撤销

保留 rebuild 提交：

- `b7e25e581f`：从固定 commit 生成 identity transform。
- `fb63150c48`：重放必要 Moluoxixi 适配，包版本为 `0.6.23`。
- `34171e6714`：把根 workspace 命令的包过滤器改为实际 Moluoxixi 包名，使既有门禁能运行。

撤销 `55136cfc68`：它扩展了 publish-suite 白名单、Pi/registry 测试边界和自检测试，超出版本同步所需范围。主仓中的 `roles/moluoxixi/__test__/sync-export-guard.test.ts` 同样删除。

## 人与工具的职责

工具负责固定输入、生成可重复身份转换、检查已知包身份/版本、比较导出内容。人负责判断适配是否仍有意义。任何脚本输出都不能作为“语义适配完整”的证明。

## 失败与回滚

- rebuild 失败时停留在本地维护分支，不触碰正式 packages。
- 导出验证失败时从 clean rebuild 重新完整导出，不在正式 packages 中修补。
- 新发现的非阻塞问题写入任务记录后延后；不把它变成本任务实现项。
