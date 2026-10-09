import type { SetupCommand } from './types/manifest.js'
import type { McpCatalog, McpServerDefinition, McpServerOwner } from './types/mcp.js'
import fs from 'node:fs'
import { canonicalJson } from './core/canonical-json.js'

export type { McpCatalog } from './types/mcp.js'

const reservedServerNames = new Set(['__proto__', 'constructor', 'prototype'])

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function parseSetupCommand(value: unknown, location: string): SetupCommand {
  if (!isRecord(value) || typeof value.command !== 'string' || value.command.length === 0) {
    throw new Error(`MCP setup command must declare a non-empty command: ${location}`)
  }
  if (value.args !== undefined && (!Array.isArray(value.args) || !value.args.every(argument => typeof argument === 'string'))) {
    throw new Error(`MCP setup command args must be a string array: ${location}`)
  }
  if (value.windowsCommandShim !== undefined && typeof value.windowsCommandShim !== 'boolean') {
    throw new Error(`MCP setup windowsCommandShim must be boolean: ${location}`)
  }
  if (value.skipIfCommandAvailable !== undefined && typeof value.skipIfCommandAvailable !== 'string') {
    throw new Error(`MCP setup skipIfCommandAvailable must be a string: ${location}`)
  }

  return {
    command: value.command,
    ...(value.args === undefined ? {} : { args: value.args as string[] }),
    ...(value.windowsCommandShim === undefined ? {} : { windowsCommandShim: value.windowsCommandShim }),
    ...(value.skipIfCommandAvailable === undefined ? {} : { skipIfCommandAvailable: value.skipIfCommandAvailable }),
  }
}

export function validateMcpServerNames(servers: Record<string, unknown>, sourceFile: string): void {
  for (const name of Object.keys(servers)) {
    if (name.length === 0) {
      throw new Error(`MCP server name must be non-empty: ${sourceFile}#${name}`)
    }
    if (reservedServerNames.has(name)) {
      throw new Error(`MCP server name is reserved: ${sourceFile}#${name}`)
    }
  }
}

export function readMcpServerFile(sourceFile: string): Record<string, unknown> {
  const stats = fs.lstatSync(sourceFile)
  if (!stats.isFile() || stats.isSymbolicLink())
    throw new Error(`MCP source must be a plain file: ${sourceFile}`)
  const raw = fs.readFileSync(sourceFile, 'utf8').trim()
  if (!raw)
    return {}
  let parsed: unknown
  try {
    parsed = JSON.parse(raw) as unknown
  }
  catch (error) {
    throw new Error(`MCP source is invalid JSON: ${sourceFile}`, { cause: error })
  }
  if (!isRecord(parsed))
    throw new Error(`MCP source must contain an "mcpServers" object: ${sourceFile}`)
  if (parsed.mcpServers === undefined)
    return {}
  if (!isRecord(parsed.mcpServers))
    throw new Error(`MCP source must contain an "mcpServers" object: ${sourceFile}`)
  validateMcpServerNames(parsed.mcpServers, sourceFile)
  return parsed.mcpServers
}

export function loadMcpCatalog(sourceFile: string): McpCatalog {
  let parsed: unknown
  try {
    parsed = JSON.parse(fs.readFileSync(sourceFile, 'utf8')) as unknown
  }
  catch (error) {
    throw new Error(`MCP catalog is invalid JSON: ${sourceFile}`, { cause: error })
  }

  if (!isRecord(parsed) || !isRecord(parsed.mcps)) {
    throw new Error(`MCP catalog must contain an "mcps" object: ${sourceFile}`)
  }
  validateMcpServerNames(parsed.mcps, sourceFile)

  const servers = Object.create(null) as Record<string, Record<string, unknown>>
  const setup: SetupCommand[] = []
  const serverSetup = Object.create(null) as Record<string, SetupCommand[]>
  for (const [name, value] of Object.entries(parsed.mcps)) {
    if (!name || !isRecord(value) || !isRecord(value.mcp)) {
      throw new Error(`MCP catalog entry must contain an "mcp" object: ${sourceFile}#${name}`)
    }
    if (value.setup !== undefined && !Array.isArray(value.setup)) {
      throw new Error(`MCP catalog entry setup must be an array: ${sourceFile}#${name}`)
    }

    servers[name] = value.mcp
    serverSetup[name] = (value.setup ?? []).map((command: unknown, index: number) => parseSetupCommand(command, `${sourceFile}#${name}.setup[${index}]`))
    setup.push(...serverSetup[name])
  }

  return { servers, serverSetup, setup }
}

export function setupIdentity(setup: readonly SetupCommand[] = []): string {
  return canonicalJson(setup.map(command => ({
    command: command.command,
    args: command.args ?? [],
    windowsCommandShim: command.windowsCommandShim ?? false,
    skipIfCommandAvailable: command.skipIfCommandAvailable ?? null,
  })))
}

/** Returns false for a completely identical declaration; incompatible names fail closed. */
export function mergeMcpServer(
  owners: Map<string, McpServerOwner>,
  name: string,
  definition: McpServerDefinition,
  owner: string,
): boolean {
  const previous = owners.get(name)
  if (previous) {
    if (canonicalJson(previous.server) !== canonicalJson(definition.server)
      || setupIdentity(previous.setup) !== setupIdentity(definition.setup)) {
      throw new Error(`Shared MCP server "${name}" has conflicting connection or setup definitions: ${previous.owner} conflicts with ${owner}`)
    }
    return false
  }
  owners.set(name, { ...definition, owner })
  return true
}
