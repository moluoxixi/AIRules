# Moluoxixi Skills Installation Guide (openCode)

## Prerequisites

- Git installed
- Node.js installed
- openCode installed

## Goal

After installation, openCode reads the aggregated skills tree from:

```text
~/.config/opencode/skills -> ~/.moluoxixi/skills
```

The shared installation root remains:

```text
~/.moluoxixi/
  skills/           # First-party skills plus linked vendor skills
  vendors/          # Vendor clones used to build the aggregated skills tree
```

## What's Included

The projected `skills/` tree contains:

- First-party skills such as `standard-workflow`, `personal-defaults`, `frontend`, `backend`, `testing`, `verification`, and `wrap-up`
- Language and framework skills such as `javascript`, `typescript`, `react`, and `vue`
- Vendor skills linked from `vendors/`, including `superpowers/*`

## Installation Steps

### macOS / Linux

```bash
mkdir -p "${HOME}/.moluoxixi"

if [ -d "${HOME}/.moluoxixi/.git" ]; then
  git -C "${HOME}/.moluoxixi" pull --ff-only
else
  git clone https://github.com/moluoxixi/AIRules.git "${HOME}/.moluoxixi"
fi

node "${HOME}/.moluoxixi/scripts/sync-vendors.mjs" --home "${HOME}/.moluoxixi"
node "${HOME}/.moluoxixi/scripts/rebuild-links.mjs" --home "${HOME}/.moluoxixi"

mkdir -p "${HOME}/.config/opencode"
rm -rf "${HOME}/.config/opencode/skills"
ln -sfn "${HOME}/.moluoxixi/skills" "${HOME}/.config/opencode/skills"
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

New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\\.config\\opencode" | Out-Null
if (Test-Path "$env:USERPROFILE\\.config\\opencode\\skills") {
  Remove-Item "$env:USERPROFILE\\.config\\opencode\\skills" -Recurse -Force
}
cmd /c mklink /J "$env:USERPROFILE\\.config\\opencode\\skills" "$env:USERPROFILE\\.moluoxixi\\skills"
```

## Verification

```bash
ls ~/.moluoxixi/skills
ls ~/.config/opencode/skills
```

Checkpoints:

- `~/.config/opencode/skills` points to `~/.moluoxixi/skills`
- openCode is using the shared skills-first projection
- openCode uses the shared skills-first projection directly

## Notes

- `superpowers/*` remains part of the projected skill tree
- openCode uses the same aggregated `~/.moluoxixi/skills/` tree as the other supported hosts
