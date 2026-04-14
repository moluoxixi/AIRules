# Moluoxixi AI Workflow Distribution

For Chinese documentation, see [README-zh.md](README-zh.md).

Moluoxixi AI Workflow Distribution is a superpowers-based, skills-first workflow distribution for personal AI coding.

It is built on top of [superpowers](https://github.com/obra/superpowers) and packages a consistent workflow layer across Claude, Codex, Qoder, tare, and openCode.

## What This Distribution Includes

- A shared root `AGENTS.md` as the single baseline source for host global guidance
- Remote vendor skill repositories cloned under `vendor/repos/`
- Final skill artifacts under `vendor/skills/`
- Host-visible projected skills exposed as leaf entrypoints through `~/.moluoxixi/skills/`
- Vendor skills declared in `constants/skills.js` and projected into each host
- First-party agents in `agents/` for orchestration roles
- Multi-host install/upgrade docs in `.claude/`, `.codex/`, `.qoder/`, `.tare/`, and `.opencode/`

## Skill Layout

- `constants/skills.js` defines which remote vendor repositories are synced into `vendor/repos/`
- The same manifest defines how those vendor sources are classified into `vendor/skills/`
- `vendor/skills/` is the only final artifact tree
- Installed host entrypoints read from `~/.moluoxixi/skills/`, which is a flat projection of leaf skill directories from `vendor/skills/`

## Host Support

- Claude / Claude Code
- Cursor
- Codex CLI
- Qoder IDE
- tare
- openCode

## Claude

### Install

Tell Claude:

```
Fetch and follow instructions from https://raw.githubusercontent.com/moluoxixi/AIRules/refs/heads/main/.claude/INSTALL.md
```

### Upgrade

Tell Claude:

```
Fetch and follow instructions from https://raw.githubusercontent.com/moluoxixi/AIRules/refs/heads/main/.claude/UPGRADE.md
```

## Cursor

### Install

Tell Cursor:

```
Fetch and follow instructions from https://raw.githubusercontent.com/moluoxixi/AIRules/refs/heads/main/.cursor/INSTALL.md
```

### Upgrade

Tell Cursor:

```
Fetch and follow instructions from https://raw.githubusercontent.com/moluoxixi/AIRules/refs/heads/main/.cursor/UPGRADE.md
```

## Codex

### Install

Tell Codex:

```
Fetch and follow instructions from https://raw.githubusercontent.com/moluoxixi/AIRules/refs/heads/main/.codex/INSTALL.md
```

### Upgrade

Tell Codex:

```
Fetch and follow instructions from https://raw.githubusercontent.com/moluoxixi/AIRules/refs/heads/main/.codex/UPGRADE.md
```

## Qoder

### Install

Tell Qoder:

```
Fetch and follow instructions from https://raw.githubusercontent.com/moluoxixi/AIRules/refs/heads/main/.qoder/INSTALL.md
```

### Upgrade

Tell Qoder:

```
Fetch and follow instructions from https://raw.githubusercontent.com/moluoxixi/AIRules/refs/heads/main/.qoder/UPGRADE.md
```

## tare

### Install

Tell tare:

```
Fetch and follow instructions from https://raw.githubusercontent.com/moluoxixi/AIRules/refs/heads/main/.tare/INSTALL.md
```

### Upgrade

Tell tare:

```
Fetch and follow instructions from https://raw.githubusercontent.com/moluoxixi/AIRules/refs/heads/main/.tare/UPGRADE.md
```

## openCode

### Install

Tell openCode:

```
Fetch and follow instructions from https://raw.githubusercontent.com/moluoxixi/AIRules/refs/heads/main/.opencode/INSTALL.md
```

### Upgrade

Tell openCode:

```
Fetch and follow instructions from https://raw.githubusercontent.com/moluoxixi/AIRules/refs/heads/main/.opencode/UPGRADE.md
```
