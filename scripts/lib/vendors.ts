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

function isVendorEntry(value: any): boolean {
  return Boolean(
    value &&
    typeof value === 'object' &&
    typeof value.name === 'string' &&
    typeof value.source === 'string'
  );
}

function buildTargetPath(namespaceParts: string[], outputName: string): string {
  // Always ignore namespaceParts to keep a flat installation structure in vendor/skills
  return path.posix.join('vendor', 'skills', outputName);
}

function buildLinksForEntry(namespaceParts: string[], entry: any): VendorLink[] {
  if (entry.sourceDir) {
    return [{
      kind: 'namespace-dir',
      source: entry.sourceDir,
      target: path.posix.join('vendor', 'skills', entry.name),
    }];
  }

  const sourceBaseDir = entry.sourceBaseDir ?? 'skills';
  return Object.entries(entry.skills ?? {}).map(([sourceName, outputName]) => ({
    kind: 'skill',
    source: path.posix.join(sourceBaseDir, sourceName as string),
    target: buildTargetPath(namespaceParts, outputName as string),
  }));
}

function mergeVendor(vendors: Record<string, Vendor>, vendorName: string, namespaceParts: string[], entry: any) {
  if (entry.local === true) {
    throw new Error('Local vendor entries are not supported');
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
    throw new Error(`Vendor "${vendorName}" is defined inconsistently across modules`);
  }

  existing.official = existing.official || entry.official;
  existing.links.push(...links);
}

function walkVendorTree(node: any, namespaceParts: string[], vendors: Record<string, Vendor>) {
  if (Array.isArray(node)) {
    for (const entry of node) {
      if (!isVendorEntry(entry)) {
        throw new Error(`Invalid vendor entry under "${namespaceParts.join('/') || '<root>'}"`);
      }

      mergeVendor(vendors, entry.name, namespaceParts, entry);
    }
    return;
  }

  for (const [key, value] of Object.entries(node ?? {})) {
    walkVendorTree(value, [...namespaceParts, key], vendors);
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
