# Supported Platforms

Pass one or more IDs to `--platform`, separated by commas.

| ID | Primary output |
| --- | --- |
| `claude` | `.claude/` |
| `cursor` | `.cursor/` |
| `opencode` | `.opencode/` |
| `codex` | `.codex/` and `.agents/skills/` |
| `kilo` | `.kilocode/` |
| `kiro` | `.kiro/` |
| `gemini` | `.gemini/` and `.agents/skills/` |
| `antigravity` | `.agent/` |
| `devin` | `.devin/` |
| `qoder` | `.qoder/` |
| `codebuddy` | `.codebuddy/` |
| `copilot` | `.github/agents`, `.github/copilot`, `.github/hooks`, `.github/prompts`, `.github/skills` |
| `droid` | `.factory/` |
| `pi` | `.pi/` |
| `reasonix` | `.reasonix/` |
| `zcode` | `.zcode/` |
| `trae` | `.trae/` |
| `omp` | `.omp/` |

`claude-code` is accepted as an alias for `claude`. `all` expands to every ID above.

The initializer always creates the shared `.moluoxixi/` runtime, root managed instructions, project specs, workspace index, task root, and local Trellis license notices.
