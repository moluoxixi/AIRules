import type { RolePackageConfig, VendorRepo } from '../../../scripts/lib/vendors.js'

export const extendsRoles: string[] = []

export const hosts = 'all'

export const packages: RolePackageConfig[] = [
  {
    name: '@moluoxixi/airules-moluoxixi-core',
    path: 'packages/core',
  },
  {
    name: '@moluoxixi/airules-moluoxixi-cli',
    path: 'packages/cli',
    install: {
      kind: 'npm-global',
      version: 'latest',
    },
  },
]

export const vendors: VendorRepo[] = [
  {
    name: 'moluoxixi',
    source: 'https://github.com/moluoxixi/AIRules.git',
    projections: [
      {
        kind: 'role-assets',
        sourceDir: 'roles/moluoxixi',
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
