import type { VendorRepo } from '../../../scripts/lib/vendors.js'

export const extendsRoles: string[] = []

export const hosts = 'all'

export const vendors: VendorRepo[] = [
  {
    name: 'trellis',
    source: 'https://github.com/moluoxixi/AIRules.git',
    setup: [
      {
        command: 'npm',
        args: ['install', '--global', '@mindfoldhq/trellis@latest'],
      },
    ],
    projections: [
      {
        kind: 'role-assets',
        sourceDir: 'roles/trellis',
      },
    ],
  },
]
