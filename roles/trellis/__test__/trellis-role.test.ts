import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { parseDocument } from 'yaml'
import { HOST_IDS } from '../../../constants/hosts.js'
import { rebuildVendorAssets } from '../../../scripts/lib/vendor-staging.js'
import { loadVendorManifest } from '../../../scripts/lib/vendors.js'
import { extendsRoles, hosts, vendors } from '../constants/skills.js'

const roleRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const manifestPath = path.join(roleRoot, 'constants', 'skills.ts')
const temporaryRoots: string[] = []

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    fs.rmSync(root, { force: true, recursive: true })
  }
})

describe('native Trellis role', () => {
  it('installs the official CLI and projects the AIRules-owned initialization entry', async () => {
    expect(extendsRoles).toEqual([])
    expect(hosts).toBe('all')
    expect(vendors).toEqual([
      {
        name: 'trellis',
        source: 'https://github.com/moluoxixi/AIRules.git',
        setup: [
          {
            command: 'npm',
            args: ['install', '--global', '@mindfoldhq/trellis@latest'],
          },
        ],
        projections: [
          {
            kind: 'role-assets',
            sourceDir: 'roles/trellis',
          },
        ],
      },
    ])

    const loaded = await loadVendorManifest(manifestPath)
    expect(loaded.hosts).toEqual(HOST_IDS)
    expect(loaded.vendors.trellis).toMatchObject({
      repo: 'https://github.com/moluoxixi/AIRules.git',
      links: [
        {
          kind: 'role-assets-dir',
          source: 'roles/trellis',
          target: 'vendor',
        },
      ],
      setup: [
        {
          command: 'npm',
          args: ['install', '--global', '@mindfoldhq/trellis@latest'],
        },
      ],
    })
  })

  it('ships only the native initialization entry alongside role metadata', () => {
    expect(fs.readdirSync(roleRoot).sort()).toEqual(['__test__', 'constants', 'role.yaml', 'skills'])
    expect(fs.existsSync(path.join(roleRoot, 'mcp'))).toBe(false)
    expect(fs.readdirSync(path.join(roleRoot, 'skills')).sort()).toEqual(['init-project'])
    expect(fs.existsSync(path.join(roleRoot, 'skills', 'init-project', 'scripts'))).toBe(false)

    const skill = fs.readFileSync(path.join(roleRoot, 'skills', 'init-project', 'SKILL.md'), 'utf8')
    expect(skill).toContain('trellis init --help')
    expect(skill).toContain('trellis init <confirmed-platform-flags> -u <confirmed-developer>')
    expect(skill).toContain('Do not stage or commit generated files')

    const document = parseDocument(fs.readFileSync(path.join(roleRoot, 'role.yaml'), 'utf8'), {
      merge: false,
      prettyErrors: true,
      strict: true,
      uniqueKeys: true,
    })
    expect(document.errors).toEqual([])
    expect(document.toJS({ maxAliasCount: 0 })).toMatchObject({
      schema_version: 1,
      role_id: 'trellis',
      role_version: '0.1.0',
      status: 'stable',
      canonical_root: 'roles/trellis',
      assets: {
        skills: 'skills',
      },
      distribution: {
        bootstrap_manifest: 'constants/skills.ts',
        full_role_path_required: true,
        npm_embedded_source: false,
      },
      entrypoints: {
        initialize_project_skill: 'init-project',
      },
      third_party: {
        upstream: {
          name: 'Trellis',
          source: 'https://github.com/mindfold-ai/Trellis.git',
          package: '@mindfoldhq/trellis@latest',
        },
      },
    })
  })

  it('stages the project initializer as the role skill', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'airules-trellis-role-'))
    temporaryRoots.push(root)
    const homeDir = path.join(root, 'home')
    const repository = path.join(homeDir, 'vendor', 'repos', 'trellis')
    fs.mkdirSync(path.join(repository, 'roles'), { recursive: true })
    fs.cpSync(roleRoot, path.join(repository, 'roles', 'trellis'), { recursive: true })
    const stagingManifest = path.join(root, 'manifest.mjs')
    fs.writeFileSync(stagingManifest, `export const vendors = ${JSON.stringify([{
      name: 'trellis',
      source: 'https://github.com/moluoxixi/AIRules.git',
      projections: [
        { kind: 'role-assets', sourceDir: 'roles/trellis' },
      ],
    }])}\n`)

    const inventory = await rebuildVendorAssets({ homeDir, role: 'trellis', manifestPath: stagingManifest })
    expect(inventory.skills).toEqual(['init-project'])
    expect(fs.existsSync(path.join(homeDir, 'vendor', 'skills', 'init-project', 'SKILL.md'))).toBe(true)
    expect(fs.existsSync(path.join(homeDir, 'vendor', 'skills', 'init-project', 'agents', 'openai.yaml'))).toBe(true)
  })
})
