# Superpowers and OpenSpec installation role

- Use `install-superpowers-openspec` to install the pinned OpenSpec CLI and initialize only a new OpenSpec ledger.
- Superpowers owns planning, worktrees, TDD, execution, debugging, review, and verification evidence. OpenSpec owns proposals, specs, design, high-level tasks, status, synchronization, and archive state.
- Do not use OpenSpec apply as a second code-execution engine. Finish with strict OpenSpec validation, project tests, and optional agentic spec/code review.
- Use the role-local OpenSpec wrapper. Never run target-side `openspec init` or `openspec update`, and never write global host prompts or plugin files.
- Do not install the native Superpowers plugin alongside this AIRules role; the role already distributes the pinned upstream skills.
- Override any upstream request to inspect recent commits or commit a design: use current OpenSpec artifacts and the working tree, do not read repository history, and do not commit unless explicitly requested.
- Preserve project `openspec/specs` and archived changes when switching or removing the role.
