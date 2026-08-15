import type { VendorRepo } from '../../../scripts/lib/vendors.js'

export const extendsRoles: string[] = []

export const hosts = 'all'

export const vendors: VendorRepo[] = [
  {
    name: 'mattpocock',
    source: 'https://github.com/mattpocock/skills.git',
    revision: '8b78b531ab965735c5dc74f6f7a219e1e37326df',
    projections: [
      {
        kind: 'namespace',
        sourceDir: 'skills/engineering',
        output: 'engineering',
      },
      {
        kind: 'namespace',
        sourceDir: 'skills/productivity',
        output: 'productivity',
      },
    ],
  },
  {
    name: 'matt-role',
    source: 'https://github.com/moluoxixi/AIRules.git',
    projections: [
      {
        kind: 'role-assets',
        sourceDir: 'roles/matt',
      },
    ],
  },
]
