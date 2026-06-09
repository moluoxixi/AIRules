import type { SetupCommand } from '../../constants/skills.js'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { flattenedSkillName, flattenedVendorSkillTarget } from './skill-projection.js'

export function normalizePath(value: string): string {
  return value.replace(/\\/g, '/')
}

export interface VendorLink {
  kind: string
  source: string
  target: string
  /** 该 skill 的安装前置命令（来自 SkillConfig.setup） */
  setup?: SetupCommand[]
}

export interface Vendor {
  official?: boolean
  repo: string
  sourceMode?: 'git' | 'workspace'
  cloneDir: string
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
  if (entry.sourceDir || entry.sourceBaseDir || entry.skills) {
    throw new Error(`供应商 "${entry.name}" 必须使用 projections 配置`)
  }

  if (!Array.isArray(entry.projections)) {
    throw new TypeError(`供应商 "${entry.name}" 必须使用 projections 配置`)
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

  const cloneDir = path.posix.join('vendor', 'repos', vendorName)
  const links = buildLinksForEntry(entry)

  if (!vendors[vendorName]) {
    vendors[vendorName] = {
      official: entry.official,
      repo: entry.source,
      sourceMode: entry.sourceMode,
      cloneDir,
      setup: entry.setup,
      links,
    }
    return
  }

  const existing = vendors[vendorName]
  if (
    existing.repo !== entry.source
    || existing.sourceMode !== entry.sourceMode
    || existing.cloneDir !== cloneDir
  ) {
    throw new Error(`供应商 "${vendorName}" 在不同模块中的定义不一致`)
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
