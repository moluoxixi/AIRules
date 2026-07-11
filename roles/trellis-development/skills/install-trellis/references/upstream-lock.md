# Trellis upstream lock

- Source: `https://github.com/mindfold-ai/Trellis`
- Package: `@mindfoldhq/trellis@0.6.6`
- Git tag: `v0.6.6`
- Git commit: `41b6a460d298861991b082c7a7fbfa1f9f42fc6f`
- Package integrity: `sha512-c9zdUbKT+agDPZ8Ro3dlq4WetluFAA60JmEx7CeJLKtdVslk0oR8m2e0GKry3kgXEgGkqYuE41FijR3+Axc5MA==`
- License: `AGPL-3.0-only`
- Runtime: Node.js `>=18.17.0`, Python `>=3.9`

The bundled `assets/tool/package-lock.json` freezes the npm dependency graph. Installation uses `npm ci --ignore-scripts`; the installed package still carries its upstream license and source metadata.

Trellis initialization writes `.trellis/` and platform-specific project integration files. It may also install native hooks. AIRules intentionally declares no hook for this role, and the wrapper never enables trust settings or approves hooks on the user's behalf.
