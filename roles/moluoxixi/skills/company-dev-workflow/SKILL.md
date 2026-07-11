---
name: company-dev-workflow
description: Drive company software work from requirement intake through specification, test design, task planning, implementation, automated verification, independent review, delivery, memory capture, and governed capability evolution. Use for feature delivery, bug fixes, refactors, migrations, incident follow-ups, or any repository change that needs auditable artifacts, phase gates, traceability, validation evidence, and controlled learning.
---

# Company Development Workflow

Run one evidence-driven lifecycle through a deterministic state engine. Keep role assets immutable; write case state, artifacts, evidence, decisions, and learning proposals only under `<project>/.ai-workflow/`.

## Establish the case

1. Resolve `<role-root>` from `AI_ROLE_ROOT` and `<project-root>` from the target repository.
2. Run `node <role-root>/skills/company-dev-workflow/scripts/workflow.mjs status --root <project-root>`.
3. If the project is not initialized, run `... workflow.mjs init --root <project-root>`.
4. If no suitable case exists, create one with `... workflow.mjs new --root <project-root> --id <work-id> --title <title> --risk <level> --actor <actor>`.
5. Work only on the active case unless the user explicitly selects another case.

Never put runtime state under `<role-root>`; full role synchronization may replace that path.

## Follow the lifecycle

Read [lifecycle.md](references/lifecycle.md) before driving transitions. Use exactly these phases:

`intake → specification → test-design → planning → implementation → verification → review → delivery → learning → complete`

For every phase:

- Load the current case and validate the previous gate before acting.
- Produce or update the phase artifact from `assets/templates/`.
- Preserve stable trace IDs: `REQ-nnn`, `AC-nnn`, `TEST-nnn`, `TASK-nnn`, and `EVID-nnn`.
- Record assumptions as decisions, not as hidden reasoning.
- Run `validate` before `advance`; let the engine reject incomplete gates.
- Use an explicit rollback reason when new information invalidates an earlier phase.

### 1. Intake

Capture the requester, business outcome, scope, constraints, dependencies, data sensitivity, risk, unknowns, and measurable success. Do not silently invent missing business facts. Mark material unknowns and ask only questions that change scope, safety, architecture, or acceptance.

### 2. Specification

Translate intent into bounded behavior. Assign requirement and acceptance IDs; state invariants, failure behavior, compatibility, security, observability, rollout, and out-of-scope items. Read [artifact-contracts.md](references/artifact-contracts.md) before editing `traceability.json`.

### 3. Test design

Design tests before implementation. Cover happy paths, boundaries, negative cases, regressions, and risk-specific checks. Map every `AC-*` to at least one `TEST-*`; define the oracle and execution level. Do not weaken an acceptance criterion to fit existing behavior.

### 4. Planning

Create small, dependency-ordered `TASK-*` units. Map each task to acceptance criteria and tests, name expected files or components when known, include validation commands, and isolate risky or reversible changes. Do not place coding in the plan before test design is complete.

### 5. Implementation

Implement only planned scope. Prefer the smallest coherent change, preserve unrelated user edits, update task status, and keep tests near the behavior they prove. Stop and return to specification when behavior or scope materially changes.

### 6. Verification

Configure explicit checks in `.ai-workflow/config.json`, then run `... workflow.mjs run-checks --root <project-root> --case <id> --profile <profile> --actor <verifier>`. Record manual or external evidence with `record-evidence`. Treat missing, stale, or unrelated evidence as failure. A verifier must be distinct from an implementer when separation of duties is enabled.

### 7. Review and delivery

Route code and evidence to a reviewer who did not implement the change. Review correctness, trace coverage, security, operability, backward compatibility, test adequacy, and scope discipline. Record the decision with `review`; advance only an approved case. Write a delivery record that identifies the exact revision, migration or rollout steps, residual risk, rollback, and evidence.

### 8. Learning and evolution

Read [governance.md](references/governance.md). Distill durable knowledge into a memory candidate and process gaps into an evolution proposal. Never auto-promote either, and never edit synchronized role assets from runtime learning. Record an explicit `none` disposition with rationale when no durable change is warranted.

## Route specialized work

Use the role agents when available:

- `requirement-intake` for intake and ambiguity triage.
- `specification-architect` for requirements and acceptance contracts.
- `test-strategist` for risk-based test design.
- `delivery-planner` for dependency-ordered tasks.
- `implementation-engineer` for planned code changes.
- `verification-engineer` for independent evidence collection.
- `delivery-reviewer` for approval or change requests.
- `knowledge-curator` for memory candidates.
- `capability-governor` for rule or capability proposals.

Do not delegate final approval to the implementation agent. Give agents the case path and current artifacts, not a paraphrased private version of the requirements.

## Enforce stop conditions

Stop advancement and surface the exact failed condition when:

- required scope, authority, or data classification is unknown;
- acceptance criteria are untestable or have no test mapping;
- planned work lacks traceability;
- required checks are absent, failed, stale, or unverifiable;
- implementation, verification, and review identities violate configured separation;
- delivery lacks rollback or residual-risk disclosure;
- memory or rule changes have no evidence, owner, validation, or approval path.

Never bypass a non-waivable gate. Use a documented waiver only where policy permits, with approver, rationale, expiry, and compensating control.

## Use bundled resources

- Run `scripts/workflow.mjs` for deterministic lifecycle operations and validation.
- Run `scripts/self-test.mjs` after changing the workflow implementation.
- Read `references/lifecycle.md` for transitions and rollback behavior.
- Read `references/artifact-contracts.md` for artifact and trace schemas.
- Read `references/governance.md` for security, memory, and evolution policy.
- Copy and complete files from `assets/templates/`; do not alter source templates during a case.
