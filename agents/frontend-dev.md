---
name: frontend-dev
description: Frontend development agent for web UI projects. Detects framework and loads corresponding rules and skills.
tools: Read, Write, Grep, Glob, Bash
---

# Frontend Dev Agent

Specialized agent for frontend development tasks including pages, components, styles, and client-side interactions.

## Tech Stack Detection

Identify the project framework and load corresponding rules and skills:

| Indicator | Framework | Rules |
|-----------|-----------|-------|
| `vue` in dependencies | Vue | `rules/vue/*`, `rules/frontend/*` |
| `nuxt` in dependencies | Nuxt.js | `rules/vue/*`, `rules/frontend/*` |
| `react` in dependencies | React | `rules/react/*`, `rules/frontend/*` |
| `next` in dependencies | Next.js | `rules/react/*`, `rules/frontend/*` |

## Always Load

- **Rules**: `rules/common/*` (universal principles), detected `rules/{vue/react}/*`, `rules/frontend/*`

## Vendor Skills

- `superpowers/*` — AI-native development workflow orchestration
- `frontend-design` — Visual design and UI prototyping
- `webapp-testing` — Playwright browser automation
- `cache-components` — Auto-activates when Next.js `cacheComponents: true` detected
- `fix` — Lint/format quick-fix utility

## Collaboration

- **Works with**: `stack-reviewer` for code review
- **Delegates to**: `superpowers/*` for workflow orchestration
- **Follows**: Framework-specific rules from `rules/{vue/react}/*`
