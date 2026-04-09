import path from 'node:path';
import { pathToFileURL } from 'node:url';

export function normalizePath(value) {
  return value.replace(/\\/g, '/');
}

function isVendorEntry(value) {
  return Boolean(value && typeof value === 'object' && typeof value.source === 'string');
}

function buildTargetPath(namespaceParts, outputName) {
  return path.posix.join('vendor', 'skills', ...namespaceParts, outputName);
}

function buildLinksForEntry(namespaceParts, entry) {
  if (entry.sourceDir) {
    return [{
      kind: 'namespace-dir',
      source: entry.sourceDir,
      target: path.posix.join('vendor', 'skills', ...namespaceParts),
    }];
  }

  const sourceBaseDir = entry.sourceBaseDir ?? 'skills';
  return Object.entries(entry.skills ?? {}).map(([sourceName, outputName]) => ({
    kind: 'skill',
    source: path.posix.join(sourceBaseDir, sourceName),
    target: buildTargetPath(namespaceParts, outputName),
  }));
}

function mergeVendor(vendors, vendorId, namespaceParts, entry) {
  const cloneDir = path.posix.join('vendor', 'repos', vendorId);
  const links = buildLinksForEntry(namespaceParts, entry);

  if (!vendors[vendorId]) {
    vendors[vendorId] = {
      official: entry.official,
      repo: entry.source,
      cloneDir,
      links,
    };
    return;
  }

  const existing = vendors[vendorId];
  if (existing.repo !== entry.source || existing.cloneDir !== cloneDir) {
    throw new Error(`Vendor "${vendorId}" is defined inconsistently across modules`);
  }

  existing.official = existing.official || entry.official;
  existing.links.push(...links);
}

function walkVendorTree(node, namespaceParts, vendors) {
  for (const [key, value] of Object.entries(node ?? {})) {
    if (isVendorEntry(value)) {
      const vendorId = value.vendorId ?? key;
      const targetNamespaceParts = namespaceParts.length === 0 ? [key] : namespaceParts;
      mergeVendor(vendors, vendorId, targetNamespaceParts, value);
      continue;
    }

    walkVendorTree(value, [...namespaceParts, key], vendors);
  }
}

export async function loadVendorManifest(manifestPath) {
  const manifestUrl = manifestPath instanceof URL
    ? manifestPath.href
    : pathToFileURL(path.resolve(manifestPath)).href;
  const module = await import(manifestUrl);
  const vendorTree = module.vendors ?? module.default?.vendors ?? module.default;
  if (!vendorTree || typeof vendorTree !== 'object') {
    throw new Error(`Vendor manifest "${manifestPath}" must export a "vendors" object`);
  }

  const vendors = {};
  walkVendorTree(vendorTree, [], vendors);

  return {
    version: 1,
    vendors,
  };
}

export function getRepoRoot(fromFileUrl) {
  return path.resolve(new URL('../..', fromFileUrl).pathname);
}

export function resolveHomePath(homeDir, relativePath) {
  return normalizePath(path.resolve(homeDir, relativePath));
}
