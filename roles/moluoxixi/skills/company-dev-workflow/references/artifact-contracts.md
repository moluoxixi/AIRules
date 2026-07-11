# Artifact and traceability contracts

## Contents

1. Case layout
2. Artifact requirements
3. Traceability schema
4. ID and coverage rules
5. Evidence and decision records

## Case layout

```text
.ai-workflow/
├── config.json
├── index.json
├── audit/events.jsonl
├── cases/<case-id>/
│   ├── case.json
│   ├── traceability.json
│   ├── artifacts/
│   │   ├── intake.md
│   │   ├── spec.md
│   │   ├── test-plan.md
│   │   ├── plan.md
│   │   ├── implementation.md
│   │   ├── verification.md
│   │   ├── review.md
│   │   ├── delivery.md
│   │   └── learning.md
│   ├── decisions/*.json
│   ├── evidence/*.json
│   ├── evidence/*.log
│   └── reviews/*.json
├── memory/candidates/*.md
├── memory/approved/*.md
└── evolution/proposals/*.md
```

## Artifact requirements

Start from the bundled templates. Replace every `<!-- REQUIRED: ... -->` marker. Keep material unknowns explicit; do not delete them merely to pass validation.

- `intake.md`: source, owner, outcome, scope, constraints, sensitivity, risk, dependencies, unknowns, success signal.
- `spec.md`: behavior, invariants, errors, compatibility, security, observability, rollout, out of scope.
- `test-plan.md`: test levels, oracles, fixtures, boundaries, negative paths, non-functional checks.
- `plan.md`: ordered tasks, dependencies, likely files, validation, rollback boundaries.
- `implementation.md`: completed tasks, deviations, affected surfaces, migrations, generated output.
- `verification.md`: environment, revision, required checks, manual evidence, failures and reruns.
- `review.md`: findings, trace audit, risk assessment, reviewer independence, decision reference.
- `delivery.md`: exact revision, change summary, deployment or handoff, rollback, residual risks, links.
- `learning.md`: durable memory disposition, capability-evolution disposition, rationale, owner.

## Traceability schema

Maintain `traceability.json` as valid JSON:

```json
{
  "schema_version": 1,
  "requirements": [
    {
      "id": "REQ-001",
      "text": "A bounded business or system requirement",
      "source": "requester, ticket, regulation, or decision ID",
      "priority": "must",
      "status": "approved"
    }
  ],
  "acceptance_criteria": [
    {
      "id": "AC-001",
      "requirement_ids": ["REQ-001"],
      "given": "observable starting state",
      "when": "observable action or event",
      "then": "measurable result",
      "priority": "must"
    }
  ],
  "tests": [
    {
      "id": "TEST-001",
      "acceptance_ids": ["AC-001"],
      "level": "unit",
      "method": "command, test name, or manual protocol",
      "status": "designed",
      "evidence_ids": []
    }
  ],
  "tasks": [
    {
      "id": "TASK-001",
      "acceptance_ids": ["AC-001"],
      "test_ids": ["TEST-001"],
      "description": "small implementation unit",
      "status": "planned",
      "files": []
    }
  ]
}
```

## ID and coverage rules

- Use uppercase prefixes and three or more digits; never recycle an ID within a case.
- Keep IDs stable when text changes. Add a new ID when semantics split or merge and record a decision.
- Require every `AC-*` to reference existing `REQ-*` entries.
- Require every `AC-*` to be covered by a `TEST-*` before planning.
- Require every `TEST-*` to be owned by a `TASK-*` before implementation.
- Require every `TASK-*` to finish before verification.
- Require each test to have passing evidence before review.
- Keep removed items with an explicit superseded status and decision reference when audit retention matters.

## Evidence and decision records

Create evidence through the engine. Include a unique `EVID-*` ID, kind, pass/fail/blocked status, actor, timestamp, case revision, summary, optional safe relative path, related test IDs, and a SHA-256 content hash. Store redacted logs beside the JSON record.

Create a decision whenever an assumption affects scope, behavior, risk, architecture, or acceptance. Record title, selected choice, alternatives, rationale, actor, and timestamp. Never store hidden chain-of-thought; record only concise, reviewable rationale and evidence.
