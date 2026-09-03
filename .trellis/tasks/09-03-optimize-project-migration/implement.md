# 实施计划

## 1. 建立失败优先的回归测试

- [x] 扩展 `scripts/lib/__test__/migrate-project.test.ts` 的 fixture，使源 README 包含未知正文、复杂 Trellis H2 章节、代码围栏伪标题、CRLF 与 BOM。
- [x] 断言根 `README*.md` 仅删除 Trellis 角色章节，其他正文及 `README-zh.md` 保留。
- [x] 断言源树任意层级 `node_modules` 不复制，而目标已有根 `node_modules` 默认完整保留。
- [x] 覆盖多个、重复和嵌套 `--preserve`，以及 dry-run 摘要。
- [x] 覆盖非法相对路径、父符号链接及与迁移输出冲突，并断言失败发生在目标清理前。

## 2. 实现保留路径契约

- [x] 在 `scripts/migrate-project.mjs` 中解析可重复 `--preserve` 参数并更新 usage。
- [x] 实现相对路径规范化、平台比较键、父子归并和目标符号链接安全检查。
- [x] 扩展重命名预检，使其返回迁移输出计划并在清理前检查保留冲突。
- [x] 将 `cleanTarget()` 改为按保留树递归清理。
- [x] 在迁移摘要中输出最终保留路径。

## 3. 实现保真的 README 清理

- [x] 增加根 `README*.md` 发现和清理前 UTF-8 预检。
- [x] 实现 fenced code block 感知的 H1/H2 扫描与 Trellis H2 范围删除。
- [x] 在文本复制转换中仅对根 README 文件应用该删除器。
- [x] 移除 README/SKILLS 固定模板生成与 `README-zh.md` 删除逻辑。
- [x] 为 `SKILLS_ORGANIZATION.md` 增加保留原文的定点 Trellis 清理。

## 4. 调整残留检查

- [x] 让残留扫描跳过根 `.git`、最终保留根及根 `README*.md`。
- [x] 保持其他迁移输出中的 Trellis 路径、链接目标和内容残留可定位失败。

## 5. 验证与复核

- [x] 运行 `npm test -- scripts/lib/__test__/migrate-project.test.ts`：28 个测试通过。
- [x] 运行本任务测试文件的独立 TypeScript 检查；全局 `npm run typecheck` 当前被并发 `role-packages` 改动缺少两个导出阻断。
- [x] 运行 `npm run lint:check`。
- [x] 对真实仓库运行迁移 dry-run，核对保留项和复制摘要。
- [x] 检查 `git diff --check` 与任务范围，确认未修改 `.github/workflows/publish.yml`；该文件保留用户原有改动。

## 回滚点

- 主要风险文件只有 `scripts/migrate-project.mjs` 和对应专项测试；若保留计划或 README 状态机无法通过边界测试，撤销本任务对这两个文件的改动，不影响用户已有工作区变更。
