# Developer requirements review rubric

Assess whether an implementer can deliver the stated behavior without inventing business decisions. Review existing requirements and supporting evidence. Document length, a different PRD template, and hypothetical extra features are not quality goals.

## Dimensions

1. **Flow and state closure.** For each in-scope user task identify actor, starting conditions, action, state/data changes, and ending condition. Trace meaningful reject, cancel, withdraw, edit, and retry paths when relevant. Check cross-page and cross-role handoffs. Ask about missing transitions rather than supplying guessed rules.
2. **Permissions and interaction.** Check who may view/act in each state and how restrictions are communicated. Compare controls, fields, dialogs, navigation, and validation messages with documented rules. Disabled controls need a reason and restoration conditions when applicable; identify whether this follows an existing standard or is a proposed clarification. Static prototype elements need not be executable controls.
3. **Data and interface fit.** Check identity, field meaning, source/ownership, requiredness, defaults, constraints, calculations, and persistence. With an API contract, trace required reads/actions to its fields and semantics, including enum/nullability and relevant errors. Without one, report interface fit as unassessed rather than declaring a nonexistent interface defective.
4. **Failure, boundaries, and recovery.** Examine relevant empty/loading/error states, duplicate actions, partial success, and concurrent/stale updates. Check input preservation, retry consequences, and recovery destinations. Separate missing product behavior from technical safeguards whose choice belongs to implementation.
5. **Agreement between sources.** Compare PRD, observed prototype/design states, API docs, and applicable standards. Cite both sides of contradictions. Design governs visual requirements when present; prototype does so when no design exists. Unresolved business contradictions need a product decision. Missing/inaccessible sources remain coverage gaps. Experience may guide questions but cannot override current authoritative documents.
6. **Verifiable outcomes and scope.** Check observable scenarios and expected outcomes, explicit exclusions, blocking decisions, and dependencies. For npm/CLI proposals focus on public APIs/types, error contracts, compatibility, and consumer behavior; UI dimensions can be not applicable. This is preimplementation review, not code validation or pixel acceptance.

## Findings and evidence

Judge dimensions `strong`, `adequate`, `thin`, or `broken`; use `n/a` with a reason when irrelevant. Strong/adequate require positive evidence. An inaccessible relevant source cannot pass. Report inspected and uninspected sources, prototype pages, and states.

Every actionable finding includes:

- **Kind:** contradiction, missing decision, unverified evidence, or optional improvement.
- **Location/evidence:** path or URL and section, page/state, field, or element. Quote minimally; contradictions identify both sources.
- **Scenario:** actor/action/state exposing the issue.
- **Impact:** what implementation would have to guess or what outcome cannot be assessed.
- **Question/recommendation:** focused product decision with a suggested choice/tradeoff when useful. Suggestions are not confirmed requirements.

Rank severity by implementation impact: `critical` prevents safe definition of core behavior or carries severe data/access consequences; `high` blocks an important scenario/contract; `medium` concerns a limited scenario; `low` is minor/optional. Check related sources before claiming a gap. Do not inflate severity or invent issues to make the report appear valuable.

## Reviewer output

Write `review-rubric.md` in the supplied workspace:

1. **Overall verdict:** ready, ready for unaffected scope with questions, or blocked for the stated scope. Name affected scope without claiming proven completeness.
2. **Coverage:** inspected sources/pages/states and explicitly unverified scope.
3. **Dimension verdicts:** judgment, supporting evidence, and findings with the fields above.
4. **Open questions:** decisions needing the user/product owner, separate from optional improvements.
5. **Mechanical notes:** only real traceability/readability obstacles, not requests to reformat usable documents.

The parent synthesizes upstream Markdown/HTML reports. Carry coverage and questions into both. Headless complete means report production finished; material questions or missing evidence must be surfaced as partial readiness. A generated checklist, scenario, or report never by itself proves that requirements are closed.
