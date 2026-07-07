# ECC Development Role Rules

## Scope

- This role is selected explicitly for ECC-native or personal/lightweight workflows.
- Treat ECC as the orchestration provider; do not combine it with OpenSpec, Superpowers, BMAD, or gstack as parallel workflow owners inside this role.
- Default installation is ECC core only. Language, framework, database, security, research, orchestration, and other capability packs are opt-in after project evidence is reviewed.

## Knowledge Retrieval First

Before running ECC onboarding, project scanning, language detection, or implementation work, search project-owned facts in this order:

1. Root guidance: `AGENTS.md`, `CLAUDE.md`, host-specific rule files, and checked-in project instructions.
2. Long-term knowledge: `knowledge/index.md`, `knowledge/memory/MEMORY.md`, `knowledge/**`.
3. AIRules knowledge: `.airules/knowledge/**`, `.airules/requirements/**`, `.airules/tasks/**`, `.airules/tests/**`.
4. Specification state: `openspec/**`, `.specify/**`, product or feature specs, ADRs, and accepted change records.
5. Engineering docs: `docs/**`, package scripts, test docs, API docs, component docs, and architecture notes.

Use targeted search first, for example:

```bash
rg -n "<feature|module|domain|stack>" AGENTS.md CLAUDE.md knowledge .airules openspec .specify docs package.json
```

If a directory does not exist, skip it explicitly. Do not silently invent project facts.

## ECC Core And Opt-in Language Packs

- Native ECC install uses `--profile core` for Codex, Claude, and Cursor.
- OpenCode uses ECC's `opencode` profile to avoid forcing hook runtime into OpenCode.
- Do not install `developer`, `full`, `framework-language`, `database`, `orchestration`, or language/framework skills during role sync.
- For a target project, run ECC `/project-init` or `ecc consult` in dry-run mode before adding project-specific packs.
- Install language packs only after stack evidence exists and the user approves the plan.

Allowed opt-in forms:

```bash
ecc install --profile core --target <target> --with lang:*
ecc install --profile core --target <target> --with framework:*
```

## Project Scan Contract

When language or framework support may be needed:

1. Detect stack signals from project files such as `package.json`, lockfiles, `pyproject.toml`, `requirements.txt`, `go.mod`, `Cargo.toml`, `pom.xml`, Gradle files, framework config files, Docker files, and existing ECC config.
2. Prefer ECC `/project-init` for stack-aware onboarding. It must start as dry-run and report detected evidence, selected modules/components/skills, target paths, skipped unsupported modules, and exact files that would change.
3. Use `repo-scan` only for structural source-code inventory or legacy/monorepo audits; it does not replace reading the project knowledge sources above.
4. Apply non-dry-run installation only after explicit user approval.

## Failure Semantics

- Missing required project facts are blockers, not warnings.
- Conflicting knowledge sources must be reported with file paths; do not pick one silently.
- If ECC cannot map a detected stack to a safe component, report `MISSING ECC component mapping` and continue with core only.
