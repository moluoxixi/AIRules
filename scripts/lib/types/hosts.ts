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
  /** 是否向宿主私有目录投影 skills；false 表示宿主直接复用 canonical `.agents/skills`。 */
  projectSkills?: boolean
  /** 角色可选 MCP 中性源到该宿主配置的投影规则。 */
  mcp?: McpProjection
}

export interface AgentSkillsConfig {
  homeRelPath: string
  skillsDirName: string
}

export interface HostDeclaration {
  globalAgentSkills: AgentSkillsConfig
  hosts: HostConfig[]
}

export interface ResolvedHostPaths {
  hostHome: string
  skillsDirName: string
  excludedSkills: string[]
  projectSkills: boolean
  mcpHome: string
  mcp?: McpProjection
}
