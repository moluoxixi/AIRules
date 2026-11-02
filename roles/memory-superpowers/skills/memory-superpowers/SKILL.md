---
name: memory-superpowers
description: Initialize Basic Memory and official Superpowers in a target repository, or use project experience and task sources during development, debugging, review, and task resumption.
---

Resolve the target repository. Run `uv run <skill-directory>/scripts/project.py init --project <absolute-root> --host codex|claude|cursor`. Requires uv, Git and network on first use. Read the resulting output; a nonzero exit means initialization is incomplete. Resolve the reported problem and rerun. Preserve existing MCP entries and hooks. Restart the host and approve the project MCP connection as required by that host.

Read [policy.md](references/policy.md) for development, review and resumption. For example, a local wording edit uses branch A; a recurring checkout failure uses branch C and searches prior experience before root-cause investigation. Do not install either upstream plugin in addition to this skill-based integration. If already installed globally, reuse its official skills and avoid installing a second plugin/bootstrap hook.
