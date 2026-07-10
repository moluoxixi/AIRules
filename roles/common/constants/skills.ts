import type { VendorsConfig } from '../../../scripts/lib/vendors.js'

/**
 * common 是可独立选择的通用能力角色，不与其它角色隐式组合。
 */
export const vendors: VendorsConfig = [
  {
    name: 'moluoxixi',
    official: true,
    source: 'https://github.com/moluoxixi/AIRules.git',
    projections: [
      {
        kind: 'role-assets',
        sourceDir: 'roles/common',
      },
    ],
  },
]
