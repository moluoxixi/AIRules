# Moluoxixi Skills Installation Guide (Qoder)

## Prerequisites

- Git installed
- Node.js installed
- Qoder IDE working properly

## Command

### macOS / Linux

```bash
mkdir -p ~/.moluoxixi

if [ -d ~/.moluoxixi/.git ]; then
  git -C ~/.moluoxixi pull --ff-only
else
  git clone https://github.com/moluoxixi/AIRules.git ~/.moluoxixi
fi

npx tsx ~/.moluoxixi/scripts/host-setup.ts --host qoder --mode install
```

### Windows PowerShell

```powershell
New-Item -ItemType Directory -Force -Path "~/.moluoxixi" | Out-Null

if (Test-Path "~/.moluoxixi/.git") {
  git -C "~/.moluoxixi" pull --ff-only
} else {
  git clone https://github.com/moluoxixi/AIRules.git "~/.moluoxixi"
}

npx tsx ~/.moluoxixi/scripts/host-setup.ts --host qoder --mode install
```
