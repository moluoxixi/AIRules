# Task Splitting

## Split When

- The request changes multiple independent domains, packages, routes, or services.
- The work mixes behavior changes, large refactors, data migration, and UI changes.
- Different tasks can be verified independently.
- Multiple agents or sessions may work in parallel.
- The user asks for a broad goal such as "改造订单管理" that contains several features.

## Parallel Agent Gate

Use multiple subagents or parallel sessions when all are true:
- there are two or more independent problem domains, failures, modules, files, or research tracks;
- each subtask has a clear goal, boundary, and expected output;
- write scopes do not overlap, or one subtask is read-only research;
- subtasks do not require sequential results from each other;
- each subtask can be verified independently;
- the host environment supports subagents or parallel sessions.

Do not dispatch parallel agents when failures are likely caused by the same root issue, the same files must be edited together, or the parent agent cannot safely review and integrate the results.

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
