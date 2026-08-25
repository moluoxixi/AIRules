import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, it } from 'vitest'
import { ensureGlobalSkillLink, getDefaultInstallPaths, projectHostById } from '../install.js'
import { verifyGlobalAgentSkills, verifyHost } from '../verify.js'

const temporaryRoots: string[] = []

afterEach(() => {
  for (const root of temporaryRoots.splice(0))
    fs.rmSync(root, { recursive: true, force: true })
})

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'airules-verify-skills-'))
  temporaryRoots.push(root)
  const userHome = path.join(root, 'user')
  const moluoHome = path.join(root, 'home')
  const codexHome = path.join(userHome, '.codex')
  fs.mkdirSync(path.join(moluoHome, 'vendor', 'skills', 'demo'), { recursive: true })
  fs.writeFileSync(path.join(moluoHome, 'vendor', 'skills', 'demo', 'SKILL.md'), '---\nname: demo\ndescription: demo\n---\n')
  fs.mkdirSync(codexHome, { recursive: true })
  return { codexHome, moluoHome, root, userHome }
}

function writeSharedMcp(moluoHome: string): void {
  const mcpFile = path.join(moluoHome, 'vendor', 'mcps', 'code', 'mcp.json')
  fs.mkdirSync(path.dirname(mcpFile), { recursive: true })
  fs.writeFileSync(mcpFile, `${JSON.stringify({
    mcpServers: {
      'codegraph': { command: 'codegraph', args: ['serve', '--mcp'] },
      'context7': { command: 'npx', args: ['-y', '@upstash/context7-mcp@latest'] },
      'quoted"server\\name': { command: 'quoted-server' },
    },
  })}\n`)
}

it('verifyHost rejects unknown hosts and skips missing host homes', async () => {
  const { moluoHome, root } = fixture()
  assert.equal(await verifyHost('unknown', moluoHome), false)
  assert.equal(await verifyHost('claude', moluoHome, path.join(root, 'missing-user')), true)
})

it('verifyHost validates only the projected skill set', async () => {
  const { moluoHome, userHome } = fixture()
  assert.equal(projectHostById('codex', userHome, moluoHome).success, true)
  assert.equal(await verifyHost('codex', moluoHome, userHome), true)

  fs.rmSync(path.join(userHome, '.agents', 'skills', 'demo'), { recursive: true, force: true })
  assert.equal(await verifyHost('codex', moluoHome, userHome), true)
})

it.each([
  ['codex', '.codex', 'skills', '.codex/config.toml'],
  ['cursor', '.cursor', 'skills-cursor', '.cursor/mcp.json'],
  ['qoder', '.qoder', 'skills', 'AppData/Roaming/Qoder/SharedClientCache/mcp.json'],
  ['trae', '.trae', 'skills', 'AppData/Roaming/Trae/User/mcp.json'],
  ['trae-cn', '.trae-cn', 'skills', 'AppData/Roaming/Trae CN/User/mcp.json'],
  ['trae-solo', '.trae-solo', 'skills', 'AppData/Roaming/TRAE SOLO/User/mcp.json'],
  ['trae-solo-cn', '.trae-solo-cn', 'skills', 'AppData/Roaming/TRAE SOLO CN/User/mcp.json'],
  ['opencode', '.config/opencode', 'skills', '.config/opencode/opencode.json'],
])('%s reuses canonical skills while retaining host MCP projection', async (host, hostHomePath, skillsDirName, mcpFilePath) => {
  const { moluoHome, userHome } = fixture()
  writeSharedMcp(moluoHome)
  fs.mkdirSync(path.join(userHome, ...hostHomePath.split('/')), { recursive: true })
  fs.mkdirSync(path.dirname(path.join(userHome, ...mcpFilePath.split('/'))), { recursive: true })

  assert.equal(projectHostById(host, userHome, moluoHome).success, true)
  assert.equal(await verifyHost(host, moluoHome, userHome), true)
  assert.ok(fs.existsSync(path.join(userHome, '.agents', 'skills', 'demo', 'SKILL.md')))
  assert.equal(fs.existsSync(path.join(userHome, ...hostHomePath.split('/'), skillsDirName, 'demo')), false)
  assert.ok(fs.statSync(path.join(userHome, ...mcpFilePath.split('/'))).isFile())
})

it('hermes reuses canonical skills without creating a private skill entry', async () => {
  const { moluoHome, userHome } = fixture()
  const hermesHome = path.join(userHome, 'AppData', 'Local', 'hermes')
  fs.mkdirSync(hermesHome, { recursive: true })

  assert.equal(projectHostById('hermes', userHome, moluoHome).success, true)
  assert.equal(await verifyHost('hermes', moluoHome, userHome), true)
  assert.ok(fs.existsSync(path.join(userHome, '.agents', 'skills', 'demo', 'SKILL.md')))
  assert.equal(fs.existsSync(path.join(hermesHome, 'skills', 'demo')), false)
})

it('verifyHost validates JSON and TOML MCP server presence while preserving user servers', async () => {
  const { moluoHome, userHome } = fixture()
  writeSharedMcp(moluoHome)
  fs.mkdirSync(path.join(userHome, '.cursor'), { recursive: true })

  assert.equal(projectHostById('codex', userHome, moluoHome).success, true)
  assert.equal(projectHostById('cursor', userHome, moluoHome).success, true)
  assert.equal(await verifyHost('codex', moluoHome, userHome), true)
  assert.equal(await verifyHost('cursor', moluoHome, userHome), true)

  const codexFile = path.join(userHome, '.codex', 'config.toml')
  fs.writeFileSync(codexFile, fs.readFileSync(codexFile, 'utf8').replace(/\[mcp_servers\.context7\][\s\S]*?(?=\n\[|\n# <<<)/u, ''))
  assert.equal(await verifyHost('codex', moluoHome, userHome), false)

  const cursorFile = path.join(userHome, '.cursor', 'mcp.json')
  const cursor = JSON.parse(fs.readFileSync(cursorFile, 'utf8')) as { mcpServers: Record<string, unknown> }
  cursor.mcpServers.user = { command: 'user' }
  delete cursor.mcpServers.codegraph
  fs.writeFileSync(cursorFile, `${JSON.stringify(cursor)}\n`)
  assert.equal(await verifyHost('cursor', moluoHome, userHome), false)
  assert.ok(cursor.mcpServers.user)
})

it.each([
  ['trae-solo', 'TRAE SOLO'],
  ['trae-solo-cn', 'TRAE SOLO CN'],
])('verifyHost checks MCP-only host %s', async (host, roamingDir) => {
  const { moluoHome, userHome } = fixture()
  writeSharedMcp(moluoHome)
  const mcpHome = path.join(userHome, 'AppData', 'Roaming', roamingDir, 'User')
  fs.mkdirSync(mcpHome, { recursive: true })

  assert.equal(projectHostById(host, userHome, moluoHome, 'demo').success, true)
  assert.equal(await verifyHost(host, moluoHome, userHome, 'demo'), true)
  fs.rmSync(path.join(mcpHome, 'mcp.json'))
  assert.equal(await verifyHost(host, moluoHome, userHome, 'demo'), false)
})

it('verifyGlobalAgentSkills requires and validates the mandatory shared layer', async () => {
  const { moluoHome, userHome } = fixture()
  assert.equal(await verifyGlobalAgentSkills(moluoHome, userHome), false)

  ensureGlobalSkillLink({
    ...getDefaultInstallPaths(userHome),
    moluoHome,
    repoRoot: moluoHome,
  })
  assert.equal(await verifyGlobalAgentSkills(moluoHome, userHome), true)

  fs.rmSync(path.join(userHome, '.agents', 'skills', 'demo'), { recursive: true, force: true })
  assert.equal(await verifyGlobalAgentSkills(moluoHome, userHome), false)
})

it('skills-only projection preserves host-native assets byte-for-byte', async () => {
  const { codexHome, moluoHome, userHome } = fixture()
  const sentinels = {
    'AGENTS.md': '# user rules\n',
    'agents/reviewer.toml': 'name = "reviewer"\n',
    'config.toml': '[mcp_servers.user]\ncommand = "user"\n',
    'hooks/user.mjs': 'export const user = true\n',
  }
  for (const [relativePath, content] of Object.entries(sentinels)) {
    const target = path.join(codexHome, ...relativePath.split('/'))
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.writeFileSync(target, content)
  }

  assert.equal(projectHostById('codex', userHome, moluoHome).success, true)
  assert.equal(await verifyHost('codex', moluoHome, userHome), true)
  for (const [relativePath, content] of Object.entries(sentinels))
    assert.equal(fs.readFileSync(path.join(codexHome, ...relativePath.split('/')), 'utf8'), content)
})
