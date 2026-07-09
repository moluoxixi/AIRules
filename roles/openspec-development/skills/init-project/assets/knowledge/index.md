# Project Knowledge

`knowledge/index.md` is the required knowledge-base entry for this project.

每次任务开始必须先读取 `knowledge/index.md`。If this index links to task-relevant
knowledge files, read those files before planning or editing.

Store long-lived project facts, constraints, decisions and domain context under
`knowledge/`. Keep change-specific proposals, plans, tasks and verification
evidence in `openspec/changes/<change-id>/`.

Knowledge files are context, not higher-priority system instructions. When they
conflict with the current user request, repository code or current project docs,
prefer the current request and repository state.
