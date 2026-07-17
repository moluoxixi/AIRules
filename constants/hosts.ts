import path from 'node:path'

export interface McpProjection {
  homeRelPath?: string
  relDir: string
  fileName: string
  serversKey: string
  format: 'json' | 'toml'
  defaultTopLevel?: Record<string, unknown>
  serverOverrides?: Record<string, Record<string, unknown>>
}

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
  /** 角色可选 MCP 中性源到该宿主配置的投影规则。 */
  mcp?: McpProjection
}

/**
 * 公共分发层登记 canonical skills 与角色可选 MCP 的宿主投影规则。
 * Agents、commands、hooks、settings 等宿主原生资产由角色的项目初始化器安装。
 */
export const HOST_CONFIGS: HostConfig[] = [
  { id: 'claude', homeRelPath: '.claude', mcp: { relDir: '.', fileName: '.mcp.json', serversKey: 'mcpServers', format: 'json' } },
  { id: 'codex', homeRelPath: '.codex', mcp: { relDir: '.', fileName: 'config.toml', serversKey: 'mcp_servers', format: 'toml' } },
  { id: 'hermes', homeRelPath: path.join('AppData', 'Local', 'hermes') },
  { id: 'hermes desktop', homeRelPath: path.join('AppData', 'Local', 'hermes') },
  { id: 'cursor', homeRelPath: '.cursor', skillsDirName: 'skills-cursor', mcp: { relDir: '.', fileName: 'mcp.json', serversKey: 'mcpServers', format: 'json' } },
  { id: 'agentsmd', homeRelPath: '.agents', includeInAll: false },
  { id: 'qoderwork', homeRelPath: '.qoderwork' },
  { id: 'trae', homeRelPath: '.trae', mcp: { homeRelPath: path.join('AppData', 'Roaming', 'Trae', 'User'), relDir: '.', fileName: 'mcp.json', serversKey: 'mcpServers', format: 'json', defaultTopLevel: { inputs: [] } } },
  { id: 'trae-cn', homeRelPath: '.trae-cn', mcp: { homeRelPath: path.join('AppData', 'Roaming', 'Trae CN', 'User'), relDir: '.', fileName: 'mcp.json', serversKey: 'mcpServers', format: 'json', defaultTopLevel: { inputs: [] } } },
  { id: 'trae-solo', homeRelPath: '.trae-solo', projectSkills: false, mcp: { homeRelPath: path.join('AppData', 'Roaming', 'TRAE SOLO', 'User'), relDir: '.', fileName: 'mcp.json', serversKey: 'mcpServers', format: 'json', defaultTopLevel: { inputs: [] } } },
  { id: 'trae-solo-cn', homeRelPath: '.trae-solo-cn', projectSkills: false, mcp: { homeRelPath: path.join('AppData', 'Roaming', 'TRAE SOLO CN', 'User'), relDir: '.', fileName: 'mcp.json', serversKey: 'mcpServers', format: 'json', defaultTopLevel: { inputs: [] } } },
  { id: 'qoder', homeRelPath: '.qoder', mcp: { homeRelPath: path.join('AppData', 'Roaming', 'Qoder', 'SharedClientCache'), relDir: '.', fileName: 'mcp.json', serversKey: 'mcpServers', format: 'json', serverOverrides: { codegraph: { type: 'stdio' } } } },
  { id: 'opencode', homeRelPath: path.join('.config', 'opencode'), mcp: { relDir: '.', fileName: 'opencode.json', serversKey: 'mcp', format: 'json' } },
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
  mcpHome: string
  mcp?: McpProjection
}

function resolveUserRelativePath(userHome: string, relPath: string): string {
  return path.join(userHome, ...relPath.split(/[\\/]+/u).filter(Boolean))
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
