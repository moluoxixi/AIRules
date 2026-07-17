import type { VendorLink, VendorManifest } from './vendors.js'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { parseDocument } from 'yaml'
import { requireRoleName } from './role-assets.js'
import { collectFlattenedSkillSources } from './skill-projection.js'
import { loadVendorManifest } from './vendors.js'

export interface VendorAssetInventory {
  role: string
  roleRoot?: string
  skills: string[]
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
  roleSource?: string
  roleVendorId?: string
}

interface MaterializedPlan {
  buildRoot: string
  stagingRoot: string
  roleStagingRoot?: string
}

type SourceKind = 'file' | 'directory'

interface CanonicalRoleAssetRoots {
  skills: string
}

const defaultCanonicalRoleAssetRoots: CanonicalRoleAssetRoots = {
  skills: 'skills',
}

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

function validateRoleSourceTree(source: string, roleRoot: string, vendorId: string): void {
  const relative = path.relative(roleRoot, source).replace(/\\/gu, '/')
  const segments = relative.split('/').filter(Boolean).map(segment => segment.toLowerCase())
  const airulesIndex = segments.indexOf('.airules')
  if (airulesIndex === 0) {
    throw new Error(`Vendor "${vendorId}" role source contains project instance state at its root: ${relative}`)
  }
  if (airulesIndex >= 0) {
    const statePath = segments.slice(airulesIndex + 1)
    const stateRoot = statePath[0]
    const stateFile = statePath.at(-1)
    const forbiddenRoot = new Set(['state', 'tasks', 'workspace', 'runtime', 'platform'])
    const forbiddenKnowledge = stateRoot === 'knowledge'
      && ['approved', 'candidates', 'reviews', 'tombstones', 'index'].includes(statePath[1] ?? '')
    const forbiddenEvidence = stateRoot === 'evidence'
      && ['logs', 'manifests', 'reports'].includes(statePath[1] ?? '')
    if (
      forbiddenRoot.has(stateRoot ?? '')
      || forbiddenKnowledge
      || forbiddenEvidence
      || stateFile === 'project.json'
      || stateFile === 'events.jsonl'
      || stateFile === 'snapshot.json'
      || stateFile === 'state.lock'
    ) {
      throw new Error(`Vendor "${vendorId}" role source contains forbidden project instance state: ${relative}`)
    }
  }
  const stats = fs.lstatSync(source)
  if (stats.isSymbolicLink()) {
    throw new Error(`Vendor "${vendorId}" role source must not contain symbolic links: ${source}`)
  }
  const resolved = fs.realpathSync(source)
  if (!isInsideRoot(roleRoot, resolved)) {
    throw new Error(`Vendor "${vendorId}" role source resolves outside the selected role: ${source}`)
  }
  if (stats.isFile()) {
    return
  }
  if (!stats.isDirectory()) {
    throw new Error(`Vendor "${vendorId}" role source contains an unsupported filesystem entry: ${source}`)
  }
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    validateRoleSourceTree(path.join(source, entry.name), roleRoot, vendorId)
  }
}

function requireRoleAssetRoot(
  assets: Record<string, unknown> | undefined,
  key: keyof CanonicalRoleAssetRoots,
  roleManifest: string,
): string {
  const declared = assets?.[key]
  const configured = declared === undefined ? defaultCanonicalRoleAssetRoots[key] : declared
  if (typeof configured !== 'string' || configured.length === 0) {
    throw new Error(`AIRules role asset root "${key}" must be a non-empty relative path: ${roleManifest}`)
  }

  const normalized = path.posix.normalize(configured.replace(/\\/gu, '/'))
  if (path.posix.isAbsolute(normalized) || normalized === '..' || normalized.startsWith('../')) {
    throw new Error(`AIRules role asset root "${key}" must stay inside the role: ${roleManifest}`)
  }
  return normalized
}

function requireCanonicalRoleContract(roleRoot: string, role: string, vendorId: string): CanonicalRoleAssetRoots {
  const roleManifest = path.join(roleRoot, 'role.yaml')
  const constantsFile = path.join(roleRoot, 'constants', 'skills.ts')
  for (const [label, file] of [['role manifest', roleManifest], ['role constants', constantsFile]] as const) {
    const stats = fs.lstatSync(file, { throwIfNoEntry: false })
    if (!stats?.isFile() || stats.isSymbolicLink()) {
      throw new Error(`Vendor "${vendorId}" canonical ${label} must be a plain file: ${file}`)
    }
  }

  const document = parseDocument(fs.readFileSync(roleManifest, 'utf8'), {
    merge: false,
    prettyErrors: true,
    strict: true,
    uniqueKeys: true,
  })
  if (document.errors.length > 0) {
    throw new Error(`Vendor "${vendorId}" role.yaml is invalid: ${document.errors.map(error => error.message).join('; ')}`)
  }
  const manifest = document.toJS({ maxAliasCount: 0 }) as unknown
  if (!isRecord(manifest) || manifest.role_id !== role) {
    throw new Error(`Vendor "${vendorId}" role.yaml role_id must equal selected role "${role}"`)
  }
  if (manifest.canonical_root !== undefined && manifest.canonical_root !== `roles/${role}`) {
    throw new Error(`Vendor "${vendorId}" role.yaml canonical_root must equal roles/${role}`)
  }

  if (manifest.assets !== undefined && !isRecord(manifest.assets)) {
    throw new Error(`Vendor "${vendorId}" role.yaml assets must be an object`)
  }
  const assets = manifest.assets as Record<string, unknown> | undefined
  return {
    skills: requireRoleAssetRoot(assets, 'skills', roleManifest),
  }
}

function rejectSymbolicLinkPathSegments(checkoutRoot: string, configuredPath: string, vendorId: string): void {
  let current = checkoutRoot
  for (const segment of portablePath(configuredPath).split(path.sep).filter(Boolean)) {
    current = path.join(current, segment)
    const stats = fs.lstatSync(current, { throwIfNoEntry: false })
    if (!stats) {
      return
    }
    if (stats.isSymbolicLink()) {
      const relative = path.relative(checkoutRoot, current).replace(/\\/gu, '/')
      throw new Error(`Vendor "${vendorId}" selected role source path must not contain symbolic links: ${relative}`)
    }
  }
}

function requireManagedTarget(homeDir: string, kind: VendorLink['kind'], configuredTarget: string): string {
  const vendorRoot = path.resolve(homeDir, 'vendor')
  const target = path.resolve(homeDir, portablePath(configuredTarget))
  const skillsRoot = path.join(vendorRoot, 'skills')
  const valid = (kind === 'skill' || kind === 'namespace-dir')
    && isInsideRoot(skillsRoot, target)
    && target !== skillsRoot

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
    throw new Error('role-assets must be expanded through the canonical role staging path')
  }

  const source = requireSource(checkoutRoot, link.source, 'directory', vendorId)
  requireSkill(source, checkoutRoot, vendorId)

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
  if (!isInsideRoot(roleRoot, resolved)) {
    throw new Error(`Role asset resolves outside the selected role: ${relativePath}`)
  }
  const stats = fs.statSync(resolved)
  if (kind === 'file' ? !stats.isFile() : !stats.isDirectory()) {
    throw new Error(`Role asset has invalid type: ${relativePath}`)
  }
  return resolved
}

function resolveRoleSource(
  homeDir: string,
  role: string,
  vendorId: string,
  sourceDir: string,
): string {
  const expectedSource = path.posix.join('roles', role)
  if (sourceDir !== expectedSource) {
    throw new Error(`Vendor "${vendorId}" role-assets source must be exactly ${expectedSource}`)
  }

  const checkoutRoot = path.resolve(homeDir, 'vendor', 'repos', vendorId)
  rejectSymbolicLinkPathSegments(checkoutRoot, sourceDir, vendorId)
  const roleRoot = requireSource(checkoutRoot, sourceDir, 'directory', vendorId)
  validateRoleSourceTree(roleRoot, roleRoot, vendorId)
  requireCanonicalRoleContract(roleRoot, role, vendorId)
  return roleRoot
}

function expandRoleAssets(roleRoot: string, vendorId: string): PlannedAsset[] {
  const roleAssets: PlannedAsset[] = []
  const assetRoots = requireCanonicalRoleContract(roleRoot, path.basename(roleRoot), vendorId)
  const skillsRoot = resolveRoleChild(roleRoot, assetRoots.skills, 'directory')
  if (skillsRoot) {
    for (const { name, source } of collectFlattenedSkillSources(skillsRoot)) {
      requireSkill(source, roleRoot, vendorId)
      roleAssets.push({
        vendorId,
        kind: 'skill',
        source,
        target: path.join('skills', name),
      })
    }
  }

  requireNoTargetConflicts(roleAssets, 'Canonical role-assets target conflict')
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

  if (roleDeclarations.length > 1) {
    throw new Error('A vendor manifest may declare at most one canonical role-assets source')
  }

  const roleDeclaration = roleDeclarations[0]
  return {
    ordinary,
    roleSource: roleDeclaration === undefined
      ? undefined
      : resolveRoleSource(homeDir, role, roleDeclaration.vendorId, roleDeclaration.source),
    roleVendorId: roleDeclaration?.vendorId,
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

function materializePlan(plan: VendorStagingPlan, role: string): MaterializedPlan {
  const buildRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'airules-vendor-build-'))
  const stagingRoot = path.join(buildRoot, 'vendor')
  fs.mkdirSync(stagingRoot)

  try {
    for (const asset of plan.ordinary) {
      copyPlannedAsset(stagingRoot, asset, false)
    }
    let roleStagingRoot: string | undefined
    if (plan.roleSource !== undefined && plan.roleVendorId !== undefined) {
      roleStagingRoot = path.join(buildRoot, 'roles', role)
      fs.mkdirSync(path.dirname(roleStagingRoot), { recursive: true })
      fs.cpSync(plan.roleSource, roleStagingRoot, { recursive: true, dereference: false })
      validateSourceTree(roleStagingRoot, buildRoot, 'staged-role', new Set())
      for (const asset of expandRoleAssets(roleStagingRoot, plan.roleVendorId)) {
        copyPlannedAsset(stagingRoot, asset, true)
      }
    }
    return { buildRoot, stagingRoot, roleStagingRoot }
  }
  catch (error) {
    removeBestEffort(buildRoot)
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
  roleStagingRoot?: string,
): VendorAssetInventory {
  const skillsRoot = path.join(stagingRoot, 'skills')
  const skills = fs.existsSync(skillsRoot)
    ? fs.readdirSync(skillsRoot, { withFileTypes: true })
        .sort((left, right) => compareStable(left.name, right.name))
        .map((entry) => {
          const skillRoot = path.join(skillsRoot, entry.name)
          const skillFile = path.join(skillRoot, 'SKILL.md')
          if (!fs.statSync(skillRoot).isDirectory() || !fs.existsSync(skillFile) || !fs.statSync(skillFile).isFile()) {
            throw new Error(`Staged skill is missing SKILL.md: ${skillRoot}`)
          }
          return entry.name
        })
    : []

  return {
    role,
    ...(roleStagingRoot === undefined
      ? {}
      : { roleRoot: path.join(path.dirname(finalVendorRoot), 'roles', role) }),
    skills,
  }
}

const managedEntryNames = ['skills'] as const

interface ManagedEntryCommit {
  current: string
  backup: string
  movedCurrent: boolean
  installedNext: boolean
}

interface ManagedEntrySpec {
  current: string
  next: string
  backup: string
}

function requirePlainDirectoryOrMissing(target: string, label: string): void {
  const stats = fs.lstatSync(target, { throwIfNoEntry: false })
  if (stats && (!stats.isDirectory() || stats.isSymbolicLink())) {
    throw new Error(`${label} has invalid type: ${target}`)
  }
}

function removeBestEffort(target: string): void {
  try {
    fs.rmSync(target, { recursive: true, force: true })
  }
  catch {
    // Cleanup happens after the semantic result is known and cannot change it.
  }
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

async function commitManagedEntries(
  stagingRoot: string,
  roleStagingRoot: string | undefined,
  homeDir: string,
  role: string,
): Promise<void> {
  const resolvedHome = path.resolve(homeDir)
  const vendorRoot = path.join(resolvedHome, 'vendor')
  const rolesRoot = path.join(resolvedHome, 'roles')
  requirePlainDirectoryOrMissing(vendorRoot, 'Vendor staging root')
  if (roleStagingRoot !== undefined) {
    requirePlainDirectoryOrMissing(rolesRoot, 'AIRules roles root')
  }
  fs.mkdirSync(vendorRoot, { recursive: true })
  if (roleStagingRoot !== undefined) {
    fs.mkdirSync(rolesRoot, { recursive: true })
    requirePlainDirectoryOrMissing(path.join(rolesRoot, role), 'Installed AIRules role')
  }

  const nextWorkspace = fs.mkdtempSync(path.join(resolvedHome, '.airules-vendor-next-'))
  const nextRoot = path.join(nextWorkspace, 'vendor')
  const backupRoot = fs.mkdtempSync(path.join(resolvedHome, '.airules-vendor-backup-'))
  const committedEntries: ManagedEntryCommit[] = []

  try {
    fs.mkdirSync(nextRoot)
    fs.cpSync(stagingRoot, nextRoot, { recursive: true, dereference: true })
    const specs: ManagedEntrySpec[] = managedEntryNames.map(name => ({
      current: path.join(vendorRoot, name),
      next: path.join(nextRoot, name),
      backup: path.join(backupRoot, 'vendor', name),
    }))
    if (roleStagingRoot !== undefined) {
      const nextRole = path.join(nextWorkspace, 'roles', role)
      fs.mkdirSync(path.dirname(nextRole), { recursive: true })
      fs.cpSync(roleStagingRoot, nextRole, { recursive: true, dereference: true })
      specs.unshift({
        current: path.join(rolesRoot, role),
        next: nextRole,
        backup: path.join(backupRoot, 'roles', role),
      })
    }

    for (const spec of specs) {
      const entry: ManagedEntryCommit = {
        current: spec.current,
        backup: spec.backup,
        movedCurrent: false,
        installedNext: false,
      }
      committedEntries.push(entry)

      if (fs.existsSync(spec.current)) {
        fs.mkdirSync(path.dirname(spec.backup), { recursive: true })
        fs.renameSync(spec.current, spec.backup)
        entry.movedCurrent = true
      }
      if (fs.existsSync(spec.next)) {
        fs.mkdirSync(path.dirname(spec.current), { recursive: true })
        fs.renameSync(spec.next, spec.current)
        entry.installedNext = true
      }
    }
  }
  catch (error) {
    const rollbackErrors = rollbackManagedEntries(committedEntries)
    removeBestEffort(nextWorkspace)
    if (rollbackErrors.length > 0) {
      throw new AggregateError(
        [error, ...rollbackErrors],
        `Role and vendor staging commit failed and rollback did not restore every managed asset: ${String(error)}`,
      )
    }

    removeBestEffort(backupRoot)
    throw new Error(`Role and vendor staging commit failed; previous managed assets restored: ${String(error)}`, { cause: error })
  }

  removeBestEffort(nextWorkspace)
  removeBestEffort(backupRoot)
}

export async function rebuildVendorAssets(options: RebuildVendorAssetsOptions): Promise<VendorAssetInventory> {
  const role = requireRoleName(options.role)
  const manifest = await loadVendorManifest(options.manifestPath)
  const plan = buildStagingPlan(manifest, options.homeDir, role)
  const { buildRoot, stagingRoot, roleStagingRoot } = materializePlan(plan, role)
  const finalVendorRoot = path.resolve(options.homeDir, 'vendor')

  try {
    const inventory = validateInventory(stagingRoot, finalVendorRoot, role, roleStagingRoot)
    await commitManagedEntries(stagingRoot, roleStagingRoot, options.homeDir, role)
    return inventory
  }
  finally {
    removeBestEffort(buildRoot)
  }
}
