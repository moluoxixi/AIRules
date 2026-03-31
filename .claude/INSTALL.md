# Moluoxixi Rules Installation Guide (Claude)

## Prerequisites

- Git installed
- Node.js installed
- Claude / Claude Code working properly

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
```

Claude reads from:

```text
~/.claude/rules   -> ~/.moluoxixi/rules
~/.claude/skills  -> ~/.moluoxixi/skills
~/.claude/agents  -> ~/.moluoxixi/agents
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

### Skills (Vendor)

Skills are now sourced exclusively from vendor repositories. See [rules/CATALOG.md](../rules/CATALOG.md) for the complete vendor skill index.

**Key Vendor Skills**:
- `superpowers/*` — AI-native workflow orchestration
- `frontend-design` — Visual design and UI prototyping
- `webapp-testing` — Playwright browser testing
- `code-reviewer` — Code review execution
- `pr-creator` — PR creation per repo template
- `fix` — Lint/format quick-fix

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

# 4. Point Claude entry to ~/.moluoxixi
mkdir -p "${HOME}/.claude"
rm -rf "${HOME}/.claude/rules" "${HOME}/.claude/skills" "${HOME}/.claude/agents"
ln -sfn "${HOME}/.moluoxixi/rules" "${HOME}/.claude/rules"
ln -sfn "${HOME}/.moluoxixi/skills" "${HOME}/.claude/skills"
ln -sfn "${HOME}/.moluoxixi/agents" "${HOME}/.claude/agents"
```

### Windows PowerShell

```powershell
New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\\.moluoxixi" | Out-Null

if (Test-Path "$env:USERPROFILE\\.moluoxixi\\.git") {
  git -C "$env:USERPROFILE\\.moluoxixi" pull --ff-only
} else {
  git clone https://github.com/moluoxixi/AIRules.git "$env:USERPROFILE\\.moluoxixi"
}

node "$env:USERPROFILE\\.moluoxixi\\scripts\\sync-vendors.mjs" --home "$env:USERPROFILE\\.moluoxixi"

node "$env:USERPROFILE\\.moluoxixi\\scripts\\rebuild-links.mjs" --home "$env:USERPROFILE\\.moluoxixi"

New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\\.claude" | Out-Null
if (Test-Path "$env:USERPROFILE\\.claude\\rules") {
  Remove-Item "$env:USERPROFILE\\.claude\\rules" -Recurse -Force
}
if (Test-Path "$env:USERPROFILE\\.claude\\skills") {
  Remove-Item "$env:USERPROFILE\\.claude\\skills" -Recurse -Force
}
if (Test-Path "$env:USERPROFILE\\.claude\\agents") {
  Remove-Item "$env:USERPROFILE\\.claude\\agents" -Recurse -Force
}
cmd /c mklink /J "$env:USERPROFILE\\.claude\\rules" "$env:USERPROFILE\\.moluoxixi\\rules"
cmd /c mklink /J "$env:USERPROFILE\\.claude\\skills" "$env:USERPROFILE\\.moluoxixi\\skills"
cmd /c mklink /J "$env:USERPROFILE\\.claude\\agents" "$env:USERPROFILE\\.moluoxixi\\agents"
```

## Verification

```bash
ls ~/.moluoxixi/vendors/superpowers
ls ~/.moluoxixi/skills
ls ~/.claude/skills
```

Checkpoints:

- `superpowers` is installed
- `~/.moluoxixi/skills/` contains vendor skill links
- `~/.claude/skills/` points to `~/.moluoxixi/skills/`
- `~/.claude/rules/` contains the layered rule structure (common/ + tech-stack/)
- `~/.claude/agents/` contains 4 agent definitions

## Notes

- This setup installs `superpowers` first as the baseline workflow layer
- First-party `rules/` are maintained in this repository with a layered architecture:
  - `common/` - Cross-language principles
  - `{tech-stack}/` - Implementation-specific rules (java/, react/, vue/, etc.)
- Third-party skills are aggregated around `~/.moluoxixi/` and exposed via symlinks
- See [rules/CATALOG.md](../rules/CATALOG.md) for complete rule-skill-agent mapping
