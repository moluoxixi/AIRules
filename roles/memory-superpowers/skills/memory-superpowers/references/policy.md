# Project workflow

This role's project policy takes precedence over Superpowers default skill triggers (including using-superpowers and brainstorming). Keep upstream skills unchanged. Explicit user requests for skills or a complete workflow take precedence over this routing. Superpowers provides AI workflow guardrails; required merge gates remain the project's existing CI and checks.

Read project instructions and configured applicable standards before implementation, regardless of Memory search results. Resolve `memory_superpowers` in the existing `.moluoxixi/config.yaml`, or `.airules/config.yaml` for a standalone project (or the initialization `--config` path). `documents` maps standards/product/api/design to lists of directories, individual files or URLs. Find relevant originals on demand; read all standards applicable to the affected scope. User-supplied task materials also count. Preserve original locations. Report inaccessible required material and resolve its impact; an inaccessible design is not an absent design.

## Sources

Use the existing task identifier and task/plan directory. Without one, use `.airules/tasks/<short-task-id>/sources.jsonl`; a small edit needs no separate design or plan. Record adopted implementation evidence as one JSON object per line: `{"file":"docs/product/order.md","reason":"Order state constraints"}`. Paths are repository relative; external materials use URLs. Include applicable standards and confirmed decisions. Add new evidence incrementally; deduplicate by file. Git diff owns the change list.

Pass this index during resumption, implementation, review and any authorized delegation; read originals relevant to each responsibility. Superpowers design/plan documents reference the index and reuse confirmed requirements. Before completion compare behavior against these originals; resolve changed, conflicting or inaccessible evidence for affected work. Do not merely copy the index into context and skip the originals.

## Routing

Classify by requirement certainty, behavioral impact, compatibility and verification difficulty, rather than lines changed.

A. Read-only answers, code explanation, explicit documentation/copy edits: read relevant sources and check the result; skip the full development pipeline.
B. Clear local changes with controlled impact: establish scope, implement directly, verify appropriately. Copy/visual changes need relevant textual/visual checks, not artificial unit tests. Reassess testing when behavior changes.
C. Bugs: invoke official systematic-debugging, establish a meaningful reproduction and regression check, then fix and verify. Use test-driven-development where applicable to behavior.
D. Features or important requirement gaps: when asked to review existing requirements/prototypes, or unresolved business rules block implementation, invoke `review-requirements` to inspect originals and surface decisions. Reuse its source index, findings and confirmed answers; then invoke applicable brainstorming, writing-plans and execution skills for remaining implementation work. Adequate existing requirements need no repeated product interview.
E. Architecture, cross-module refactors, public API changes: use design, planning, requesting-code-review and thorough verification. Choose subagents and worktrees only when needed and authorized.

Upgrade the route when impact grows and briefly explain why. For important ambiguity affecting business meaning, API contract or data correctness, present evidence, impact and recommendation to the user; continue unaffected work. All routes retain task acceptance criteria. Invoke official verification-before-completion before claiming development complete; read actual outputs and distinguish verified, unverified, failed and blocked items.

Load `scenarios.md` beside this source policy when doing business pages, DIY products, npm packages or CLIs. Initialization copies both references into the same local state directory.

## Experience

When encountering unfamiliar terminology, investigating similar issues, changing a related module or making important decisions, search relevant project experience and compare it with current authoritative documents and code. Use only this clone's `airules-memory` MCP server; it is restricted to the current project. With CLI use `uv run <installed-skill>/scripts/project.py bm --project <root> tool search ... --local`. Read matching notes on demand. If unavailable, read existing Markdown directly and report degraded search.

Before writing, search existing records and prefer updating them. Save reusable verified pitfalls, root causes, solutions, validation evidence, non-obvious background/constraints, aliases/disambiguation and references to authoritative sources. Mark unverified hypotheses explicitly. Include provenance and applicability; correct stale notes. No new lesson means no mandatory summary note. Use official memory-notes and memory-metadata-search as applicable; this policy restricts their scope to project experience.

Formal standards, PRDs, APIs, terminology definitions and architectural decisions retain their authoritative sources. Experience cannot override them or become a second maintained specification. Register only the configured memory directory (default docs/memory), never all docs. Markdown may be committed through the normal project process; writing a note does not authorize commit/push. Databases, indexes, caches, credentials and machine configuration remain local. Every clone/worktree runs initialization independently after clone/pull to register and index shared Markdown. Never use another clone's MCP configuration or a global default project.
