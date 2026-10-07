import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { projectHostById } from '../install.js'

const roots: string[] = []

afterEach(() => {
  for (const root of roots.splice(0))
    fs.rmSync(root, { force: true, recursive: true })
})

function createFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'airules-mcp-projection-'))
  roots.push(root)
  const userHome = path.join(root, 'user')
  const homeDir = path.join(root, 'home')
  for (const directory of ['.claude', '.cursor', '.codex', '.config/opencode'])
    fs.mkdirSync(path.join(userHome, directory), { recursive: true })
  const catalogDir = path.join(homeDir, 'vendor', 'mcps', 'shared')
  fs.mkdirSync(catalogDir, { recursive: true })
  const servers = {
    memory: {
      type: 'http',
      url: 'http://localhost:8888/mcp/',
      headers: { 'X-Project': 'demo', 'X-Label': 'quote " slash \\ newline\n' },
    },
    local: { command: 'node', args: ['server.mjs'], env: { MODE: 'demo' } },
  }
  fs.writeFileSync(path.join(catalogDir, 'mcp.json'), JSON.stringify({ mcpServers: servers }))
  return { homeDir, userHome, servers }
}

describe('shared MCP host projection', () => {
  it('projects HTTP endpoints alongside stdio servers to JSON and OpenCode hosts', () => {
    const { homeDir, userHome, servers } = createFixture()
    for (const host of ['claude', 'cursor', 'opencode'])
      projectHostById(host, userHome, homeDir, 'demo')

    for (const configFile of ['.claude.json', '.cursor/mcp.json']) {
      const config = JSON.parse(fs.readFileSync(path.join(userHome, configFile), 'utf8'))
      expect(config.mcpServers.memory).toEqual(servers.memory)
      expect(config.mcpServers.local).toEqual({ type: 'stdio', ...servers.local })
    }
    const openCode = JSON.parse(fs.readFileSync(path.join(userHome, '.config', 'opencode', 'opencode.json'), 'utf8'))
    expect(openCode.mcp.memory).toEqual({ ...servers.memory, type: 'remote', enabled: true })
    expect(openCode.mcp.local).toEqual({
      type: 'local',
      enabled: true,
      command: ['node', 'server.mjs'],
      environment: { MODE: 'demo' },
    })
  })

  it('writes URL and escaped HTTP headers to Codex TOML while keeping stdio configuration', () => {
    const { homeDir, userHome } = createFixture()
    projectHostById('codex', userHome, homeDir, 'demo')

    const config = fs.readFileSync(path.join(userHome, '.codex', 'config.toml'), 'utf8')
    expect(config).toContain('[mcp_servers.memory]\nurl = "http://localhost:8888/mcp/"')
    expect(config).toContain('http_headers = { X-Project = "demo", X-Label = "quote \\" slash \\\\ newline\\n" }')
    expect(config).toContain('[mcp_servers.local]\ncommand = "node"\nargs = ["server.mjs"]\nenv = { MODE = "demo" }')
    expect(config).not.toContain('type = "http"')
  })

  it('preserves user endpoint overrides and stays idempotent across repeated projections', () => {
    const { homeDir, userHome } = createFixture()
    const claudeFile = path.join(userHome, '.claude.json')
    const codexFile = path.join(userHome, '.codex', 'config.toml')
    const userServer = { type: 'http', url: 'https://memory.example.test/mcp/team/' }
    fs.writeFileSync(claudeFile, JSON.stringify({ mcpServers: { memory: userServer }, theme: 'dark' }))
    const userToml = '[mcp_servers.memory]\nurl = "https://memory.example.test/mcp/team/"\n'
    fs.writeFileSync(codexFile, userToml)

    for (const host of ['claude', 'codex'])
      projectHostById(host, userHome, homeDir, 'demo')
    const firstClaude = fs.readFileSync(claudeFile, 'utf8')
    const firstCodex = fs.readFileSync(codexFile, 'utf8')
    for (const host of ['claude', 'codex'])
      projectHostById(host, userHome, homeDir, 'demo')

    expect(fs.readFileSync(claudeFile, 'utf8')).toBe(firstClaude)
    expect(fs.readFileSync(codexFile, 'utf8')).toBe(firstCodex)
    expect(JSON.parse(firstClaude)).toMatchObject({ theme: 'dark', mcpServers: { memory: userServer } })
    expect(firstCodex).toContain(userToml.trimEnd())
    expect(firstCodex.match(/\[mcp_servers\.memory\]/gu)).toHaveLength(1)
    expect(firstCodex).not.toContain('localhost:8888')
  })
})
