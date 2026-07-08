<!-- Source: frontend-superpowers-bridge/templates/adopters/CLAUDE.md.fragment.md -->
<!-- Drop this section into your project's CLAUDE.md so Claude routes frontend work using this schema correctly. -->

## Frontend Workflow Routing (read on session start)

This repo uses `frontend-superpowers-bridge` for frontend changes and `superpowers-bridge` for non-frontend changes.

### Entry routing

| Trigger you observe | What to do |
|---|---|
| User starts a frontend/page/component/UI-state design discussion | Run verbal `superpowers:brainstorming`, but **do NOT** write to `docs/superpowers/specs/`. Once the conversation converges, promote to `/opsx:propose` with `--schema frontend-superpowers-bridge` |
| User invokes `/opsx:new` / `/opsx:ff` / `/opsx:propose` for frontend work | Use `frontend-superpowers-bridge`; artifact instructions inject at each step |
| User invokes `/opsx:new` / `/opsx:ff` / `/opsx:propose` for non-frontend work | Use `superpowers-bridge` unless the user chose another schema |
| User explicitly says bug fix / typo / config tweak / doc update | Direct PR — **do NOT** open a change (see skip rules below) |
| User is mid-change | Advance with `/opsx:continue`, `/opsx:apply`, `/opsx:verify`, or `/opsx:archive` |

### Schema Selection

| Scenario | Schema |
|---|---|
| Pure frontend project feature | `frontend-superpowers-bridge` |
| Full-stack change focused on UI/page/component/state/route/permission/browser behavior | `frontend-superpowers-bridge` |
| Backend/API/CLI/infrastructure/docs-only change | `superpowers-bridge` |
| Bug fix with no contract change / typo / config value tweak | Direct PR |

### Frontend Gates

Before frontend implementation, `design.md` must contain `Layout`, `Fields`, `Components`, `States`, and `Frontend Test Matrix`.

If any UI-required field is absent, ambiguous, or permission-unverifiable in API/OpenAPI/interface code/API client/store/route params/permission/state/persistence/static/derived contracts, mark `MISSING blocked: <reason>` and stop before coding.

Every UI unit must be classified as `existing`, `wrap existing`, or `new`.

### ECC Execution Agents

For `frontend-superpowers-bridge` apply/review work, use the projected ECC agents when available:

| Agent | Use |
|---|---|
| `planner` | Implementation planning |
| `tdd-guide` | TDD execution discipline |
| `pr-test-analyzer` | Frontend test matrix coverage analysis |
| `e2e-runner` | Browser/E2E execution |
| `code-reviewer` | General code review |
| `typescript-reviewer` | TypeScript contract review |
| `react-reviewer` | React implementation review |
| `vue-reviewer` | Vue implementation review |
| `react-build-resolver` | React build failure diagnosis |
| `build-error-resolver` | Build/type/lint/test failure diagnosis |
| `silent-failure-hunter` | Missing assertion and swallowed-error review |

### Front-door anti-patterns (don't do)

- Letting brainstorming write to `docs/superpowers/specs/`
- Letting writing-plans write to `docs/superpowers/plans/`
- Coding frontend UI with unresolved `MISSING blocked:` field rows
- Creating new components before checking existing components/hooks/utilities/UI libraries
- Marking frontend tests PASS without commands, exit status, viewport, console/network, or screenshot/log evidence
- Ignoring the ECC execution agents during apply/review when they are available
