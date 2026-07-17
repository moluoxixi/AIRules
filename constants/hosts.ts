import path from 'node:path'

/** 单个 AI 宿主的 skills 投影配置。 */
export interface HostConfig {
  /** 宿主标识符，也是 --host 参数的值。 */
  id: string
  /** 宿主主目录，相对于用户 home。 */
  homeRelPath: string
  /** 宿主内 skills 目录名，默认 `skills`。 */
  skillsDirName?: string
  /** 指定宿主不启用的 skills，仅影响最终宿主投影。 */
  excludedSkills?: string[]
  /** 是否启用 skills 投影，默认启用。 */
  projectSkills?: boolean
  /** 是否参与 `--host all`，默认参与。 */
  includeInAll?: boolean
}

/**
 * 公共分发层只登记 skills 目录。Agents、commands、hooks、settings 等宿主原生资产
 * 由角色的项目初始化器安装，不在这里转译或合并。
 */
export const HOST_CONFIGS: HostConfig[] = [
  { id: 'claude', homeRelPath: '.claude' },
  { id: 'codex', homeRelPath: '.codex' },
  { id: 'hermes', homeRelPath: path.join('AppData', 'Local', 'hermes') },
  { id: 'hermes desktop', homeRelPath: path.join('AppData', 'Local', 'hermes') },
  { id: 'cursor', homeRelPath: '.cursor', skillsDirName: 'skills-cursor' },
  { id: 'agentsmd', homeRelPath: '.agents', includeInAll: false },
  { id: 'qoderwork', homeRelPath: '.qoderwork' },
  { id: 'trae', homeRelPath: '.trae' },
  { id: 'trae-cn', homeRelPath: '.trae-cn' },
  { id: 'trae-solo', homeRelPath: '.trae-solo', projectSkills: false },
  { id: 'trae-solo-cn', homeRelPath: '.trae-solo-cn', projectSkills: false },
  { id: 'qoder', homeRelPath: '.qoder' },
  { id: 'opencode', homeRelPath: path.join('.config', 'opencode') },
  { id: 'cc-switch', homeRelPath: '.cc-switch' },
]

/** 所有已登记宿主 ID，供显式 `--host` 校验与帮助输出使用。 */
export const HOST_IDS: string[] = HOST_CONFIGS.map(host => host.id)

/** 默认 `--host all` 目标；共享目录等目标可通过 `includeInAll: false` 排除。 */
export const ALL_HOST_IDS: string[] = HOST_CONFIGS
  .filter(host => host.includeInAll ?? true)
  .map(host => host.id)

export function findHostConfig(id: string): HostConfig | undefined {
  return HOST_CONFIGS.find(host => host.id === id)
}

export interface ResolvedHostPaths {
  hostHome: string
  skillsDirName: string
  excludedSkills: string[]
  projectSkills: boolean
}

function resolveUserRelativePath(userHome: string, relPath: string): string {
  return path.join(userHome, ...relPath.split(/[\\/]+/u).filter(Boolean))
}

export function resolveHostPaths(config: HostConfig, userHome: string): ResolvedHostPaths {
  return {
    hostHome: resolveUserRelativePath(userHome, config.homeRelPath),
    skillsDirName: config.skillsDirName ?? 'skills',
    excludedSkills: config.excludedSkills ?? [],
    projectSkills: config.projectSkills ?? true,
  }
}
