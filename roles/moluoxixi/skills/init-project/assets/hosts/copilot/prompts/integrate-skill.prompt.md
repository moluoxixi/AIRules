---
description: "Moluoxixi Copilot prompt: Integrate Claude Skill into Project Guidelines"
---

# Integrate Claude Skill into Project Guidelines

Adapt and integrate a Claude global skill into your project's development guidelines (not directly into project code).

## Usage

```
/ <skill-name>
```

**Examples**:
```
/ frontend-design
/ mcp-builder
```

## Core Principle

> [!] **Important**: The goal is to prepare complete, reviewable development-guideline candidates, not to generate project code or modify formal specs directly.
>
> - Guidelines target -> `.moluoxixi/spec/{target}/doc.md`
> - Code-example targets -> `.moluoxixi/spec/{target}/examples/skills/<skill-name>/`
> - Example files -> Use `.template` suffix (e.g., `component.tsx.template`) to avoid IDE errors
>
> Prepare candidates under the active task's `research/` directory and submit each target through `spec-proposals.mjs`. A human promotes them with `spec-review`.

## Execution Steps

### 1. Read Skill Content

```bash
openskills read <skill-name>
```

If the skill doesn't exist, prompt user to check available skills:
```bash
# Available skills are listed in AGENTS.md under <available_skills>
```

### 2. Determine Integration Target

Based on skill type, determine which guidelines to update:

| Skill Category | Integration Target |
|----------------|-------------------|
| UI/Frontend (`frontend-design`, `web-artifacts-builder`) | `.moluoxixi/spec/frontend/` |
| Backend/API (`mcp-builder`) | `.moluoxixi/spec/backend/` |
| Documentation (`doc-coauthoring`, `docx`, `pdf`) | `.moluoxixi/` or create dedicated guidelines |
| Testing (`webapp-testing`) | `.moluoxixi/spec/frontend/` (E2E) |

### 3. Analyze Skill Content

Extract from the skill:
- **Core concepts**: How the skill works and key concepts
- **Best practices**: Recommended approaches
- **Code patterns**: Reusable code templates
- **Caveats**: Common issues and solutions

### 4. Prepare Integration Candidates

#### 4.1 Prepare the Complete Guidelines Document

Add a new section to the corresponding `doc.md`:

```markdown
@@@section:skill-<skill-name>
## # <Skill Name> Integration Guide

### Overview
[Core functionality and use cases of the skill]

### Project Adaptation
[How to use this skill in the current project]

### Usage Steps
1. [Step 1]
2. [Step 2]

### Caveats
- [Project-specific constraints]
- [Differences from default behavior]

### Reference Examples
See `examples/skills/<skill-name>/`

@@@/section:skill-<skill-name>
```

#### 4.2 Prepare Example Candidates (if code examples exist)

```bash
# Directory structure ({target} = frontend or backend)
.moluoxixi/spec/{target}/
|-- doc.md                      # Add skill-related section
|-- index.md                    # Update index
+-- examples/
    +-- skills/
        +-- <skill-name>/
            |-- README.md               # Example documentation
            |-- example-1.ts.template   # Code example (use .template suffix)
            +-- example-2.tsx.template
```

**File naming conventions**:
- Code files: `<name>.<ext>.template` (e.g., `component.tsx.template`)
- Config files: `<name>.config.template` (e.g., `tailwind.config.template`)
- Documentation: `README.md` (normal suffix)

#### 4.3 Prepare the Complete Index Candidate

Add to the Quick Navigation table in `index.md`:

```markdown
| <Skill-related task> | <Section name> | `skill-<skill-name>` |
```

#### 4.4 Submit Every Target for Review

For each complete candidate, including `.template` examples, run:

```bash
node ./.moluoxixi/scripts/spec-proposals.mjs propose \
  --target <path-relative-to-.moluoxixi/spec> \
  --content-file <task-local-candidate> \
  --source-task <active-task-path> \
  --reason "Integrate <skill-name> into project guidance"
```

Do not create or edit any formal `.moluoxixi/spec/` target. Report all proposal
IDs and wait for explicit human review through `spec-review`.

### 5. Generate Integration Report

---

## Skill Integration Report: `<skill-name>`

### # Overview
- **Skill description**: [Functionality description]
- **Integration target**: `.moluoxixi/spec/{target}/`

### # Tech Stack Compatibility

| Skill Requirement | Project Status | Compatibility |
|-------------------|----------------|---------------|
| [Tech 1] | [Project tech] | [OK]/[!]/[X] |

### # Integration Locations

| Type | Path |
|------|------|
| Guidelines doc | `.moluoxixi/spec/{target}/doc.md` (section: `skill-<name>`) |
| Code examples | `.moluoxixi/spec/{target}/examples/skills/<name>/` |
| Index update | `.moluoxixi/spec/{target}/index.md` |

> `{target}` = `frontend` or `backend`

### # Dependencies (if needed)

```bash
# Install required dependencies (adjust for your package manager)
npm install <package>
# or
pnpm add <package>
# or
yarn add <package>
```

### [OK] Proposed Changes

- [ ] Submitted complete `doc.md` candidate
- [ ] Submitted complete `index.md` candidate
- [ ] Submitted each example candidate under `examples/skills/<name>/`
- [ ] Example targets use `.template` suffix
- [ ] Left formal specs unchanged pending human review

### # Related Guidelines

- [Existing related section IDs]

---

## 6. Optional: Create Usage Command

If this skill is frequently used, create a shortcut command:

```bash
/ use-<skill-name> Use <skill-name> skill following project guidelines
```

## Common Skill Integration Reference

| Skill | Integration Target | Examples Directory |
|-------|-------------------|-------------------|
| `frontend-design` | `frontend` | `examples/skills/frontend-design/` |
| `mcp-builder` | `backend` | `examples/skills/mcp-builder/` |
| `webapp-testing` | `frontend` | `examples/skills/webapp-testing/` |
| `doc-coauthoring` | `.moluoxixi/` | N/A (documentation workflow only) |

## Example: Integrating `mcp-builder` Skill

### Directory Structure

```
.moluoxixi/spec/backend/
|-- doc.md                           # Add MCP section
|-- index.md                         # Add index entry
+-- examples/
    +-- skills/
        +-- mcp-builder/
            |-- README.md
            |-- server.ts.template
            |-- tools.ts.template
            +-- types.ts.template
```

### New Section in doc.md

```markdown
@@@section:skill-mcp-builder
## # MCP Server Development Guide

### Overview
Create LLM-callable tool services using MCP (Model Context Protocol).

### Project Adaptation
- Place services in a dedicated directory
- Follow existing TypeScript and type definition conventions
- Use project's logging system

### Reference Examples
See `examples/skills/mcp-builder/`

@@@/section:skill-mcp-builder
```
