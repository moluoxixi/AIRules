import type { SetupCommand } from './manifest.js'

export interface McpCatalog {
  servers: Record<string, Record<string, unknown>>
  serverSetup: Record<string, SetupCommand[]>
  setup: SetupCommand[]
}

export interface McpServerDefinition {
  server: unknown
  setup: SetupCommand[]
}

export interface McpServerOwner extends McpServerDefinition {
  owner: string
}
