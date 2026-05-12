# Task Splitting

## Split When

- The request changes multiple independent domains, packages, routes, or services.
- The work mixes behavior changes, large refactors, data migration, and UI changes.
- Different tasks can be verified independently.
- Multiple agents or sessions may work in parallel.
- The user asks for a broad goal such as "改造订单管理" that contains several features.

## Keep Together When

- One acceptance criterion cannot work without the other changes.
- The same small set of files must change together.
- Splitting would create unusable intermediate states.

## Subtask Shape

Each subtask should have:
- a user-visible goal;
- file or module scope;
- acceptance criteria;
- test expectations;
- dependencies on earlier subtasks;
- known risks or blocked inputs.

## Parent And Child Work

Use the current functional area as the parent title. Example: `订单管理` can contain `采购订单`, and `采购订单` can contain `新增字段`.

When a new conversation mentions a child item without enough context, infer only from explicit names, aliases, file scope, or project facts. If multiple parent items match, ask before acting.
