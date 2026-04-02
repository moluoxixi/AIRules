---
name: testing
description: Repository-specific testing guidance that complements superpowers test-driven-development.
---

# Testing

## Overview

This skill defines repository-specific testing behavior. It complements `superpowers/test-driven-development` by specifying how to scope and run checks in this repo.

## When to Use

Use after or alongside TDD when adding, changing, or reviewing repository behavior, including skill layout and workflow conventions.

## Hard Gates

1. Follow red-green discipline from `superpowers/test-driven-development`; this skill does not replace it.
2. Run the smallest relevant test command first, then broaden only as needed.
3. Include at least one test/assertion that covers the changed behavior directly.
4. Do not claim task completion based on reasoning alone; test evidence is required.

## Process

1. Identify the most targeted command for the changed area.
2. Run targeted checks while iterating.
3. Re-run impacted checks after edits are complete.
4. Capture concise evidence (command, pass/fail result, and notable failures if any).
5. If a test gap remains, call it out explicitly in handoff.

## Repository Notes

- For skill tree presence/structure changes, run:
  `node --test tests/skill-first-layout.test.mjs`
- Prefer deterministic test inputs and avoid brittle assertions tied to incidental formatting.

## Boundaries

This skill is repository-specific and phase-focused. Keep technical implementation guidance in domain/language/framework skills, and completion-claim rules in `verification`.

## Related Skills

- `standard-workflow`
- `superpowers/test-driven-development`
- `verification`
- `wrap-up`
- `personal-defaults`

