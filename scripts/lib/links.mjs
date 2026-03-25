import path from 'node:path';

import { normalizePath } from './vendors.mjs';

export function buildLinkPlan(manifest, homeDir) {
  const plan = [];

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
