# Frontend Rules Overview

Focus on page structure, component boundaries, state management, and visual consistency.

## Architecture Principles

- Page and component responsibilities are clear
- First screen, interactions, and error states are complete
- Styling strategy is consistent without chaotic layering
- Use together with UI testing rules

## Related Rules

- [comments.md](./comments.md) - Cross-framework frontend universal comment standards
- [testing.md](./testing.md) - Cross-framework frontend universal testing standards
- [verification.md](./verification.md) - Cross-framework frontend universal verification standards
- [jsdoc.md](./jsdoc.md) - JSDoc/TSDoc detailed standards
- [workflow.md](./workflow.md) - Page task standard workflow

## Directory Structure Conventions

General rules that apply across all frontend frameworks.

- **No empty placeholder directories** — only create directories that are actually used
- **Type-first separation** — type definitions belong in separate `.ts` files, not inline inside component files
- **Unified entry exports** — components export via `index.ts`; pages use `index.vue` / `index.tsx` directly as their entry
- **Naming conventions**
  - Component directories: PascalCase (e.g., `UserPicker/`)
  - Page directories: kebab-case (e.g., `user-manage/`) or follow the route structure
  - Type files: lowercase (e.g., `props.ts`, `emits.ts`, `types.ts`)
