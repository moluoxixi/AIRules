# Moluoxixi Skills 全局基线

## 仓库定位

这个仓库是一套 `skills-first` 的工作流发行版。

- 第一方 skills 负责表达仓库自己的工作流和工程判断
- `superpowers/*` 继续作为流程基线，负责 brainstorming、planning、TDD、debugging、verification 等过程能力
- 其他 vendor skills 作为补充能力使用，不替代第一方技能层

## 第一方 Skill 分层

优先按下面这个顺序理解和加载第一方 skills：

1. `standard-workflow`：决定默认交付顺序
2. `frontend` / `backend`：决定领域层 guidance
3. `javascript` / `typescript` / `react` / `vue`：决定语言与框架层 guidance
4. `testing` / `verification` / `wrap-up`：决定阶段层 guidance

## 冲突优先级

当指导重叠时，按下面顺序处理：

1. 用户指令
2. 仓库本地项目指令
3. 第一方 skills
4. `superpowers/*`
5. 其他 vendor skills
6. 默认行为

## 工作方式

- 从当前宿主已经安装好的技能入口出发
- 优先加载第一方 skill 分层，再补充 vendor skills
- 默认遵循 `standard-workflow -> domain -> language/framework -> phase` 这个顺序
- 仓库内第一方 source skill 统一维护在根目录 `skills/<skill-name>/`
- 安装产物统一落到 `~/.moluoxixi/vendor/skills/`，宿主入口 `~/.moluoxixi/skills/` 只暴露扁平的 leaf skill 投影
- 要修改仓库行为时，优先编辑仓库根目录 `skills/` 的第一方 source，而不是直接改宿主投影目录

## 完成前验证

在宣称安装、升级或任务完成之前：

- 确认当前宿主的技能入口真的指向 `~/.moluoxixi/skills/`
- 确认 `~/.moluoxixi/vendor/skills/` 是最终构建产物目录，`~/.moluoxixi/skills/` 只是 leaf skill 投影入口
- 确认需要的第一方 skills 已经存在于该入口
- 确认当前宿主描述仍然符合 `skills-first` 模型
