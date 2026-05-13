# Directory Structure

## Default Shape

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

Follow the existing project structure when it is established.

## Feature Colocation

Keep feature-specific files together:

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

For React:

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

## Boundaries

- `api/`: request functions and API DTOs only.
- `types/`: contracts used by the feature or shared module.
- `constants/`: stable mappings, defaults, enum labels, and config.
- `composables/` or `hooks/`: state, data loading, validation orchestration, and actions.
- `components/`: view components and feature UI.
- `utils/`: pure utilities reused across features.

Do not move feature-specific code into global folders just because it might be reused later.

## Utility Placement

- Keep feature-specific utilities inside the feature module.
- Move utilities to shared folders only after real cross-feature reuse exists.
- Do not create global utilities for speculative reuse.
