---
name: verification
description: Repository-specific completion verification guidance that complements superpowers verification-before-completion.
---

# Verification

## Overview

This skill defines repository-specific verification checks before completion claims. It complements `superpowers/verification-before-completion` with practical evidence expectations for this codebase.

## When to Use

Use immediately before reporting completion, especially after tests pass and before final handoff.

## Hard Gates

1. Apply `superpowers/verification-before-completion` as the primary rule set.
2. Re-run the relevant verification command(s) after the final edit, not from stale output.
3. Confirm results against task requirements, not just command exit codes.
4. Report any unverified scope explicitly as risk or follow-up work.

## Process

1. Map each requirement to concrete evidence (test command, file check, behavior check).
2. Run required command(s) fresh and read full output.
3. Confirm requirement-by-requirement coverage and identify gaps.
4. Summarize evidence in final handoff with explicit pass/fail outcomes.

## Repository Notes

- For skill layout updates, treat
  `node --test tests/skill-first-layout.test.mjs`
  as mandatory verification evidence.
- If verification cannot run, provide the blocker and exact missing evidence.

## Boundaries

This skill does not define implementation or testing strategy. Use `testing` for test execution flow and technical skills for code/content decisions.

## Related Skills

- `standard-workflow`
- `testing`
- `superpowers/verification-before-completion`
- `wrap-up`
- `personal-defaults`

