---
name: review-requirements
description: Review existing product requirements, prototypes, and API documents for business-flow completeness, contradictions, missing decisions, and implementation readiness before development. Use when a developer asks to review requirements or a prototype, or when unresolved business rules block implementation.
---

# Review existing requirements

Use BMAD's pinned PRD Validate workflow with [review-rubric.md](references/review-rubric.md). This adapter installs only the Validate dependency chain. PRD creation/update requires a full BMAD installation. Superpowers handles subsequent implementation after material decisions are resolved.

## Bind the review

1. Resolve the source repository, primary existing PRD, and existing task directory. Without a task directory, use `.airules/tasks/<task-id>`. Reuse configured `memory_superpowers.documents` and user-supplied materials in their original locations. Examples: review `docs/product/订单.md` against its prototype and API; review an npm package proposal against its public API/type contract.
2. Run `uv run <this-skill>/scripts/bmad.py prepare --project <absolute-repository> --prd <repository-relative-file> --task <repository-relative-task-directory>`. Pass `--config` when initialization used a custom configuration. First use needs uv, Git, and network. Inspect the JSON and exit code: preparation installs dependencies and binds paths; **it does not perform a review**.
3. Read the PRD and relevant configured originals. Returned `documents` are discovery locations, not proof they were read. In `sources_index`, record adopted sources as `{"file":"repository-relative-path-or-URL","reason":"why it matters"}`, preserving unrelated entries and deduplicating by file. Pass this same index to implementation and subsequent reviews.

The CLI accepts a local UTF-8 text PRD. For remote/binary documents, use available document tools to read/export the original into the task input area, record the authoritative URL/path, and label the export as review input, not a replacement PRD. With only a prototype, review its actual available specification and explicitly report missing business decisions; do not invent a PRD to make validation look complete. Unreadable input is missing evidence, not an implicit pass.

## Inspect the prototype and supporting evidence

Open the actual prototype/design with host browser/design tools, following project browser preferences. Inspect relevant pages, dialogs, navigation, and represented states; use screenshots for visual evidence. Screenshot-only inputs support conclusions only about represented states. An absent interaction in a prototype may mean an unspecified requirement, not a confirmed application bug.

Compare PRD and prototype business rules instead of silently choosing one. For visual authority, use a design when present and the prototype when no design exists. An inaccessible design is not absent. Read supplied API field definitions. List sources, states, and interactions that could not be checked. Apply existing project standards, including reasons and recovery conditions for disabled controls.

## Run BMAD Validate

Read the returned `skill_root/SKILL.md`, `references/headless.md`, `references/validate.md`, and the rubric. Invoke with the returned bindings:

- `intent=validate`, `headless=true`, explicit `prd`, and `doc_workspace`. Upstream references to `prd.md` mean the supplied original, regardless of filename. Addendum/memlog apply only when supplied. Preserve the original in place.
- BMAD's `{project-root}` is `project_root`, an isolated runtime used only for BMAD scripts/configuration. The actual repository is `source_project`; resolve source-index entries against it. `{skill-root}` is `skill_root`. Use the supplied absolute workspace/template paths.
- Forward all `resolved_workflow` values as pre-resolved customization, including `workflow.validation_checklist_template`; this selects the development rubric without changing upstream files. Run the rubric walker even for small reviews; add independent reviewers when complexity warrants them.
- Pass actual evidence locations, `sources_index`, and coverage gaps to the reviewer. Keep product/API/prototype/code/configuration inputs read-only. Write reviewer files and both consolidated reports inside `doc_workspace`. Run only Validate; other workflows and external publishing require a separate user request.
- Produce substantive `review-rubric.md`, then `validation-report.md` and `validation-report.html` using upstream synthesis/template. On repeat reviews, synthesize only the reviewer files selected and freshly produced in this run; retain but exclude old reviewer files. Pass this current file list in context instead of using an unrestricted `review-*.md` glob. Re-read both reports: findings must cite inspected evidence and preserve coverage gaps. Generating a checklist is not completing a review.

With a subagent, pass these bindings and require the headless status plus report paths back. Use serial execution when subagents are unavailable. Headless `complete` describes report production, not proof that the requirements are defect-free. Material missing evidence or unresolved product decisions means `partial` readiness even if the report operation completed.

## Surface decisions

The inner headless reviewer records questions without interrupting; **the outer assistant surfaces consequential business/API/data decisions to the user**. Lead with whether implementation can proceed, then blocking/high-impact findings with location, scenario, impact, and a focused question or recommendation. Separate optional improvements. Include report paths and unchecked scope. Continue independent work while decisions are pending. Modify product originals only when requested; record confirmed answers through the existing task decision/source mechanism before dependent implementation.
