import type { SetupCommand, VendorManifest } from '../types/manifest.js'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { runSkillSetupCommands } from '../install.js'

const roots: string[] = []

afterEach(() => {
  for (const root of roots.splice(0))
    fs.rmSync(root, { recursive: true, force: true })
})

function fixture() {
  const homeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'airules-setup-composition-'))
  roots.push(homeDir)
  const marker = path.join(homeDir, 'executed.txt')
  const append = (value: string): SetupCommand => ({
    command: process.execPath,
    args: ['-e', 'require("node:fs").appendFileSync(process.argv[1], process.argv[2])', marker, value],
  })
  return { homeDir, marker, append }
}

function writeCatalog(homeDir: string, name: string, mcps: unknown): void {
  const file = path.join(homeDir, 'vendor', 'repos', name, 'mcps.json')
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, JSON.stringify({ mcps }))
}

function mcpManifest(names: string[], setup: SetupCommand[] = []): VendorManifest {
  return {
    version: 1,
    vendors: Object.fromEntries(names.map(name => [name, {
      repo: `https://example.test/${name}.git`,
      cloneDir: `vendor/repos/${name}`,
      setup,
      links: [{ kind: 'mcp-file', source: 'mcps.json', target: `vendor/mcps/${name}/mcp.json` }],
    }])),
  }
}

describe('composed setup execution', () => {
  it('runs identical command groups once while preserving repetition inside each group', () => {
    const { marker, append } = fixture()
    const vendorSetup = append('v')
    const skillSetup = append('s')
    const manifest: VendorManifest = {
      version: 1,
      vendors: Object.fromEntries(['one', 'two'].map(name => [name, {
        repo: `https://example.test/${name}.git`,
        cloneDir: `vendor/repos/${name}`,
        setup: [{ ...vendorSetup, windowsCommandShim: false }],
        links: [{ kind: 'skill', source: 'skills/shared', target: 'vendor/skills/shared', setup: [skillSetup, skillSetup] }],
      }])),
    }

    runSkillSetupCommands(manifest)
    expect(fs.readFileSync(marker, 'utf8')).toBe('vss')
  })

  it('runs a shared setup group once for distinct servers and repeated catalogs', () => {
    const { homeDir, marker, append } = fixture()
    const setup = [append('m')]
    const server = { command: 'node', args: ['serve.mjs'] }
    writeCatalog(homeDir, 'one', {
      memory: { mcp: server, setup },
      other: { mcp: { command: 'other' }, setup },
    })
    writeCatalog(homeDir, 'two', { memory: { mcp: { args: ['serve.mjs'], command: 'node' }, setup } })

    runSkillSetupCommands(mcpManifest(['one', 'two']), homeDir)
    expect(fs.readFileSync(marker, 'utf8')).toBe('m')
  })

  it.each(['connection', 'setup', 'source'])('validates every MCP %s before any setup command runs', (conflict) => {
    const { homeDir, marker, append } = fixture()
    writeCatalog(homeDir, 'one', { shared: { mcp: { command: 'same' } } })
    if (conflict !== 'source') {
      writeCatalog(homeDir, 'two', {
        shared: {
          mcp: { command: conflict === 'connection' ? 'different' : 'same' },
          setup: conflict === 'setup' ? [append('unexpected')] : [],
        },
      })
    }
    const manifest = mcpManifest(['one', 'two'], [append('vendor')])

    expect(() => runSkillSetupCommands(manifest, homeDir)).toThrow(conflict === 'source' ? /plain file/u : /conflicting connection or setup/u)
    expect(fs.existsSync(marker)).toBe(false)
  })
})
