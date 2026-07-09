import type { SetupCommand, VendorsConfig } from '../../../scripts/lib/vendors.js'

/**
 * trellis-development 角色把 Trellis 作为项目内任务状态机、规格知识库与会话记忆运行时。
 * 该角色故意不 extends common：Trellis 自带 .trellis/workspace 与 trellis mem，
 * 需要 AIRules common 时由后续角色显式继承或用户另行选择。
 */
const trellisDevelopmentSetup: SetupCommand[] = [
  {
    command: 'npm',
    args: ['install', '--global', '@mindfoldhq/trellis@latest'],
    skipIfCommandAvailable: 'trellis',
  },
]

export const vendors: VendorsConfig = [
  {
    name: 'moluoxixi',
    official: true,
    source: 'https://github.com/moluoxixi/AIRules.git',
    sourceMode: 'workspace',
    setup: trellisDevelopmentSetup,
    projections: [
      {
        kind: 'skills',
        sourceBaseDir: 'roles/trellis-development/skills',
        skills: ['init-project'],
      },
    ],
  },
]
