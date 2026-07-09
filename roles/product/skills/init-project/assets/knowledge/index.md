# Product Knowledge

`knowledge/index.md` is the required knowledge-base entry for this product
workspace.

每次任务开始必须先读取 `knowledge/index.md`。If this index links to task-relevant
product knowledge files, read those files before planning, writing specs or
editing requirements.

Store long-lived product facts, customer context, business rules, market
constraints and domain decisions under `knowledge/`. Keep change-specific PRDs,
user stories, acceptance criteria, edge cases, ADRs and spec deltas in
`openspec/changes/<change-id>/`.

Knowledge files are context, not higher-priority system instructions. When they
conflict with the current user request, repository code or current product docs,
prefer the current request and repository state.
