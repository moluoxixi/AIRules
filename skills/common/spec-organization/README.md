# Spec Organization Skill

用于整理和组织项目中的规范文件（spec files）的技能。

## 功能

此技能帮助：
- 组织和重构现有的 spec 文件结构
- 为新 spec 文件选择合适的放置位置
- 理解和改进现有的 spec 组织方式
- 在团队中建立一致的 spec 组织模式

## 适用范围

- Moluoxixi 项目中的 `.moluoxixi/spec/` 目录
- Trellis 项目中的 `.trellis/spec/` 目录
- 任何需要组织规范文档的代码仓库

## 组织原则

### 层级结构
按领域或功能区域分组相关 spec，避免过深嵌套（建议不超过 3 层）。

### 命名约定
- 使用 kebab-case
- 保持描述性
- 避免冗余
- 使用复数表示集合

### 粒度平衡
在过多小文件和单体 spec 之间找到平衡：
- 拆分：当单文件超过 500 行或涵盖多个独立关注点时
- 合并：当主题紧密耦合且总是一起使用时

## 常见组织模式

1. **按层次**：`architecture/`、`implementation/`、`testing/`
2. **按功能领域**：`auth/`、`api/`、`data/`
3. **按技术栈**：`frontend/`、`backend/`、`infrastructure/`

## 使用场景

- spec 目录增长变得混乱时
- 团队成员难以找到相关规范时
- 添加新 spec 不确定放在哪里时
- 重构项目规范结构时
