import type { HostConfig, HostDeclaration, McpProjection, ResolvedHostPaths } from './types/hosts.js'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseDocument } from 'yaml'

const declaration = loadHostDeclaration()

/** 所有角色都必须获得的 canonical skills 公共层，不是可选宿主。 */
export const GLOBAL_AGENT_SKILLS = declaration.globalAgentSkills
export const HOST_CONFIGS: HostConfig[] = declaration.hosts
/** 所有已登记宿主 ID，供显式 --host 校验与帮助输出使用。 */
export const HOST_IDS: string[] = HOST_CONFIGS.map(host => host.id)

/** 从源码或 npm 包自身读取声明，不依赖 CLI 的工作目录。 */
function resolveHostDeclarationPath(): string {
  const moduleDirectory = path.dirname(fileURLToPath(import.meta.url))
  const candidates = [
    path.resolve(moduleDirectory, '..', '..', 'hosts', 'hosts.yaml'),
    path.resolve(moduleDirectory, '..', '..', '..', 'hosts', 'hosts.yaml'),
  ]
  const declarationPath = candidates.find(candidate => fs.existsSync(candidate))
  if (!declarationPath)
    throw new Error(`Unable to locate hosts/hosts.yaml from ${moduleDirectory}`)
  return declarationPath
}

/** 校验 YAML 后转换成安装器使用的类型；配置错误在文件投影前失败。 */
export function loadHostDeclaration(declarationPath = resolveHostDeclarationPath()): HostDeclaration {
  const location = `Host declaration "${declarationPath}"`
  const document = parseDocument(fs.readFileSync(declarationPath, 'utf8'), {
    merge: false,
    prettyErrors: true,
    strict: true,
    uniqueKeys: true,
  })
  if (document.errors.length > 0)
    throw new Error(`${location} is invalid: ${document.errors.map(error => error.message).join('; ')}`)

  let value: unknown
  try {
    value = document.toJS({ maxAliasCount: 0 })
  }
  catch (error) {
    throw new Error(`${location} is invalid: ${String(error)}`, { cause: error })
  }
  const record = requireRecord(value, location, ['schema_version', 'global_agent_skills', 'hosts'])
  if (record.schema_version !== 1)
    throw new Error(`${location} must use schema_version: 1`)

  const globalLocation = `${location}.global_agent_skills`
  const global = requireRecord(record.global_agent_skills, globalLocation, ['home_rel_path', 'skills_dir_name'])
  if (!Array.isArray(record.hosts) || record.hosts.length === 0)
    throw new TypeError(`${location}.hosts must be a non-empty array`)

  const hosts = record.hosts.map((host, index) => readHost(host, `${location}.hosts[${index}]`))
  const names = new Set<string>(['all'])
  for (const host of hosts) {
    for (const name of [host.id, ...host.aliases ?? []]) {
      if (names.has(name))
        throw new Error(`${location} has a duplicate or reserved host id/alias: "${name}"`)
      names.add(name)
    }
  }

  return {
    globalAgentSkills: {
      homeRelPath: requireRelativePath(global.home_rel_path, `${globalLocation}.home_rel_path`),
      skillsDirName: requirePathSegment(global.skills_dir_name, `${globalLocation}.skills_dir_name`),
    },
    hosts,
  }
}

function requireRecord(value: unknown, location: string, allowedKeys?: string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new TypeError(`${location} must be a mapping`)
  const record = value as Record<string, unknown>
  const unknownKey = allowedKeys && Object.keys(record).find(key => !allowedKeys.includes(key))
  if (unknownKey !== undefined)
    throw new Error(`${location} has an unknown field "${unknownKey}"`)
  return record
}

function requireString(value: unknown, location: string): string {
  if (typeof value !== 'string' || value.trim().length === 0 || value.trim() !== value)
    throw new TypeError(`${location} must be a non-empty string without surrounding whitespace`)
  return value
}

function requireRelativePath(value: unknown, location: string): string {
  const configured = requireString(value, location)
  const normalized = configured.replaceAll('\\', '/')
  if (path.posix.isAbsolute(normalized) || path.win32.isAbsolute(configured) || /^[A-Za-z]:/u.test(normalized) || normalized.includes('\0') || normalized.split('/').includes('..'))
    throw new Error(`${location} must be a relative path without parent traversal`)
  return normalized
}

function requirePathSegment(value: unknown, location: string): string {
  const configured = requireRelativePath(value, location)
  if (configured === '.' || configured.includes('/'))
    throw new Error(`${location} must be a single file or directory name`)
  return configured
}

function optionalBoolean(value: unknown, location: string): boolean | undefined {
  if (value !== undefined && typeof value !== 'boolean')
    throw new TypeError(`${location} must be boolean`)
  return value
}

function optionalStringArray(value: unknown, location: string): string[] | undefined {
  if (value === undefined)
    return undefined
  if (!Array.isArray(value))
    throw new TypeError(`${location} must be an array of strings`)
  return value.map((entry, index) => requireString(entry, `${location}[${index}]`))
}

function optionalRecord(value: unknown, location: string): Record<string, unknown> | undefined {
  return value === undefined ? undefined : requireRecord(value, location)
}

function readHost(value: unknown, location: string): HostConfig {
  const record = requireRecord(value, location, ['id', 'aliases', 'home_rel_path', 'skills_dir_name', 'excluded_skills', 'project_skills', 'mcp'])
  const id = requireString(record.id, `${location}.id`)
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(id))
    throw new Error(`${location}.id must contain lowercase letters, digits, and hyphens`)

  const excludedSkills = optionalStringArray(record.excluded_skills, `${location}.excluded_skills`)
    ?.map((skill, index) => requirePathSegment(skill, `${location}.excluded_skills[${index}]`))
  return {
    id,
    aliases: optionalStringArray(record.aliases, `${location}.aliases`),
    homeRelPath: requireRelativePath(record.home_rel_path, `${location}.home_rel_path`),
    skillsDirName: record.skills_dir_name === undefined ? undefined : requirePathSegment(record.skills_dir_name, `${location}.skills_dir_name`),
    excludedSkills,
    projectSkills: optionalBoolean(record.project_skills, `${location}.project_skills`),
    mcp: record.mcp === undefined ? undefined : readMcpProjection(record.mcp, `${location}.mcp`),
  }
}

function readMcpProjection(value: unknown, location: string): McpProjection {
  const record = requireRecord(value, location, [
    'home_rel_path',
    'rel_dir',
    'file_name',
    'servers_key',
    'format',
    'require_host_home',
    'default_top_level',
    'server_defaults',
    'server_overrides',
    'server_command_format',
  ])
  const format = record.format
  if (format !== 'json' && format !== 'toml')
    throw new Error(`${location}.format must be "json" or "toml"`)
  const serverCommandFormat = record.server_command_format
  if (serverCommandFormat !== undefined && serverCommandFormat !== 'command-and-args' && serverCommandFormat !== 'command-array')
    throw new Error(`${location}.server_command_format must be "command-and-args" or "command-array"`)
  const overrides = optionalRecord(record.server_overrides, `${location}.server_overrides`)
  return {
    homeRelPath: record.home_rel_path === undefined ? undefined : requireRelativePath(record.home_rel_path, `${location}.home_rel_path`),
    relDir: requireRelativePath(record.rel_dir, `${location}.rel_dir`),
    fileName: requirePathSegment(record.file_name, `${location}.file_name`),
    serversKey: requireString(record.servers_key, `${location}.servers_key`),
    format,
    requireHostHome: optionalBoolean(record.require_host_home, `${location}.require_host_home`),
    defaultTopLevel: optionalRecord(record.default_top_level, `${location}.default_top_level`),
    serverDefaults: optionalRecord(record.server_defaults, `${location}.server_defaults`),
    serverOverrides: overrides === undefined
      ? undefined
      : Object.fromEntries(
          Object.entries(overrides).map(([name, override]) => [name, requireRecord(override, `${location}.server_overrides.${name}`)]),
        ),
    serverCommandFormat,
  }
}

export function findHostConfig(id: string): HostConfig | undefined {
  const canonical = resolveHostId(id)
  return canonical ? HOST_CONFIGS.find(host => host.id === canonical) : undefined
}

export function resolveHostId(id: string): string | undefined {
  return HOST_CONFIGS.find(host => host.id === id || host.aliases?.includes(id))?.id
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
