# Moluoxixi Rules Installation Guide (Codex)

## Prerequisites

- Git installed
- Node.js installed
- Codex CLI installed

## Goal

Codex will use these two locations:

```text
~/.moluoxixi/          Unified aggregation layer
~/.agents/skills/      Codex native skill discovery directory
```

Only one namespace entry will be exposed:

```text
~/.agents/skills/superpowers -> ~/.moluoxixi/skills
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

# 4. Set up Codex entry
mkdir -p "${HOME}/.codex"
cp "${HOME}/.moluoxixi/.codex/AGENTS.md" "${HOME}/.codex/AGENTS.md"

# 5. Expose to Codex native skill discovery directory
mkdir -p "${HOME}/.agents/skills"
rm -rf "${HOME}/.agents/skills/superpowers"
ln -sfn "${HOME}/.moluoxixi/skills" "${HOME}/.agents/skills/superpowers"
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

New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\\.codex" | Out-Null
if (Test-Path "$env:USERPROFILE\\.codex\\AGENTS.md") {
  Remove-Item "$env:USERPROFILE\\.codex\\AGENTS.md" -Force
}
Copy-Item "$env:USERPROFILE\\.moluoxixi\\.codex\\AGENTS.md" "$env:USERPROFILE\\.codex\\AGENTS.md" -Force

New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\\.agents\\skills" | Out-Null
if (Test-Path "$env:USERPROFILE\\.agents\\skills\\superpowers") {
  Remove-Item "$env:USERPROFILE\\.agents\\skills\\superpowers" -Recurse -Force
}
cmd /c mklink /J "$env:USERPROFILE\\.agents\\skills\\superpowers" "$env:USERPROFILE\\.moluoxixi\\skills"
```

## Verification

```bash
ls ~/.moluoxixi/vendors/superpowers
ls -la ~/.agents/skills/superpowers
```

Checkpoints:

- `superpowers` is installed as baseline
- `~/.moluoxixi/skills/` contains vendor skill links
- `~/.agents/skills/superpowers` points to `~/.moluoxixi/skills`
- `~/.codex/AGENTS.md` is synced from `~/.moluoxixi/.codex/AGENTS.md`

## Notes

- This setup installs `superpowers` first as the baseline workflow layer
- First-party `rules/` are maintained in this repository with a layered architecture:
  - `common/` - Cross-language principles
  - `{tech-stack}/` - Implementation-specific rules (java/, react/, vue/, etc.)
- Third-party skills are aggregated around `~/.moluoxixi/` and exposed via symlinks
- See [rules/CATALOG.md](../rules/CATALOG.md) for complete rule-skill-agent mapping
