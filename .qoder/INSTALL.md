# Moluoxixi Rules Installation Guide (Qoder)

## Prerequisites

- Git installed
- Node.js installed
- Qoder IDE working properly

## Goal

After installation, core content will be organized at:

```text
~/.moluoxixi/
  vendors/          # Third-party skill repositories
  rules/            # First-party rules (common + tech-stack layers)
  skills/           # First-party and linked vendor skills
  agents/           # First-party agent definitions
  .claude/          # Claude-specific configuration
  .codex/           # Codex-specific configuration
  .qoder/           # Qoder-specific configuration
```

Qoder reads from:

```text
~/.qoder/rules   -> ~/.moluoxixi/rules
~/.qoder/skills  -> ~/.moluoxixi/skills
~/.qoder/agents  -> ~/.moluoxixi/agents
```

Or for project-level usage, Qoder also supports reading directly from the project root:

```text
./skills/         # Project-level skills
./rules/          # Project-level rules
./agents/         # Project-level agents
```

## What's Included

### Rules (Layered Architecture)

**Common Layer** (Cross-language principles):
- `common/workflow.md` - Standard development workflow phases
- `common/coding-standards.md` - Universal coding conventions
- `common/comments.md` - Cross-language comment principles
- `common/testing-standards.md` - Universal testing principles
- `common/verification.md` - Universal verification gates
- `common/git-conventions.md` - Version control conventions
- `common/overview.md` - High-level architectural principles

**Tech-Stack Layer** (Implementation-specific):
- `java/` - Java (overview, comments, testing, verification)
- `nest/` - NestJS (overview, comments, testing, verification)
- `react/` - React (overview, comments, testing, verification)
- `vue/` - Vue.js (overview, comments, testing, verification)
- `go/` - Go (overview, comments, testing, verification)
- `python/` - Python (overview, comments, testing, verification)
- `rust/` - Rust (overview, comments, testing, verification)
- `frontend/` - Cross-framework frontend guidelines
- `backend/` - Cross-framework backend guidelines

See [rules/CATALOG.md](../rules/CATALOG.md) for complete rule index and inheritance mapping.

### Skills (First-Party)

**Workflow Skills**:
- `coding-standards` - Enforce code quality standards
- `standard-dev-workflow` - Orchestrate workflow phases
- `testing-workflow` - Test planning and execution
- `post-coding-verification` - Run verification pipeline
- `ui-test-planning` - UI-specific test strategies

**Tech Pattern Skills**:
- `java-backend-patterns` - Java implementation patterns
- `nest-patterns` - NestJS implementation patterns
- `react-patterns` - React implementation patterns
- `vue-patterns` - Vue implementation patterns
- `go-patterns` - Go implementation patterns
- `python-patterns` - Python implementation patterns
- `rust-service-patterns` - Rust implementation patterns

### Agents

- `frontend-dev` - Frontend development (Vue, React, Next.js)
- `backend-dev` - Backend development (Java, NestJS, Go, Python, Rust)
- `fullstack-dev` - Full-stack development spanning both layers
- `stack-reviewer` - Review cross-cutting concerns, rule-skill alignment

See [agents/README.md](../agents/README.md) for agent orchestration details.

## Installation Steps

### macOS / Linux

```bash
mkdir -p "${HOME}/.moluoxixi"

# 1. Clone or update repository
if [ -d "${HOME}/.moluoxixi/.git" ]; then
  git -C "${HOME}/.moluoxixi" pull --ff-only
else
  git clone https://github.com/moluoxixi/AIRules.git "${HOME}/.moluoxixi"
fi

# 2. Install superpowers first, then fetch other vendors
node "${HOME}/.moluoxixi/scripts/sync-vendors.mjs" --home "${HOME}/.moluoxixi"

# 3. Rebuild vendor skill links to ~/.moluoxixi/skills
node "${HOME}/.moluoxixi/scripts/rebuild-links.mjs" --home "${HOME}/.moluoxixi"

# 4. Point Qoder entry to ~/.moluoxixi
mkdir -p "${HOME}/.qoder"
rm -rf "${HOME}/.qoder/rules" "${HOME}/.qoder/skills" "${HOME}/.qoder/agents"
ln -sfn "${HOME}/.moluoxixi/rules" "${HOME}/.qoder/rules"
ln -sfn "${HOME}/.moluoxixi/skills" "${HOME}/.qoder/skills"
ln -sfn "${HOME}/.moluoxixi/agents" "${HOME}/.qoder/agents"
```

### Windows PowerShell

```powershell
New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\.moluoxixi" | Out-Null

if (Test-Path "$env:USERPROFILE\.moluoxixi\.git") {
  git -C "$env:USERPROFILE\.moluoxixi" pull --ff-only
} else {
  git clone https://github.com/moluoxixi/AIRules.git "$env:USERPROFILE\.moluoxixi"
}

node "$env:USERPROFILE\.moluoxixi\scripts\sync-vendors.mjs" --home "$env:USERPROFILE\.moluoxixi"

node "$env:USERPROFILE\.moluoxixi\scripts\rebuild-links.mjs" --home "$env:USERPROFILE\.moluoxixi"

New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\.qoder" | Out-Null
if (Test-Path "$env:USERPROFILE\.qoder\rules") {
  Remove-Item "$env:USERPROFILE\.qoder\rules" -Recurse -Force
}
if (Test-Path "$env:USERPROFILE\.qoder\skills") {
  Remove-Item "$env:USERPROFILE\.qoder\skills" -Recurse -Force
}
if (Test-Path "$env:USERPROFILE\.qoder\agents") {
  Remove-Item "$env:USERPROFILE\.qoder\agents" -Recurse -Force
}
cmd /c mklink /J "$env:USERPROFILE\.qoder\rules" "$env:USERPROFILE\.moluoxixi\rules"
cmd /c mklink /J "$env:USERPROFILE\.qoder\skills" "$env:USERPROFILE\.moluoxixi\skills"
cmd /c mklink /J "$env:USERPROFILE\.qoder\agents" "$env:USERPROFILE\.moluoxixi\agents"
```

## Verification

```bash
ls ~/.moluoxixi/vendors/superpowers
ls ~/.moluoxixi/skills
ls ~/.qoder/skills
```

Checkpoints:

- `superpowers` is installed
- `~/.moluoxixi/skills/` contains both vendor skill links and first-party skills
- `~/.qoder/skills/` points to `~/.moluoxixi/skills/`
- `~/.qoder/rules/` contains the layered rule structure (common/ + tech-stack/)
- `~/.qoder/agents/` contains 4 agent definitions

## Notes

- This setup installs `superpowers` first as the baseline workflow layer
- First-party `rules/` are maintained in this repository with a layered architecture:
  - `common/` - Cross-language principles
  - `{tech-stack}/` - Implementation-specific rules (java/, react/, vue/, etc.)
- Third-party skills are aggregated around `~/.moluoxixi/` and exposed via symlinks
- Qoder shares the same `~/.moluoxixi/` aggregation layer with Claude and Codex
- See [rules/CATALOG.md](../rules/CATALOG.md) for complete rule-skill-agent mapping
