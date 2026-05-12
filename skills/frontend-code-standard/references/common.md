# Common Frontend Code Standard

## Naming

| Item | Rule | Example |
|---|---|---|
| variable | camelCase | `loading`, `tableData`, `queryParams` |
| function | camelCase, verb-led when possible | `handleSearch`, `createDefaultParams` |
| type/interface | PascalCase | `UserRecord`, `OrderQueryParams` |
| constant | UPPER_SNAKE_CASE | `DEFAULT_PAGE_SIZE` |
| component directory | PascalCase | `FormDrawer/` |
| non-component directory | camelCase | `userManagement/`, `orderList/` |
| hook/composable | `use` + PascalCase | `useUserList`, `useOrderDetail` |
| ref variable | camelCase + `Ref` | `formDrawerRef` |

## Comments

Comments help readers identify purpose, boundary, constraints, side effects, and failure semantics without chasing context.

Must comment:
- modules, pages, components, composables/hooks, stores, complex config objects;
- exported APIs and cross-file reusable functions;
- business rules, validators, permission checks, data transforms, event handlers, and async flows;
- constants whose source, limit, or business meaning is not obvious.

May omit comments only for tiny local callbacks, clear test inline helpers, or short private functions whose role is fully expressed by local context.

Avoid:
- restating the function name;
- comments like "set loading to true";
- vague comments that exist only to satisfy a rule.

## Error And Fallbacks

Do not hide API, validation, or rendering failures with empty defaults, fake success, or silent fallback. If UI needs an empty state, represent it explicitly and keep real failures visible.

API functions should preserve failure semantics unless the caller explicitly asks for a domain-specific error result.

## API Alignment

Frontend models must align with backend contracts:
- do not add fields the API does not return;
- do not support multiple historical field names unless the project explicitly requires compatibility;
- remove stale frontend compatibility when the interface changes;
- keep form models separate from persistence entities when they have different constraints.

## Reuse Threshold

Extract utilities only when reuse is real:
- one file: keep local;
- two or three files: consider extraction if it clarifies the boundary;
- four or more files: extract to a shared module.
