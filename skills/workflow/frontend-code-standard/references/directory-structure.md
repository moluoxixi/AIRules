# 目录结构

默认采用特性模块化目录结构：顶层保留通用技术目录，业务代码优先放入 `views/`、`pages/` 或 `modules/`，特性内部按需共置自己的组件、状态、请求、类型、常量和工具。

## 顶层结构

```text
src/
  api/
  components/
  composables/ or hooks/
  views/ or pages/ or modules/
  router/
  stores/
  styles/
  types/
  utils/
  ...
  app.vue or app.tsx
```

`views/`、`pages/` 和 `modules/` 是或的关系，按项目约定选择一种作为业务入口；不要为同一业务同时创建三套入口。

项目已有稳定结构时，优先遵循项目结构。

## 模块结构

特性专属文件优先放在特性目录内：

```text
purchaseOrder/
  index.vue or index.tsx
  api/
  components/
    AuditDialog/
      index.vue or index.tsx
      types/
      constants/
      utils/
      types/
      composables/ or hooks/
      ...
  composables/ or hooks/
  types/
  constants/
  utils/
  ...
```

## 组件目录结构

组件目录使用同一套内部组织，但目录结构放在组件目录的 `src/` 下；组件目录根只放 `README.md`、`index.ts` 和 `src/`。

```text
DataTable/
  README.md
  index.ts
  src/
    index.vue or index.tsx
    api/
    components/
      Toolbar/
        index.vue or index.tsx
        types/
        constants/
        composables/ or hooks/
    composables/ or hooks/
    modules/
      columnSettings/
        index.vue or index.tsx
        components/
        composables/ or hooks/
        types/
        constants/
        utils/
    stores/
    styles/
    types/
    constants/
    utils/
```

组件外部只能从组件根入口导入，例如 `DataTable/index.ts`；不要直接 deep import `DataTable/src/...`。

## 嵌套模块

当一个特性继续变复杂，可在内部递归拆分子模块，子模块仍遵循同一套结构：

```text
purchaseOrder/
  index.vue or index.tsx
  api/
  components/
  composables/ or hooks/
  types/
  constants/
  modules/
    approval/
      index.vue or index.tsx
      api/
      components/
      composables/ or hooks/
      types/
      constants/
      utils/
    settlement/
      index.vue or index.tsx
      api/
      components/
      composables/ or hooks/
      types/
      constants/
      utils/
```

不要为了形式完整创建空目录；只有出现对应职责时才创建目录。

## 目录边界

- `api/`：请求函数、API DTO 和请求层适配。
- `components/`：视图组件；特性组件放在特性内，真正跨特性组件才进入顶层。
- `composables/` 或 `hooks/`：状态、数据加载、校验编排、派生状态和用户动作。
- `views/`：路由视图入口，适合 Vue 或已有项目使用 views 命名的页面层。
- `pages/`：页面入口，适合文件路由、React/Next/Nuxt 风格或已有项目使用 pages 命名的页面层。
- `modules/`：非路由入口的业务特性、领域模块，或复杂特性的内部子模块。
- `stores/`：跨页面、跨特性或需要持久化的客户端状态。
- `types/`：特性或共享模块使用的契约。
- `constants/`：稳定映射、默认值、枚举文案和配置。
- `utils/`：纯函数、无副作用工具和稳定基础能力。

## 放置规则

- 仅供当前模块使用的 hook/composable、utility、sub-component、constant 或 type，必须留在当前模块目录内。
- 不要为了“整齐”把未复用逻辑提前移动到顶层 `components/`、`utils/`、`types/` 或 `stores/`。
- 除非逻辑已被 3 个及以上特性复用，或它是明确的平台级能力，否则保留在当前模块内。
- 平台级能力包括请求客户端、鉴权框架、路由框架、主题系统、全局布局、通用错误处理等。

## 模块入口

- 每个模块通过 `index.ts`、`index.vue` 或 `index.tsx` 暴露对外入口。
- 模块内部可以引用同级或下级实现细节。
- 模块外部只能从目标模块入口导入，不要跨模块 deep import 内部文件。
