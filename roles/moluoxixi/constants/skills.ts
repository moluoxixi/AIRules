import type { VendorRepo } from '../../../scripts/lib/vendors.js'

export const extendsRoles: string[] = []

export const vendors: VendorRepo[] = [
  {
    name: 'moluoxixi',
    official: true,
    source: 'https://github.com/moluoxixi/AIRules.git',
    projections: [
      {
        kind: 'role-assets',
        sourceDir: 'roles/moluoxixi',
      },
    ],
  },
]
