# 组件分类正反例

本文件只解释 `frontend-code-standard` 的组件分类规则，不定义额外规则。

## 正例：私有叶子例外

```text
components/
  StatusDot.vue
```

`StatusDot.vue` 仅服务当前模块展示，不声明 props、emits、expose、slot、model 或 ref API，不导出类型，也不被跨目录复用。它可以保持单文件，因为它没有形成稳定组件契约。

## 正例：组件包

```text
UserPicker/
  README.md
  index.ts
  src/
    index.vue
    types/
      index.ts
      props.ts
      emit.ts
      expose.ts
```

`UserPicker` 存在稳定 props、事件和 expose 契约，因此必须通过 `component-package` 建立根门面、实现边界和类型门面。

## 反例：单文件承载稳定契约

```text
components/
  UserPicker.vue
```

`UserPicker.vue` 若声明可复用 props、emits、expose、slot、model 或 ref API，却继续停留在单文件中，会让公共契约和实现细节混在一起。它必须升级为 `component-package`。

## 反例：有类型文件但没有组件包门面

```text
components/
  UserPicker.vue
  types/
    props.ts
```

出现 `types/` 已经说明组件契约需要独立维护。此结构缺少组件根 `index.ts` 与 `src/types/index.ts`，必须改为 `component-package`。

## 反例：跨模块复用但深藏在业务目录

```text
views/
  order/
    components/
      UserPicker.vue
  invoice/
    index.vue
```

若 `invoice` 也依赖 `order/components/UserPicker.vue`，说明它不再是 `order` 私有叶子组件。应上浮到最近公共边界，并按 `component-package` 暴露门面。
