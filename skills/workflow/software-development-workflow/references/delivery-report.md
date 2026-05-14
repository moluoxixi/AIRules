# 交付报告

本文件提供交付报告建议格式。最终回复应优先满足用户要求和项目约束。

## 建议包含

根据任务规模选择性说明：
- 改了什么；
- 触及的文件或范围；
- 覆盖的验收标准；
- 实际运行的验证命令；
- 每条命令的结果；
- `FAIL`、`MISSING`、`NOT RUN` 或 `N/A` 的质量维度；
- coverage 结果，或 coverage 为什么不相关、缺失或未运行；
- 残余风险和后续工作。

## 场景化报告

只读任务或未修改代码：

```text
已完成：完成只读审查，未修改代码。

验证：
- N/A 质量检查：本次未修改代码。
```

文档或策略修改：

```text
已完成：调整 workflow 分场景验证规则。

验证：
- PASS `git diff --check`: 无 whitespace error。
- PASS `npm test -- tests/workflow-policy.test.ts`: 策略锚点通过。
- N/A coverage/build: 本次仅修改策略文档。
```

代码修改：

```text
已完成：...

验证：
- PASS `...`: ...
- FAIL `...`: ...
- MISSING typecheck: package.json 没有 typecheck 脚本，也没有等价配置。
- NOT RUN browser: 本次未影响浏览器行为。

风险：...
```

报告要短。没有新的验证证据时，不要声称“已完成”“已修复”或“已通过”。
