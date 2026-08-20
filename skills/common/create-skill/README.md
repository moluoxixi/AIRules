# Create Skill

创建新的 skill 文件和目录结构的技能。

## 功能

此技能帮助：
- 创建符合规范的 skill 目录结构
- 生成 README.md 说明文档
- 生成 SKILL.md 操作手册
- 确保共享 skill 在多个角色间同步

## 适用范围

- 多个角色共享的 skills (`skills/common/`)
- 角色专属 skills (`roles/<role>/skills/`)

## 文件职责

### README.md - 说明文档
- 功能介绍：skill 是做什么的
- 适用范围：在什么场景下使用
- 使用场景：典型的用例

### SKILL.md - 操作手册
- 操作步骤：详细的执行步骤
- 命令示例：可直接运行的命令
- 检查清单：验证步骤
- 注意事项：警告和限制

### references/ - 参考文档（可选）
- 详细的技术参考
- 命令大全
- 示例代码
- 故障排查指南

## 使用场景

- 创建新的 skill 时
- 重构现有 skill 结构时
- 确保 skill 文档规范统一时
- 组织跨角色共享的 skills 时
- 为远程安装准备 skill 包时
