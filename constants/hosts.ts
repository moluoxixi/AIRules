import path from 'node:path'

/**
 * 宿主 agent 文件格式。
 * 决定第一方 Markdown agent 能否直接软链到该宿主：
 * - 'markdown'：宿主吃 Markdown + YAML frontmatter，可直接软链（Claude / Cursor / OpenCode）。
 * - 'toml'：宿主吃 TOML（Codex CLI），由 Markdown agent 转译生成。
 * - 'json'：宿主吃 JSON（Kiro），需转译，未实现前显式跳过 + 告警。
 * - 'agentsmd'：agents.md 共享层，使用 .agents/subagents。
 * 映射依据见 docs/architecture/host-agent-mcp-mapping.md（提取自 rulesync 源码）。
 */
export type AgentFormat = 'markdown' | 'toml' | 'json' | 'agentsmd'

/**
 * 宿主 MCP 配置投影规格。
 * 中性源 { mcpServers: {...} } 按此规格写到各宿主对应文件、键名、格式。
 * 映射依据见 docs/architecture/host-agent-mcp-mapping.md。
 */
export interface McpProjection {
  /** MCP 配置根目录；未声明时使用宿主 home。 */
  homeRelPath?: string
  /** MCP 配置文件相对宿主 home 的目录片段（'.' 表示宿主 home 根） */
  relDir: string
  /** MCP 配置文件名（如 mcp.json / config.toml / .claude.json） */
  fileName: string
  /** 服务表的键名：多数宿主为 'mcpServers'，OpenCode 为 'mcp'，Codex TOML 为 'mcp_servers' */
  serversKey: string
  /** 文件格式 */
  format: 'json' | 'toml'
  /** JSON 宿主缺省顶层字段，仅在用户文件未声明时补齐。 */
  defaultTopLevel?: Record<string, unknown>
  /** 特定宿主对中性 server 的字段覆盖；用户同名 server 仍优先。 */
  serverOverrides?: Record<string, Record<string, unknown>>
}

/**
 * 宿主生命周期 hook 投影规格。
 * 把 AIRules 的会话自动记录 Stop hook 写到各宿主对应的配置文件、格式。
 * 仅在宿主暴露按轮 Stop 生命周期 hook 时声明。已确认支持的宿主与差异：
 * - Claude：~/.claude/settings.json（JSON，event 'Stop'，group 嵌套，内层带 type）
 * - Codex：~/.codex/config.toml（TOML，[[hooks.Stop]] 受管块）
 * - Qoder：~/.qoder/settings.json（JSON，与 Claude 同构）
 * - Trae：~/.trae-cn/hooks.json（JSON，顶层 version:1，group 嵌套）
 * - Cursor：~/.cursor/hooks.json（JSON，顶层 version:1，事件名小写 'stop'，扁平条目、无 type）
 * 映射依据见 docs/architecture/host-hook-mapping.md。
 */
export interface HookProjection {
  /** hook 配置文件相对宿主 home 的目录片段（'.' 表示宿主 home 根） */
  relDir: string
  /** 配置文件名：settings.json / config.toml / hooks.json */
  fileName: string
  /** 文件格式，决定合并写法：JSON 浅合并 / TOML 受管块 */
  format: 'json' | 'toml'
  /** hook 事件名：多数为 'Stop'，Cursor 为小写 'stop' */
  event: string
  /** 脚本源文件名（位于 vendor/hooks 下，投影时拷到宿主 hooks 目录） */
  scriptName: string
  /** JSON 宿主：是否需要顶层 `version: 1`（Trae/Cursor 需要） */
  version?: number
  /**
   * JSON 宿主条目嵌套风格：
   * - 'group'（默认）：event 下是 [{ hooks: [{...}] }]（Claude/Qoder/Trae）
   * - 'flat'：event 下直接是 [{ command }]（Cursor）
   */
  nesting?: 'group' | 'flat'
  /** JSON 宿主内层条目是否带 `type: 'command'`（Claude/Qoder 带；Cursor 不带） */
  includeType?: boolean
}

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
  /** 是否将 AIRules 规则基线投影到宿主基线文件 */
  projectBaseline?: boolean
  /** 是否向宿主投影 skills / agents 共享资源 */
  projectSharedResources?: boolean
  /** 是否参与 --host all；用于共享层这种被其它宿主复用、但不应默认覆盖基线的目标。 */
  includeInAll?: boolean
  /**
   * 基线投影方式：
   * - 'symlink'（默认）：用软链接覆盖宿主基线文件，整份替换为 AIRules 规则。
   * - 'append'：把 AIRules 规则以幂等托管块追加进宿主基线文件，保留文件原有内容。
   *   用于像 Hermes SOUL.md 这类身份文件——不能整份覆盖，只能注入红线块。
   */
  baselineMode?: 'symlink' | 'append'
  /** 宿主内 skills 目录的名字（默认 'skills'） */
  skillsDirName?: string
  /** 指定宿主不启用的技能名，仅影响最终宿主投影 */
  excludedSkills?: string[]
  /**
   * 宿主 agent 文件格式，默认 'markdown'。
   * 第一方 agent 当前均为 Markdown：'markdown' 宿主直接软链 agents 目录；
   * 'toml' 宿主转译为 TOML；'agentsmd' 宿主投影到 .agents/subagents；
   * 'json' 宿主需转译层（暂未实现，投影时显式跳过并告警，不静默软链错误格式）。
   */
  agentFormat?: AgentFormat
  /**
   * 宿主 MCP 配置投影规格，未声明则该宿主不参与 MCP 投影。
   */
  mcp?: McpProjection
  /**
   * 宿主生命周期 hook 投影规格，未声明则该宿主不参与 hook 投影。
   * - 单值：宿主只投影一个事件（如仅 Stop）——历史形态，保持兼容。
   * - 数组：宿主同时投影多个事件（如 PreToolUse + SubagentStop + Stop）。
   * 每条 HookProjection 仍是单事件；多事件由数组承载。内部经 normalizeHooks 统一为数组遍历。
   */
  hooks?: HookProjection | HookProjection[]
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
    agentFormat: 'markdown',
    mcp: { relDir: '.', fileName: '.mcp.json', serversKey: 'mcpServers', format: 'json' },
    // 多事件投影：Stop 记录（session-log）+ SubagentStop 计数（subagent-trace）+ PreToolUse 熔断（loop-guard）。
    hooks: [
      { relDir: '.', fileName: 'settings.json', format: 'json', event: 'Stop', scriptName: 'session-log.mjs', nesting: 'group', includeType: true },
      { relDir: '.', fileName: 'settings.json', format: 'json', event: 'SubagentStop', scriptName: 'subagent-trace.mjs', nesting: 'group', includeType: true },
      { relDir: '.', fileName: 'settings.json', format: 'json', event: 'PreToolUse', scriptName: 'loop-guard.mjs', nesting: 'group', includeType: true },
    ],
  },
  {
    id: 'codex',
    homeRelPath: '.codex',
    baselineFileName: 'AGENTS.md',
    agentFormat: 'toml',
    mcp: { relDir: '.', fileName: 'config.toml', serversKey: 'mcp_servers', format: 'toml' },
    // 多事件投影（TOML 受管块按 event 各写一块）：Stop 记录 + SubagentStop 计数 + PreToolUse 熔断。
    hooks: [
      { relDir: '.', fileName: 'config.toml', format: 'toml', event: 'Stop', scriptName: 'session-log.mjs' },
      { relDir: '.', fileName: 'config.toml', format: 'toml', event: 'SubagentStop', scriptName: 'subagent-trace.mjs' },
      { relDir: '.', fileName: 'config.toml', format: 'toml', event: 'PreToolUse', scriptName: 'loop-guard.mjs' },
    ],
  },
  {
    id: 'hermes',
    homeRelPath: path.join('AppData', 'Local', 'hermes'),
    baselineFileName: 'SOUL.md',
    baselineMode: 'append',
  },
  {
    id: 'hermes desktop',
    homeRelPath: path.join('AppData', 'Local', 'hermes'),
    baselineFileName: 'SOUL.md',
    baselineMode: 'append',
  },
  {
    id: 'cursor',
    homeRelPath: '.cursor',
    baselineFileName: 'AGENTS.md',
    skillsDirName: 'skills-cursor',
    agentFormat: 'markdown',
    mcp: { relDir: '.', fileName: 'mcp.json', serversKey: 'mcpServers', format: 'json' },
    // Cursor hooks：顶层 version、事件名小写、扁平条目（无 type 包裹）。多事件投影。
    hooks: [
      { relDir: '.', fileName: 'hooks.json', format: 'json', event: 'stop', scriptName: 'session-log.mjs', version: 1, nesting: 'flat' },
      { relDir: '.', fileName: 'hooks.json', format: 'json', event: 'subagentStop', scriptName: 'subagent-trace.mjs', version: 1, nesting: 'flat' },
      { relDir: '.', fileName: 'hooks.json', format: 'json', event: 'preToolUse', scriptName: 'loop-guard.mjs', version: 1, nesting: 'flat' },
    ],
  },
  {
    id: 'agentsmd',
    homeRelPath: '.agents',
    baselineFileName: 'AGENTS.md',
    agentFormat: 'agentsmd',
    projectBaseline: false,
    includeInAll: false,
  },
  {
    id: 'qoderwork',
    homeRelPath: '.qoderwork',
    baselineFileName: 'AGENTS.md',
  },
  {
    id: 'trae',
    homeRelPath: '.trae',
    baselineFileName: 'AGENTS.md',
    mcp: {
      homeRelPath: path.join('AppData', 'Roaming', 'Trae', 'User'),
      relDir: '.',
      fileName: 'mcp.json',
      serversKey: 'mcpServers',
      format: 'json',
      defaultTopLevel: { inputs: [] },
    },
    // Trae hooks：~/.trae/hooks.json，顶层 version、group 嵌套、事件名 Stop。
    hooks: { relDir: '.', fileName: 'hooks.json', format: 'json', event: 'Stop', scriptName: 'session-log.mjs', version: 1, nesting: 'group', includeType: true },
  },
  {
    id: 'trae-cn',
    homeRelPath: '.trae-cn',
    baselineFileName: 'AGENTS.md',
    mcp: {
      homeRelPath: path.join('AppData', 'Roaming', 'Trae CN', 'User'),
      relDir: '.',
      fileName: 'mcp.json',
      serversKey: 'mcpServers',
      format: 'json',
      defaultTopLevel: { inputs: [] },
    },
    // Trae CN hooks：~/.trae-cn/hooks.json（官方文档示例的全局路径）。
    hooks: { relDir: '.', fileName: 'hooks.json', format: 'json', event: 'Stop', scriptName: 'session-log.mjs', version: 1, nesting: 'group', includeType: true },
  },
  {
    id: 'trae-solo',
    homeRelPath: '.trae-solo',
    baselineFileName: 'AGENTS.md',
    projectBaseline: false,
    projectSharedResources: false,
    mcp: {
      homeRelPath: path.join('AppData', 'Roaming', 'TRAE SOLO', 'User'),
      relDir: '.',
      fileName: 'mcp.json',
      serversKey: 'mcpServers',
      format: 'json',
      defaultTopLevel: { inputs: [] },
    },
  },
  {
    id: 'trae-solo-cn',
    homeRelPath: '.trae-solo-cn',
    baselineFileName: 'AGENTS.md',
    projectBaseline: false,
    projectSharedResources: false,
    mcp: {
      homeRelPath: path.join('AppData', 'Roaming', 'TRAE SOLO CN', 'User'),
      relDir: '.',
      fileName: 'mcp.json',
      serversKey: 'mcpServers',
      format: 'json',
      defaultTopLevel: { inputs: [] },
    },
  },
  {
    id: 'qoder',
    homeRelPath: '.qoder',
    baselineFileName: 'AGENTS.md',
    mcp: {
      homeRelPath: path.join('AppData', 'Roaming', 'Qoder', 'SharedClientCache'),
      relDir: '.',
      fileName: 'mcp.json',
      serversKey: 'mcpServers',
      format: 'json',
      serverOverrides: {
        codegraph: { type: 'stdio' },
      },
    },
    // Qoder hooks：~/.qoder/settings.json，与 Claude 同构（JSON、group 嵌套、内层 type）。多事件投影。
    hooks: [
      { relDir: '.', fileName: 'settings.json', format: 'json', event: 'Stop', scriptName: 'session-log.mjs', nesting: 'group', includeType: true },
      { relDir: '.', fileName: 'settings.json', format: 'json', event: 'SubagentStop', scriptName: 'subagent-trace.mjs', nesting: 'group', includeType: true },
      { relDir: '.', fileName: 'settings.json', format: 'json', event: 'PreToolUse', scriptName: 'loop-guard.mjs', nesting: 'group', includeType: true },
    ],
  },
  {
    id: 'opencode',
    homeRelPath: path.join('.config', 'opencode'),
    baselineFileName: 'AGENTS.md',
    agentFormat: 'markdown',
    // OpenCode MCP 服务键为 'mcp'（非 mcpServers），写在 opencode.json。
    mcp: { relDir: '.', fileName: 'opencode.json', serversKey: 'mcp', format: 'json' },
  },
  {
    id: 'cc-switch',
    homeRelPath: '.cc-switch',
    baselineFileName: 'AGENTS.md',
  },
]

/** 所有支持的宿主 ID 列表，供 --host all 使用 */
export const ALL_HOST_IDS: string[] = HOST_CONFIGS
  .filter(h => h.includeInAll ?? true)
  .map(h => h.id)

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
  projectBaseline: boolean
  projectSharedResources: boolean
  baselineMode: 'symlink' | 'append'
  skillsDirName: string
  excludedSkills: string[]
  agentFormat: AgentFormat
  mcpHome: string
  mcp?: McpProjection
  hooksHome: string
  /** 规范化为数组：未声明则空数组；单值/数组均归一为数组，供下游统一遍历。 */
  hooks: HookProjection[]
}

/** 把 HostConfig.hooks（单值 | 数组 | undefined）归一为数组，供 install/verify 统一遍历。 */
export function normalizeHooks(hooks?: HookProjection | HookProjection[]): HookProjection[] {
  if (!hooks) {
    return []
  }
  return Array.isArray(hooks) ? hooks : [hooks]
}

function resolveUserRelativePath(userHome: string, relPath: string): string {
  return path.join(userHome, ...relPath.split(/[\\/]+/u).filter(Boolean))
}

export function resolveHostPaths(config: HostConfig, userHome: string): ResolvedHostPaths {
  const hostHome = resolveUserRelativePath(userHome, config.homeRelPath)
  const mcpHome = config.mcp?.homeRelPath
    ? resolveUserRelativePath(userHome, config.mcp.homeRelPath)
    : hostHome
  return {
    hostHome,
    hostBaselineFile: path.join(hostHome, config.baselineFileName),
    projectBaseline: config.projectBaseline ?? true,
    projectSharedResources: config.projectSharedResources ?? true,
    baselineMode: config.baselineMode ?? 'symlink',
    skillsDirName: config.skillsDirName ?? 'skills',
    excludedSkills: config.excludedSkills ?? [],
    agentFormat: config.agentFormat ?? 'markdown',
    mcpHome,
    mcp: config.mcp,
    hooksHome: hostHome,
    hooks: normalizeHooks(config.hooks),
  }
}
