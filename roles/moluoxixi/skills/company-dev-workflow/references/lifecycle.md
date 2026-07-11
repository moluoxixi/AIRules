# Lifecycle and gates

## Contents

1. Operating model
2. Phase gates
3. Allowed transitions
4. Failure and recovery
5. Evidence freshness

## Operating model

Treat the workflow engine as the sole writer of case state. Let humans and agents edit phase artifacts and `traceability.json`, but use the CLI or MCP tools for transitions, evidence, decisions, review decisions, memory candidates, and evolution proposals.

Keep synchronized role assets immutable. Store all per-project state under `<project>/.ai-workflow/`. Each command acquires a project lock, writes state atomically, and appends a hash-chained audit event.

Use `status` to identify the active case. A case retains its current phase when blocked; blocking is a status and reason, not a phase that loses lifecycle position.

## Phase gates

| Advance to | Required gate | Deterministic conditions |
| --- | --- | --- |
| `specification` | intake ready | Completed `intake.md`; risk and actor recorded |
| `test-design` | specification ready | Completed `spec.md`; valid `REQ-*` and `AC-*`; every acceptance criterion references a requirement |
| `planning` | test design ready | Completed `test-plan.md`; every `AC-*` is covered by at least one `TEST-*` |
| `implementation` | plan ready | Completed `plan.md`; every test is assigned to at least one `TASK-*`; all tasks are planned |
| `verification` | implementation ready | Completed `implementation.md`; all tasks are `done`; implementer identity recorded |
| `review` | verification passed | Completed `verification.md`; all required configured checks passed; all tests passed with evidence; verifier is independent when configured |
| `delivery` | review approved | Completed `review.md`; latest review is approved; required reviewers are independent |
| `learning` | delivery recorded | Completed `delivery.md`; exact revision, rollout or migration, rollback, and residual risk recorded |
| `complete` | learning recorded | Completed `learning.md`; memory and evolution each have a candidate/proposal or an explicit `none` disposition |

The engine recalculates gates during validation. A prose claim cannot override structured traceability, check results, or review records.

## Allowed transitions

Use the normal forward path:

`intake → specification → test-design → planning → implementation → verification → review → delivery → learning → complete`

Use controlled loops:

- Return `verification → implementation` after a failed check or discovered defect.
- Return `review → implementation` after a change request.
- Return any phase before delivery to `specification` when scope or expected behavior changes materially.
- Reopen a delivered or completed case only through a new follow-up case that links the original; do not rewrite delivered history.

Supply a non-empty reason for every backward transition. The engine invalidates downstream gates, prior review approval, and stale verification results. Preserve prior artifacts and evidence for audit; update them rather than deleting history.

## Failure and recovery

- On a validation failure, stay in the current phase and fix the reported contract violation.
- On an automated check failure, record the failed evidence before returning to implementation.
- On tool or infrastructure failure, distinguish `failed` from `blocked`; never report a blocked check as passed.
- On interrupted writes, rely on atomic rename and rerun the command. Remove a stale lock only after confirming no workflow process is active.
- On conflicting concurrent work, stop and reconcile the case revision; do not force a last-writer-wins state.
- On suspected audit corruption, stop transitions and preserve the directory for investigation.

## Evidence freshness

Evidence is valid only when it identifies the case, command or method, actor, timestamp, status, and content hash. Verification evidence predating the latest implementation-affecting event is stale. Re-run affected checks after code, configuration, schema, dependency, or generated-output changes.
