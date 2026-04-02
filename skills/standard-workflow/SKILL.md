---
name: standard-workflow
description: First-party entry skill that defines the default phase order from clarification through wrap-up.
---

# Standard Workflow

## Overview

This is the first-party entry skill for repository work. It keeps the default flow aligned to the approved sequence:

`requirements clarification -> solution/design -> implementation -> testing -> verification -> wrap-up`

Use this as the starting behavioral layer, then compose domain/language/framework/phase skills as needed.

## When to Use

Use when starting or re-scoping work in this repository, especially when task sequencing or handoff between phases is unclear.

## Hard Gates

1. Do not skip requirements clarification before design or implementation.
2. Do not skip solution/design before implementation.
3. Do not claim completion until testing and verification have both run with fresh evidence.

## Process

1. Clarify requirements, constraints, and success criteria.
2. Define a concrete solution or design approach before coding.
3. Implement in small, reviewable steps.
4. Run task-appropriate tests.
5. Verify outcomes against requirements and test evidence.
6. Wrap up with a concise summary of changes, residual risks, and next steps.

## Boundaries

This skill defines phase order and workflow expectations. It does not replace technical detail owned by domain, language, framework, or phase-specific skills.

## Related Skills

- `frontend`, `backend`
- `javascript`, `typescript`
- `react`, `vue`
- `testing`, `verification`, `wrap-up`
- `personal-defaults` (final overlay)
