# Remote Role Asset Distribution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 按必填 role 从全远程 vendor checkout 汇聚 `skills`、`agents`、`rules`、`hooks`、`mcp`，其中 `moluoxixi` 全量复制所选 `roles/<role>` 资产，再安全投影到宿主。

**Architecture:** `vendors.ts` 只把 role manifest 归一成远程资产声明；深模块 `vendor-staging.ts` 负责所有路径校验、冲突、moluoxixi 覆盖与事务提交。`tool.ts` 只编排远程获取、staging、宿主投影和 verify，不存在 workspace/local source、默认 role 或 overlay 分支。

**Tech Stack:** TypeScript 6、Node.js 22 标准库、Vitest 4、smol-toml、现有 Git vendor adapter 与宿主映射。

## Global Constraints

- 所有运行时资产必须来自 Git remote checkout；禁止 workspace/local vendor、本地 assets 层、repoRoot 直读、旧缓存 fallback。
- 当前仓库对应远程 vendor ID `moluoxixi`。
- `moluoxixi` 全量复制所选 `roles/<role>` 的 `skills`、`agents`、`rules`、`hooks`、`mcp`。
- role 只决定路径；无默认 role、`extendsRoles`、`common` overlay 或跨角色共享语义。
- 普通 vendor 冲突失败；moluoxixi role-assets 只覆盖本次 staging 的受管目标。
- 不修改 Git 忽略目录；测试在系统临时目录中构造 remote checkout 与 staging。
- 外部路径、JSON/TOML、文件类型和符号链接在进入 staging 前显式校验，失败不得提交半成品。

---

### Task 1: Remote-Only Vendor Manifest

**Files:**
- Modify: `scripts/lib/vendors.ts`
- Modify: `scripts/lib/links.ts`
- Rewrite: `scripts/lib/roles.ts`
- Test: `scripts/lib/__test__/vendors.test.ts`
- Test: `scripts/lib/__test__/install-coverage.test.ts`

**Interfaces:**
- Produces:

```ts
export type VendorProjection =
  | NamespaceProjection
  | SkillsProjection
  | AgentsProjection
  | RulesProjection
  | HooksProjection
  | McpProjection
  | RoleAssetsProjection

export interface RulesProjection {
  kind: 'rules'
  sourceFile: string
  targetFile?: string
}

export interface HooksProjection {
  kind: 'hooks'
  sourceDir: string
  targetDir?: string
  hooks?: Array<string | { name: string, output?: string }>
}

export interface RoleAssetsProjection {
  kind: 'role-assets'
  sourceDir: string
}

export interface VendorRepo {
  name: string
  official: boolean
  source: string
  setup?: SetupCommand[]
  projections: VendorProjection[]
}
```

- `VendorRepo` 不再包含 `sourceMode`。
- `VendorLink.kind` 增加 `rules-file`、`hooks-dir`、`hook-file`、`role-assets-dir`。
- `requireRolePaths(repoRoot, role)` 强制安全 role 与独立 constants；不提供默认值或 overlay 列表。

- [ ] **Step 1: Write failing manifest tests**

```ts
it('normalizes remote rules, hooks, and role-assets projections', () => {
  const vendors: Record<string, Vendor> = {}
  walkVendorTree([{ name: 'remote', official: true, source: 'https://example.com/remote.git', projections: [
    { kind: 'rules', sourceFile: 'rules/AGENTS.md' },
    { kind: 'hooks', sourceDir: 'hooks' },
    { kind: 'role-assets', sourceDir: 'roles/alpha' },
  ] }], [], vendors)
  expect(vendors.remote.links).toEqual([
    expect.objectContaining({ kind: 'rules-file', target: 'vendor/AGENTS.md' }),
    expect.objectContaining({ kind: 'hooks-dir', target: 'vendor/hooks' }),
    expect.objectContaining({ kind: 'role-assets-dir', target: 'vendor' }),
  ])
})

it('rejects workspace and local source declarations', () => {
  const vendors: Record<string, Vendor> = {}
  expect(() => walkVendorTree([{
    name: 'bad', official: true, source: 'https://example.com/bad.git',
    sourceMode: 'workspace', projections: [],
  }], [], vendors))
    .toThrow(/workspace|sourceMode/i)
})
```

- [ ] **Step 2: Run RED**

Run: `npx vitest run scripts/lib/__test__/vendors.test.ts`

Expected: FAIL because the new projection kinds are unsupported and workspace remains accepted.

- [ ] **Step 3: Implement the manifest types and normalization**

Use typed discriminated unions, exact default targets, and reject unknown projection kinds. Do not infer hooks/rules from arbitrary repository folders.

- [ ] **Step 4: Remove default/overlay role resolution**

```ts
export function requireRolePaths(repoRoot: string, roleValue: unknown): RolePaths {
  const role = requireRoleName(roleValue)
  const roleRoot = realpathInside(path.join(repoRoot, 'roles'), role)
  const constantsFile = path.join(roleRoot, 'constants', 'skills.ts')
  if (!existsSync(constantsFile))
    throw new Error(`AIRules role constants do not exist: ${constantsFile}`)
  return { role, roleRoot, constantsFile }
}
```

- [ ] **Step 5: Run focused tests**

Run: `npx vitest run scripts/lib/__test__/vendors.test.ts scripts/lib/__test__/role-assets.test.ts`

Expected: PASS.

---

### Task 2: Transactional Multi-Asset Staging

**Files:**
- Create: `scripts/lib/vendor-staging.ts`
- Create: `scripts/lib/__test__/vendor-staging.test.ts`
- Modify: `scripts/lib/install.ts`
- Modify: `scripts/lib/links.ts`
- Test: `scripts/lib/__test__/install.test.ts`

**Interface:**

```ts
export interface VendorAssetInventory {
  role: string
  skills: string[]
  agents: string[]
  rules?: string
  hooks: string[]
  mcp?: string
}

export async function rebuildVendorAssets(options: {
  homeDir: string
  role: string
  manifestPath: string
}): Promise<VendorAssetInventory>
```

The interface performs all manifest loading, remote checkout source resolution, validation, temporary staging, conflict handling, moluoxixi overlay, commit, and inventory generation.

- [ ] **Step 1: Write failing staging tests**

```ts
it('forwards remote skills, agents, rules, hooks, and mcp', async () => {
  const inventory = await rebuildVendorAssets(fixture)
  expect(inventory).toMatchObject({
    skills: ['remote-skill'],
    agents: ['reviewer.md'],
    rules: expect.stringContaining('vendor/AGENTS.md'),
    hooks: ['stop.mjs'],
    mcp: expect.stringContaining('vendor/mcp/mcp.json'),
  })
})

it('copies every distributable asset from the selected moluoxixi role', async () => {
  await rebuildVendorAssets(alphaFixture)
  expect(existsSync(path.join(home, 'vendor', 'skills', 'alpha-skill', 'SKILL.md'))).toBe(true)
  expect(existsSync(path.join(home, 'vendor', 'agents', 'alpha-agent.md'))).toBe(true)
  expect(readFileSync(path.join(home, 'vendor', 'AGENTS.md'), 'utf8')).toContain('alpha rules')
  expect(existsSync(path.join(home, 'vendor', 'hooks', 'alpha-stop.mjs'))).toBe(true)
  expect(existsSync(path.join(home, 'vendor', 'mcp', 'mcp.json'))).toBe(true)
  expect(existsSync(path.join(home, 'vendor', 'skills', 'beta-skill'))).toBe(false)
})

it('keeps the previous staging when validation fails', async () => {
  await rebuildVendorAssets(validFixture)
  const previousSkill = readFileSync(path.join(home, 'vendor', 'skills', 'stable', 'SKILL.md'), 'utf8')
  await expect(rebuildVendorAssets(brokenFixture)).rejects.toThrow(/missing configured source/i)
  expect(readFileSync(path.join(home, 'vendor', 'skills', 'stable', 'SKILL.md'), 'utf8')).toBe(previousSkill)
})
```

- [ ] **Step 2: Run RED**

Run: `npx vitest run scripts/lib/__test__/vendor-staging.test.ts`

Expected: FAIL because `vendor-staging.ts` does not exist.

- [ ] **Step 3: Implement source validation and conflict planning**

Build a complete in-memory target map before copying. Resolve every source with `realpathSync`, require it to remain under `<home>/vendor/repos/<vendor>`, and reject duplicate ordinary-vendor targets.

- [ ] **Step 4: Implement moluoxixi role-assets expansion**

Expand only these mappings, preserving complete contents beneath each selected directory:

```ts
const roleAssetMappings = [
  ['skills', 'skills'],
  ['agents', 'agents'],
  ['rules/AGENTS.md', 'AGENTS.md'],
  ['hooks', 'hooks'],
  ['mcp/mcp.json', 'mcp/mcp.json'],
] as const
```

Require vendor ID `moluoxixi` and require `sourceDir` to equal `roles/${role}`. Apply this overlay last.

- [ ] **Step 5: Implement transactional commit**

Build under a unique system temporary directory, validate the inventory, move current managed staging to a backup, move the next staging into place, and restore the backup on commit failure. Repository checkouts remain outside the managed staging set.

- [ ] **Step 6: Replace the skills-only rebuild adapter**

`install.ts` calls `rebuildVendorAssets`; remove `syncFirstPartyToHome`, `syncFirstPartySkillsToVendor`, and separate resource-link branches.

- [ ] **Step 7: Run focused tests**

Run: `npx vitest run scripts/lib/__test__/vendor-staging.test.ts scripts/lib/__test__/install.test.ts`

Expected: PASS.

---

### Task 3: Remote-Only Role Orchestration

**Files:**
- Modify: `roles/*/constants/skills.ts`
- Modify: `scripts/lib/tool.ts`
- Modify: `scripts/cli.ts`
- Modify: `scripts/sync-vendors.ts`
- Modify: `scripts/lib/vendor-sync.ts`
- Rewrite: `scripts/lib/__test__/tool.test.ts`
- Modify: `scripts/lib/__test__/vendor-sync.test.ts`
- Modify: `__test__/workflow-contract.test.ts`

**Interfaces:**

```ts
export interface SyncOptions {
  repoRoot: string
  home: string
  userHome?: string
  host: string
  role: string
  verify: boolean
}
```

- No `skipVendors`, `sourceMode`, `DEFAULT_ROLE`, local skill layer, or official role-specific installation path.
- `add` writes `roles/<role>/skills/<name>` for repository authoring; sync still consumes remote only.

- [ ] **Step 1: Write CLI/tool RED tests**

```ts
it.each(['sync', 'verify'])(`requires --role for %s`, command => {
  expect(runCli([command, '--host', 'claude']).stderr).toMatch(/--role.*required/i)
})

it('fetches moluoxixi instead of reading repoRoot assets', async () => {
  const fixture = createRemoteToolFixture('alpha')
  rmSync(path.join(fixture.repoRoot, 'roles', 'alpha', 'skills'), { recursive: true, force: true })
  await syncToHosts({
    repoRoot: fixture.repoRoot,
    home: fixture.home,
    userHome: fixture.userHome,
    host: 'claude',
    role: 'alpha',
    verify: true,
  })
  expect(existsSync(path.join(fixture.userHome, '.claude', 'skills', 'remote-role-skill'))).toBe(true)
})
```

- [ ] **Step 2: Run RED**

Run: `npx vitest run scripts/lib/__test__/tool.test.ts scripts/lib/__test__/vendor-sync.test.ts`

- [ ] **Step 3: Update every role manifest**

Remove `extendsRoles` and `sourceMode`. Every selectable role must declare one remote moluoxixi entry:

```ts
{
  name: 'moluoxixi',
  official: true,
  source: 'https://github.com/moluoxixi/AIRules.git',
  projections: [{ kind: 'role-assets', sourceDir: 'roles/<exact-role>' }],
}
```

- [ ] **Step 4: Remove local orchestration branches**

`syncToHosts` always runs `ensureVendorRepo` for every manifest vendor, then `rebuildVendorAssets`. Remove repoRoot first-party sync, `<home>/local`, `--skip-vendors`, fingerprint-only early success, default role, role aliases, and official ECC side installation.

- [ ] **Step 5: Make add an authoring-only command**

Copy into the selected tracked role path, return the target, and print that commit/push is required. Do not feed the copied directory directly into current sync.

- [ ] **Step 6: Run orchestration tests**

Run: `npx vitest run scripts/lib/__test__/tool.test.ts scripts/lib/__test__/vendor-sync.test.ts __test__/workflow-contract.test.ts`

Expected: PASS.

---

### Task 4: Five-Asset Host State and Verification

**Files:**
- Modify: `scripts/lib/projection-state.ts`
- Modify: `scripts/lib/install.ts`
- Modify: `scripts/lib/verify.ts`
- Modify: `constants/hosts.ts`
- Modify: `scripts/lib/__test__/projection-state.test.ts`
- Modify: `scripts/lib/__test__/agent-mcp-projection.test.ts`
- Modify: `scripts/lib/__test__/hook-projection.test.ts`
- Modify: `scripts/lib/__test__/verify-coverage.test.ts`

**Interfaces:**

```ts
export interface ProjectionState {
  version: 1
  host: string
  role: string
  stagingHash: string
  skills: Array<{ source: string, target: string }>
  agents: Array<{ source: string, target: string, format: string, hash?: string }>
  rules?: {
    source: string
    target: string
    mode: 'symlink' | 'append'
    contentHash?: string
  }
  mcp?: {
    target: string
    format: 'json' | 'toml'
    serversKey: string
    servers: Record<string, string>
  }
  hooks: Array<{
    source: string
    scriptTarget: string
    scriptHash: string
    target: string
    format: 'json' | 'toml'
    nesting: 'flat' | 'group'
    event: string
    scriptName: string
    command: string
  }>
}
```

- [ ] **Step 1: Add RED tests for agent state and A -> B switching**

```ts
it('removes alpha agents when beta is selected and preserves user agents', () => {
  project(alpha)
  project(beta)
  expect(hostAgents()).toContain('beta-agent')
  expect(hostAgents()).not.toContain('alpha-agent')
  expect(hostAgents()).toContain('user-agent')
})
```

- [ ] **Step 2: Run RED**

Run: `npx vitest run scripts/lib/__test__/projection-state.test.ts scripts/lib/__test__/agent-mcp-projection.test.ts`

- [ ] **Step 3: Record and safely clean agent projections**

Links are removed only when they still resolve to the recorded source. Generated TOML/Markdown agent files are removed only when their content hash still matches state.

- [ ] **Step 4: Connect host projection to canonical staging and role state**

Project all five classes from `<home>/vendor`, report unsupported classes as `N/A`, and write state only after every supported projection succeeds.

- [ ] **Step 5: Rewrite verify against manifest, staging, state, and host target**

Verify selected role, staging hash, exact managed source/target pairs, generated hashes, managed MCP/hook entries, and absence of stale state from another role.

- [ ] **Step 6: Run host tests**

Run: `npx vitest run scripts/lib/__test__/projection-state.test.ts scripts/lib/__test__/agent-mcp-projection.test.ts scripts/lib/__test__/hook-projection.test.ts scripts/lib/__test__/verify-coverage.test.ts`

Expected: PASS.

---

### Task 5: Rules, Documentation, Package, and Final Verification

**Files:**
- Modify: `AGENTS.md`
- Modify: `CLAUDE.md`
- Rewrite: `README.md`
- Rewrite: `README-zh.md`
- Modify: `package.json`
- Test: `__test__/workflow-contract.test.ts`

- [ ] **Step 1: Enforce the remote-only repository rule**

The root rules must state: no workspace/local vendor, current repo is remote vendor `moluoxixi`, role selects the remote `roles/<role>` path, and moluoxixi fully copies that selected role.

- [ ] **Step 2: Rewrite README distribution flow**

Document remote-only sources, five asset classes, role path selection, moluoxixi role-assets expansion, required `--role`, add-as-authoring, supported hosts, switching cleanup, and explicit failures.

- [ ] **Step 3: Add repository contract scans**

```ts
expect(runtimeSource).not.toMatch(/sourceMode\s*:\s*['"]workspace|DEFAULT_ROLE|extendsRoles|\/local\/skills/u)
expect(allRoleManifests).toDeclareRemoteMoluoxixiRoleAssets()
```

- [ ] **Step 4: Run full source verification**

```powershell
npx eslint constants scripts __test__ roles/*/constants --fix
npx vitest run
npm run typecheck
npm run lint:check
npx tsc -p tsconfig.build.json --noEmit
git diff --check
```

Expected: all commands exit `0`, with zero failed tests and zero lint/type errors.

- [ ] **Step 5: Verify temporary remote staging and package**

Use system temporary directories and local bare Git remotes for alpha/beta/moluoxixi fixtures. Run remote sync, A -> B host switching, `npm pack --dry-run --silent`, and `node dist/scripts/cli.js --help` without writing the workspace `vendor/` directory.

- [ ] **Step 6: Commit final documentation and package contract**

```bash
git add -A
git commit -m "feat(distribution): forward remote role assets"
```
