import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { parseDocument } from 'yaml'
import { readInstalledMcpServers } from '../../../scripts/lib/install.js'
import { roleOverlayOrder } from '../../../scripts/lib/roles.js'
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

describe('shared development template', () => {
  it.each(['matt', 'moluoxixi', 'trellis'])('provides shared skills and MCP to %s while keeping its workflow choices local', async (role) => {
    const base = await loadVendorManifest(manifestPath)
    const childPath = path.join(repoRoot, 'roles', role, 'role.yaml')
    const child = await loadVendorManifest(childPath)
    const contract = parseDocument(fs.readFileSync(childPath, 'utf8')).toJS({ maxAliasCount: 0 })
    const childVendorName = contract.role_vendor.name

    expect(contract.capabilities).toEqual(role === 'matt' ? ['engineering'] : [])
    await expect(roleOverlayOrder(repoRoot, role)).resolves.toEqual(['general', 'development', role])
    for (const vendor of ['hindsight-memory', 'anthropic-skills'])
      expect(child.vendors[vendor]).toEqual(base.vendors[vendor])
    expect(child.vendors.mattpocock).toMatchObject({
      repo: base.vendors.mattpocock?.repo,
      revision: base.vendors.mattpocock?.revision,
    })
    expect(child.vendors.mattpocock?.links).toEqual([
      ...base.vendors.mattpocock!.links,
      ...(role === 'matt'
        ? [{ kind: 'namespace-dir', source: 'skills/engineering', target: 'vendor/skills/engineering' }]
        : []),
    ])
    expect(child.vendors[childVendorName]?.links.slice(1)).toEqual(base.vendors['development-role']?.links.slice(1))
    expect(child.vendors['development-role']).toBeUndefined()
    expect(child.vendors['general-role']).toBeUndefined()
    expect(base.packages).toEqual([])
    expect(base.vendors['development-role']?.setup).toBeUndefined()
    if (role === 'moluoxixi') {
      expect(child.packages?.map(entry => entry.name)).toEqual([
        '@moluoxixi/airules-moluoxixi-core',
        '@moluoxixi/airules-moluoxixi-cli',
      ])
    }
    else {
      expect(child.packages).toEqual([])
    }
    expect(child.vendors[childVendorName]?.setup).toEqual(role === 'trellis'
      ? [{ command: 'npm', args: ['install', '--global', '@mindfoldhq/trellis@latest'] }]
      : undefined)
  })

  it('stages shared development assets without the optional engineering workflow', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'airules-development-'))
    temporaryRoots.push(root)
    const homeDir = path.join(root, 'home')
    const repository = path.join(homeDir, 'vendor', 'repos', 'development-role')
    fs.mkdirSync(path.join(repository, 'roles'), { recursive: true })
    fs.cpSync(roleRoot, path.join(repository, 'roles', 'development'), { recursive: true })
    for (const capability of ['common', 'coding', 'frontend']) {
      const checkoutRoot = path.join(repository, 'capabilities', capability)
      fs.mkdirSync(path.dirname(checkoutRoot), { recursive: true })
      fs.cpSync(path.join(repoRoot, 'capabilities', capability), checkoutRoot, { recursive: true })
    }
    for (const [vendor, source] of [
      ['hindsight-memory', 'skills/hindsight-docs'],
      ['mattpocock', 'skills/engineering/tdd'],
      ['mattpocock', 'skills/productivity/grilling'],
      ['mattpocock', 'skills/productivity/handoff'],
      ['anthropic-skills', 'skills/frontend-design'],
    ]) {
      const skillRoot = path.join(homeDir, 'vendor', 'repos', vendor, source)
      fs.mkdirSync(skillRoot, { recursive: true })
      fs.writeFileSync(path.join(skillRoot, 'SKILL.md'), `---\nname: ${path.basename(source)}\ndescription: fixture\n---\n`)
    }

    const inventory = await rebuildVendorAssets({ homeDir, role: 'development', manifestPath })

    expect(inventory.skills).toEqual([
      'create-skill',
      'frontend-design',
      'grilling',
      'handoff',
      'hindsight-docs',
      'hindsight-memory',
      'spec-organization',
    ])
    expect(fs.readFileSync(path.join(homeDir, 'roles', 'development', 'role.yaml'), 'utf8')).toBe(fs.readFileSync(manifestPath, 'utf8'))
    expect(Object.keys(readInstalledMcpServers(homeDir, 'development') ?? {}).sort()).toEqual([
      'codegraph',
      'context7',
      'hindsight',
      'playwright',
      'sequential-thinking',
    ])
  })
})
