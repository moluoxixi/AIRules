import type { SetupCommand, VendorsConfig } from '../../../scripts/lib/vendors.js'

/**
 * openspec-development 角色同步 CodeGraph 与 OpenSpec，作为代码图谱、规格治理和 schema 校验入口。
 */
const openspecDevelopmentSetup: SetupCommand[] = [
  {
    command: 'npm',
    args: ['install', '--global', '@colbymchenry/codegraph'],
    skipIfCommandAvailable: 'codegraph',
  },
  {
    command: 'codegraph',
    args: ['install', '--yes'],
  },
  {
    command: 'npm',
    args: ['install', '--global', '@fission-ai/openspec'],
    skipIfCommandAvailable: 'openspec',
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
    name: 'gstack',
    official: true,
    source: 'https://github.com/garrytan/gstack.git',
    projections: [
      {
        kind: 'skills',
        sourceBaseDir: '.',
        skills: [
          { name: 'plan-ceo-review', output: 'gstack-plan-ceo-review' },
          { name: 'plan-eng-review', output: 'gstack-plan-eng-review' },
          { name: 'plan-design-review', output: 'gstack-plan-design-review' },
          { name: 'plan-devex-review', output: 'gstack-plan-devex-review' },
          { name: 'review', output: 'gstack-review' },
          { name: 'qa-only', output: 'gstack-qa-only' },
          { name: 'qa', output: 'gstack-qa' },
          { name: 'design-review', output: 'gstack-design-review' },
          { name: 'devex-review', output: 'gstack-devex-review' },
          { name: 'document-release', output: 'gstack-document-release' },
        ],
      },
    ],
  },
  {
    name: 'mattPocock',
    official: true,
    source: 'https://github.com/mattpocock/skills.git',
    projections: [
      {
        kind: 'skills',
        sourceBaseDir: 'skills/engineering',
        skills: [
          { name: 'grill-with-docs', output: 'matt-grill-with-docs' },
          { name: 'domain-modeling', output: 'matt-domain-modeling' },
          { name: 'codebase-design', output: 'matt-codebase-design' },
        ],
      },
    ],
  },
  {
    name: 'ecc',
    official: true,
    source: 'https://github.com/affaan-m/ECC.git',
    projections: [
      {
        kind: 'agents',
        sourceDir: 'agents',
        agents: [
          'planner',
          'tdd-guide',
          'pr-test-analyzer',
          'e2e-runner',
          'code-reviewer',
          'typescript-reviewer',
          'react-reviewer',
          'vue-reviewer',
          'react-build-resolver',
          'build-error-resolver',
          'silent-failure-hunter',
        ],
      },
    ],
  },
  {
    name: 'gemini',
    official: true,
    source: 'https://github.com/google-gemini/gemini-cli.git',
    projections: [
      {
        kind: 'skills',
        sourceBaseDir: '.gemini/skills',
        skills: [
          { name: 'code-reviewer', output: 'code-reviewer-gemini' },
          { name: 'pr-creator', output: 'pr-creator-gemini' },
        ],
      },
    ],
  },
  {
    name: 'vercelLabs',
    official: true,
    source: 'https://github.com/vercel-labs/skills.git',
    projections: [
      {
        kind: 'skills',
        sourceBaseDir: 'skills',
        skills: [{ name: 'find-skills', output: 'find-skills-vercel' }],
      },
    ],
  },
  {
    name: 'anthropic',
    official: true,
    source: 'https://github.com/anthropics/skills.git',
    projections: [
      {
        kind: 'skills',
        sourceBaseDir: 'skills',
        skills: [
          { name: 'frontend-design', output: 'frontend-design-anthropic' },
        ],
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
    name: 'superpowers',
    official: true,
    source: 'https://github.com/obra/superpowers.git',
    projections: [
      {
        // skills 版 Superpowers 作为多宿主默认能力；宿主侧按叶子 skill 名展平调用。
        kind: 'namespace',
        sourceDir: 'skills',
        output: 'superpowers',
      },
    ],
  },
  {
    name: 'moluoxixi',
    official: true,
    source: 'https://github.com/moluoxixi/AIRules.git',
    sourceMode: 'workspace',
    setup: openspecDevelopmentSetup,
    projections: [
      {
        kind: 'skills',
        sourceBaseDir: 'roles/openspec-development/skills',
        skills: ['init-project'],
      },
    ],
  },
]
