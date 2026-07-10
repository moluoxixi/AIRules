import type { SetupCommand, VendorsConfig } from '../../../scripts/lib/vendors.js'

/**
 * speckit-development 角色以 GitHub Spec Kit 官方 CLI 作为规格主线，
 * 以 speckit-superpowers-bridge 连接 Spec Kit 设计产物与 Superpowers 执行纪律。
 */
const speckitDevelopmentSetup: SetupCommand[] = [
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
    command: 'uv',
    args: [
      'tool',
      'install',
      'specify-cli',
      '--from',
      'git+https://github.com/github/spec-kit.git@v0.12.5',
    ],
    skipIfCommandAvailable: 'specify',
  },
]

export const vendors: VendorsConfig = [
  {
    name: 'speckitSuperpowersBridge',
    official: false,
    source: 'https://github.com/lihan3238/speckit-superpowers-bridge.git',
    projections: [
      {
        kind: 'skills',
        sourceBaseDir: '.agents/skills',
        skills: ['speckit-superpowers-bridge'],
      },
    ],
  },
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
    name: 'moluoxixi',
    official: true,
    source: 'https://github.com/moluoxixi/AIRules.git',
    setup: speckitDevelopmentSetup,
    projections: [
      {
        kind: 'role-assets',
        sourceDir: 'roles/speckit-development',
      },
    ],
  },
]
