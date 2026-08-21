import type { SetupCommand } from './vendors.js'
import fs from 'node:fs'

export interface McpCatalog {
  servers: Record<string, Record<string, unknown>>
  setup: SetupCommand[]
}

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
  for (const [name, value] of Object.entries(parsed.mcps)) {
    if (!name || !isRecord(value) || !isRecord(value.mcp)) {
      throw new Error(`MCP catalog entry must contain an "mcp" object: ${sourceFile}#${name}`)
    }
    if (value.setup !== undefined && !Array.isArray(value.setup)) {
      throw new Error(`MCP catalog entry setup must be an array: ${sourceFile}#${name}`)
    }

    servers[name] = value.mcp
    for (const [index, command] of (value.setup ?? []).entries()) {
      setup.push(parseSetupCommand(command, `${sourceFile}#${name}.setup[${index}]`))
    }
  }

  return { servers, setup }
}
