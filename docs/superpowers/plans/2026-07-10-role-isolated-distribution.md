# Role-Isolated Distribution Kernel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 AIRules 重构为只按独立角色分发 `skills`、`rules`、`hooks`、`mcp` 的通用内核，仓库不再内置任何角色或非分发能力。

**Architecture:** 用户资产只存在于 `<home>/roles/<role>/`。`role-assets.ts` 提供安全的单角色资产接口，`projection-state.ts` 记录并清理上一角色的受管投影，`install.ts` 只实现四类宿主投影，`tool.ts` 与 CLI 只负责编排和显式失败。

**Tech Stack:** TypeScript 6、Node.js 22 标准库、Vitest 4、smol-toml、现有宿主配置表。

## Global Constraints

- 仓库不包含 `roles/` 目录或任何内置角色。
- `--role <name>` 对 `sync`、`add`、`verify` 都是必填参数。
- 角色只允许包含 `skills`、`rules`、`hooks`、`mcp`，不支持 `common`、`extendsRoles`、overlay 或共享资产。
- 不分发 agents，不获取 vendor，不执行第三方 setup，不安装工作流产品。
- 角色目录不存在、路径逃逸、非法资产、投影失败、清理失败或状态写入失败都必须显式终止。
- 用户手工内容不得被受管清理误删。
- 不修改任何 Git 忽略目录；构建和打包验证使用系统临时 staging。

---

## File Structure

### New Modules

- `scripts/lib/role-assets.ts`：校验角色名，解析 `<home>/roles/<role>`，返回四类可选资产路径。
- `scripts/lib/projection-state.ts`：读取、校验、原子写入宿主受管状态，并提供安全旧投影清理。
- `scripts/lib/__test__/role-assets.test.ts`：角色边界、目录缺省和逃逸测试。
- `scripts/lib/__test__/projection-state.test.ts`：状态校验、原子写入和用户内容保护测试。
- `scripts/lib/__test__/distribution-projection.test.ts`：四类资产投影、幂等和双角色隔离测试。

### Rewritten Modules

- `constants/hosts.ts`：只保留 skills、rules、hooks、MCP 宿主能力。
- `scripts/lib/install.ts`：只保留四类资产的投影与受管清理。
- `scripts/lib/verify.ts`：按指定角色资产和受管状态验证宿主。
- `scripts/lib/tool.ts`：解析单角色资产并编排 sync/add/verify。
- `scripts/cli.ts`、`scripts/host-setup.ts`：强制 `--role`，删除 vendor 与角色能力输出。
- `README.md`、`README-zh.md`：只描述独立角色四类资产分发。
- `package.json`、`tsconfig.build.json`、`.gitignore`、`AGENTS.md`：删除角色能力、vendor 和旧资产协议。

### Deleted Modules and Assets

- `roles/**`
- `scripts/lib/roles.ts`
- `scripts/lib/vendors.ts`
- `scripts/lib/vendor-sync.ts`
- `scripts/lib/links.ts`
- `scripts/sync-vendors.ts`
- `scripts/check-rules-consistency.ts`
- `scripts/review-candidates.ts`
- `scripts/memory-health.ts`
- `scripts/verify-scenario-coverage.mjs`
- `vendor-lock.json`
- 与 vendor、agent、角色继承、项目初始化、知识和候选治理对应的测试。

---

### Task 1: Safe Role Asset Source

**Files:**
- Create: `scripts/lib/role-assets.ts`
- Create: `scripts/lib/__test__/role-assets.test.ts`

**Interfaces:**
- Produces:

```ts
export interface RoleAssets {
  role: string
  roleRoot: string
  skillsDir?: string
  rulesFile?: string
  hooksDir?: string
  mcpFile?: string
}

export function requireRoleName(value: unknown): string
export function resolveRoleAssets(home: string, roleValue: unknown): RoleAssets
```

- `requireRoleName` 接受 `^[a-z0-9](?:[a-z0-9-]{0,62})$`。
- `resolveRoleAssets` 要求 `<home>/roles/<role>` 是真实目录。
- 已存在的资产路径经 `realpathSync` 后必须仍位于角色根内。

- [ ] **Step 1: Write boundary tests**

```ts
it('requires an existing safe role name', () => {
  expect(() => resolveRoleAssets(home, '../common')).toThrow(/role name/i)
  expect(() => resolveRoleAssets(home, 'missing')).toThrow(/role directory/i)
})

it('returns only the selected role assets', () => {
  createRole(home, 'alpha', ['skills', 'rules', 'hooks', 'mcp'])
  createRole(home, 'beta', ['skills'])
  expect(resolveRoleAssets(home, 'alpha')).toMatchObject({ role: 'alpha' })
  expect(resolveRoleAssets(home, 'alpha').skillsDir).toContain('alpha')
  expect(resolveRoleAssets(home, 'alpha').skillsDir).not.toContain('beta')
})
```

- [ ] **Step 2: Run the tests and verify RED**

Run: `npx vitest run scripts/lib/__test__/role-assets.test.ts`

Expected: FAIL because `role-assets.ts` does not exist.

- [ ] **Step 3: Implement the minimal role source**

```ts
const roleNamePattern = /^[a-z0-9](?:[a-z0-9-]{0,62})$/u

export function requireRoleName(value: unknown): string {
  if (typeof value !== 'string' || !roleNamePattern.test(value))
    throw new TypeError('Invalid AIRules role name')
  return value
}

export function resolveRoleAssets(home: string, roleValue: unknown): RoleAssets {
  const role = requireRoleName(roleValue)
  const rolesRoot = path.resolve(home, 'roles')
  const requestedRoot = path.join(rolesRoot, role)
  if (!existsSync(requestedRoot) || !statSync(requestedRoot).isDirectory())
    throw new Error(`AIRules role directory does not exist: ${requestedRoot}`)
  const roleRoot = realpathSync(requestedRoot)
  requireInsideRoot(rolesRoot, roleRoot, 'role directory')
  return {
    role,
    roleRoot,
    skillsDir: resolveOptionalAsset(roleRoot, 'skills', 'directory'),
    rulesFile: resolveOptionalAsset(roleRoot, 'rules/AGENTS.md', 'file'),
    hooksDir: resolveOptionalAsset(roleRoot, 'hooks', 'directory'),
    mcpFile: resolveOptionalAsset(roleRoot, 'mcp/mcp.json', 'file'),
  }
}

function requireInsideRoot(root: string, target: string, field: string): void {
  const relative = path.relative(root, target)
  if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative))
    throw new Error(`AIRules ${field} resolves outside its role`)
}

function resolveOptionalAsset(roleRoot: string, relativePath: string, kind: 'file' | 'directory'): string | undefined {
  const requested = path.join(roleRoot, relativePath)
  if (!existsSync(requested))
    return undefined
  const resolved = realpathSync(requested)
  requireInsideRoot(roleRoot, resolved, relativePath)
  const stats = statSync(resolved)
  if (kind === 'file' ? !stats.isFile() : !stats.isDirectory())
    throw new Error(`AIRules role asset has invalid type: ${relativePath}`)
  return resolved
}
```

- [ ] **Step 4: Add symlink-escape and missing-directory tests**

```ts
it('rejects an asset symlink that resolves outside its role', () => {
  const outside = path.join(root, 'outside-skills')
  mkdirSync(outside)
  symlinkSync(outside, path.join(home, 'roles', 'alpha', 'skills'), platformDirectoryLinkType())
  expect(() => resolveRoleAssets(home, 'alpha')).toThrow(/outside.*role/i)
})

it('allows a role with no asset directories', () => {
  mkdirSync(path.join(home, 'roles', 'empty'), { recursive: true })
  expect(resolveRoleAssets(home, 'empty')).toEqual({
    role: 'empty',
    roleRoot: realpathSync(path.join(home, 'roles', 'empty')),
  })
})
```

- [ ] **Step 5: Run tests and commit**

Run: `npx vitest run scripts/lib/__test__/role-assets.test.ts`

Expected: PASS.

```bash
git add scripts/lib/role-assets.ts scripts/lib/__test__/role-assets.test.ts
git commit -m "feat(distribution): add isolated role asset source"
```

---

### Task 2: Managed Projection State

**Files:**
- Create: `scripts/lib/projection-state.ts`
- Create: `scripts/lib/__test__/projection-state.test.ts`

**Interfaces:**
- Consumes: `requireRoleName` from Task 1.
- Produces:

```ts
export interface ProjectionState {
  version: 1
  host: string
  role: string
  skills: Array<{ source: string, target: string }>
  rules?: { source: string, target: string, mode: 'symlink' | 'append' }
  mcp?: { target: string, servers: Record<string, string> }
  hooks: Array<{ target: string, event: string, scriptName: string, command: string }>
}

export function readProjectionState(home: string, host: string): ProjectionState | undefined
export function writeProjectionState(home: string, state: ProjectionState): void
export function removeManagedProjection(state: ProjectionState): void
```

- MCP `servers` 的值是稳定 JSON Hash，只删除目标配置中 Hash 仍匹配的旧服务。
- skills 只删除仍指向记录 source 的符号链接。
- rules 只删除仍指向 source 的链接或 AIRules 受管块。
- hooks 只删除匹配记录 event、scriptName 和 command 的受管条目。

- [ ] **Step 1: Write state validation tests**

```ts
it('round-trips a strict versioned projection state', () => {
  writeProjectionState(home, state)
  expect(readProjectionState(home, 'codex')).toEqual(state)
})

it('rejects unknown fields and mismatched host identities', () => {
  writeRawState(home, 'codex', { ...state, automaticCleanup: true })
  expect(() => readProjectionState(home, 'codex')).toThrow(/fields/i)
})
```

- [ ] **Step 2: Run tests and verify RED**

Run: `npx vitest run scripts/lib/__test__/projection-state.test.ts`

Expected: FAIL because `projection-state.ts` does not exist.

- [ ] **Step 3: Implement strict read and atomic write**

```ts
function statePath(home: string, host: string): string {
  return path.join(path.resolve(home), 'state', 'projections', `${host}.json`)
}

export function writeProjectionState(home: string, state: ProjectionState): void {
  const target = statePath(home, state.host)
  mkdirSync(path.dirname(target), { recursive: true })
  const temporary = `${target}.tmp-${process.pid}-${randomUUID()}`
  writeFileSync(temporary, `${JSON.stringify(state, null, 2)}\n`, 'utf8')
  renameSync(temporary, target)
}
```

- [ ] **Step 4: Write user-content protection tests**

```ts
it('does not remove a skill target replaced by the user', () => {
  replaceManagedLinkWithUserDirectory(state.skills[0].target)
  removeManagedProjection(state)
  expect(readFileSync(path.join(state.skills[0].target, 'USER.md'), 'utf8')).toBe('keep')
})

it('removes only unchanged managed MCP servers', () => {
  mutateOneManagedServerAndAddUserServer(state.mcp!.target)
  removeManagedProjection(state)
  expect(readServers(state.mcp!.target)).toEqual({ changedManaged: expect.anything(), user: expect.anything() })
})
```

- [ ] **Step 5: Implement safe cleanup and commit**

Run: `npx vitest run scripts/lib/__test__/projection-state.test.ts`

Expected: PASS.

```bash
git add scripts/lib/projection-state.ts scripts/lib/__test__/projection-state.test.ts
git commit -m "feat(distribution): track managed host projections"
```

---

### Task 3: Four-Asset Host Projection

**Files:**
- Modify: `constants/hosts.ts`
- Rewrite: `scripts/lib/install.ts`
- Modify: `scripts/lib/skill-projection.ts`
- Create: `scripts/lib/__test__/distribution-projection.test.ts`
- Delete after replacement tests pass: `scripts/lib/__test__/agent-mcp-projection.test.ts`
- Delete after replacement tests pass: `scripts/lib/__test__/hook-projection.test.ts`
- Delete after replacement tests pass: `scripts/lib/__test__/install.test.ts`
- Delete after replacement tests pass: `scripts/lib/__test__/install-coverage.test.ts`

**Interfaces:**
- Consumes: `RoleAssets`, `ProjectionState`, `readProjectionState`, `removeManagedProjection`, `writeProjectionState`.
- Produces:

```ts
export interface ProjectionResult {
  host: string
  role: string
  projected: Array<'skills' | 'rules' | 'hooks' | 'mcp'>
  notApplicable: Array<'skills' | 'rules' | 'hooks' | 'mcp'>
}

export function projectRoleToHost(options: {
  assets: RoleAssets
  host: string
  home: string
  userHome: string
}): ProjectionResult
```

- [ ] **Step 1: Write a complete four-asset projection test**

```ts
it('projects one role skills, rules, hooks, and MCP without agents', () => {
  const assets = createRoleAssets(home, 'alpha')
  const result = projectRoleToHost({ assets, host: 'claude', home, userHome })
  expect(result.projected).toEqual(['skills', 'rules', 'hooks', 'mcp'])
  expect(readlinkSync(path.join(userHome, '.claude', 'skills', 'alpha-skill'))).toContain('roles')
  expect(readFileSync(path.join(userHome, '.claude', 'CLAUDE.md'), 'utf8')).toContain('alpha rules')
  expect(readHostMcp(userHome, 'claude')).toHaveProperty('alpha-server')
  expect(readHostHooks(userHome, 'claude')).toContain('alpha-hook.mjs')
})
```

- [ ] **Step 2: Run the test and verify RED**

Run: `npx vitest run scripts/lib/__test__/distribution-projection.test.ts`

Expected: FAIL because `projectRoleToHost` does not exist.

- [ ] **Step 3: Remove agent fields from host configuration**

Delete `AgentFormat`, `agentFormat`, `includeNativeTomlAgentsAsMarkdown`, `projectSharedResources`, `agentsmd` host and every agent conversion branch. Preserve host IDs and the existing rules, skills, MCP and hook mapping values.

The resulting resolved host interface is:

```ts
export interface ResolvedHostPaths {
  hostHome: string
  hostBaselineFile: string
  projectBaseline: boolean
  baselineMode: 'symlink' | 'append'
  skillsDirName: string
  excludedSkills: string[]
  mcpHome: string
  mcp?: McpProjection
  hooksHome: string
  hooks: HookProjection[]
}
```

- [ ] **Step 4: Rewrite install projection around RoleAssets**

Retain the existing JSON/TOML MCP merge and hook managed-block format, but change every source parameter from `moluoHome/vendor/*` to `RoleAssets` paths.

```ts
export function projectRoleToHost(options: ProjectRoleOptions): ProjectionResult {
  const previous = readProjectionState(options.home, options.host)
  if (previous)
    removeManagedProjection(previous)
  const host = requireHost(options.host, options.userHome)
  const next = emptyProjectionState(options.assets.role, options.host)
  projectSkills(options.assets.skillsDir, host, next)
  projectRules(options.assets.rulesFile, host, next)
  projectHooks(options.assets.hooksDir, host, next)
  projectMcp(options.assets.mcpFile, host, next)
  writeProjectionState(options.home, next)
  return projectionResult(next, host)
}
```

- [ ] **Step 5: Add N/A, idempotency, and isolation tests**

```ts
it('records unsupported host assets as N/A while projecting supported assets', () => {
  const result = projectRoleToHost({ assets, host: 'hermes', home, userHome })
  expect(result.projected).toContain('rules')
  expect(result.notApplicable).toEqual(expect.arrayContaining(['mcp', 'hooks']))
})

it('switches alpha to beta without leaking managed assets', () => {
  projectRoleToHost({ assets: alpha, host: 'claude', home, userHome })
  projectRoleToHost({ assets: beta, host: 'claude', home, userHome })
  expect(hostSkillNames(userHome, 'claude')).toContain('beta-skill')
  expect(hostSkillNames(userHome, 'claude')).not.toContain('alpha-skill')
  expect(hostSkillNames(userHome, 'claude')).toContain('user-skill')
})
```

- [ ] **Step 6: Run projection tests and commit**

Run: `npx vitest run scripts/lib/__test__/role-assets.test.ts scripts/lib/__test__/projection-state.test.ts scripts/lib/__test__/distribution-projection.test.ts`

Expected: PASS.

```bash
git add constants/hosts.ts scripts/lib/install.ts scripts/lib/skill-projection.ts scripts/lib/__test__
git commit -m "feat(distribution): project isolated role assets"
```

---

### Task 4: Role-Required CLI and Verification

**Files:**
- Rewrite: `scripts/lib/tool.ts`
- Rewrite: `scripts/lib/verify.ts`
- Modify: `scripts/cli.ts`
- Modify: `scripts/host-setup.ts`
- Rewrite: `scripts/lib/__test__/tool.test.ts`
- Create: `scripts/lib/__test__/cli-distribution.test.ts`
- Rewrite: `scripts/lib/__test__/verify-coverage.test.ts`

**Interfaces:**
- Consumes: `resolveRoleAssets`, `projectRoleToHost`, `readProjectionState`.
- Produces:

```ts
export interface SyncOptions {
  home: string
  role: string
  host: string
  userHome?: string
  verify?: boolean
}

export interface SyncResult {
  home: string
  role: string
  projectedHosts: string[]
  skippedHosts: string[]
  results: ProjectionResult[]
}

export interface VerifyOptions {
  home: string
  role: string
  host: string
  userHome?: string
}

export function addLocalSkill(options: {
  sourceDir: string
  home: string
  role: string
  name?: string
  overwrite?: boolean
}): AddSkillResult

export async function syncToHosts(options: SyncOptions): Promise<SyncResult>
export async function verifyHosts(options: VerifyOptions): Promise<string[]>
```

- [ ] **Step 1: Write CLI failure tests**

```ts
it.each(['sync', 'verify'])(`requires --role for %s`, (command) => {
  const result = runCli([command, '--host', 'all', '--home', home])
  expect(result.status).toBe(1)
  expect(result.stderr).toMatch(/--role.*required/i)
})

it('adds a skill only to the selected role', () => {
  createEmptyRole(home, 'alpha')
  runCli(['add', sourceSkill, '--role', 'alpha', '--home', home, '--skip-sync'])
  expect(readFileSync(path.join(home, 'roles', 'alpha', 'skills', 'demo', 'SKILL.md'), 'utf8')).toContain('demo')
  expect(existsSync(path.join(home, 'roles', 'beta', 'skills', 'demo'))).toBe(false)
})
```

- [ ] **Step 2: Run tests and verify RED**

Run: `npx vitest run scripts/lib/__test__/cli-distribution.test.ts`

Expected: FAIL because role is currently optional and local skills are global.

- [ ] **Step 3: Remove vendor and default-role orchestration**

Delete manifest resolution, official ECC installation, vendor sync, setup commands, local/global layer merging and all role defaults. Resolve assets exactly once:

```ts
export async function syncToHosts(options: SyncOptions): Promise<SyncResult> {
  const assets = resolveRoleAssets(options.home, options.role)
  const targets = resolveHostTargets(options.host)
  const results = targets.map(host => projectRoleToHost({
    assets,
    host,
    home: options.home,
    userHome: path.resolve(options.userHome ?? os.homedir()),
  }))
  if (options.verify ?? true)
    await verifyHosts({ home: options.home, role: options.role, host: options.host, userHome: options.userHome })
  return {
    home: path.resolve(options.home),
    role: assets.role,
    projectedHosts: results.map(result => result.host),
    skippedHosts: [],
    results,
  }
}
```

- [ ] **Step 4: Make CLI role mandatory and remove legacy flags**

The only accepted options are `--role`, `--host`, `--home`, `--user-home`, `--name`, `--overwrite`, `--no-verify`, `--skip-sync`, and `--help` where applicable.

```ts
function requireRoleOption(values: Record<string, string | boolean | undefined>): string {
  if (values.role === undefined)
    throw new Error('--role is required')
  return requireRoleName(values.role)
}
```

- [ ] **Step 5: Rewrite verification against source and state**

`verifyHost` must confirm selected role equals state role, every managed target still matches its source/hash, and every expected supported asset is represented in state. It must reject stale state from another role.

- [ ] **Step 6: Run CLI/tool/verify tests and commit**

Run: `npx vitest run scripts/lib/__test__/tool.test.ts scripts/lib/__test__/cli-distribution.test.ts scripts/lib/__test__/verify-coverage.test.ts`

Expected: PASS.

```bash
git add scripts/cli.ts scripts/host-setup.ts scripts/lib/tool.ts scripts/lib/verify.ts scripts/lib/__test__
git commit -m "refactor(distribution): require isolated roles in CLI"
```

---

### Task 5: Remove Built-In Capabilities and Legacy Distribution Layers

**Files:**
- Delete: `roles/**`
- Delete: `scripts/lib/roles.ts`
- Delete: `scripts/lib/vendors.ts`
- Delete: `scripts/lib/vendor-sync.ts`
- Delete: `scripts/lib/links.ts`
- Delete: `scripts/sync-vendors.ts`
- Delete: `scripts/check-rules-consistency.ts`
- Delete: `scripts/review-candidates.ts`
- Delete: `scripts/memory-health.ts`
- Delete: `scripts/verify-scenario-coverage.mjs`
- Delete: `vendor-lock.json`
- Delete: `scripts/lib/__test__/vendors.test.ts`
- Delete: `scripts/lib/__test__/vendor-sync.test.ts`
- Delete: `__test__/memory-health.test.ts`
- Delete: `__test__/review-candidates.test.ts`
- Delete: `__test__/scenario-coverage.test.ts`
- Rewrite: `__test__/workflow-contract.test.ts` to reject legacy role/vendor/agent package surfaces.
- Modify: `package.json`
- Modify: `tsconfig.build.json`
- Modify: `.gitignore`
- Modify: `AGENTS.md`
- Modify: `CLAUDE.md` only if it is a tracked independent file rather than a link.

**Interfaces:**
- Consumes the complete replacement runtime from Tasks 1–4.
- Produces a repository with no import, package script or runtime reference to deleted surfaces.

- [ ] **Step 1: Add a repository-boundary test**

Create `__test__/distribution-package.test.ts`:

```ts
it('ships only the role-isolated distribution engine', () => {
  expect(existsSync(path.join(repoRoot, 'roles'))).toBe(false)
  expect(existsSync(path.join(repoRoot, 'scripts/lib/roles.ts'))).toBe(false)
  expect(existsSync(path.join(repoRoot, 'scripts/lib/vendors.ts'))).toBe(false)
  expect(existsSync(path.join(repoRoot, 'scripts/lib/vendor-sync.ts'))).toBe(false)
  const packageJson = readPackageJson(repoRoot)
  expect(Object.keys(packageJson.scripts)).not.toEqual(expect.arrayContaining([
    'sync:development',
    'sync:ecc-development',
    'sync:speckit-development',
    'sync:trellis-development',
    'sync:product',
    'sync:update-lock',
    'candidates:review',
    'memory:health',
  ]))
})
```

- [ ] **Step 2: Run the boundary test and verify RED**

Run: `npx vitest run __test__/distribution-package.test.ts`

Expected: FAIL because legacy files and package scripts still exist.

- [ ] **Step 3: Delete legacy assets and tests**

Use `apply_patch` deletions only. Do not modify ignored `vendor/`, `knowledge/`, `.airules/`, `dist/`, or coverage directories.

- [ ] **Step 4: Simplify package and build configuration**

`package.json` scripts must become:

```json
{
  "airules": "tsx scripts/cli.ts",
  "build": "tsc -p tsconfig.build.json",
  "prepare": "husky",
  "prepack": "npm run build",
  "lint": "eslint --fix",
  "lint:check": "eslint .",
  "sync": "tsx scripts/cli.ts sync",
  "test": "vitest run",
  "typecheck": "tsc --noEmit",
  "coverage": "vitest run --coverage"
}
```

调用方式为 `npm run sync -- --role <name> --host all`；不提供默认角色或无参数 setup 别名。

Remove `roles` from package `files`; remove `roles/*/constants/**/*.ts` from `tsconfig.build.json`; remove the obsolete `vendor` ignore entry only after confirming no runtime writes that path.

- [ ] **Step 5: Rewrite repository-maintenance instructions**

`AGENTS.md` must define only:

- repo-maintenance assets;
- user role assets under `<home>/roles/<role>/{skills,rules,hooks,mcp}`;
- no built-in role assets, vendor protocol or generated-project hierarchy;
- the existing code quality and error-propagation rules.

- [ ] **Step 6: Scan for forbidden legacy references**

Run:

```powershell
rg -n "extendsRoles|COMMON_ROLE|DEFAULT_ROLE|vendor-sync|syncVendors|AgentFormat|projectCodexAgents|roles/common|openspec-development|ecc-development|speckit-development|trellis-development" constants scripts __test__ package.json tsconfig.build.json AGENTS.md
```

Expected: no output.

- [ ] **Step 7: Run focused tests and commit**

Run: `npx vitest run __test__/distribution-package.test.ts scripts/lib/__test__`

Expected: PASS.

```bash
git add -A
git commit -m "refactor(distribution): remove built-in role capabilities"
```

---

### Task 6: Documentation, Package, and Final Verification

**Files:**
- Rewrite: `README.md`
- Rewrite: `README-zh.md`
- Modify: `docs/superpowers/specs/2026-07-10-role-isolated-distribution-design.md` only if implementation reveals a contract correction.
- Test: `__test__/distribution-package.test.ts`

**Interfaces:**
- Documents the final interfaces created in Tasks 1–5 without introducing new runtime behavior.

- [ ] **Step 1: Rewrite README around the four-asset contract**

Both READMEs must include:

```text
<home>/roles/<role>/skills/<skill>/SKILL.md
<home>/roles/<role>/rules/AGENTS.md
<home>/roles/<role>/hooks/<script>
<home>/roles/<role>/mcp/mcp.json
```

Document role creation by manually creating the role directory, mandatory `--role`, host selection, `sync/add/verify`, switching cleanup, supported-host N/A reporting, and the absence of bundled roles.

- [ ] **Step 2: Add package text assertions**

```ts
it('documents mandatory isolated roles without legacy products', () => {
  const readme = readFileSync(path.join(repoRoot, 'README.md'), 'utf8')
  expect(readme).toContain('airules sync --role <name>')
  expect(readme).toContain('<home>/roles/<role>/skills')
  expect(readme).not.toMatch(/OpenSpec|Spec Kit|ECC|Trellis|common role|vendor sync/u)
})
```

- [ ] **Step 3: Run full source verification**

Run:

```powershell
npx eslint constants scripts __test__ --fix
npx vitest run
npm run typecheck
npm run lint:check
npx tsc -p tsconfig.build.json --noEmit
git diff --check
```

Expected: every command exits `0` and Vitest reports zero failed tests.

- [ ] **Step 4: Verify a real temporary build and package**

Copy tracked package sources to a unique system temporary directory, junction its `node_modules` to the workspace dependency directory, set `HUSKY=0`, then run:

```powershell
npm pack --dry-run --silent
node dist/scripts/cli.js --help
```

Expected:

- `prepack` builds successfully in temporary staging;
- package contains no `roles/`, vendor modules or agent modules;
- CLI help lists `sync/add/verify` and mandatory `--role`;
- CLI smoke exits `0`.

- [ ] **Step 5: Final isolation smoke test**

Create temporary roles `alpha` and `beta`, project alpha then beta into a temporary Claude host, and assert:

```ts
expect(hostSkillNames).toContain('beta-skill')
expect(hostSkillNames).not.toContain('alpha-skill')
expect(hostSkillNames).toContain('user-skill')
expect(readProjectionState(home, 'claude')?.role).toBe('beta')
```

- [ ] **Step 6: Commit documentation and final package contract**

```bash
git add README.md README-zh.md __test__/distribution-package.test.ts
git commit -m "docs(distribution): document isolated role assets"
```
