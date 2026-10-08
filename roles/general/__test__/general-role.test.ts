import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { HOST_IDS } from '../../../scripts/lib/hosts.js'
import { projectHostById, readInstalledMcpServers } from '../../../scripts/lib/install.js'
import { rebuildVendorAssets } from '../../../scripts/lib/vendor-staging.js'
import { loadVendorManifest } from '../../../scripts/lib/vendors.js'

const roleRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const repoRoot = path.resolve(roleRoot, '..', '..')
const manifestPath = path.join(roleRoot, 'role.yaml')
const temporaryRoots: string[] = []

afterEach(() => {
  for (const root of temporaryRoots.splice(0))
    fs.rmSync(root, { recursive: true, force: true })
})

describe('general role', () => {
  it('distributes only shared skills and the memory MCP, including visualization assets', async () => {
    const loaded = await loadVendorManifest(manifestPath)
    expect(loaded.hosts).toEqual(HOST_IDS)
    expect(loaded.packages).toEqual([])
    expect(Object.keys(loaded.vendors)).toEqual(['general-role', 'hindsight-memory'])
    expect(Object.values(loaded.vendors).every(vendor => vendor.setup === undefined)).toBe(true)
    expect(loaded.vendors.mattpocock).toBeUndefined()

    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'airules-general-'))
    temporaryRoots.push(root)
    const homeDir = path.join(root, 'home')
    const userHome = path.join(root, 'user')
    const repository = path.join(homeDir, 'vendor', 'repos', 'general-role')
    fs.mkdirSync(path.join(repository, 'roles'), { recursive: true })
    fs.cpSync(roleRoot, path.join(repository, 'roles', 'general'), { recursive: true })
    fs.mkdirSync(path.join(repository, 'capabilities'), { recursive: true })
    fs.cpSync(path.join(repoRoot, 'capabilities', 'common'), path.join(repository, 'capabilities', 'common'), { recursive: true })
    for (const [vendor, source] of [
      ['hindsight-memory', 'skills/hindsight-docs'],
      ['mattpocock', 'skills/productivity/grilling'],
      ['mattpocock', 'skills/productivity/unselected'],
    ]) {
      const skillRoot = path.join(homeDir, 'vendor', 'repos', vendor, source)
      fs.mkdirSync(skillRoot, { recursive: true })
      fs.writeFileSync(path.join(skillRoot, 'SKILL.md'), `---\nname: ${path.basename(source)}\ndescription: fixture\n---\n`)
    }

    const inventory = await rebuildVendorAssets({ homeDir, role: 'general', manifestPath })

    expect(inventory.skills).toEqual(['create-skill', 'hindsight-docs', 'hindsight-memory', 'spec-organization'])
    expect(fs.readFileSync(path.join(homeDir, 'roles', 'general', 'role.yaml'), 'utf8')).toBe(fs.readFileSync(manifestPath, 'utf8'))
    const memoryRoot = path.join(homeDir, 'vendor', 'skills', 'hindsight-memory')
    for (const asset of ['assets/compose.yaml', 'assets/hindsight.env.example', 'references/visualization.md']) {
      expect(fs.readFileSync(path.join(memoryRoot, asset))).toEqual(
        fs.readFileSync(path.join(repoRoot, 'capabilities', 'common', 'skills', 'hindsight-memory', asset)),
      )
    }
    expect(readInstalledMcpServers(homeDir, 'general')).toEqual({
      hindsight: { type: 'http', url: 'http://localhost:8888/mcp/' },
    })

    for (const directory of ['.claude', '.codex', '.config/opencode'])
      fs.mkdirSync(path.join(userHome, directory), { recursive: true })
    for (const host of ['claude', 'codex', 'opencode'])
      expect(projectHostById(host, userHome, homeDir, 'general').success).toBe(true)

    const claude = JSON.parse(fs.readFileSync(path.join(userHome, '.claude.json'), 'utf8'))
    expect(claude.mcpServers).toEqual({ hindsight: { type: 'http', url: 'http://localhost:8888/mcp/' } })
    const codex = fs.readFileSync(path.join(userHome, '.codex', 'config.toml'), 'utf8')
    expect(codex).toContain('[mcp_servers.hindsight]')
    expect(codex).toContain('url = "http://localhost:8888/mcp/"')
    expect(codex.match(/\[mcp_servers\./gu)).toHaveLength(1)
    const openCode = JSON.parse(fs.readFileSync(path.join(userHome, '.config', 'opencode', 'opencode.json'), 'utf8'))
    expect(openCode.mcp).toEqual({ hindsight: { type: 'remote', enabled: true, url: 'http://localhost:8888/mcp/' } })
  })
})
