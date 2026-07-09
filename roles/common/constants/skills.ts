import type { VendorsConfig } from '../../../scripts/lib/vendors.js'

/**
 * common 不是业务角色；它是可被其它角色通过 extendsRoles 显式继承的公共能力包。
 */
export const vendors: VendorsConfig = [
  {
    name: 'moluoxixi',
    official: true,
    source: 'https://github.com/moluoxixi/AIRules.git',
    sourceMode: 'workspace',
    projections: [
      {
        kind: 'skills',
        sourceBaseDir: 'roles/common/skills',
        skills: [
          'distill-candidates',
          'frontend-testing',
          'handoff',
          'recall-memory',
          'reflect',
          'remember',
          'session-capture',
        ],
      },
    ],
  },
]
