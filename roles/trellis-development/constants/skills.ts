import type { VendorsConfig } from '../../../scripts/lib/vendors.js'

export const vendors = [
  {
    name: 'moluoxixi',
    official: true,
    source: 'https://github.com/moluoxixi/AIRules.git',
    projections: [
      {
        kind: 'role-assets',
        sourceDir: 'roles/trellis-development',
      },
    ],
  },
] satisfies VendorsConfig
