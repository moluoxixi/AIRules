import path from 'node:path';
import { normalizePath, type VendorManifest } from './vendors.js';

export interface LinkEntry {
  vendorId: string;
  source: string;
  target: string;
}

export function buildLinkPlan(manifest: VendorManifest, homeDir: string): LinkEntry[] {
  const plan: LinkEntry[] = [];

  for (const [vendorId, vendor] of Object.entries(manifest.vendors ?? {})) {
    for (const link of vendor.links ?? []) {
      const source = normalizePath(path.resolve(homeDir, vendor.cloneDir, link.source));
      const target = normalizePath(path.resolve(homeDir, link.target));

      plan.push({
        vendorId,
        source,
        target
      });
    }
  }

  return plan.sort((left, right) => left.target.localeCompare(right.target));
}
