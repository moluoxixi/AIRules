import path from 'node:path'
import { fileURLToPath, pathToFileURL, URL } from 'node:url'
import { flattenedSkillName, flattenedVendorSkillTarget } from './skill-projection.js'

const vendorNamePattern = /^[A-Za-z0-9][\w-]*$/u
const remoteGitProtocols = new Set(['https:', 'http:', 'ssh:', 'git:', 'git+ssh:'])
const scpStyleRemotePattern = /^[^@\s/:]+@[^@\s/:]+:\S+$/u

/**
 * 安装前置命令必须以结构化参数声明，避免把配置内容拼进 shell 字符串。
 */
export interface SetupCommand {
  command: string
  args?: string[]
  /**
   * 当指定命令已存在于 PATH 时跳过当前 setup 命令。
   * 适用于全局工具已安装后不应重复覆盖正在运行二进制的场景。
   */
  skipIfCommandAvailable?: string
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
 * 单个 agent 的详细配置（适用于从上游 agents 目录精选文件或重命名的场景）。
 */
export interface AgentConfig {
  /** 仓库内 agent 文件名；可省略 .md 后缀。 */
  name: string
  /** 安装后文件名，默认与 name 相同；可省略 .md 后缀。 */
  output?: string
}

/**
 * Agent 定义：字符串简写或对象配置。
 */
export type AgentDef = string | AgentConfig

export interface HookConfig {
  /** 仓库内 hook 文件名。 */
  name: string
  /** 安装后的 hook 文件名，默认与 name 相同。 */
  output?: string
}

export type HookDef = string | HookConfig

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
    kind: 'agents'
    /** 仓库内 agent 源目录。 */
    sourceDir: string
    /** vendor 侧目标目录，默认 vendor/agents。 */
    targetDir?: string
    /** 需要精确安装的 agent 文件列表；省略时投影整个 sourceDir。 */
    agents?: AgentDef[]
  }
  | {
    kind: 'mcp'
    /** 仓库内 MCP 配置源文件。 */
    sourceFile: string
    /** vendor 侧目标文件，默认 vendor/mcp/mcp.json。 */
    targetFile?: string
  }
  | {
    kind: 'rules'
    /** 仓库内中性规则文件。 */
    sourceFile: string
    /** vendor 侧目标文件，默认 vendor/AGENTS.md。 */
    targetFile?: string
  }
  | {
    kind: 'hooks'
    /** 仓库内 hook 源目录。 */
    sourceDir: string
    /** vendor 侧目标目录，默认 vendor/hooks。 */
    targetDir?: string
    /** 需要精确转发的 hook 文件；省略时转发整个目录。 */
    hooks?: HookDef[]
  }
  | {
    kind: 'role-assets'
    /** 远程仓库内所选角色根目录，如 roles/openspec-development。 */
    sourceDir: string
  }

/**
 * 代表一个必须通过 Git remote checkout 获取的供应商仓库。
 */
export interface VendorRepo {
  /** 供应商名称，也是克隆到本地后的目录名。 */
  name: string
  /** 是否为官方仓库。 */
  official: boolean
  /** Git 仓库地址。 */
  source: string
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
    | 'agents-dir'
    | 'agent-file'
    | 'rules-file'
    | 'hooks-dir'
    | 'hook-file'
    | 'mcp-file'
    | 'role-assets-dir'
  source: string
  target: string
  /** 该 skill 的安装前置命令（来自 SkillConfig.setup） */
  setup?: SetupCommand[]
}

export interface Vendor {
  official?: boolean
  repo: string
  cloneDir: string
  sourceMode?: 'workspace'
  setup?: SetupCommand[]
  links: VendorLink[]
}

export interface VendorManifest {
  version: number
  vendors: Record<string, Vendor>
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

function agentFileName(value: string): string {
  return value.endsWith('.md') ? value : `${value}.md`
}

function buildAgentLink(sourceDir: string, targetDir: string, agentDef: any): VendorLink {
  if (typeof agentDef === 'string') {
    const fileName = agentFileName(agentDef)
    return {
      kind: 'agent-file',
      source: path.posix.join(sourceDir, fileName),
      target: path.posix.join(targetDir, fileName),
    }
  }

  const sourceFileName = agentFileName(agentDef.name as string)
  const outputFileName = agentFileName((agentDef.output ?? sourceFileName) as string)
  return {
    kind: 'agent-file',
    source: path.posix.join(sourceDir, sourceFileName),
    target: path.posix.join(targetDir, outputFileName),
  }
}

function buildHookLink(sourceDir: string, targetDir: string, hookDef: any): VendorLink {
  if (typeof hookDef === 'string') {
    return {
      kind: 'hook-file',
      source: path.posix.join(sourceDir, hookDef),
      target: path.posix.join(targetDir, hookDef),
    }
  }

  return {
    kind: 'hook-file',
    source: path.posix.join(sourceDir, hookDef.name as string),
    target: path.posix.join(targetDir, (hookDef.output ?? hookDef.name) as string),
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

    if (projection.kind === 'agents') {
      const targetDir = projection.targetDir ?? 'vendor/agents'
      if (Array.isArray(projection.agents)) {
        return projection.agents.map((agentDef: any) =>
          buildAgentLink(projection.sourceDir, targetDir, agentDef),
        )
      }

      return [{
        kind: 'agents-dir',
        source: projection.sourceDir,
        target: targetDir,
      }]
    }

    if (projection.kind === 'mcp') {
      return [{
        kind: 'mcp-file',
        source: projection.sourceFile,
        target: projection.targetFile ?? 'vendor/mcp/mcp.json',
      }]
    }

    if (projection.kind === 'rules') {
      return [{
        kind: 'rules-file',
        source: projection.sourceFile,
        target: projection.targetFile ?? 'vendor/AGENTS.md',
      }]
    }

    if (projection.kind === 'hooks') {
      const targetDir = projection.targetDir ?? 'vendor/hooks'
      if (Array.isArray(projection.hooks)) {
        return projection.hooks.map((hookDef: any) =>
          buildHookLink(projection.sourceDir, targetDir, hookDef),
        )
      }
      return [{
        kind: 'hooks-dir',
        source: projection.sourceDir,
        target: targetDir,
      }]
    }

    if (projection.kind === 'role-assets') {
      return [{
        kind: 'role-assets-dir',
        source: projection.sourceDir,
        target: 'vendor',
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
  const cloneDir = path.posix.join('vendor', 'repos', safeVendorName)
  const links = buildLinksForEntry(entry)

  if (!vendors[safeVendorName]) {
    vendors[safeVendorName] = {
      official: entry.official,
      repo: remoteSource,
      cloneDir,
      setup: entry.setup,
      links,
    }
    return
  }

  const existing = vendors[safeVendorName]
  if (
    existing.repo !== remoteSource
    || existing.cloneDir !== cloneDir
  ) {
    throw new Error(`供应商 "${safeVendorName}" 在不同模块中的定义不一致`)
  }

  existing.official = existing.official || entry.official
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

  return {
    version: 1,
    vendors,
  }
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
