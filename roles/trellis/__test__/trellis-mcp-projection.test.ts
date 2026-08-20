import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { projectHostById } from '../../../scripts/lib/install.js'

const roleRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const temporaryRoots: string[] = []
const workspaceFolderPlaceholder = '$' + '{workspaceFolder}'

afterEach(() => {
  for (const root of temporaryRoots.splice(0))
    fs.rmSync(root, { force: true, recursive: true })
})

function createFixture(): { moluoHome: string, userHome: string } {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'airules-trellis-mcp-'))
  temporaryRoots.push(root)
  const userHome = path.join(root, 'user')
  const moluoHome = path.join(root, 'moluoxixi')
  fs.mkdirSync(path.join(moluoHome, 'vendor', 'skills'), { recursive: true })
  fs.mkdirSync(path.join(moluoHome, 'roles', 'trellis'), { recursive: true })
  fs.cpSync(path.join(roleRoot, 'mcp'), path.join(moluoHome, 'roles', 'trellis', 'mcp'), { recursive: true })
  return { moluoHome, userHome }
}

describe('trellis MCP projection', () => {
  it('uses client roots for Claude and Codex while preserving the Cursor workspace variable', () => {
    const { moluoHome, userHome } = createFixture()
    for (const directory of ['.claude', '.codex', '.cursor'])
      fs.mkdirSync(path.join(userHome, directory), { recursive: true })

    projectHostById('claude', userHome, moluoHome, 'trellis')
    projectHostById('codex', userHome, moluoHome, 'trellis')
    projectHostById('cursor', userHome, moluoHome, 'trellis')

    const claude = JSON.parse(fs.readFileSync(path.join(userHome, '.claude.json'), 'utf8')) as {
      mcpServers: Record<string, { args: string[], command: string, type: string }>
    }
    expect(claude.mcpServers.codegraph).toEqual({
      type: 'stdio',
      command: 'codegraph',
      args: ['serve', '--mcp'],
    })
    expect(Object.keys(claude.mcpServers).sort()).toEqual([
      'codegraph',
      'context7',
      'playwright',
      'sequential-thinking',
    ])

    const codex = fs.readFileSync(path.join(userHome, '.codex', 'config.toml'), 'utf8')
    expect(codex).toContain('[mcp_servers.codegraph]')
    expect(codex).toContain('[mcp_servers.context7]')
    expect(codex).toContain('[mcp_servers.sequential-thinking]')
    expect(codex).toContain('[mcp_servers.playwright]')
    expect(codex).not.toContain(workspaceFolderPlaceholder)

    const cursor = JSON.parse(fs.readFileSync(path.join(userHome, '.cursor', 'mcp.json'), 'utf8')) as {
      mcpServers: Record<string, { args: string[] }>
    }
    expect(cursor.mcpServers.codegraph.args).toEqual([
      'serve',
      '--mcp',
      '--path',
      workspaceFolderPlaceholder,
    ])
  })

  it('uses the workspace variable for a non-native VSCode host', () => {
    const { moluoHome, userHome } = createFixture()
    const mcpHome = path.join(userHome, 'AppData', 'Roaming', 'Trae', 'User')
    fs.mkdirSync(mcpHome, { recursive: true })

    projectHostById('trae', userHome, moluoHome, 'trellis')

    const trae = JSON.parse(fs.readFileSync(path.join(mcpHome, 'mcp.json'), 'utf8')) as {
      mcpServers: Record<string, { args: string[] }>
    }
    expect(trae.mcpServers.codegraph.args).toEqual([
      'serve',
      '--mcp',
      '--path',
      workspaceFolderPlaceholder,
    ])
    expect(Object.keys(trae.mcpServers)).toHaveLength(4)
  })

  it('converts every server to the OpenCode command-array schema', () => {
    const { moluoHome, userHome } = createFixture()
    const openCodeHome = path.join(userHome, '.config', 'opencode')
    fs.mkdirSync(openCodeHome, { recursive: true })

    projectHostById('opencode', userHome, moluoHome, 'trellis')

    const config = JSON.parse(fs.readFileSync(path.join(openCodeHome, 'opencode.json'), 'utf8')) as {
      $schema: string
      mcp: Record<string, { command: string[], enabled: boolean, type: string }>
    }
    expect(config.$schema).toBe('https://opencode.ai/config.json')
    expect(config.mcp.codegraph).toEqual({
      type: 'local',
      enabled: true,
      command: ['codegraph', 'serve', '--mcp'],
    })
    expect(config.mcp.context7.command).toEqual(['npx', '-y', '@upstash/context7-mcp@latest'])
    expect(config.mcp['sequential-thinking'].command).toEqual([
      'npx',
      '-y',
      '@modelcontextprotocol/server-sequential-thinking@latest',
    ])
    expect(config.mcp.playwright.command).toEqual(['npx', '-y', '@playwright/mcp@latest'])
  })
})
