import path from 'node:path'

/**
 * 单个宿主（AI 代理）的配置定义
 */
export interface HostConfig {
  /** 宿主标识符，也是 --host 参数的值 */
  id: string
  /** 宿主的主目录（相对于 userHome 的路径片段） */
  homeRelPath: string
  /** 宿主基线文件的文件名（如 CLAUDE.md / AGENTS.md） */
  baselineFileName: string
  /** 宿主内 skills 目录的名字（默认 'skills'） */
  skillsDirName?: string
}

/**
 * 所有支持的宿主（AI 代理）配置表
 *
 * 新增宿主时只需在此添加一条记录，脚本会自动感知。
 */
export const HOST_CONFIGS: HostConfig[] = [
  {
    id: 'claude',
    homeRelPath: '.claude',
    baselineFileName: 'CLAUDE.md',
  },
  {
    id: 'codex',
    homeRelPath: '.codex',
    baselineFileName: 'AGENTS.md',
  },
  {
    id: 'cursor',
    homeRelPath: '.cursor',
    baselineFileName: 'AGENTS.md',
    skillsDirName: 'skills-cursor',
  },
  // 不需要，会自己复用.agents
  // {
  //   id: 'qoder',
  //   homeRelPath: '.qoder',
  //   baselineFileName: 'AGENTS.md',
  // },
  {
    id: 'tare',
    homeRelPath: '.tare',
    baselineFileName: 'AGENTS.md',
  },
  {
    id: 'opencode',
    homeRelPath: path.join('.config', 'opencode'),
    baselineFileName: 'AGENTS.md',
  },
  {
    id: 'cc-switch',
    homeRelPath: '.cc-switch',
    baselineFileName: 'AGENTS.md',
  },
]

/** 所有支持的宿主 ID 列表，供 --host all 使用 */
export const ALL_HOST_IDS: string[] = HOST_CONFIGS.map(h => h.id)

/**
 * 根据宿主 ID 获取配置，找不到时返回 undefined
 */
export function findHostConfig(id: string): HostConfig | undefined {
  return HOST_CONFIGS.find(h => h.id === id)
}

/**
 * 根据宿主配置和用户 home 目录，解析出完整的绝对路径集合
 */
export interface ResolvedHostPaths {
  hostHome: string
  hostBaselineFile: string
  skillsDirName: string
}

export function resolveHostPaths(config: HostConfig, userHome: string): ResolvedHostPaths {
  const hostHome = path.join(userHome, ...config.homeRelPath.split(path.sep))
  return {
    hostHome,
    hostBaselineFile: path.join(hostHome, config.baselineFileName),
    skillsDirName: config.skillsDirName ?? 'skills',
  }
}
