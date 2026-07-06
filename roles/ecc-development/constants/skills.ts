import type { VendorsConfig } from '../../../scripts/lib/vendors.js'

/**
 * ecc-development 角色把成熟上游 ECC 作为主编排来源。
 * 原生宿主安装走 ECC 官方 installer；这里仅保留 namespace 兜底投影，
 * 不混入 development 角色的 Superpowers/gstack/BMAD 组合。
 */
export const vendors: VendorsConfig = [
  {
    name: 'ecc',
    official: true,
    source: 'https://github.com/affaan-m/ECC.git',
    projections: [
      {
        // ECC upstream states that skills/ is the canonical workflow surface.
        // AIRules keeps it for non-native hosts and skip-vendors fallback flows.
        kind: 'namespace',
        sourceDir: 'skills',
        output: 'ecc',
      },
    ],
  },
]
