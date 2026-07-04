import type { SetupCommand, VendorsConfig } from '../../../scripts/lib/vendors.js'

/**
 * development 角色同步 CodeGraph 与 OpenSpec，作为代码图谱、规格治理和 schema 校验入口。
 */
const developmentSetup: SetupCommand[] = [
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
    setup: developmentSetup,
    projections: [
      {
        kind: 'skills',
        sourceBaseDir: 'roles/development/skills',
        skills: [
          'init-project',
          'handoff',
        ],
      },
    ],
  },
]
