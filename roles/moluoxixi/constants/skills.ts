import type { VendorRepo } from '../../../scripts/lib/vendors.js'

export const extendsRoles: string[] = []

export const hosts = 'all'

export const vendors: VendorRepo[] = [
  {
    name: 'moluoxixi',
    source: 'https://github.com/moluoxixi/AIRules.git',
    setup: [
      {
        command: 'npm',
        args: ['install', '--global', '@colbymchenry/codegraph'],
        skipIfCommandAvailable: 'codegraph',
      },
      {
        command: 'codegraph',
        args: ['install', '--yes'],
        windowsCommandShim: true,
      },
    ],
    projections: [
      {
        kind: 'role-assets',
        sourceDir: 'roles/moluoxixi',
      },
    ],
  },
]
