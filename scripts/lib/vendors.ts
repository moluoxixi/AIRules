import path from 'node:path'
import { fileURLToPath, pathToFileURL, URL } from 'node:url'
import { HOST_IDS } from '../../constants/hosts.js'
import { flattenedSkillName, flattenedVendorSkillTarget } from './skill-projection.js'

const vendorNamePattern = /^[A-Za-z0-9][\w-]*$/u
const npmPackageNamePattern = /^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/u
const npmInstallVersionPattern = /^(?:(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?|[a-z][a-z0-9._-]*)$/u
const gitCommitPattern = /^[a-f0-9]{40}$/u
const remoteGitProtocols = new Set(['https:', 'http:', 'ssh:', 'git:', 'git+ssh:'])
const scpStyleRemotePattern = /^[^@\s/:]+@[^@\s/:]+:\S+$/u

/**
 * 安装前置命令必须以结构化参数声明，避免把配置内容拼进 shell 字符串。
 */
export interface SetupCommand {
  command: string
  args?: string[]
  /** Windows 下该命令由 `.cmd` shim 提供；宿主执行器据此安全解析可执行文件。 */
  windowsCommandShim?: boolean
  /**
   * 当指定命令已存在于 PATH 时跳过当前 setup 命令。
   * 适用于全局工具已安装后不应重复覆盖正在运行二进制的场景。
   */
  skipIfCommandAvailable?: string
}

/** A published role package may optionally provide a global CLI for role setup. */
export interface RolePackageInstall {
  kind: 'npm-global'
  /** npm version or dist-tag. Defaults to `latest`. */
  version?: string
}

/** Role-owned npm package declaration. Array order is the publication order. */
export interface RolePackageConfig {
  name: string
  /** Package directory relative to `roles/<role>`. */
  path: string
  /** Packages without this field are published but not globally installed. */
  install?: RolePackageInstall
}

/**
 * 单个 skill 的详细配置（适用于需要重命名或前置安装命令的场景）。
 */
export interface SkillConfig {
  /** 仓库内源目录名。 */
  name: string
  /** 安装后目录名，默认与 name 相同。 */
  output?: string
  /**
   * 该 skill 的安装前置命令。
   * 在 skill 链接建立后执行，例如安装对应的全局 CLI 工具。
   */
  setup?: SetupCommand[]
}

/**
 * 技能定义：字符串简写或对象配置。
 */
export type SkillDef = string | SkillConfig

/**
 * 单个供应商仓库内的一条安装投影规则。
 */
export type VendorProjection
  = | {
    kind: 'namespace'
    /** 仓库内要递归扫描的目录。 */
    sourceDir: string
    /** 清单中的占位名；实际 vendor 目录由叶子 skill 名称决定。 */
    output: string
    /** namespace 级安装前置命令。 */
    setup?: SetupCommand[]
  }
  | {
    kind: 'skills'
    /** 仓库内技能所在的基准目录。 */
    sourceBaseDir: string
    /** 需要精确安装的技能列表。 */
    skills: SkillDef[]
  }
  | {
    kind: 'role-assets'
    /** 远程仓库内所选角色根目录，如 roles/example-development。 */
    sourceDir: string
  }
  | {
    kind: 'mcp'
    /** 仓库内单个 MCP 清单文件路径，如 mcps/code/mcps.json。文件格式包含 mcp 配置和 setup 命令。 */
    sourceFile: string
    /** 投影到 vendor/ 下的目标路径，如 mcps/code/mcp.json。会从 sourceFile 提取 mcp 配置并生成标准 MCP 格式。 */
    output: string
  }

/**
 * 代表一个必须通过 Git remote checkout 获取的供应商仓库。
 */
export interface VendorRepo {
  /** 供应商名称，也是克隆到本地后的目录名。 */
  name: string
  /** Git 仓库地址。 */
  source: string
  /** 固定 checkout 的完整 Git commit SHA；省略时跟随远端默认分支。 */
  revision?: string
  /**
   * 供应商级安装前置命令。
   */
  setup?: SetupCommand[]
  /** 从远程 checkout 投影到 vendor staging 的安装规则列表；仅做 setup 的供应商可为空。 */
  projections: VendorProjection[]
}

/**
 * 技能节点：可以是一个具体的 VendorRepo，也可以是包含多个节点的分类对象。
 */
export type VendorNode = VendorRepo | { [category: string]: VendorNode[] }

/**
 * 供应商配置根结构。
 */
export type VendorsConfig = VendorNode[]

export function normalizePath(value: string): string {
  return value.replace(/\\/g, '/')
}

export interface VendorLink {
  kind:
    | 'namespace-dir'
    | 'skill'
    | 'role-assets-dir'
    | 'mcp-file'
  source: string
  target: string
  /** 该 skill 或 MCP 的安装前置命令 */
  setup?: SetupCommand[]
}

export interface Vendor {
  repo: string
  revision?: string
  cloneDir: string
  setup?: SetupCommand[]
  links: VendorLink[]
}

export interface VendorManifest {
  hosts?: string[]
  packages?: RolePackageConfig[]
  version: number
  vendors: Record<string, Vendor>
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
  const manifestUrl = pathToFileURL(path.resolve(manifestPath)).href
  const module = await import(manifestUrl)
  const vendorTree = module.vendors ?? module.default?.vendors ?? module.default
  if (!vendorTree || typeof vendorTree !== 'object') {
    throw new Error(`Vendor manifest "${manifestPath}" must export a "vendors" object`)
  }

  const vendors: Record<string, Vendor> = {}
  walkVendorTree(vendorTree, [], vendors)
  const hosts = normalizeRoleHosts(module.hosts ?? module.default?.hosts, manifestPath)
  const packages = normalizeRolePackages(module.packages ?? module.default?.packages, manifestPath)

  return {
    ...(hosts === undefined ? {} : { hosts }),
    packages,
    version: 1,
    vendors,
  }
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
