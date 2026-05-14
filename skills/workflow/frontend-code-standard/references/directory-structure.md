# 目录结构

## 默认形态

```text
src/
  api/
  components/
  composables/ or hooks/
  modules/
  router/
  stores/
  styles/
  types/
  utils/
  app.vue or app.tsx
```

项目已有稳定结构时，优先遵循项目结构。

## 特性共置

特性专属文件优先放在特性目录内：

```text
purchaseOrder/
  index.vue
  types/
  constants/
  composables/
  components/
    AuditDialog/
      index.vue
      types/
      constants/
      composables/
```

React 项目可使用：

```text
purchaseOrder/
  index.tsx
  types/
  constants/
  hooks/
  components/
    AuditDialog/
      index.tsx
      types/
      constants/
      hooks/
```

## 边界

- `api/`：请求函数和 API DTO。
- `types/`：特性或共享模块使用的契约。
- `constants/`：稳定映射、默认值、枚举文案和配置。
- `composables/` 或 `hooks/`：状态、数据加载、校验编排和动作。
- `components/`：视图组件和特性 UI。
- `utils/`：跨特性复用的纯工具。

不要因为“以后可能复用”就把特性专属代码提前移到全局目录。

## 工具放置

- 特性专属工具留在特性模块内。
- 确认存在跨特性复用后，再移动到共享目录。
- 不为推测性复用创建全局工具。
