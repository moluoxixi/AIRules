import type { VendorLink, VendorManifest } from './vendors.js'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { requireRoleName } from './role-assets.js'
import { collectFlattenedSkillSources } from './skill-projection.js'
import { loadVendorManifest } from './vendors.js'

export interface VendorAssetInventory {
  role: string
  skills: string[]
  agents: string[]
  rules?: string
  hooks: string[]
  mcp?: string
}

export interface RebuildVendorAssetsOptions {
  homeDir: string
  role: string
  manifestPath: string
}

interface PlannedAsset {
  vendorId: string
  kind: VendorLink['kind']
  source: string
  target: string
}

interface VendorStagingPlan {
  ordinary: PlannedAsset[]
  roleAssets: PlannedAsset[]
}

type SourceKind = 'file' | 'directory'

function portablePath(value: string): string {
  return value.replace(/[\\/]+/gu, path.sep)
}

function isInsideRoot(root: string, target: string): boolean {
  const relative = path.relative(root, target)
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative))
}

function requireSource(
  checkoutRoot: string,
  configuredPath: string,
  kind: SourceKind,
  vendorId: string,
): string {
  const requested = path.resolve(checkoutRoot, portablePath(configuredPath))
  if (!isInsideRoot(checkoutRoot, requested)) {
    throw new Error(`Vendor "${vendorId}" source resolves outside its checkout: ${configuredPath}`)
  }
  if (!fs.existsSync(requested)) {
    throw new Error(`Vendor "${vendorId}" is missing configured source: ${configuredPath}`)
  }

  const resolved = fs.realpathSync(requested)
  if (!isInsideRoot(checkoutRoot, resolved)) {
    throw new Error(`Vendor "${vendorId}" source resolves outside its checkout: ${configuredPath}`)
  }

  const stats = fs.statSync(resolved)
  if (kind === 'file' ? !stats.isFile() : !stats.isDirectory()) {
    throw new Error(`Vendor "${vendorId}" configured source has invalid type: ${configuredPath}`)
  }

  validateSourceTree(resolved, checkoutRoot, vendorId, new Set())
  return resolved
}

function validateSourceTree(
  source: string,
  checkoutRoot: string,
  vendorId: string,
  ancestors: Set<string>,
): void {
  const resolved = fs.realpathSync(source)
  if (!isInsideRoot(checkoutRoot, resolved)) {
    throw new Error(`Vendor "${vendorId}" source symlink escapes outside its checkout: ${source}`)
  }

  const stats = fs.statSync(resolved)
  if (stats.isFile()) {
    return
  }
  if (!stats.isDirectory()) {
    throw new Error(`Vendor "${vendorId}" source contains an unsupported filesystem entry: ${source}`)
  }

  const key = process.platform === 'win32' ? resolved.toLowerCase() : resolved
  if (ancestors.has(key)) {
    throw new Error(`Vendor "${vendorId}" source contains a recursive symlink cycle: ${source}`)
  }

  ancestors.add(key)
  for (const entry of fs.readdirSync(resolved, { withFileTypes: true })) {
    validateSourceTree(path.join(resolved, entry.name), checkoutRoot, vendorId, ancestors)
  }
  ancestors.delete(key)
}

function requireManagedTarget(homeDir: string, kind: VendorLink['kind'], configuredTarget: string): string {
  const vendorRoot = path.resolve(homeDir, 'vendor')
  const target = path.resolve(homeDir, portablePath(configuredTarget))
  const skillsRoot = path.join(vendorRoot, 'skills')
  const agentsRoot = path.join(vendorRoot, 'agents')
  const hooksRoot = path.join(vendorRoot, 'hooks')
  const mcpRoot = path.join(vendorRoot, 'mcp')

  const valid = kind === 'skill' || kind === 'namespace-dir'
    ? isInsideRoot(skillsRoot, target) && target !== skillsRoot
    : kind === 'agent-file'
      ? isInsideRoot(agentsRoot, target) && target !== agentsRoot
      : kind === 'agents-dir'
        ? isInsideRoot(agentsRoot, target)
        : kind === 'hook-file'
          ? isInsideRoot(hooksRoot, target) && target !== hooksRoot
          : kind === 'hooks-dir'
            ? isInsideRoot(hooksRoot, target)
            : kind === 'rules-file'
              ? target === path.join(vendorRoot, 'AGENTS.md')
              : kind === 'mcp-file'
                ? isInsideRoot(mcpRoot, target) && target !== mcpRoot
                : false

  if (!valid) {
    throw new Error(`Vendor target resolves outside its managed staging root: ${configuredTarget}`)
  }

  const relative = path.relative(vendorRoot, target)
  return relative
}

function requireSkill(source: string, checkoutRoot: string, vendorId: string): void {
  const skillFile = path.join(source, 'SKILL.md')
  if (!fs.existsSync(skillFile)) {
    throw new Error(`Vendor "${vendorId}" skill is missing SKILL.md: ${source}`)
  }
  requireSource(checkoutRoot, path.relative(checkoutRoot, skillFile), 'file', vendorId)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function requireNeutralMcp(source: string): void {
  let parsed: unknown
  try {
    parsed = JSON.parse(fs.readFileSync(source, 'utf8').replace(/^\uFEFF/u, ''))
  }
  catch (error) {
    throw new Error(`Invalid neutral MCP JSON: ${source}`, { cause: error })
  }

  if (!isRecord(parsed) || !isRecord(parsed.mcpServers)) {
    throw new Error(`Neutral MCP configuration mcpServers must be an object: ${source}`)
  }
}

function compareStable(left: string, right: string): number {
  const leftKey = left.toLowerCase()
  const rightKey = right.toLowerCase()
  if (leftKey !== rightKey) {
    return leftKey < rightKey ? -1 : 1
  }
  return left === right ? 0 : left < right ? -1 : 1
}

function expandOrdinaryLink(
  homeDir: string,
  vendorId: string,
  link: VendorLink,
): PlannedAsset[] {
  const checkoutRoot = path.resolve(homeDir, 'vendor', 'repos', vendorId)

  if (link.kind === 'namespace-dir') {
    const namespaceRoot = requireSource(checkoutRoot, link.source, 'directory', vendorId)
    return collectFlattenedSkillSources(namespaceRoot).map(({ name, source }) => {
      requireSkill(source, checkoutRoot, vendorId)
      return {
        vendorId,
        kind: 'skill',
        source,
        target: requireManagedTarget(homeDir, 'skill', path.posix.join('vendor', 'skills', name)),
      }
    })
  }

  if (link.kind === 'role-assets-dir') {
    throw new Error('role-assets must be expanded through the moluoxixi role overlay')
  }

  const sourceKind: SourceKind = link.kind.endsWith('-dir') || link.kind === 'skill'
    ? 'directory'
    : 'file'
  const source = requireSource(checkoutRoot, link.source, sourceKind, vendorId)
  if (link.kind === 'skill') {
    requireSkill(source, checkoutRoot, vendorId)
  }
  if (link.kind === 'mcp-file') {
    requireNeutralMcp(source)
  }

  return [{
    vendorId,
    kind: link.kind,
    source,
    target: requireManagedTarget(homeDir, link.kind, link.target),
  }]
}

function conflicts(left: string, right: string): boolean {
  const leftKey = left.replace(/\\/gu, '/').toLowerCase()
  const rightKey = right.replace(/\\/gu, '/').toLowerCase()
  return leftKey === rightKey
    || leftKey.startsWith(`${rightKey}/`)
    || rightKey.startsWith(`${leftKey}/`)
}

function requireNoTargetConflicts(assets: PlannedAsset[], label: string): void {
  const accepted: PlannedAsset[] = []
  for (const asset of assets) {
    const previous = accepted.find(candidate => conflicts(candidate.target, asset.target))
    if (previous) {
      throw new Error(`${label} at "${asset.target}": ${previous.vendorId} conflicts with ${asset.vendorId}`)
    }
    accepted.push(asset)
  }
}

function resolveRoleChild(
  roleRoot: string,
  relativePath: string,
  kind: SourceKind,
): string | undefined {
  const requested = path.join(roleRoot, portablePath(relativePath))
  if (!fs.existsSync(requested)) {
    return undefined
  }

  const resolved = fs.realpathSync(requested)
  const stats = fs.statSync(resolved)
  if (kind === 'file' ? !stats.isFile() : !stats.isDirectory()) {
    throw new Error(`moluoxixi role asset has invalid type: ${relativePath}`)
  }
  return resolved
}

function expandRoleDirectory(
  roleRoot: string,
  relativePath: 'agents' | 'hooks',
): PlannedAsset[] {
  const sourceRoot = resolveRoleChild(roleRoot, relativePath, 'directory')
  if (!sourceRoot) {
    return []
  }

  return fs.readdirSync(sourceRoot, { withFileTypes: true })
    .sort((left, right) => compareStable(left.name, right.name))
    .map((entry) => {
      const source = path.join(sourceRoot, entry.name)
      const stats = fs.statSync(fs.realpathSync(source))
      const kind = relativePath === 'agents'
        ? stats.isDirectory() ? 'agents-dir' : 'agent-file'
        : stats.isDirectory() ? 'hooks-dir' : 'hook-file'
      return {
        vendorId: 'moluoxixi',
        kind,
        source,
        target: path.join(relativePath, entry.name),
      }
    })
}

function expandRoleAssets(
  homeDir: string,
  role: string,
  sourceDir: string,
): PlannedAsset[] {
  const expectedSource = path.posix.join('roles', role)
  if (sourceDir !== expectedSource) {
    throw new Error(`moluoxixi role-assets source must be exactly ${expectedSource}`)
  }

  const checkoutRoot = path.resolve(homeDir, 'vendor', 'repos', 'moluoxixi')
  const roleRoot = requireSource(checkoutRoot, sourceDir, 'directory', 'moluoxixi')
  const roleAssets: PlannedAsset[] = []
  const skillsRoot = resolveRoleChild(roleRoot, 'skills', 'directory')
  if (skillsRoot) {
    for (const { name, source } of collectFlattenedSkillSources(skillsRoot)) {
      requireSkill(source, checkoutRoot, 'moluoxixi')
      roleAssets.push({
        vendorId: 'moluoxixi',
        kind: 'skill',
        source,
        target: path.join('skills', name),
      })
    }
  }

  roleAssets.push(...expandRoleDirectory(roleRoot, 'agents'))

  const rulesFile = resolveRoleChild(roleRoot, 'rules/AGENTS.md', 'file')
  if (rulesFile) {
    roleAssets.push({
      vendorId: 'moluoxixi',
      kind: 'rules-file',
      source: rulesFile,
      target: 'AGENTS.md',
    })
  }

  roleAssets.push(...expandRoleDirectory(roleRoot, 'hooks'))

  const mcpFile = resolveRoleChild(roleRoot, 'mcp/mcp.json', 'file')
  if (mcpFile) {
    requireNeutralMcp(mcpFile)
    roleAssets.push({
      vendorId: 'moluoxixi',
      kind: 'mcp-file',
      source: mcpFile,
      target: path.join('mcp', 'mcp.json'),
    })
  }

  requireNoTargetConflicts(roleAssets, 'moluoxixi role-assets target conflict')
  return roleAssets
}

function buildStagingPlan(
  manifest: VendorManifest,
  homeDir: string,
  role: string,
): VendorStagingPlan {
  const ordinary: PlannedAsset[] = []
  const roleDeclarations: Array<{ vendorId: string, source: string }> = []

  for (const [vendorId, vendor] of Object.entries(manifest.vendors)) {
    for (const link of vendor.links) {
      if (link.kind === 'role-assets-dir') {
        roleDeclarations.push({ vendorId, source: link.source })
        continue
      }
      ordinary.push(...expandOrdinaryLink(homeDir, vendorId, link))
    }
  }

  requireNoTargetConflicts(ordinary, 'Ordinary vendor target conflict')

  const moluoxixi = manifest.vendors.moluoxixi
  if (roleDeclarations.some(declaration => declaration.vendorId !== 'moluoxixi')) {
    throw new Error('Only moluoxixi may declare role-assets')
  }
  if (moluoxixi && roleDeclarations.length !== 1) {
    throw new Error(`moluoxixi must declare exactly one role-assets source ${path.posix.join('roles', role)}`)
  }

  return {
    ordinary,
    roleAssets: roleDeclarations.length === 0
      ? []
      : expandRoleAssets(homeDir, role, roleDeclarations[0].source),
  }
}

function copyPlannedAsset(stagingRoot: string, asset: PlannedAsset, replace: boolean): void {
  const target = path.join(stagingRoot, asset.target)
  if (replace) {
    fs.rmSync(target, { recursive: true, force: true })
  }
  fs.mkdirSync(path.dirname(target), { recursive: true })
  fs.cpSync(asset.source, target, { recursive: true, dereference: true })
}

function materializePlan(plan: VendorStagingPlan): { buildRoot: string, stagingRoot: string } {
  const buildRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'airules-vendor-build-'))
  const stagingRoot = path.join(buildRoot, 'vendor')
  fs.mkdirSync(stagingRoot)

  try {
    for (const asset of plan.ordinary) {
      copyPlannedAsset(stagingRoot, asset, false)
    }
    for (const asset of plan.roleAssets) {
      copyPlannedAsset(stagingRoot, asset, true)
    }
    return { buildRoot, stagingRoot }
  }
  catch (error) {
    fs.rmSync(buildRoot, { recursive: true, force: true })
    throw new Error('Failed to materialize vendor staging', { cause: error })
  }
}

function listRelativeFiles(root: string): string[] {
  if (!fs.existsSync(root)) {
    return []
  }

  const files: string[] = []
  function visit(current: string): void {
    for (const entry of fs.readdirSync(current, { withFileTypes: true }).sort((left, right) => compareStable(left.name, right.name))) {
      const entryPath = path.join(current, entry.name)
      if (entry.isDirectory()) {
        visit(entryPath)
      }
      else if (entry.isFile()) {
        files.push(path.relative(root, entryPath).replace(/\\/gu, '/'))
      }
      else {
        throw new Error(`Staged asset has unsupported filesystem type: ${entryPath}`)
      }
    }
  }
  visit(root)
  return files.sort(compareStable)
}

function validateInventory(
  stagingRoot: string,
  finalVendorRoot: string,
  role: string,
): VendorAssetInventory {
  const skillsRoot = path.join(stagingRoot, 'skills')
  const skills = fs.existsSync(skillsRoot)
    ? fs.readdirSync(skillsRoot, { withFileTypes: true })
        .sort((left, right) => compareStable(left.name, right.name))
        .map((entry) => {
          const skillRoot = path.join(skillsRoot, entry.name)
          if (!entry.isDirectory() || !fs.statSync(path.join(skillRoot, 'SKILL.md')).isFile()) {
            throw new Error(`Staged skill is missing SKILL.md: ${skillRoot}`)
          }
          return entry.name
        })
    : []

  const rulesFile = path.join(stagingRoot, 'AGENTS.md')
  const mcpFile = path.join(stagingRoot, 'mcp', 'mcp.json')
  if (fs.existsSync(mcpFile)) {
    requireNeutralMcp(mcpFile)
  }

  return {
    role,
    skills,
    agents: listRelativeFiles(path.join(stagingRoot, 'agents')),
    rules: fs.existsSync(rulesFile) ? path.join(finalVendorRoot, 'AGENTS.md') : undefined,
    hooks: listRelativeFiles(path.join(stagingRoot, 'hooks')),
    mcp: fs.existsSync(mcpFile) ? path.join(finalVendorRoot, 'mcp', 'mcp.json') : undefined,
  }
}

const managedEntryNames = ['skills', 'agents', 'AGENTS.md', 'hooks', 'mcp'] as const

interface ManagedEntryCommit {
  current: string
  backup: string
  movedCurrent: boolean
  installedNext: boolean
}

function rollbackManagedEntries(entries: ManagedEntryCommit[]): Error[] {
  const rollbackErrors: Error[] = []

  for (const entry of [...entries].reverse()) {
    try {
      if (entry.installedNext && fs.existsSync(entry.current)) {
        fs.rmSync(entry.current, { recursive: true, force: true })
      }
      if (entry.movedCurrent) {
        fs.renameSync(entry.backup, entry.current)
      }
    }
    catch (error) {
      rollbackErrors.push(error instanceof Error ? error : new Error(String(error)))
    }
  }

  return rollbackErrors
}

function commitManagedEntries(stagingRoot: string, homeDir: string): void {
  const vendorRoot = path.resolve(homeDir, 'vendor')
  if (fs.existsSync(vendorRoot) && !fs.lstatSync(vendorRoot).isDirectory()) {
    throw new Error(`Vendor staging root has invalid type: ${vendorRoot}`)
  }
  fs.mkdirSync(vendorRoot, { recursive: true })

  const nextRoot = fs.mkdtempSync(path.join(path.resolve(homeDir), '.airules-vendor-next-'))
  const backupRoot = fs.mkdtempSync(path.join(path.resolve(homeDir), '.airules-vendor-backup-'))
  const committedEntries: ManagedEntryCommit[] = []

  try {
    fs.cpSync(stagingRoot, nextRoot, { recursive: true, dereference: true })
    for (const name of managedEntryNames) {
      const current = path.join(vendorRoot, name)
      const next = path.join(nextRoot, name)
      const backup = path.join(backupRoot, name)
      const entry: ManagedEntryCommit = {
        current,
        backup,
        movedCurrent: false,
        installedNext: false,
      }
      committedEntries.push(entry)

      if (fs.existsSync(current)) {
        fs.mkdirSync(path.dirname(backup), { recursive: true })
        fs.renameSync(current, backup)
        entry.movedCurrent = true
      }
      if (fs.existsSync(next)) {
        fs.renameSync(next, current)
        entry.installedNext = true
      }
    }
  }
  catch (error) {
    const rollbackErrors = rollbackManagedEntries(committedEntries)
    fs.rmSync(nextRoot, { recursive: true, force: true })
    if (rollbackErrors.length > 0) {
      throw new AggregateError(
        [error, ...rollbackErrors],
        `Vendor staging commit failed and rollback did not restore every managed asset: ${String(error)}`,
      )
    }

    fs.rmSync(backupRoot, { recursive: true, force: true })
    throw new Error(`Vendor staging commit failed; previous managed assets restored: ${String(error)}`, { cause: error })
  }

  fs.rmSync(nextRoot, { recursive: true, force: true })
  fs.rmSync(backupRoot, { recursive: true, force: true })
}

export async function rebuildVendorAssets(options: RebuildVendorAssetsOptions): Promise<VendorAssetInventory> {
  const role = requireRoleName(options.role)
  const manifest = await loadVendorManifest(options.manifestPath)
  const plan = buildStagingPlan(manifest, options.homeDir, role)
  const { buildRoot, stagingRoot } = materializePlan(plan)
  const finalVendorRoot = path.resolve(options.homeDir, 'vendor')

  try {
    const inventory = validateInventory(stagingRoot, finalVendorRoot, role)
    commitManagedEntries(stagingRoot, options.homeDir)
    return inventory
  }
  finally {
    fs.rmSync(buildRoot, { recursive: true, force: true })
  }
}
