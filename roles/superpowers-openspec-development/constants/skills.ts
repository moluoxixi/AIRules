import type { VendorsConfig } from '../../../scripts/lib/vendors.js'

export const vendors = [
  {
    name: 'moluoxixi',
    official: true,
    source: 'https://github.com/moluoxixi/AIRules.git',
    projections: [
      {
        kind: 'role-assets',
        sourceDir: 'roles/superpowers-openspec-development',
      },
    ],
  },
  {
    name: 'superpowers',
    official: true,
    source: 'https://github.com/obra/superpowers.git',
    revision: 'd884ae04edebef577e82ff7c4e143debd0bbec99',
    projections: [
      {
        kind: 'namespace',
        sourceDir: 'skills',
        output: 'superpowers',
      },
    ],
  },
] satisfies VendorsConfig
