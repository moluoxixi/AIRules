import path from 'node:path';
import { pathToFileURL } from 'node:url';

export function normalizePath(value: string): string {
  return value.replace(/\\/g, '/');
}

export interface VendorLink {
  kind: string;
  source: string;
  target: string;
}

export interface Vendor {
  official?: boolean;
  repo: string;
  cloneDir: string;
  links: VendorLink[];
}

export interface VendorManifest {
  version: number;
  vendors: Record<string, Vendor>;
}

/**
 * 判断是否为有效的 VendorRepo 定义
 */
function isVendorEntry(value: any): boolean {
  return Boolean(
    value &&
    typeof value === 'object' &&
    typeof value.name === 'string' &&
    typeof value.source === 'string'
  );
}

/**
 * 构造技能链接的目标路径
 * @param namespaceParts 分类路径片段
 * @param outputName 最终的技能目录名
 */
function buildTargetPath(namespaceParts: string[], outputName: string): string {
  return path.posix.join('vendor', 'skills', ...namespaceParts, outputName);
}

/**
 * 构建单个供应商实体的链接计划
 * @param namespaceParts 当前递归深度对应的分类路径
 * @param entry 供应商定义实体
 */
function buildLinksForEntry(namespaceParts: string[], entry: any): VendorLink[] {
  if (entry.sourceDir) {
    return [{
      kind: 'namespace-dir',
      source: entry.sourceDir,
      target: path.posix.join('vendor', 'skills', ...namespaceParts, entry.name),
    }];
  }

  const sourceBaseDir = entry.sourceBaseDir ?? 'skills';
  return Object.entries(entry.skills ?? {}).map(([sourceName, outputName]) => ({
    kind: 'skill',
    source: path.posix.join(sourceBaseDir, sourceName as string),
    target: buildTargetPath(namespaceParts, outputName as string),
  }));
}

/**
 * 合并供应商定义到全局清单
 */
function mergeVendor(vendors: Record<string, Vendor>, vendorName: string, namespaceParts: string[], entry: any) {
  if (entry.local === true) {
    throw new Error('暂不支持本地供应商实体 (Local vendor entries)');
  }

  const cloneDir = path.posix.join('vendor', 'repos', vendorName);
  const links = buildLinksForEntry(namespaceParts, entry);

  if (!vendors[vendorName]) {
    vendors[vendorName] = {
      official: entry.official,
      repo: entry.source,
      cloneDir,
      links,
    };
    return;
  }

  const existing = vendors[vendorName];
  if (
    existing.repo !== entry.source ||
    existing.cloneDir !== cloneDir
  ) {
    throw new Error(`供应商 "${vendorName}" 在不同模块中的定义不一致`);
  }

  existing.official = existing.official || entry.official;
  existing.links.push(...links);
}

/**
 * 递归遍历供应商定义树，支持混合数组和对象结构
 * @param node 当前处理的节点 (VendorRepo | Record | Array)
 * @param namespaceParts 当前递归深度对应的分类路径
 * @param vendors 全局积累的供应商对象映射
 */
/**
 * 递归遍历供应商定义树，支持混合数组和对象结构
 * @param node 当前处理的节点 (VendorRepo | Record | Array)
 * @param namespaceParts 当前递归深度对应的分类路径
 * @param vendors 全局积累的供应商对象映射
 */
export function walkVendorTree(node: any, namespaceParts: string[], vendors: Record<string, Vendor>) {
  if (!node) return;

  if (Array.isArray(node)) {
    for (const entry of node) {
      if (isVendorEntry(entry)) {
        mergeVendor(vendors, entry.name, namespaceParts, entry);
      } else if (entry && typeof entry === 'object') {
        // 如果数组元素是普通对象，则视为分类节点（例如 { "frontend": [...] }）
        for (const [key, value] of Object.entries(entry)) {
          walkVendorTree(value, [...namespaceParts, key], vendors);
        }
      } else {
        throw new Error(`在分类 "${namespaceParts.join('/') || '根目录'}" 下发现无效的供应商节点定义`);
      }
    }
  } else if (typeof node === 'object') {
    // 处理直接传入的对象结构（用于递归或旧版兼容）
    for (const [key, value] of Object.entries(node)) {
      walkVendorTree(value, [...namespaceParts, key], vendors);
    }
  }
}

export async function loadVendorManifest(manifestPath: string): Promise<VendorManifest> {
  const manifestUrl = manifestPath instanceof URL
    ? manifestPath.href
    : pathToFileURL(path.resolve(manifestPath)).href;
  const module = await import(manifestUrl);
  const vendorTree = module.vendors ?? module.default?.vendors ?? module.default;
  if (!vendorTree || typeof vendorTree !== 'object') {
    throw new Error(`Vendor manifest "${manifestPath}" must export a "vendors" object`);
  }

  const vendors: Record<string, Vendor> = {};
  walkVendorTree(vendorTree, [], vendors);

  return {
    version: 1,
    vendors,
  };
}

export function getRepoRoot(fromFileUrl: string): string {
  return path.resolve(new URL('../..', fromFileUrl).pathname);
}

export function resolveHomePath(homeDir: string, relativePath: string): string {
  return normalizePath(path.resolve(homeDir, relativePath));
}
