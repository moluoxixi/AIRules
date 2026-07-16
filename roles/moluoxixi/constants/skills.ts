import type { SetupCommand, VendorRepo } from '../../../scripts/lib/vendors.js'

const TRELLIS_VERSION = '0.6.7'

const roleSetup: SetupCommand[] = [
  {
    command: 'npm',
    args: ['install', '--global', `@mindfoldhq/trellis@${TRELLIS_VERSION}`],
  },
]

export const extendsRoles: string[] = []

export const vendors: VendorRepo[] = [
  {
    name: 'moluoxixi',
    official: true,
    source: 'https://github.com/moluoxixi/AIRules.git',
    setup: roleSetup,
    projections: [
      {
        kind: 'role-assets',
        sourceDir: 'roles/moluoxixi',
      },
    ],
  },
]
