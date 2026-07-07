import type { SkillDef, VendorsConfig } from '../../../scripts/lib/vendors.js'

/**
 * ecc-development 角色把成熟上游 ECC 作为主编排来源。
 * 原生宿主安装走 ECC 官方 core profile；这里仅保留 core / onboarding / retrieval
 * 兜底 skills，不混入 development 角色的 Superpowers/gstack/BMAD 组合，也不默认铺开
 * ECC 的语言/框架 skills。语言能力由目标项目扫描后通过 ECC --with lang:* / framework:* 按需安装。
 */
const eccCoreFallbackSkills: SkillDef[] = [
  'ecc-guide',
  'configure-ecc',
  'repo-scan',
  'search-first',
  'codebase-onboarding',
  'skill-scout',
  'skill-stocktake',
  'tdd-workflow',
  'verification-loop',
  'error-handling',
  'iterative-retrieval',
  'strategic-compact',
]

export const vendors: VendorsConfig = [
  {
    name: 'ecc',
    official: true,
    source: 'https://github.com/affaan-m/ECC.git',
    projections: [
      {
        kind: 'skills',
        sourceBaseDir: 'skills',
        skills: eccCoreFallbackSkills,
      },
    ],
  },
]
