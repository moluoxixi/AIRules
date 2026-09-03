# Moluoxixi AIRules

[简体中文](README.md) | English

AIRules distributes versioned role capabilities to AI coding hosts. A role is more than a prompt collection: it is an installable composition of shared skills, MCP servers, a role CLI, project workflows, agents, hooks, and runtime assets.

There are two installation layers:

- `airules install <role>` installs user-level assets. It checks out pinned vendors, composes capabilities, projects skills through `~/.agents/skills`, merges host MCP configuration, and installs declared role CLI packages.
- `init-project` installs project-level assets. It invokes the native role CLI to generate `.moluoxixi/` or `.trellis/`, then adds the AIRules knowledge and Simplified Chinese compatibility extensions.

The AIRules installer handles user-level package setup, asset distribution, and managed skill/MCP verification, but it does not dispatch agents. The initialized Moluoxixi or Trellis main workflow owns dispatch, hooks inject state and context, and skills perform semantic work and file changes.

## `moluoxixi`

For users who want a complete AI development workflow with the native Moluoxixi CLI, project knowledge, multi-domain skills, and controlled multi-agent dispatch.

### Install

```bash
npm install --global moluoxixi-ai-rules
airules install moluoxixi --host all
airules verify moluoxixi --host all
```

The role install includes Moluoxixi core and its global CLI, exposed as both commands:

```bash
moluoxixi --version
ml --version
```

Install the CLI package directly only when you do not want the complete role or need to repair the CLI installation:

```bash
npm install --global @moluoxixi/airules-moluoxixi-cli
```

### Features

#### Installed assets

| Layer | Assets | Responsibility |
| --- | --- | --- |
| User-level role | Moluoxixi core, `moluoxixi`/`ml`, `init-project` | Native initialization, update, task, memory, workflow, and channel commands |
| Shared capabilities | `common`, `coding`, `productivity`, `frontend` | Shared and pinned external skills plus MCP servers |
| Native project | `.moluoxixi/workflow.md`, `tasks/`, `spec/`, `scripts/`, `agents/`, host configuration | Workflow state, task artifacts, project rules, and agent definitions |
| AIRules project extension | `.moluoxixi/knowledge/`, knowledge runtime and hook, `moluoxixi-knowledge` | Source change detection and traceable project knowledge |

`~/.agents/skills` is the canonical shared skill directory. Hosts that can discover it receive no duplicate private copy; AIRules creates managed projections for hosts that require one.

#### Skills

Project workflow entries become slash commands or discoverable skills according to host capabilities; the table uses their common logical names.

| Source | Skill | Purpose |
| --- | --- | --- |
| Role entry | `init-project` | Run the installed Moluoxixi CLI, then install knowledge, host hooks, and Chinese task conventions |
| Project workflow | `moluoxixi-start` | Load identity, Git state, active task, and specs, then select the task path |
| Project workflow | `moluoxixi-brainstorm` | Clarify requirements and tradeoffs and produce PRD, design, and implementation plans |
| Project workflow | `moluoxixi-before-dev` | Load current task artifacts and applicable `.moluoxixi/spec/` rules before editing |
| Project workflow | `moluoxixi-continue` | Resume the active task from its phase index |
| Project workflow | `moluoxixi-check` | Check specs, lint, types, tests, cross-layer flow, reuse, and scope |
| Project workflow | `moluoxixi-break-loop` | Analyze recurring bug causes and preserve prevention mechanisms |
| Project workflow | `moluoxixi-update-spec` | Store confirmed implementation and debugging contracts in project specs |
| Project workflow | `moluoxixi-finish-work` | Verify gates, prompt for commit, archive the task, and record the journal |
| Project workflow | `moluoxixi-channel` | Start, inspect, and coordinate live workers through `moluoxixi channel` |
| Project workflow | `moluoxixi-session-insight` | Search prior conversations through `moluoxixi mem` |
| Project workflow | `moluoxixi-spec-bootstrap` | Build or refresh project-specific coding specs from real source |
| Project workflow | `moluoxixi-meta` | Inspect and customize `.moluoxixi/`, host hooks, agents, skills, and workflow templates |
| Knowledge extension | `moluoxixi-knowledge` | Organize sources into library pages, update `index.md` and `relations.json`, then acknowledge a valid batch |
| `common` | `create-skill` | Create or revise a reusable agent skill |
| `common` | `spec-organization` | Reorganize specification directories, names, indexes, and links |
| `frontend` | `frontend-design` | Give intentional visual direction when creating or reshaping interfaces |
| `productivity` | `grill-me` | Start a rigorous interview that turns an idea into an executable plan |
| `productivity` | `grilling` | Stress-test plans, decisions, and designs |
| `productivity` | `handoff` | Compress the conversation into a document another agent can resume |
| `productivity` | `teach` | Run stateful teaching across sessions in the current repository |
| `productivity` | `to-questionnaire` | Turn unresolved decisions into a questionnaire for an informed person |
| `productivity` | `wait-what` | Restate misunderstood material in direct technical English |
| `productivity` | `writing-for-agents` | Write skills, `AGENTS.md`, and `CLAUDE.md` for agent consumption |

The `coding` capability installs the CodeGraph, Context7, and Sequential Thinking MCP servers for code relationships, library documentation, and structured reasoning. The `frontend` capability installs Playwright MCP for browser inspection and automation.

#### Agents, hooks, and dispatch

| Agent | Responsibility | Write boundary |
| --- | --- | --- |
| `moluoxixi-research` | Research source, specs, and technical options | Writes only to the active task's `research/`; read-only elsewhere |
| `moluoxixi-implement` | Implement from PRD/design/implement and run checks | May edit implementation; never commits or recursively dispatches |
| `moluoxixi-check` | Independently review diff, specs, tests, and scope | May fix mechanical issues; never commits or recursively dispatches |

The main session is the sole dispatcher. In automatic mode, research can precede the execution chain `implement -> check -> update-spec -> commit -> finish-work`. With `dispatch_mode: inline`, the main session runs `before-dev -> edit -> check` itself. `moluoxixi channel spawn --agent <name>` loads definitions from `.moluoxixi/agents/`; its supervisor bridges workers and the main session through the event log.

Hooks inject context but do not replace skills:

```text
UserPrompt/SessionStart
  -> workflow-state hook reads the active task and workflow.md
  -> knowledge-hook.py calls common/knowledge.py for index + status
  -> current phase, task, and impacted knowledge assets enter context
  -> the main session invokes workflow or knowledge skills as needed

SubagentStart
  -> subagent-context hook identifies research/implement/check
  -> injects task JSONL, PRD, design, implement, and relevant specs
```

The knowledge hook performs deterministic scanning and context injection only. `moluoxixi-knowledge` performs semantic organization. `relations.json` is the single machine-readable source of truth for each canonical asset's dependency on one or more sources; the runtime derives the reverse source-to-assets impact index.

### Usage

For first-time full workflow and knowledge setup, ask in the target host:

```text
Use init-project to initialize the Moluoxixi workflow in this project for Codex.
```

A typical task moves through:

```text
describe requirement -> start -> brainstorm -> task start
  -> research when needed -> implement -> check -> update-spec
  -> user-approved commit -> finish-work
```

Put reference material in `.moluoxixi/knowledge/sources/`. On each turn the hook checks for changes; pending sources route the AI through `moluoxixi-knowledge` before the main task.

Use `init-project` only for first-time setup, adding or reconfiguring a host, or restoring extensions. It is unnecessary for shared skills or CLI-only use. Running `moluoxixi init` directly installs native project assets without the AIRules knowledge extension.

Role source: [`roles/moluoxixi`](roles/moluoxixi).

## `matt`

For users who want Matt Pocock's engineering and productivity methods without a fixed project workflow, project agents, hooks, MCP servers, or a role CLI.

### Install

```bash
npm install --global moluoxixi-ai-rules
airules install matt --host all
airules verify matt --host all
```

### Features

#### Installed assets

`matt` composes only the `engineering` and `productivity` capabilities. It installs pinned upstream skills but creates no `.matt/` directory and has no role-owned `init-project`, agents, hooks, CLI, or MCP server.

#### Skills

| Capability | Skill | Purpose |
| --- | --- | --- |
| `engineering` | `ask-matt` | Explicit router that selects the appropriate Matt skill or flow |
| `engineering` | `code-review` | Review changes since a baseline against standards and specification |
| `engineering` | `codebase-design` | Improve module boundaries, interfaces, and testability using deep-module principles |
| `engineering` | `diagnosing-bugs` | Diagnose difficult bugs, performance problems, and regressions |
| `engineering` | `domain-modeling` | Create or revise domain models, `CONTEXT.md`, and ADRs |
| `engineering` | `grill-with-docs` | Interview a design while producing ADR and vocabulary documents |
| `engineering` | `implement` | Implement an existing specification or ticket set |
| `engineering` | `improve-codebase-architecture` | Find architectural improvement opportunities and drive decisions |
| `engineering` | `prototype` | Build a disposable prototype to answer design, state, or UI questions |
| `engineering` | `research` | Research primary sources and write repository Markdown |
| `engineering` | `resolving-merge-conflicts` | Resolve an active merge/rebase and run checks |
| `engineering` | `setup-matt-pocock-skills` | Configure issue tracking, triage labels, and domain documentation |
| `engineering` | `tdd` | Develop through red-green-refactor |
| `engineering` | `to-spec` | Convert the conversation into a specification and publish it to the issue tracker |
| `engineering` | `to-tickets` | Split a plan or spec into dependency-aware tracer-bullet tickets |
| `engineering` | `triage` | Validate and classify issues or external PRs into agent-ready briefs |
| `engineering` | `wayfinder` | Plan work larger than one agent session as a decision and ticket map |
| `engineering` | `wizard` | Generate an interactive Bash wizard for human-only credentials, consoles, or migrations |
| `productivity` | `grill-me` | Start a rigorous planning interview |
| `productivity` | `grilling` | Stress-test a plan, decision, or design |
| `productivity` | `handoff` | Produce a resumable cross-agent handoff |
| `productivity` | `teach` | Teach across sessions with recorded state |
| `productivity` | `to-questionnaire` | Turn unknowns into a questionnaire for an informed person |
| `productivity` | `wait-what` | Restate material that was not understood |
| `productivity` | `writing-for-agents` | Write agent-facing documents and skills |

#### Dispatch

`matt` has no project agent scheduler. The host discovers skills from their `SKILL.md` descriptions, and manually constrained skills are not guaranteed to trigger automatically. Explicitly request `ask-matt` when the right path is unclear.

### Usage

No `init-project` step is required. State the engineering goal or name a skill directly:

```text
Use ask-matt to select the right engineering workflow for this requirement.
Use diagnosing-bugs to find the cause of this performance regression.
Turn this proposal into a spec, then use to-tickets to split the work.
Implement this behavior with tdd, then run code-review.
```

A typical extended chain is `setup-matt-pocock-skills -> to-spec -> to-tickets -> implement -> code-review`; isolated problems can invoke one skill directly. The host, repository documents, or issue tracker owns state, and AIRules creates no `.matt/` directory.

Role source: [`roles/matt`](roles/matt).

## `trellis`

For users who want the native Trellis task-and-specification workflow together with AIRules shared skills, MCP, project knowledge, and multi-agent dispatch.

### Install

```bash
npm install --global moluoxixi-ai-rules
airules install trellis --host all
airules verify trellis --host all
trellis --version
```

The role install provides the Trellis CLI and user-level capabilities but does not modify a project. `init-project` creates project-local workflow assets.

### Features

#### Installed assets

| Layer | Assets | Responsibility |
| --- | --- | --- |
| User-level role | Trellis CLI and `init-project` | Native `init/update/upgrade/uninstall/mem/workflow/platforms/channel` commands |
| Shared capabilities | `common`, `coding`, `productivity`, `frontend` | The same shared skills, pinned external skills, and MCP servers as Moluoxixi |
| Native project | `.trellis/workflow.md`, `tasks/`, `spec/`, `scripts/`, `agents/`, host configuration | Plan/Execute/Finish state, task artifacts, specs, and agent definitions |
| AIRules project extension | `.trellis/knowledge/`, knowledge runtime and hook, `trellis-knowledge` | Source change detection and bidirectionally traceable knowledge |

#### Skills

Native Trellis projects workflow entries as commands or skills according to host capabilities; the table uses their common skill names.

| Source | Skill | Purpose |
| --- | --- | --- |
| Role entry | `init-project` | Run native `trellis init`, then add knowledge, README usage, and Chinese task conventions |
| Project workflow | `trellis-start` | Initialize a development session and select the task path |
| Project workflow | `trellis-brainstorm` | Clarify complex requirements and create PRD, design, and implementation plans |
| Project workflow | `trellis-before-dev` | Load applicable project coding guidelines before implementation |
| Project workflow | `trellis-continue` | Resume the current task from its phase index |
| Project workflow | `trellis-check` | Check specs, lint, types, tests, reuse, scope, and cross-layer consistency |
| Project workflow | `trellis-break-loop` | Analyze recurring bugs and establish prevention mechanisms |
| Project workflow | `trellis-update-spec` | Preserve confirmed contracts and coding conventions in `.trellis/spec/` |
| Project workflow | `trellis-finish-work` | Verify quality gates, archive the task, and record the journal |
| Project workflow | `trellis-channel` | Coordinate live multi-agent work through the channel runtime |
| Project workflow | `trellis-session-insight` | Search prior conversations through `trellis mem` |
| Project workflow | `trellis-spec-bootstrap` | Build or refresh specs from real source |
| Project workflow | `trellis-meta` | Inspect and customize `.trellis/`, platform hooks, agents, skills, and workflow |
| Knowledge extension | `trellis-knowledge` | Organize sources, update library/index/relations, and acknowledge a stable batch |
| `common` | `create-skill` | Create or revise a reusable agent skill |
| `common` | `spec-organization` | Reorganize project specification documents and indexes |
| `frontend` | `frontend-design` | Guide intentional frontend design and redesign |
| `productivity` | `grill-me` | Start a rigorous requirements interview |
| `productivity` | `grilling` | Stress-test plans, decisions, and designs |
| `productivity` | `handoff` | Produce a cross-agent handoff |
| `productivity` | `teach` | Teach across sessions with recorded progress |
| `productivity` | `to-questionnaire` | Turn unresolved questions into a questionnaire |
| `productivity` | `wait-what` | Restate misunderstood material |
| `productivity` | `writing-for-agents` | Write agent-facing documents and skills |

Trellis also installs the CodeGraph, Context7, Sequential Thinking, and Playwright MCP servers. Its role-owned MCP manifest is empty; these servers come from `coding` and `frontend` capabilities.

#### Agents, hooks, and dispatch

| Agent | Responsibility | Dispatch point |
| --- | --- | --- |
| `trellis-research` | Research code, specs, and technical choices, writing only task research | Plan or pre-execution research |
| `trellis-implement` | Implement from task artifacts and run baseline checks | Execute |
| `trellis-check` | Independently review implementation and repair mechanical issues | After implement, before commit |

The main session normally dispatches `trellis-implement -> trellis-check`, inserting research when needed. Subagent prompts start with `Active task`, then hooks inject context in the order `JSONL -> prd.md -> design.md -> implement.md -> spec`. Implement and check agents cannot dispatch each other or recurse. With `dispatch_mode: inline`, the main session runs `trellis-before-dev -> edit -> trellis-check`.

Plan creates and confirms the PRD and, for complex work, design and implementation artifacts before `task.py start`. Execute implements and checks. Finish runs break-loop when needed, updates specs, asks for commit approval, and runs finish-work. The channel runtime can also load `.trellis/agents/implement.md` and `check.md` as persistent workers.

The knowledge chain mirrors Moluoxixi: a host event invokes `knowledge-hook.py`; the shared scanner computes source changes, impacted assets, and relationship errors; the hook injects `<trellis-knowledge>`; `trellis-knowledge` performs organization and acknowledgement.

### Usage

For first-time full workflow and knowledge setup, ask:

```text
Use init-project to initialize the Trellis workflow in this project for developer wl and Codex.
```

Use the workflow entry points during development:

```text
Use Trellis to start this requirement: <describe the requirement>
Use Trellis to continue the current task.
Use Trellis to check the current changes.
Use Trellis to finish this work.
```

The workflow is Plan → Execute → Finish. Put reference material in `.trellis/knowledge/sources/`; when the hook finds changes it routes through `trellis-knowledge` before the main task.

Use `init-project` only for first-time setup, adding a host, or reconfiguration. It is unnecessary when using only the role's shared skills and MCP servers.

Role source: [`roles/trellis`](roles/trellis).

## Shared distribution

Roles declare capabilities. The registry composes vendors in declaration order, merges compatible projections, deduplicates identical projections, and rejects source or target conflicts. See [capabilities/README.md](capabilities/README.md) for the complete mapping.

```text
role manifest
  -> pinned vendor checkout / package setup
  -> vendor staging
  -> canonical ~/.agents/skills
  -> host skill projection and MCP merge
```

The managed shared layer reflects the currently installed role, so roles are not fully isolated environments that accumulate forever. Existing user MCP entries win same-name conflicts. `airules verify` checks managed skills, host links, and MCP server names, not project agents and hooks generated by an initializer; the native workflow checks those assets.

## Development

```bash
npm install
npm test
npm run typecheck
npm run lint:check
```

## License

MIT
