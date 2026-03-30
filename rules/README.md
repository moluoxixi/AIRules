# Rules

This directory stores first-party rules with no external dependencies on third-party repositories.

## Layered Inheritance Architecture

Rules follow a three-layer inheritance model:

```
common/                    # Universal principles layer (cross-language)
├── coding-standards.md    # Universal coding standards
├── comments.md            # Universal comment principles
├── testing-standards.md   # Universal testing principles
└── verification.md        # Universal verification principles

tech-stack/                # Tech stack implementation layer (specific tools)
├── java/
│   ├── overview.md        # Architecture principles
│   ├── comments.md        # JavaDoc standards
│   ├── testing.md         # JUnit 5 + Mockito
│   └── verification.md    # Checkstyle + SpotBugs
├── nest/
│   ├── overview.md
│   ├── comments.md        # TSDoc standards
│   ├── testing.md         # Jest + TestingModule
│   └── verification.md    # ESLint + tsc
├── react/
│   ├── overview.md
│   ├── comments.md        # JSDoc/TSDoc component comments
│   ├── testing.md         # Vitest + Testing Library
│   └── verification.md    # ESLint + typescript-eslint
├── vue/
│   ├── overview.md
│   ├── comments.md        # SFC comment standards
│   ├── testing.md         # Vitest + Vue Test Utils
│   └── verification.md    # ESLint + vue-tsc
├── rust/
│   ├── overview.md
│   ├── comments.md        # rustdoc standards
│   ├── testing.md         # #[test] + proptest
│   └── verification.md    # Clippy + rustfmt
├── frontend/              # Cross-framework frontend universal
│   ├── overview.md
│   ├── comments.md
│   ├── testing.md
│   └── verification.md
└── backend/               # Cross-framework backend universal
    ├── overview.md
    ├── comments.md
    ├── testing.md
    └── verification.md
```

## File Naming Conventions

Each tech stack directory contains 4 standard files:

| File | Content |
|------|---------|
| `overview.md` | Pure architecture principles (layers, responsibilities, boundaries) |
| `comments.md` | Comment standards (language/framework specific) |
| `testing.md` | Testing standards (tools, naming, structure) |
| `verification.md` | Verification standards (lint, type check, build) |

## Inheritance Principles

1. **Common Layer**: Defines universal principles across languages, without specific tools
2. **Tech-Stack Layer**: Inherits common principles, specifies concrete tools and commands
3. **Reference Method**: Tech stack files should reference common layer principles rather than redefining them

## Recommended Division of Labor

- `rules/` is responsible for stable, reusable, cross-task constraints such as comment standards, code organization principles, and verification gates
- `skills/` is responsible for task workflows, checklists, and tech stack implementation strategies
- If a requirement needs to apply long-term across multiple skills, prioritize writing it into `rules/`, then reference it from the corresponding skill
