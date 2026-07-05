import type { SetupCommand, VendorsConfig } from '../../../scripts/lib/vendors.js'

/**
 * product 角色使用 OpenSpec 管理产品变更生命周期，PM 方法论来自 pm-skills 上游。
 */
const productSetup: SetupCommand[] = [
  {
    command: 'npm',
    args: ['install', '--global', '@fission-ai/openspec'],
    skipIfCommandAvailable: 'openspec',
  },
  {
    command: 'npm',
    args: ['install', '--global', 'bmad-method'],
    skipIfCommandAvailable: 'bmad-method',
  },
]

export const vendors: VendorsConfig = [
  {
    name: 'bmadMethod',
    official: true,
    source: 'https://github.com/bmad-code-org/BMAD-METHOD.git',
    projections: [
      {
        kind: 'skills',
        sourceBaseDir: 'src/bmm-skills/2-plan-workflows',
        skills: ['bmad-prd'],
      },
      {
        kind: 'skills',
        sourceBaseDir: 'src/bmm-skills/3-solutioning',
        skills: [
          'bmad-create-epics-and-stories',
          'bmad-generate-project-context',
        ],
      },
      {
        kind: 'skills',
        sourceBaseDir: 'src/core-skills',
        skills: ['bmad-shard-doc'],
      },
    ],
  },
  {
    // 产品发现 / 用户故事 / 验收标准 / 边界用例 / ADR 等 PM 方法论由 pm-skills 上游做主。
    // AIRules 只提供产品 init-project，把 OpenSpec 项目与 product-pm-bridge schema 初始化好。
    name: 'pmSkills',
    official: false,
    source: 'https://github.com/product-on-purpose/pm-skills.git',
    projections: [
      {
        kind: 'skills',
        sourceBaseDir: 'skills',
        skills: [
          'deliver-prd',
          'deliver-user-stories',
          'deliver-acceptance-criteria',
          'deliver-edge-cases',
          'develop-adr',
          'develop-solution-brief',
        ],
      },
    ],
  },
  {
    name: 'moluoxixi',
    official: true,
    source: 'https://github.com/moluoxixi/AIRules.git',
    sourceMode: 'workspace',
    setup: productSetup,
    projections: [
      {
        kind: 'skills',
        sourceBaseDir: 'roles/product/skills',
        skills: ['init-project'],
      },
    ],
  },
]
