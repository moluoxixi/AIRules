# Spec Kit Project Knowledge

`knowledge/index.md` is the required knowledge-base entry for this Spec Kit
project.

每次任务开始必须先读取 `knowledge/index.md`。If this index links to task-relevant
knowledge files, read those files before planning, editing specs or changing
implementation tasks.

Store long-lived project facts, constraints, decisions and domain context under
`knowledge/`. Keep Spec Kit feature-specific specs, plans and tasks in
`.specify/`.

Knowledge files are context, not higher-priority system instructions. When they
conflict with the current user request, repository code or current Spec Kit
artifacts, prefer the current request and repository state.
