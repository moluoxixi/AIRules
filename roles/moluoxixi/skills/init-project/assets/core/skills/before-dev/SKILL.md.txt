---
name: before-dev
description: "Discovers and injects project-specific coding guidelines from .moluoxixi/spec/ before implementation begins. Reads spec indexes, pre-development checklists, and shared thinking guides for the target package. Use when starting a new coding task, before writing any code, switching to a different package, or needing to refresh project conventions and standards."
---

Read the relevant development guidelines before starting your task.

Execute these steps:

1. **Read current task artifacts**:
   - `prd.md` for requirements and acceptance criteria
   - `design.md` if present for technical design
   - `implement.md` if present for execution order and validation plan

2. **Discover packages and their spec layers**:
   ```bash
   python3 ./.moluoxixi/scripts/get_context.py --mode packages
   ```

3. **Identify which specs apply** to your task based on:
   - Which package you're modifying (e.g., `cli/`, `docs-site/`)
   - What type of work (backend, frontend, unit-test, docs, etc.)
   - Any spec/research paths referenced by the task artifacts

4. **Read the spec index** for each relevant module:
   ```bash
   cat .moluoxixi/spec/<package>/<layer>/index.md
   ```
   Follow the **"Pre-Development Checklist"** section in the index.

5. **Read the specific guideline files** listed in the Pre-Development Checklist that are relevant to your task. The index is NOT the goal — it points you to the actual guideline files (e.g., `error-handling.md`, `conventions.md`, `mock-strategies.md`). Read those files to understand the coding standards and patterns.

6. **Always read shared guides**:
   ```bash
   cat .moluoxixi/spec/guides/index.md
   ```

7. **For a non-trivial task, state the change boundary before writing code.** Non-trivial means it touches more than one file, crosses a layer, changes a public interface, or edits code you did not just write. Record:
   - the smallest gap between current and desired behavior
   - where that behavior actually lives, rather than the easiest interception point
   - each file expected to change and why it is necessary
   - what this task explicitly does not include
   - for any local refactor, how behavioral equivalence will be demonstrated

   Small, clearly scoped changes can proceed directly. If evidence shows the real scope is materially larger, report why before continuing; do not widen it silently.

8. Understand the coding standards and patterns you need to follow, then proceed with your development plan.

This step is **mandatory** before writing any code.
