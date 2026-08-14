---
name: brainstorm
description: "Guide requirements discovery for a Moluoxixi task after task-creation consent. Use when the user is ready to clarify requirements before implementation."
---

# Moluoxixi Brainstorm

## Non-Negotiable Planning Contract

A request to implement, fix, refactor, or "go ahead" is not approval to leave planning. Task-creation consent is not implementation approval.

For every non-trivial task, the user must respond after the initial request. If no clarification is needed, that later response must approve the final planning summary. While a user-owned product, scope, UX, compatibility, risk, or acceptance decision remains unresolved, ask exactly one highest-value question and stop without implementation.

## Non-Negotiable Evidence Rule

If a question can be answered by exploring the codebase, explore the codebase instead.

This is mandatory. Before asking the user a question, first check whether the answer is already available in code, tests, configs, docs, existing specs, or task history.

Do not ask the user to confirm facts that the repository can answer. Ask only for product intent, preference, scope, risk tolerance, or decisions that remain ambiguous after inspection.

Repository evidence establishes current behavior and constraints; it does not choose intended behavior or scope for the user.

---

Use this skill during Phase 1 planning to turn the user's request into clear requirements and planning artifacts.

## Preconditions

Use this skill only after task-creation consent has been given and the user is ready to enter Moluoxixi planning.

If no task exists yet, create one:

```bash
TASK_DIR=$({{PYTHON_CMD}} ./.moluoxixi/scripts/task.py create "<short task title>" --slug <slug>)
```

Use a concise title from the user's request. Use a slug without a date prefix. `task.py create` adds the `MM-DD-` directory prefix automatically.

`task.py create` creates the default `prd.md`. Update that file with the current understanding before asking follow-up questions.

## Planning Flow

1. Capture the user's request and initial known facts in `prd.md`.
2. Inspect available evidence before asking questions:
   - code, tests, fixtures, and configs
   - README files, docs, existing specs, and domain notes
   - related Moluoxixi tasks, research files, and session history when present
3. Separate what you found into:
   - confirmed facts
   - product intent still needed from the user
   - scope or risk decisions still needed from the user
   - likely out-of-scope items
4. If a user-owned decision remains, ask one question with recommendation and trade-off, then stop.
5. After each answer, update `prd.md` and recompute the decision inventory.
6. When decisions are resolved, create or update `design.md` and `implement.md` for complex tasks.
7. Run the Requirement Convergence Gate and PRD Convergence Pass.
8. Present the final planning summary and stop without implementation.
9. Only a subsequent message explicitly approving that latest summary authorizes `task.py start`. Material artifact changes require another review.

Do not invent a project-specific product/spec hierarchy. If the repository already has product, domain, or spec docs, use them. If it does not, proceed with the evidence that exists.

## Question Rules

Ask only one question per message.

Each question must include:

- the decision needed
- why the answer matters
- your recommended answer
- the trade-off if the user chooses differently

Do not ask process questions such as whether to search, inspect files, or continue brainstorming. Do the evidence work directly. Ask the user only when the remaining issue is a product decision, preference, scope boundary, or risk tolerance choice.

Recommendations are not default selections. Do not manufacture a question when evidence resolves all decisions; present the final summary, which still requires later approval. Initial implementation requests and approval given before the latest summary do not satisfy this gate.

## Requirement Convergence Gate

Before final review, verify outcome and value, in/out scope, observable acceptance criteria, resolved user-owned decisions, no blocking questions, and researched or explicitly deferred technical unknowns. Lightweight tasks may omit design artifacts but may not skip convergence, final review, or fresh approval.

The final summary includes Goal, In Scope, Out of Scope, Acceptance Criteria, Key Decisions, Risks or Deferred Items, and artifact status.

## Artifact Rules

`prd.md` records requirements and acceptance:

- goal and user value
- confirmed facts
- requirements
- acceptance criteria
- out of scope
- open questions that still block planning

`design.md` records technical design for complex tasks:

- architecture and boundaries
- data flow and contracts
- compatibility and migration notes
- important trade-offs
- operational or rollback considerations

`implement.md` records execution planning for complex tasks:

- ordered implementation checklist
- validation commands
- risky files or rollback points
- follow-up checks before `task.py start`

Lightweight tasks may have only `prd.md`. Complex tasks must have `prd.md`, `design.md`, and `implement.md` before `task.py start`.

`implement.md` is not a replacement for `implement.jsonl`. On sub-agent-dispatch workflows, `implement.jsonl` and `check.jsonl` must each contain at least one real spec/research entry before `task.py start`; the seed `_example` row does not count. Inline workflows skip this JSONL gate because Phase 2 loads context through `moluoxixi-before-dev`.

## PRD Convergence Pass

Before declaring planning ready or running `task.py start`, rewrite `prd.md` once against the final structure described in the artifact rules above. This is not optional cleanup; it is the final planning gate.

The pass must be lossless:

- Collapse repeated facts into one authoritative section.
- Fold temporary brainstorm sections such as `What I already know`, `Assumptions`, and resolved `Open Questions` into Goal, Background, Requirements, Technical Notes, or Acceptance Criteria.
- Remove resolved open questions instead of leaving empty or already-answered sections.
- Merge parallel bug and requirement lists when they describe the same work; keep each defect's severity, evidence, and file:line anchors on the owning requirement.
- Preserve every file:line anchor, decision, constraint, requirement ID, and acceptance-criteria mapping.
- Keep only genuinely blocking open questions.

After the pass, read `prd.md` top to bottom and verify that no fact is repeated across sections unless the repetition adds new information.

## Quality Bar

Before declaring planning ready:

- `prd.md` contains testable acceptance criteria.
- `prd.md` has passed the PRD convergence pass: no unresolved temporary brainstorm sections, no duplicate facts across sections, and no lost anchors, decisions, or acceptance mappings.
- Repository-answerable questions have already been answered through inspection.
- Blocking open questions are empty.
- Complex tasks have `design.md` and `implement.md`.
- Sub-agent-dispatch tasks have real curated entries in both `implement.jsonl` and `check.jsonl`; seed-only manifests are not ready.
- The latest final planning summary has been presented.
- A subsequent user message explicitly approved that summary.

Do not start implementation merely because the initial request asked for it. In manual mode, only a later message approving the latest final planning summary authorizes `task.py start --user-approved`. For task-local automatic execution, require explicit authorization and record it with `task.py set-execution-mode <task> auto --user-authorized`; auto mode does not bypass final-summary approval.
