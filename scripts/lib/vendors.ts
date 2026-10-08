import type { CapabilityName } from './types/capabilities.js'
import type {
  RolePackageConfig,
  SetupCommand,
  SkillDef,
  Vendor,
  VendorLink,
  VendorManifest,
  VendorProjection,
  VendorRepo,
} from './types/manifest.js'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL, URL } from 'node:url'
import { parseDocument } from 'yaml'
import { CAPABILITY_NAMES, composeCapabilities } from './capabilities.js'
import { HOST_IDS } from './hosts.js'
import { flattenedSkillName, flattenedVendorSkillTarget } from './skill-projection.js'

const vendorNamePattern = /^[A-Za-z0-9][\w-]*$/u
const npmPackageNamePattern = /^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/u
const npmInstallVersionPattern = /^(?:(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?|[a-z][a-z0-9._-]*)$/u
const gitCommitPattern = /^[a-f0-9]{40}$/u
const remoteGitProtocols = new Set(['https:', 'http:', 'ssh:', 'git:', 'git+ssh:'])
const scpStyleRemotePattern = /^[^@\s/:]+@[^@\s/:]+:\S+$/u

export type {
  RolePackageConfig,
  RolePackageInstall,
  SetupCommand,
  SkillConfig,
  SkillDef,
  Vendor,
  VendorLink,
  VendorManifest,
  VendorNode,
  VendorProjection,
  VendorRepo,
  VendorsConfig,
} from './types/manifest.js'

export function normalizePath(value: string): string {
  return value.replace(/\\/g, '/')
}

export function rolePackageSetupCommands(packages: RolePackageConfig[] = []): SetupCommand[] {
  return packages.flatMap((rolePackage) => {
    if (!rolePackage.install)
      return []
    const version = rolePackage.install.version ?? 'latest'
    return [{
      command: 'npm',
      args: ['install', '--global', `${rolePackage.name}@${version}`],
    }]
  })
}

/**
 * 判断是否为有效的 VendorRepo 定义
 */
function isVendorEntry(value: any): boolean {
  return Boolean(
    value
    && typeof value === 'object'
    && typeof value.name === 'string'
    && typeof value.source === 'string',
  )
}

function requireVendorName(value: string): string {
  if (!vendorNamePattern.test(value)) {
    throw new Error(`Invalid vendor name "${value}": expected a safe single-path identifier`)
  }
  return value
}

function requireRemoteGitSource(value: string, vendorName: string): string {
  if (scpStyleRemotePattern.test(value)) {
    return value
  }

  try {
    const sourceUrl = new URL(value)
    const authority = value.match(/^[A-Za-z][A-Za-z0-9+.-]*:\/\/([^/?#]*)/u)?.[1]
    if (remoteGitProtocols.has(sourceUrl.protocol) && authority && sourceUrl.hostname) {
      return value
    }
  }
  catch {
    // Fall through to the manifest boundary error below.
  }

  throw new Error(`Vendor "${vendorName}" source must be a remote Git URL: ${value}`)
}

function requireGitRevision(value: unknown, vendorName: string): string | undefined {
  if (value === undefined) {
    return undefined
  }
  if (typeof value !== 'string' || !gitCommitPattern.test(value)) {
    throw new Error(`Vendor "${vendorName}" revision must be a lowercase 40-character Git commit SHA`)
  }
  return value
}

/**
 * 构造 vendor 侧技能目标路径。
 * 源配置允许多级分类或嵌套源路径，但 vendor/skills 始终以叶子 skill 名称展平。
 * @param outputName 最终的技能目录名
 */
function buildTargetPath(outputName: string): string {
  return flattenedVendorSkillTarget(outputName)
}

/**
 * 构建 skills projection 中单个 skill 的链接计划
 * @param sourceBaseDir 仓库内技能基准目录
 * @param skillDef 字符串简写或带输出名/setup 的 skill 配置
 */
function buildSkillLink(sourceBaseDir: string, skillDef: any): VendorLink {
  if (typeof skillDef === 'string') {
    return {
      kind: 'skill',
      source: path.posix.join(sourceBaseDir, skillDef),
      target: buildTargetPath(skillDef),
    }
  }

  const sourceName = skillDef.name as string
  const outputName = (skillDef.output ?? flattenedSkillName(sourceName)) as string
  return {
    kind: 'skill',
    source: path.posix.join(sourceBaseDir, sourceName),
    target: buildTargetPath(outputName),
    setup: skillDef.setup,
  }
}

/**
 * 构建单个供应商实体的链接计划
 * @param entry 供应商定义实体
 */
function buildLinksForEntry(entry: any): VendorLink[] {
  if (Object.hasOwn(entry, 'sourceMode')) {
    throw new Error(`供应商 "${entry.name}" 禁止声明 sourceMode；所有资产必须来自 Git remote checkout`)
  }

  if (entry.sourceDir || entry.sourceBaseDir || entry.skills) {
    throw new Error(`供应商 "${entry.name}" 必须使用 projections 配置`)
  }

  if (!Array.isArray(entry.projections)) {
    throw new TypeError(`供应商 "${entry.name}" 必须使用 projections 配置`)
  }

  if (entry.projections.length === 0 && (!entry.setup || entry.setup.length === 0)) {
    throw new Error(`供应商 "${entry.name}" 至少需要 projections 或 setup`)
  }

  return entry.projections.flatMap((projection: any) => {
    if (projection.kind === 'namespace') {
      return [{
        kind: 'namespace-dir',
        source: projection.sourceDir,
        target: buildTargetPath(projection.output),
        setup: projection.setup,
      }]
    }

    if (projection.kind === 'skills') {
      return projection.skills.map((skillDef: any) =>
        buildSkillLink(projection.sourceBaseDir, skillDef),
      )
    }

    if (projection.kind === 'role-assets') {
      return [{
        kind: 'role-assets-dir',
        source: projection.sourceDir,
        target: 'vendor',
      }]
    }

    if (projection.kind === 'mcp') {
      return [{
        kind: 'mcp-file',
        source: projection.sourceFile,
        target: path.posix.join('vendor', projection.output),
      }]
    }

    throw new Error(`供应商 "${entry.name}" 存在未知 projection 类型: ${projection.kind}`)
  })
}

/**
 * 合并供应商定义到全局清单
 */
function mergeVendor(vendors: Record<string, Vendor>, vendorName: string, entry: any) {
  if (entry.local === true) {
    throw new Error('暂不支持本地供应商实体 (Local vendor entries)')
  }

  const safeVendorName = requireVendorName(vendorName)
  const remoteSource = requireRemoteGitSource(entry.source, safeVendorName)
  const revision = requireGitRevision(entry.revision, safeVendorName)
  const cloneDir = path.posix.join('vendor', 'repos', safeVendorName)
  const links = buildLinksForEntry(entry)

  if (!vendors[safeVendorName]) {
    vendors[safeVendorName] = {
      repo: remoteSource,
      revision,
      cloneDir,
      setup: entry.setup,
      links,
    }
    return
  }

  const existing = vendors[safeVendorName]
  if (
    existing.repo !== remoteSource
    || existing.revision !== revision
    || existing.cloneDir !== cloneDir
  ) {
    throw new Error(`供应商 "${safeVendorName}" 在不同模块中的定义不一致`)
  }

  existing.setup = [...(existing.setup ?? []), ...(entry.setup ?? [])]
  existing.links.push(...links)
}

/**
 * 递归遍历供应商定义树，支持混合数组和对象结构
 * @param node 当前处理的节点 (VendorRepo | Record | Array)
 * @param namespaceParts 当前递归深度对应的分类路径
 * @param vendors 全局积累的供应商对象映射
 */
export function walkVendorTree(node: any, namespaceParts: string[], vendors: Record<string, Vendor>) {
  if (!node)
    return

  if (Array.isArray(node)) {
    for (const entry of node) {
      if (isVendorEntry(entry)) {
        mergeVendor(vendors, entry.name, entry)
      }
      else if (entry && typeof entry === 'object') {
        // 如果数组元素是普通对象，则视为分类节点（例如 { "frontend": [...] }）
        for (const [key, value] of Object.entries(entry)) {
          walkVendorTree(value, [...namespaceParts, key], vendors)
        }
      }
      else {
        throw new Error(`在分类 "${namespaceParts.join('/') || '根目录'}" 下发现无效的供应商节点定义`)
      }
    }
  }
  else if (typeof node === 'object') {
    // 处理直接传入的对象结构（用于递归或旧版兼容）
    for (const [key, value] of Object.entries(node)) {
      walkVendorTree(value, [...namespaceParts, key], vendors)
    }
  }
}

export async function loadVendorManifest(manifestPath: string): Promise<VendorManifest> {
  const resolvedManifestPath = path.resolve(manifestPath)
  const roleContract = tryLoadRoleContract(manifestPath)
  const isRoleYaml = path.basename(resolvedManifestPath).toLowerCase() === 'role.yaml'
  const module = isRoleYaml
    ? {}
    : await import(pathToFileURL(resolvedManifestPath).href)
  const roleVendor = roleContract?.roleVendor
    ?? module.roleVendor
    ?? module.default?.roleVendor
  const vendorTree = roleVendor === undefined
    ? (isRoleYaml ? {} : module.vendors ?? module.default?.vendors ?? module.default)
    : composeRoleVendorTree(manifestPath, roleVendor, roleContract)
  if (!vendorTree || typeof vendorTree !== 'object') {
    throw new Error(`Vendor manifest "${manifestPath}" must export a "vendors" object or a "roleVendor" definition`)
  }

  const vendors: Record<string, Vendor> = {}
  walkVendorTree(vendorTree, [], vendors)
  const hosts = normalizeRoleHosts(
    roleContract?.hosts ?? module.hosts ?? module.default?.hosts,
    manifestPath,
  )
  const packages = normalizeRolePackages(
    roleContract?.packages ?? module.packages ?? module.default?.packages,
    manifestPath,
  )

  return {
    ...(hosts === undefined ? {} : { hosts }),
    packages,
    version: 1,
    vendors,
  }
}

interface RoleContractData {
  hosts?: unknown
  packages?: unknown
  capabilities?: unknown
  roleVendor?: unknown
  roleVendorPosition?: 'before' | 'after'
}

/**
 * 定位清单对应的 role.yaml 角色契约。
 * 源码与 checkout 布局下契约位于清单的角色根目录；
 * dist 布局（dist/roles/<role>/constants/skills.js）下回退到包根的 roles/<role>/role.yaml。
 */
function resolveRoleContractPath(manifestPath: string): string {
  const resolvedManifest = path.resolve(manifestPath)
  if (path.basename(resolvedManifest).toLowerCase() === 'role.yaml' && fs.existsSync(resolvedManifest)) {
    return resolvedManifest
  }
  const roleRoot = path.dirname(path.dirname(resolvedManifest))
  const sourceContract = path.join(roleRoot, 'role.yaml')
  if (fs.existsSync(sourceContract))
    return sourceContract

  const rolesDir = path.dirname(roleRoot)
  const distRoot = path.dirname(rolesDir)
  if (path.basename(rolesDir) === 'roles' && path.basename(distRoot) === 'dist') {
    const packagedContract = path.join(path.dirname(distRoot), 'roles', path.basename(roleRoot), 'role.yaml')
    if (fs.existsSync(packagedContract))
      return packagedContract
  }
  throw new Error(`Vendor manifest "${manifestPath}" exports "roleVendor" but its role.yaml contract is missing: ${sourceContract}`)
}

function tryLoadRoleContract(manifestPath: string): RoleContractData | undefined {
  const resolvedManifest = path.resolve(manifestPath)
  let contractPath: string | undefined
  if (path.basename(resolvedManifest).toLowerCase() === 'role.yaml') {
    contractPath = resolvedManifest
  }
  else {
    const roleRoot = path.dirname(path.dirname(resolvedManifest))
    const sourceContract = path.join(roleRoot, 'role.yaml')
    if (fs.existsSync(sourceContract)) {
      contractPath = sourceContract
    }
    else {
      const rolesDir = path.dirname(roleRoot)
      const distRoot = path.dirname(rolesDir)
      if (path.basename(rolesDir) === 'roles' && path.basename(distRoot) === 'dist') {
        const packagedContract = path.join(path.dirname(distRoot), 'roles', path.basename(roleRoot), 'role.yaml')
        if (fs.existsSync(packagedContract))
          contractPath = packagedContract
      }
    }
  }
  if (contractPath === undefined || !fs.existsSync(contractPath))
    return undefined

  const document = parseDocument(fs.readFileSync(contractPath, 'utf8'), {
    merge: false,
    prettyErrors: true,
    strict: true,
    uniqueKeys: true,
  })
  if (document.errors.length > 0) {
    throw new Error(`Role contract "${contractPath}" is invalid: ${document.errors.map(error => error.message).join('; ')}`)
  }
  const contract = document.toJS({ maxAliasCount: 0 }) as unknown
  if (!contract || typeof contract !== 'object' || Array.isArray(contract)) {
    throw new Error(`Role contract "${contractPath}" must be a YAML mapping`)
  }

  const record = contract as Record<string, unknown>
  const capabilities = record.capabilities
  const roleVendorPosition = record.role_vendor_position ?? record.roleVendorPosition
  if (roleVendorPosition !== undefined && roleVendorPosition !== 'before' && roleVendorPosition !== 'after') {
    throw new Error(`Role contract "${contractPath}" field "role_vendor_position" must be "before" or "after"`)
  }

  return {
    ...(capabilities === undefined ? {} : { capabilities }),
    ...(record.hosts === undefined ? {} : { hosts: record.hosts }),
    ...(record.packages === undefined ? {} : { packages: record.packages }),
    ...(record.role_vendor === undefined && record.roleVendor === undefined
      ? {}
      : { roleVendor: record.role_vendor ?? record.roleVendor }),
    ...(roleVendorPosition === undefined ? {} : { roleVendorPosition }),
  }
}

function requireRoleCapabilityContract(manifestPath: string, contract: RoleContractData): {
  capabilities: CapabilityName[]
  roleVendorPosition?: 'before' | 'after'
} {
  const capabilities = contract.capabilities
  const contractPath = resolveRoleContractPath(manifestPath)
  if (!Array.isArray(capabilities) || capabilities.length === 0) {
    throw new Error(`Role contract "${contractPath}" must declare a non-empty "capabilities" list`)
  }

  const seen = new Set<string>()
  for (const capability of capabilities) {
    if (typeof capability !== 'string' || !(CAPABILITY_NAMES as readonly string[]).includes(capability)) {
      throw new Error(`Role contract "${contractPath}" references unknown capability "${String(capability)}"`)
    }
    if (seen.has(capability)) {
      throw new Error(`Role contract "${contractPath}" declares duplicate capability "${capability}"`)
    }
    seen.add(capability)
  }

  return {
    capabilities: capabilities as CapabilityName[],
    ...(contract.roleVendorPosition === undefined ? {} : { roleVendorPosition: contract.roleVendorPosition }),
  }
}

function manifestRecord(value: unknown, location: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new TypeError(`${location} must be an object`)
  return value as Record<string, unknown>
}

function manifestString(value: unknown, location: string): string {
  if (typeof value !== 'string' || value.length === 0)
    throw new TypeError(`${location} must be a non-empty string`)
  return value
}

function manifestOptionalString(value: unknown, location: string): string | undefined {
  return value === undefined ? undefined : manifestString(value, location)
}

function manifestField(record: Record<string, unknown>, snake: string, camel: string): unknown {
  return record[snake] ?? record[camel]
}

function normalizeSetupCommands(value: unknown, location: string): SetupCommand[] | undefined {
  if (value === undefined)
    return undefined
  if (!Array.isArray(value))
    throw new TypeError(`${location} must be an array`)

  return value.map((entry, index) => {
    const commandLocation = `${location}[${index}]`
    const record = manifestRecord(entry, commandLocation)
    const command = manifestString(record.command, `${commandLocation}.command`)
    const args = record.args
    if (args !== undefined && (!Array.isArray(args) || args.some(argument => typeof argument !== 'string'))) {
      throw new TypeError(`${commandLocation}.args must be an array of strings`)
    }
    const windowsCommandShim = manifestField(record, 'windows_command_shim', 'windowsCommandShim')
    const skipIfCommandAvailable = manifestField(record, 'skip_if_command_available', 'skipIfCommandAvailable')
    if (windowsCommandShim !== undefined && typeof windowsCommandShim !== 'boolean')
      throw new TypeError(`${commandLocation}.windows_command_shim must be boolean`)
    if (skipIfCommandAvailable !== undefined && typeof skipIfCommandAvailable !== 'string')
      throw new TypeError(`${commandLocation}.skip_if_command_available must be a string`)
    return {
      command,
      ...(args === undefined ? {} : { args: args as string[] }),
      ...(windowsCommandShim === undefined ? {} : { windowsCommandShim }),
      ...(skipIfCommandAvailable === undefined ? {} : { skipIfCommandAvailable }),
    }
  })
}

function normalizeSkillDefinition(value: unknown, location: string): SkillDef {
  if (typeof value === 'string')
    return value
  const record = manifestRecord(value, location)
  const name = manifestString(record.name, `${location}.name`)
  const output = manifestOptionalString(record.output, `${location}.output`)
  const setup = normalizeSetupCommands(record.setup, `${location}.setup`)
  return {
    name,
    ...(output === undefined ? {} : { output }),
    ...(setup === undefined ? {} : { setup }),
  }
}

function normalizeProjectionDefinitions(value: unknown, location: string): VendorProjection[] {
  if (!Array.isArray(value))
    throw new TypeError(`${location} must be an array`)
  return value.map((entry, index) => {
    const projectionLocation = `${location}[${index}]`
    const record = manifestRecord(entry, projectionLocation)
    const kind = manifestString(record.kind, `${projectionLocation}.kind`)
    if (kind === 'namespace') {
      return {
        kind,
        sourceDir: manifestString(manifestField(record, 'source_dir', 'sourceDir'), `${projectionLocation}.source_dir`),
        output: manifestString(record.output, `${projectionLocation}.output`),
        ...(normalizeSetupCommands(record.setup, `${projectionLocation}.setup`) === undefined
          ? {}
          : { setup: normalizeSetupCommands(record.setup, `${projectionLocation}.setup`) }),
      }
    }
    if (kind === 'skills') {
      const skills = record.skills
      if (!Array.isArray(skills))
        throw new TypeError(`${projectionLocation}.skills must be an array`)
      return {
        kind,
        sourceBaseDir: manifestString(manifestField(record, 'source_base_dir', 'sourceBaseDir'), `${projectionLocation}.source_base_dir`),
        skills: skills.map((skill, skillIndex) => normalizeSkillDefinition(skill, `${projectionLocation}.skills[${skillIndex}]`)),
      }
    }
    if (kind === 'role-assets') {
      return {
        kind,
        sourceDir: manifestString(manifestField(record, 'source_dir', 'sourceDir'), `${projectionLocation}.source_dir`),
      }
    }
    if (kind === 'mcp') {
      return {
        kind,
        sourceFile: manifestString(manifestField(record, 'source_file', 'sourceFile'), `${projectionLocation}.source_file`),
        output: manifestString(record.output, `${projectionLocation}.output`),
      }
    }
    throw new Error(`${projectionLocation} has unknown kind "${kind}"`)
  })
}

function normalizeVendorDefinition(value: unknown, manifestPath: string): VendorRepo {
  const location = `Vendor manifest "${manifestPath}" roleVendor`
  const record = manifestRecord(value, location)
  const name = manifestString(record.name, `${location}.name`)
  const source = manifestString(record.source, `${location}.source`)
  const revision = manifestOptionalString(record.revision, `${location}.revision`)
  const setup = normalizeSetupCommands(record.setup, `${location}.setup`)
  const projections = normalizeProjectionDefinitions(record.projections, `${location}.projections`)
  if (projections.length === 0 && (!setup || setup.length === 0))
    throw new Error(`${location} must declare projections or setup`)
  return {
    name,
    source,
    ...(revision === undefined ? {} : { revision }),
    ...(setup === undefined ? {} : { setup }),
    projections,
  }
}

/**
 * 依据 role.yaml 声明的 capabilities，把清单导出的 roleVendor 组合成完整 vendors 列表。
 */
function composeRoleVendorTree(manifestPath: string, roleVendor: unknown, roleContract?: RoleContractData): VendorRepo[] {
  if (!isVendorEntry(roleVendor)) {
    throw new Error(`Vendor manifest "${manifestPath}" export "roleVendor" must be a vendor definition with name and source`)
  }
  const contract = requireRoleCapabilityContract(manifestPath, roleContract ?? tryLoadRoleContract(manifestPath) ?? {})
  return composeCapabilities(contract.capabilities, {
    roleVendor: normalizeVendorDefinition(roleVendor, manifestPath),
    ...(contract.roleVendorPosition === undefined ? {} : { roleVendorPosition: contract.roleVendorPosition }),
  })
}

function normalizeRolePackages(value: unknown, manifestPath: string): RolePackageConfig[] {
  if (value === undefined)
    return []
  if (!Array.isArray(value))
    throw new TypeError(`Vendor manifest "${manifestPath}" export "packages" must be an array`)

  const packageNames = new Set<string>()
  const packagePaths = new Set<string>()
  return value.map((entry, index) => {
    const location = `Vendor manifest "${manifestPath}" package at index ${index}`
    if (!entry || typeof entry !== 'object' || Array.isArray(entry))
      throw new TypeError(`${location} must be an object`)

    const candidate = entry as Record<string, unknown>
    if (typeof candidate.name !== 'string' || !npmPackageNamePattern.test(candidate.name))
      throw new Error(`${location} has invalid npm package name "${String(candidate.name)}"`)
    if (packageNames.has(candidate.name))
      throw new Error(`Vendor manifest "${manifestPath}" contains duplicate package "${candidate.name}"`)
    packageNames.add(candidate.name)

    if (typeof candidate.path !== 'string' || candidate.path.length === 0)
      throw new Error(`${location} must declare a non-empty relative path`)
    const packagePath = normalizePath(candidate.path)
    const pathParts = packagePath.split('/')
    if (
      path.posix.isAbsolute(packagePath)
      || path.win32.isAbsolute(packagePath)
      || pathParts.some(part => part === '' || part === '.' || part === '..')
    ) {
      throw new Error(`${location} path must stay inside the role directory: ${candidate.path}`)
    }
    if (packagePaths.has(packagePath))
      throw new Error(`Vendor manifest "${manifestPath}" contains duplicate package path "${packagePath}"`)
    packagePaths.add(packagePath)

    if (candidate.install === undefined)
      return { name: candidate.name, path: packagePath }
    if (!candidate.install || typeof candidate.install !== 'object' || Array.isArray(candidate.install))
      throw new TypeError(`${location} install must be an object`)
    const install = candidate.install as Record<string, unknown>
    if (install.kind !== 'npm-global')
      throw new Error(`${location} install.kind must be "npm-global"`)
    if (install.version !== undefined && (typeof install.version !== 'string' || !npmInstallVersionPattern.test(install.version)))
      throw new Error(`${location} install.version must be an exact semver or safe npm dist-tag`)

    return {
      name: candidate.name,
      path: packagePath,
      install: {
        kind: 'npm-global',
        ...(install.version === undefined ? {} : { version: install.version as string }),
      },
    }
  })
}

function normalizeRoleHosts(value: unknown, manifestPath: string): string[] | undefined {
  if (value === undefined)
    return undefined
  if (value === 'all')
    return [...HOST_IDS]
  if (!Array.isArray(value) || !value.every(host => typeof host === 'string'))
    throw new TypeError(`Vendor manifest "${manifestPath}" export "hosts" must be "all" or a string array`)
  const unique = new Set(value)
  if (unique.size !== value.length)
    throw new Error(`Vendor manifest "${manifestPath}" export "hosts" must not contain duplicates`)
  const unknown = value.find(host => !HOST_IDS.includes(host))
  if (unknown)
    throw new Error(`Vendor manifest "${manifestPath}" references unknown host "${unknown}"`)
  return [...value]
}

export function getRepoRoot(fromFileUrl: string): string {
  return path.resolve(fileURLToPath(new URL('../..', fromFileUrl)))
}

export function resolveHomePath(homeDir: string, relativePath: string): string {
  // Preserve caller-provided absolute path style so tests and generated plans stay OS-neutral.
  const pathApi = path.win32.isAbsolute(homeDir)
    ? path.win32
    : path.posix.isAbsolute(homeDir)
      ? path.posix
      : path

  return normalizePath(pathApi.resolve(homeDir, relativePath))
}
