import path from 'node:path'

export interface McpProjection {
  homeRelPath?: string
  relDir: string
  fileName: string
  serversKey: string
  format: 'json' | 'toml'
  /** 仅在对应宿主目录存在时写 MCP；用于配置文件位于宿主目录外的场景。 */
  requireHostHome?: boolean
  defaultTopLevel?: Record<string, unknown>
  /** 应用于每个 MCP server、但不覆盖角色显式字段的宿主默认值。 */
  serverDefaults?: Record<string, unknown>
  serverOverrides?: Record<string, Record<string, unknown>>
  /** 将中性的 command + args 转成宿主要求的 command 数组。 */
  serverCommandFormat?: 'command-and-args' | 'command-array'
}

/** 单个 AI 宿主的 skills 投影配置。 */
export interface HostConfig {
  /** 宿主标识符，也是 --host 参数的值。 */
  id: string
  /** 仅用于 CLI 输入的兼容别名；角色清单必须使用 canonical id。 */
  aliases?: string[]
  /** 宿主主目录，相对于用户 home。 */
  homeRelPath: string
  /** 宿主内 skills 目录名，默认 `skills`。 */
  skillsDirName?: string
  /** 指定宿主不启用的 skills，仅影响最终宿主投影。 */
  excludedSkills?: string[]
  /** 是否启用 skills 投影，默认启用。 */
  projectSkills?: boolean
  /** 角色可选 MCP 中性源到该宿主配置的投影规则。 */
  mcp?: McpProjection
}

/** 所有角色都必须获得的 canonical skills 公共层，不是可选宿主。 */
export const GLOBAL_AGENT_SKILLS = {
  homeRelPath: '.agents',
  skillsDirName: 'skills',
} as const

/**
 * 公共分发层登记 canonical skills 与角色可选 MCP 的宿主投影规则。
 * Agents、commands、hooks、settings 等宿主原生资产由角色的项目初始化器安装。
 */
export const HOST_CONFIGS: HostConfig[] = [
  {
    id: 'claude',
    homeRelPath: '.claude',
    mcp: {
      homeRelPath: '.',
      relDir: '.',
      fileName: '.claude.json',
      serversKey: 'mcpServers',
      format: 'json',
      requireHostHome: true,
      serverDefaults: { type: 'stdio' },
      serverOverrides: { codegraph: { args: ['serve', '--mcp'] } },
    },
  },
  {
    id: 'codex',
    homeRelPath: '.codex',
    mcp: {
      relDir: '.',
      fileName: 'config.toml',
      serversKey: 'mcp_servers',
      format: 'toml',
      serverOverrides: { codegraph: { args: ['serve', '--mcp'] } },
    },
  },
  { id: 'hermes', aliases: ['hermes desktop'], homeRelPath: path.join('AppData', 'Local', 'hermes') },
  {
    id: 'cursor',
    homeRelPath: '.cursor',
    skillsDirName: 'skills-cursor',
    mcp: {
      relDir: '.',
      fileName: 'mcp.json',
      serversKey: 'mcpServers',
      format: 'json',
      serverDefaults: { type: 'stdio' },
    },
  },
  { id: 'qoderwork', homeRelPath: '.qoderwork' },
  { id: 'trae', homeRelPath: '.trae', mcp: { homeRelPath: path.join('AppData', 'Roaming', 'Trae', 'User'), relDir: '.', fileName: 'mcp.json', serversKey: 'mcpServers', format: 'json', defaultTopLevel: { inputs: [] } } },
  { id: 'trae-cn', homeRelPath: '.trae-cn', mcp: { homeRelPath: path.join('AppData', 'Roaming', 'Trae CN', 'User'), relDir: '.', fileName: 'mcp.json', serversKey: 'mcpServers', format: 'json', defaultTopLevel: { inputs: [] } } },
  { id: 'trae-solo', homeRelPath: '.trae-solo', projectSkills: false, mcp: { homeRelPath: path.join('AppData', 'Roaming', 'TRAE SOLO', 'User'), relDir: '.', fileName: 'mcp.json', serversKey: 'mcpServers', format: 'json', defaultTopLevel: { inputs: [] } } },
  { id: 'trae-solo-cn', homeRelPath: '.trae-solo-cn', projectSkills: false, mcp: { homeRelPath: path.join('AppData', 'Roaming', 'TRAE SOLO CN', 'User'), relDir: '.', fileName: 'mcp.json', serversKey: 'mcpServers', format: 'json', defaultTopLevel: { inputs: [] } } },
  { id: 'qoder', homeRelPath: '.qoder', mcp: { homeRelPath: path.join('AppData', 'Roaming', 'Qoder', 'SharedClientCache'), relDir: '.', fileName: 'mcp.json', serversKey: 'mcpServers', format: 'json', serverDefaults: { type: 'stdio' } } },
  {
    id: 'opencode',
    homeRelPath: path.join('.config', 'opencode'),
    mcp: {
      relDir: '.',
      fileName: 'opencode.json',
      serversKey: 'mcp',
      format: 'json',
      defaultTopLevel: { $schema: 'https://opencode.ai/config.json' },
      serverDefaults: { type: 'local', enabled: true },
      serverOverrides: { codegraph: { args: ['serve', '--mcp'] } },
      serverCommandFormat: 'command-array',
    },
  },
]

/** 所有已登记宿主 ID，供显式 `--host` 校验与帮助输出使用。 */
export const HOST_IDS: string[] = HOST_CONFIGS.map(host => host.id)

export function findHostConfig(id: string): HostConfig | undefined {
  const canonical = resolveHostId(id)
  return canonical ? HOST_CONFIGS.find(host => host.id === canonical) : undefined
}

export function resolveHostId(id: string): string | undefined {
  return HOST_CONFIGS.find(host => host.id === id || host.aliases?.includes(id))?.id
}

export interface ResolvedHostPaths {
  hostHome: string
  skillsDirName: string
  excludedSkills: string[]
  projectSkills: boolean
  mcpHome: string
  mcp?: McpProjection
}

function resolveUserRelativePath(userHome: string, relPath: string): string {
  return path.join(userHome, ...relPath.split(/[\\/]+/u).filter(Boolean))
}

export function resolveGlobalAgentSkillsPath(userHome: string): string {
  return path.join(resolveUserRelativePath(userHome, GLOBAL_AGENT_SKILLS.homeRelPath), GLOBAL_AGENT_SKILLS.skillsDirName)
}

export function resolveHostPaths(config: HostConfig, userHome: string): ResolvedHostPaths {
  const hostHome = resolveUserRelativePath(userHome, config.homeRelPath)
  return {
    hostHome,
    skillsDirName: config.skillsDirName ?? 'skills',
    excludedSkills: config.excludedSkills ?? [],
    projectSkills: config.projectSkills ?? true,
    mcpHome: config.mcp?.homeRelPath ? resolveUserRelativePath(userHome, config.mcp.homeRelPath) : hostHome,
    mcp: config.mcp,
  }
}
