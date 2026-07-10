import type { SetupCommand, SkillDef, VendorsConfig } from '../../../scripts/lib/vendors.js'

const roleSetup: SetupCommand[] = [
  {
    command: 'npm',
    args: ['install', '--global', '@fission-ai/openspec@latest'],
    skipIfCommandAvailable: 'openspec',
  },
]

const eccControlSkills: SkillDef[] = [
  { name: 'continuous-learning-v2', output: 'ecc-continuous-learning' },
  { name: 'eval-harness', output: 'ecc-eval-harness' },
  { name: 'iterative-retrieval', output: 'ecc-iterative-retrieval' },
  { name: 'security-scan', output: 'ecc-security-scan' },
  { name: 'verification-loop', output: 'ecc-verification-loop' },
]

const gstackQualitySkills: SkillDef[] = [
  { name: 'document-release', output: 'gstack-document-release' },
  { name: 'plan-ceo-review', output: 'gstack-plan-ceo-review' },
  { name: 'plan-design-review', output: 'gstack-plan-design-review' },
  { name: 'plan-eng-review', output: 'gstack-plan-eng-review' },
  { name: 'qa', output: 'gstack-qa' },
  { name: 'qa-only', output: 'gstack-qa-only' },
  { name: 'review', output: 'gstack-review' },
]

/**
 * airules-development 只拥有一条 change-unit 主线。
 * 外部项目提供阶段能力，不拥有独立状态或事实源。
 */
export const vendors: VendorsConfig = [
  {
    name: 'superpowers',
    official: true,
    source: 'https://github.com/obra/superpowers.git',
    projections: [
      {
        kind: 'namespace',
        sourceDir: 'skills',
        output: 'superpowers',
      },
    ],
  },
  {
    name: 'gstack',
    official: true,
    source: 'https://github.com/garrytan/gstack.git',
    projections: [
      {
        kind: 'skills',
        sourceBaseDir: '.',
        skills: gstackQualitySkills,
      },
    ],
  },
  {
    name: 'ecc',
    official: true,
    source: 'https://github.com/affaan-m/ECC.git',
    projections: [
      {
        kind: 'skills',
        sourceBaseDir: 'skills',
        skills: eccControlSkills,
      },
    ],
  },
  {
    name: 'openai',
    official: true,
    source: 'https://github.com/openai/skills.git',
    projections: [
      {
        kind: 'skills',
        sourceBaseDir: 'skills/.curated',
        skills: [{ name: 'playwright', output: 'playwright-openai' }],
      },
    ],
  },
  {
    name: 'moluoxixi',
    official: true,
    source: 'https://github.com/moluoxixi/AIRules.git',
    setup: roleSetup,
    projections: [
      {
        kind: 'role-assets',
        sourceDir: 'roles/airules-development',
      },
    ],
  },
]
