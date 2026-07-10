import type { SetupCommand, VendorsConfig } from '../../../scripts/lib/vendors.js'

/**
 * trellis-development 角色把 Trellis 作为项目内任务状态机、规格知识库与会话记忆运行时。
 * 该角色保持独立：Trellis 自带 .trellis/workspace 与 trellis mem；
 * common 如有需要应作为另一角色独立选择。
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
    setup: trellisDevelopmentSetup,
    projections: [
      {
        kind: 'role-assets',
        sourceDir: 'roles/trellis-development',
      },
    ],
  },
]
