# Delivery Report

## Required Content

Final delivery should include:
- what changed;
- files or areas touched;
- acceptance criteria covered;
- verification commands actually run;
- result of each command;
- failed, missing, or not-run quality dimensions;
- coverage result or why coverage is unavailable;
- residual risk and follow-up work.

## Good Result Format

```text
已完成：...

验证：
- PASS `...`: ...
- FAIL `...`: ...
- MISSING typecheck: package.json 没有 typecheck 脚本，也没有 tsconfig.json。

风险：...
```

Keep the report concise. Do not claim "completed", "fixed", or "passed" unless fresh verification evidence supports that exact claim.
