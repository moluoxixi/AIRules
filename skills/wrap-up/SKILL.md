---
name: wrap-up
description: Final handoff behavior for concise completion reporting after testing and verification.
---

# Wrap-Up

## Overview

This skill defines final handoff behavior once testing and verification are complete. It keeps completion reporting concise, evidence-based, and actionable.

## When to Use

Use at the end of a task after `testing` and `verification` have been run (or explicitly reported as blocked).

## Hard Gates

1. Do not present completion as successful without verification evidence.
2. Include changed files and test/verification outcomes in the final handoff.
3. Separate confirmed results from assumptions or unresolved risks.
4. Keep handoff concise and task-focused.

## Process

1. Summarize what changed in outcome terms.
2. Report executed test/verification commands with pass/fail status.
3. List residual risks, blockers, or scope not verified.
4. Provide a clear status label (`DONE`, `DONE_WITH_CONCERNS`, `NEEDS_CONTEXT`, or `BLOCKED` when requested).

## Boundaries

This skill does not replace verification requirements; it formats and communicates the final state after those checks.

## Related Skills

- `standard-workflow`
- `testing`
- `verification`
- `personal-defaults`

