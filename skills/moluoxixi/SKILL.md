---
name: moluoxixi
description: Moluoxixi 在 JavaScript/TypeScript 项目中的偏好工具与约定。在设置新项目、配置 ESLint/Prettier 替代方案、monorepos、库发布，或者当用户提到 Moluoxixi 的偏好时使用。
metadata:
  author: Moluoxixi
  version: "2026.02.03"
---

## 编码实践

### 代码组织

- **单一职责**：每个源文件应该有清晰、专注的范围/目的
- **拆分大文件**：当文件变得庞大或处理太多关注点时，将其拆分
- **类型分离**：始终将类型和接口分离到 `types.ts` 或 `types/*.ts` 中
- **提取常量**：将常量移至专用的 `constants.ts` 文件中

### 运行时环境

- **偏好同构代码**：尽可能编写在 Node、浏览器和 workers 中都能运行的与运行时无关的代码
- **清晰的运行时标识**：当代码具有特定环境依赖时，在文件顶部添加注释：

```ts
// @env node
// @env browser
```

### TypeScript

- **显式返回类型**：在可能的情况下显式声明返回类型
- **避免复杂的内联类型**：将复杂的类型提取为专用的 `type` 或是 `interface` 声明

### 注释

- **避免不必要的注释**：代码本身应当是自解释的
- **解释“为什么”而不是“怎么做”**：注释应描述背后的理由或意图，而不是代码做了什么

### 测试 (Vitest)

- 测试文件：`foo.ts` → `foo.test.ts` (同级目录)
- 使用 `describe`/`it` API (而不是 `test`)
- 对复杂输出使用 `toMatchSnapshot`
- 对于特定语言层面的快照，通过明确路径使用 `toMatchFileSnapshot`

---

## 工具链选择

### @antfu/ni 命令

| 命令 | 描述 |
|---------|-------------|
| `ni` | 安装依赖 |
| `ni <pkg>` / `ni -D <pkg>` | 添加依赖 / 开发环境依赖 |
| `nr <script>` | 运行脚本 |
| `nu` | 升级依赖 |
| `nun <pkg>` | 卸载依赖 |
| `nci` | 纯净安装 (`pnpm i --frozen-lockfile`) |
| `nlx <pkg>` | 执行包 (`npx`) |

### TypeScript 配置

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true
  }
}
```

### ESLint 设置

```js
// eslint.config.mjs
import antfu from '@antfu/eslint-config'

export default antfu()
```


当完成任务时，运行 `pnpm run lint --fix` 格式化代码并修复代码风格。

详细的配置选项信息请参阅：[antfu-eslint-config](references/antfu-eslint-config.md)

### Git Hooks

```json
{
  "simple-git-hooks": {
    "pre-commit": "pnpm i --frozen-lockfile --ignore-scripts --offline && npx lint-staged"
  },
  "lint-staged": { "*": "eslint --fix" },
  "scripts": {
    "prepare": "npx simple-git-hooks"
  }
}
```

### pnpm Catalogs

在 `pnpm-workspace.yaml` 中使用具名目录（Catalogs）进行版本管理：

| 目录 (Catalog) | 作用 |
|---------|---------|
| `prod` | 生产级依赖 |
| `inlined` | 打包器内联依赖 |
| `dev` | 开发级工具链 (linter, bundler, testing) |
| `frontend` | 前端类库 |

避免使用默认的 catalog。Catalog 名称可根据项目需要调整。

---

## 参考资料

| 主题 | 描述 | 参考源 |
|-------|-------------|-----------|
| ESLint Config | 框架支持、格式化工具、规则覆盖、VS Code 设置 | [antfu-eslint-config](references/antfu-eslint-config.md) |
| Project Setup | .gitignore, GitHub Actions, VS Code 插件 | [setting-up](references/setting-up.md) |
| App Development | Vue/Nuxt/UnoCSS 约定与模式 | [app-development](references/app-development.md) |
| Library Development | tsdown 打包工具，pure ESM 发布 | [library-development](references/library-development.md) |
| Monorepo | pnpm workspaces, 提取中心 alias, Turborepo | [monorepo](references/monorepo.md) |
