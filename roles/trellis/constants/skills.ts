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
        sourceDir: 'roles/trellis',
      },
      {
        kind: 'namespace',
        sourceDir: 'skills/common',
        output: 'common',
      },
      {
        kind: 'mcp',
        sourceFile: 'mcps/code/mcps.json',
        output: 'mcps/code/mcp.json',
      },
    ],
  },
  {
    name: 'mattpocock',
    source: 'https://github.com/mattpocock/skills.git',
    revision: '8b78b531ab965735c5dc74f6f7a219e1e37326df',
    projections: [
      {
        kind: 'namespace',
        sourceDir: 'skills/productivity',
        output: 'productivity',
      },
    ],
  },
]
