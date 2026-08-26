# 调试复盘：Moluoxixi CLI 短命令冲突与发布闭环

## 1. 根因分类

- **B：跨层契约**。`@mindfoldhq/trellis` 与 Moluoxixi CLI 同时声明全局
  `tl`，Windows npm prefix 中的 `tl.cmd` 只能有一个所有者，第二次安装因
  `EEXIST` 失败。
- **D：测试覆盖缺口**。原发布预检只验证版本、dist-tag 和 core 精确依赖，
  没有把 CLI bin 映射作为 packed artifact 与 public registry 的共同契约。

## 2. 早期判断为何不足

1. 将失败归因于 Node、npm 或 NVM 版本，无法解释日志中精确指向 `tl.cmd`
   的 `EEXIST`，隔离 prefix 复现排除了版本假设。
2. 只在源码 `package.json` 将 `tl` 改为 `ml`，不能修复已发布的不可变
   `0.6.21`，也不能证明最终 tarball 和 public npm manifest 没有漂移。
3. 首轮 packed 校验覆盖了发布前产物，但独立检查发现发布后仍只验版本与
   dist-tag，流水线可能在 CLI bin 契约未闭环时成功。

## 3. 预防机制

| 优先级 | 机制 | 具体动作 | 状态 |
|---|---|---|---|
| P0 | 架构 | `cliBinContractError` 作为 packed/public bin 的唯一判断 | 已完成 |
| P0 | 测试 | 发布测试集覆盖正确映射、缺失 `ml`、错误入口和遗留 `tl` | 已完成 |
| P0 | 运行时门禁 | `verify-npm` 查询 public registry 的 CLI `bin` | 已完成 |
| P1 | 集成验证 | 隔离 npm prefix 验证 Trellis 保留 `tl`，Moluoxixi 使用 `ml` | 已完成 |
| P1 | 文档 | 发布规范记录 bin 验证矩阵与错误行为 | 已完成 |

## 4. 系统性扩展

- 任何全局 npm package 新增短命令时，都必须先检查同一 prefix 的 shim
  所有权；`--force` 不能作为冲突解决方案。
- 对公开 CLI，源码 manifest、packed manifest 和 public registry manifest
  是三个独立边界，发布成功条件必须覆盖三者。
- 不可变 npm 版本中的错误只能通过新版本修复，不能在同版本源码上补丁后
  继续要求 `latest` 用户获得修复。

## 5. 固化位置

- rebuild 发布规范：`.trellis/spec/cli/backend/release-process.md`
- 发布实现：`packages/cli/scripts/release-preflight.js`
- 回归测试：`packages/cli/test/release-preflight.test.ts`
