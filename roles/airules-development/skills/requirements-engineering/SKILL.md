---
name: requirements-engineering
description: Convert ambiguous product or engineering intent into implementable OpenSpec proposal and scenario contracts. Use before architecture or coding when requirements, acceptance criteria, API behavior, permissions, state, persistence, failure handling, or scope are unclear.
---

# Engineer requirements

1. Read the request, existing public contracts, relevant code, and active specs.
2. Separate business facts from assumptions and engineering decisions.
3. Write proposal goals, non-goals, constraints, success measures, and unresolved facts.
4. Write each requirement with at least one `SCN-<capability>-<NNN>` scenario using observable WHEN/THEN outcomes.
5. Cover applicable failure, authorization, state transition, persistence, concurrency, recovery, and compatibility behavior.
6. Have Development validate feasibility and testability before passing the requirement gate.

Do not invent absent fields, endpoints, permissions, data sources, or product policy. Record a missing fact and keep the change in intake.

Pass the `requirement` gate only with evidence pointing to the approved proposal and scenarios.
