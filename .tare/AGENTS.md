# Moluoxixi tare 全局基线

## 宿主入口

当 tare 通过这个仓库安装后，把下面这些路径视为当前生效入口：

- `~/.agents/skills/moluoxixi/` 是这个仓库对 tare 暴露的统一技能命名空间
- `~/.moluoxixi/skills/` 是被投影进去的源技能树
- `~/.moluoxixi/agents/` 是可选的辅助 agents 目录
- `.tare/AGENTS.md` 是 tare 侧的全局基线文件

这是一套 `skills-first` 的安装，`rules` 不再作为主入口。

## 第一方 Skill 分层

优先按下面这个顺序理解和加载第一方 skills：

1. `standard-workflow`：决定默认交付顺序
2. `frontend` / `backend`：决定领域层 guidance
3. `javascript` / `typescript` / `react` / `vue`：决定语言与框架层 guidance
4. `testing` / `verification` / `wrap-up`：决定阶段层 guidance

这些第一方 skills 都位于 `~/.agents/skills/moluoxixi/` 下，与 vendor skills 并列存在。

## 第一方与 Vendor 的关系

- 第一方 skills 负责表达仓库自己的工作流和工程判断
- `superpowers/*` 继续作为流程基线，负责 brainstorming、planning、TDD、debugging、verification 等过程能力
- 其他 vendor skills 作为补充能力使用，不替代第一方技能层

## 冲突优先级

当指导重叠时，按下面顺序处理：

1. 用户指令
2. 仓库本地项目指令
3. 第一方 skills
4. `superpowers/*`
5. 其他 vendor skills
6. 默认行为

## 工作方式

- 从 `~/.agents/skills/moluoxixi/` 这个命名空间出发
- 优先加载第一方 skill 分层，再补充 vendor skills
- 默认遵循 `standard-workflow -> domain -> language/framework -> phase` 这个顺序
- 要修改仓库行为时，优先编辑 `~/.moluoxixi/skills/` 里的第一方 skills

## 完成前验证

在宣称安装、升级或任务完成之前：

- 确认 `~/.agents/skills/moluoxixi/` 真的指向 `~/.moluoxixi/skills/`
- 确认需要的第一方 skills 已经存在于这个命名空间
- 确认当前宿主描述仍然符合 `skills-first` 模型
