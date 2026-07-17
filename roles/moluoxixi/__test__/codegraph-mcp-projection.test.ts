import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { projectHostById } from '../../../scripts/lib/install.js'

const temporaryRoots: string[] = []
const workspaceFolderPlaceholder = '$' + '{workspaceFolder}'

afterEach(() => {
  for (const root of temporaryRoots.splice(0))
    fs.rmSync(root, { recursive: true, force: true })
})

function createFixture(): { moluoHome: string, userHome: string } {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'airules-codegraph-'))
  temporaryRoots.push(root)
  const userHome = path.join(root, 'user')
  const moluoHome = path.join(root, 'moluoxixi')
  fs.mkdirSync(path.join(moluoHome, 'vendor', 'skills'), { recursive: true })
  fs.mkdirSync(path.join(moluoHome, 'roles', 'moluoxixi', 'mcp'), { recursive: true })
  fs.writeFileSync(path.join(moluoHome, 'roles', 'moluoxixi', 'mcp', 'mcp.json'), `${JSON.stringify({
    mcpServers: {
      codegraph: {
        args: ['serve', '--mcp', '--path', workspaceFolderPlaceholder],
        command: 'codegraph',
      },
    },
  }, null, 2)}\n`)
  return { moluoHome, userHome }
}

describe('moluoxixi CodeGraph MCP projection', () => {
  it('projects only for an explicitly selected role and preserves user JSON servers', () => {
    const { moluoHome, userHome } = createFixture()
    const claudeHome = path.join(userHome, '.claude')
    const target = path.join(claudeHome, '.mcp.json')
    fs.mkdirSync(claudeHome, { recursive: true })
    fs.writeFileSync(target, '\uFEFF{"custom":true,"mcpServers":{"codegraph":{"command":"user-codegraph"}}}\n')

    expect(projectHostById('claude', userHome, moluoHome, 'moluoxixi')).toEqual({ success: true })
    expect(JSON.parse(fs.readFileSync(target, 'utf8'))).toEqual({
      custom: true,
      mcpServers: { codegraph: { command: 'user-codegraph' } },
    })

    const before = fs.readFileSync(target, 'utf8')
    expect(projectHostById('claude', userHome, moluoHome)).toEqual({ success: true })
    expect(fs.readFileSync(target, 'utf8')).toBe(before)
  })

  it('uses one idempotent managed TOML block and leaves user tables intact', () => {
    const { moluoHome, userHome } = createFixture()
    const codexHome = path.join(userHome, '.codex')
    const target = path.join(codexHome, 'config.toml')
    fs.mkdirSync(codexHome, { recursive: true })
    fs.writeFileSync(target, '[mcp_servers.custom]\ncommand = "custom"\n')

    projectHostById('codex', userHome, moluoHome, 'moluoxixi')
    projectHostById('codex', userHome, moluoHome, 'moluoxixi')

    const content = fs.readFileSync(target, 'utf8')
    expect(content).toContain('[mcp_servers.custom]')
    expect(content).toContain('[mcp_servers.codegraph]')
    expect(content).toContain(`"${workspaceFolderPlaceholder}"`)
    expect(content.match(/# >>> AIRULES MCP >>>/gu)).toHaveLength(1)
    expect(content.match(/# <<< AIRULES MCP <<</gu)).toHaveLength(1)
  })

  it('supports an MCP-only Trae Solo installation', () => {
    const { moluoHome, userHome } = createFixture()
    const mcpHome = path.join(userHome, 'AppData', 'Roaming', 'TRAE SOLO', 'User')
    fs.mkdirSync(mcpHome, { recursive: true })

    expect(projectHostById('trae-solo', userHome, moluoHome, 'moluoxixi')).toEqual({ success: true })
    expect(fs.existsSync(path.join(userHome, '.trae-solo'))).toBe(false)
    expect(JSON.parse(fs.readFileSync(path.join(mcpHome, 'mcp.json'), 'utf8'))).toEqual({
      inputs: [],
      mcpServers: {
        codegraph: {
          args: ['serve', '--mcp', '--path', workspaceFolderPlaceholder],
          command: 'codegraph',
        },
      },
    })
  })

  it('adds the Qoder stdio discriminator without changing the role source', () => {
    const { moluoHome, userHome } = createFixture()
    fs.mkdirSync(path.join(userHome, '.qoder'), { recursive: true })
    const mcpHome = path.join(userHome, 'AppData', 'Roaming', 'Qoder', 'SharedClientCache')
    fs.mkdirSync(mcpHome, { recursive: true })

    projectHostById('qoder', userHome, moluoHome, 'moluoxixi')

    const projected = JSON.parse(fs.readFileSync(path.join(mcpHome, 'mcp.json'), 'utf8')) as {
      mcpServers: Record<string, Record<string, unknown>>
    }
    expect(projected.mcpServers.codegraph).toMatchObject({ command: 'codegraph', type: 'stdio' })
    const source = JSON.parse(fs.readFileSync(path.join(moluoHome, 'roles', 'moluoxixi', 'mcp', 'mcp.json'), 'utf8')) as {
      mcpServers: Record<string, Record<string, unknown>>
    }
    expect(source.mcpServers.codegraph.type).toBeUndefined()
  })
})
