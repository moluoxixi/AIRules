# Supported Platforms

`--platform` accepts these IDs:

`claude`, `cursor`, `opencode`, `codex`, `kilo`, `kiro`, `gemini`,
`antigravity`, `devin`, `qoder`, `codebuddy`, `copilot`, `droid`, `dsh`, `pi`,
`reasonix`, `zcode`, `trae`, `omp`, `grok`, `kimi`, and `snow`.

`claude-code` aliases `claude`; `windsurf` aliases `devin`. Every platform gets
the knowledge Skill and project-instruction fallback. Platforms with stable
command hooks also receive a separately registered knowledge context hook.
