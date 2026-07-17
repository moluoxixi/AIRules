import type { VendorRepo } from '../../../scripts/lib/vendors.js'

export const extendsRoles: string[] = []

export const hosts: string[] = [
  'claude',
  'codex',
  'hermes',
  'hermes desktop',
  'cursor',
  'agentsmd',
  'qoderwork',
  'trae',
  'trae-cn',
  'trae-solo',
  'trae-solo-cn',
  'qoder',
  'opencode',
  'cc-switch',
]

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
