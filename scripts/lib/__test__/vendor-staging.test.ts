import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanupEmptyVendorSkillDirectories, rebuildVendorAssets } from '../vendor-staging.js'

const temporaryRoots: string[] = []

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true })
  }
})

function createFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'airules-vendor-staging-'))
  temporaryRoots.push(root)
  const homeDir = path.join(root, 'home')
  fs.mkdirSync(path.join(homeDir, 'vendor', 'repos'), { recursive: true })
  return { root, homeDir }
}

function writeFile(filePath: string, contents: string) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, contents)
}

function writeManifest(root: string, name: string, vendors: unknown[]) {
  const manifestPath = path.join(root, `${name}.mjs`)
  writeFile(manifestPath, `export const vendors = ${JSON.stringify(vendors, null, 2)}\n`)
  return manifestPath
}

function vendorDefinition(name: string, projections: unknown[]) {
  return {
    name,
    official: false,
    source: `https://example.test/${name}.git`,
    projections,
  }
}

function repoPath(homeDir: string, vendor: string, ...parts: string[]) {
  return path.join(homeDir, 'vendor', 'repos', vendor, ...parts)
}

function validMcp(command = 'demo') {
  return `${JSON.stringify({ mcpServers: { demo: { command } } })}\n`
}

function validAgent(name: string) {
  return `---\nname: ${name}\n---\n${name} body\n`
}

function writeRoleContract(homeDir: string, vendor: string, role: string): void {
  const manifest = repoPath(homeDir, vendor, 'roles', role, 'role.yaml')
  if (!fs.existsSync(manifest)) {
    writeFile(manifest, `role_id: ${role}\ncanonical_root: roles/${role}\n`)
  }
  writeFile(repoPath(homeDir, vendor, 'roles', role, 'constants', 'skills.ts'), 'export const vendors = []\n')
}

describe('rebuildVendorAssets', () => {
  it('accepts a home path whose ancestor resolves through a filesystem alias', async () => {
    const { root } = createFixture()
    const actualRoot = path.join(root, 'private', 'var')
    const aliasRoot = path.join(root, 'var')
    const homeDir = path.join(aliasRoot, 'home')
    fs.mkdirSync(actualRoot, { recursive: true })
    fs.symlinkSync(actualRoot, aliasRoot, process.platform === 'win32' ? 'junction' : 'dir')
    writeFile(repoPath(homeDir, 'remote', 'skills', 'shared', 'SKILL.md'), '# remote\n')
    const manifestPath = writeManifest(root, 'aliased-home', [
      vendorDefinition('remote', [{ kind: 'skills', sourceBaseDir: 'skills', skills: ['shared'] }]),
    ])

    const inventory = await rebuildVendorAssets({ homeDir, role: 'alpha', manifestPath })

    expect(inventory.skills).toEqual(['shared'])
    expect(fs.readFileSync(path.join(homeDir, 'vendor', 'skills', 'shared', 'SKILL.md'), 'utf8')).toBe('# remote\n')
  })

  it('ignores legacy local skills and stages only configured remote skills', async () => {
    const { root, homeDir } = createFixture()
    writeFile(repoPath(homeDir, 'remote', 'skills', 'shared', 'SKILL.md'), '# remote\n')
    writeFile(path.join(homeDir, 'local', 'skills', 'shared', 'SKILL.md'), '# local\n')
    writeFile(path.join(homeDir, 'local', 'skills', 'local-only', 'SKILL.md'), '# local only\n')
    const manifestPath = writeManifest(root, 'local-overlay', [
      vendorDefinition('remote', [{ kind: 'skills', sourceBaseDir: 'skills', skills: ['shared'] }]),
    ])

    const inventory = await rebuildVendorAssets({ homeDir, role: 'alpha', manifestPath })

    expect(inventory.skills).toEqual(['shared'])
    expect(fs.readFileSync(path.join(homeDir, 'vendor', 'skills', 'shared', 'SKILL.md'), 'utf8')).toBe('# remote\n')
    expect(fs.existsSync(path.join(homeDir, 'vendor', 'skills', 'local-only'))).toBe(false)
  })

  it('generates and manages the shared MCP projection from a catalog', async () => {
    const { root, homeDir } = createFixture()
    const catalogPath = repoPath(homeDir, 'remote', 'mcps', 'code', 'mcps.json')
    writeFile(catalogPath, `${JSON.stringify({
      mcps: {
        codegraph: {
          mcp: { command: 'codegraph', args: ['serve', '--mcp'] },
          setup: [{ command: 'node', args: ['--version'] }],
          description: 'ignored in generated host configuration',
        },
        context7: {
          mcp: { command: 'npx', args: ['-y', '@upstash/context7-mcp@latest'] },
          setup: [],
        },
      },
    })}\n`)
    writeFile(path.join(homeDir, 'vendor', 'mcps', 'stale', 'mcp.json'), validMcp('stale'))
    const manifestPath = writeManifest(root, 'mcp-catalog', [
      vendorDefinition('remote', [{
        kind: 'mcp',
        sourceFile: 'mcps/code/mcps.json',
        output: 'mcps/code/mcp.json',
      }]),
    ])

    await rebuildVendorAssets({ homeDir, role: 'alpha', manifestPath })

    expect(JSON.parse(fs.readFileSync(path.join(homeDir, 'vendor', 'mcps', 'code', 'mcp.json'), 'utf8'))).toEqual({
      mcpServers: {
        codegraph: { command: 'codegraph', args: ['serve', '--mcp'] },
        context7: { command: 'npx', args: ['-y', '@upstash/context7-mcp@latest'] },
      },
    })
    expect(fs.existsSync(path.join(homeDir, 'vendor', 'mcps', 'stale'))).toBe(false)
    expect(fs.readFileSync(catalogPath, 'utf8')).toContain('description')
  })

  it('rejects malformed MCP catalogs before replacing managed output', async () => {
    const { root, homeDir } = createFixture()
    writeFile(path.join(homeDir, 'vendor', 'mcps', 'stable', 'mcp.json'), validMcp('stable'))
    writeFile(repoPath(homeDir, 'remote', 'mcps.json'), '{"mcps":{"broken":{"setup":[]}}}\n')
    const manifestPath = writeManifest(root, 'invalid-mcp-catalog', [
      vendorDefinition('remote', [{ kind: 'mcp', sourceFile: 'mcps.json', output: 'mcps/code/mcp.json' }]),
    ])

    await expect(rebuildVendorAssets({ homeDir, role: 'alpha', manifestPath })).rejects.toMatchObject({
      message: 'Failed to materialize vendor staging',
      cause: expect.objectContaining({
        message: expect.stringMatching(/entry.*mcp.*object/i),
      }),
    })

    expect(JSON.parse(fs.readFileSync(path.join(homeDir, 'vendor', 'mcps', 'stable', 'mcp.json'), 'utf8'))).toHaveProperty('mcpServers.demo.command', 'stable')
  })

  it('rejects duplicate server names across shared MCP catalogs', async () => {
    const { root, homeDir } = createFixture()
    writeFile(path.join(homeDir, 'vendor', 'mcps', 'stable', 'mcp.json'), validMcp('stable'))
    for (const vendor of ['one', 'two']) {
      writeFile(repoPath(homeDir, vendor, 'mcps.json'), JSON.stringify({
        mcps: { shared: { mcp: { command: vendor } } },
      }))
    }
    const manifestPath = writeManifest(root, 'duplicate-mcp-server', [
      vendorDefinition('one', [{ kind: 'mcp', sourceFile: 'mcps.json', output: 'mcps/one/mcp.json' }]),
      vendorDefinition('two', [{ kind: 'mcp', sourceFile: 'mcps.json', output: 'mcps/two/mcp.json' }]),
    ])

    await expect(rebuildVendorAssets({ homeDir, role: 'alpha', manifestPath })).rejects.toMatchObject({
      message: 'Failed to materialize vendor staging',
      cause: expect.objectContaining({
        message: expect.stringMatching(/shared MCP server "shared".*one.*two/i),
      }),
    })

    expect(JSON.parse(fs.readFileSync(path.join(homeDir, 'vendor', 'mcps', 'stable', 'mcp.json'), 'utf8'))).toHaveProperty('mcpServers.demo.command', 'stable')
  })

  it('rejects prototype-sensitive MCP server names', async () => {
    const { root, homeDir } = createFixture()
    writeFile(
      repoPath(homeDir, 'remote', 'mcps.json'),
      '{"mcps":{"__proto__":{"mcp":{"command":"unsafe"}}}}\n',
    )
    const manifestPath = writeManifest(root, 'reserved-mcp-name', [
      vendorDefinition('remote', [{ kind: 'mcp', sourceFile: 'mcps.json', output: 'mcps/code/mcp.json' }]),
    ])

    await expect(rebuildVendorAssets({ homeDir, role: 'alpha', manifestPath })).rejects.toMatchObject({
      cause: expect.objectContaining({
        message: expect.stringMatching(/server name is reserved.*__proto__/i),
      }),
    })
  })

  it('copies every distributable asset from only the selected moluoxixi role', async () => {
    const { root, homeDir } = createFixture()
    writeFile(repoPath(homeDir, 'moluoxixi', 'roles', 'alpha', 'skills', 'workflow', 'alpha-skill', 'SKILL.md'), '# alpha\n')
    writeFile(repoPath(homeDir, 'moluoxixi', 'roles', 'alpha', 'skills', 'workflow', 'alpha-skill', 'scripts', 'run.mjs'), 'export {}\n')
    writeFile(repoPath(homeDir, 'moluoxixi', 'roles', 'alpha', 'agents', 'alpha-agent.md'), validAgent('alpha-agent'))
    writeFile(repoPath(homeDir, 'moluoxixi', 'roles', 'alpha', 'rules', 'AGENTS.md'), '# alpha rules\n')
    writeFile(repoPath(homeDir, 'moluoxixi', 'roles', 'alpha', 'hooks', 'alpha-stop.mjs'), 'export default {}\n')
    writeFile(repoPath(homeDir, 'moluoxixi', 'roles', 'alpha', 'mcp', 'mcp.json'), validMcp('alpha'))
    writeFile(repoPath(homeDir, 'moluoxixi', 'roles', 'alpha', 'constants', 'skills.ts'), 'must not copy\n')
    writeFile(repoPath(homeDir, 'moluoxixi', 'roles', 'alpha', 'role.yaml'), 'role_id: alpha\n')
    writeFile(repoPath(homeDir, 'moluoxixi', 'roles', 'alpha', 'workflow', 'dag.yaml'), 'workflow_id: alpha\n')
    writeFile(repoPath(homeDir, 'moluoxixi', 'roles', 'alpha', 'schemas', 'task.schema.json'), '{}\n')
    writeFile(repoPath(homeDir, 'moluoxixi', 'roles', 'alpha', 'templates', 'project-root', '.airules', '.gitignore'), 'runtime/\n')
    writeFile(repoPath(homeDir, 'moluoxixi', 'roles', 'alpha', 'adapters', 'codex', 'adapter.yaml'), 'adapter_id: codex\n')
    writeFile(repoPath(homeDir, 'moluoxixi', 'roles', 'alpha', '__test__', 'role.test.ts'), 'export {}\n')
    writeFile(repoPath(homeDir, 'moluoxixi', 'roles', 'alpha', 'future', 'asset.txt'), 'future\n')
    writeFile(repoPath(homeDir, 'moluoxixi', 'roles', 'beta', 'skills', 'beta-skill', 'SKILL.md'), '# beta\n')
    writeFile(path.join(homeDir, 'roles', 'alpha', 'obsolete.txt'), 'obsolete\n')
    writeFile(path.join(homeDir, 'roles', 'beta', 'sentinel.txt'), 'preserve\n')

    const manifestPath = writeManifest(root, 'moluoxixi-alpha', [
      vendorDefinition('moluoxixi', [
        { kind: 'role-assets', sourceDir: 'roles/alpha' },
      ]),
    ])

    const inventory = await rebuildVendorAssets({ homeDir, role: 'alpha', manifestPath })

    expect(inventory.skills).toEqual(['alpha-skill'])
    expect(inventory.roleRoot).toBe(path.join(homeDir, 'roles', 'alpha'))
    expect(fs.existsSync(path.join(homeDir, 'vendor', 'skills', 'alpha-skill', 'SKILL.md'))).toBe(true)
    expect(fs.existsSync(path.join(homeDir, 'vendor', 'skills', 'alpha-skill', 'scripts', 'run.mjs'))).toBe(true)
    expect(fs.existsSync(path.join(homeDir, 'vendor', 'agents', 'alpha-agent.md'))).toBe(false)
    expect(fs.existsSync(path.join(homeDir, 'vendor', 'AGENTS.md'))).toBe(false)
    expect(fs.existsSync(path.join(homeDir, 'vendor', 'hooks', 'alpha-stop.mjs'))).toBe(false)
    expect(fs.existsSync(path.join(homeDir, 'vendor', 'mcp', 'mcp.json'))).toBe(false)
    expect(fs.existsSync(path.join(homeDir, 'roles', 'alpha', 'agents', 'alpha-agent.md'))).toBe(true)
    expect(fs.existsSync(path.join(homeDir, 'vendor', 'skills', 'beta-skill'))).toBe(false)
    expect(fs.existsSync(path.join(homeDir, 'vendor', 'constants'))).toBe(false)
    expect(fs.readFileSync(path.join(homeDir, 'roles', 'alpha', 'constants', 'skills.ts'), 'utf8')).toBe('must not copy\n')
    expect(fs.readFileSync(path.join(homeDir, 'roles', 'alpha', 'role.yaml'), 'utf8')).toBe('role_id: alpha\n')
    expect(fs.readFileSync(path.join(homeDir, 'roles', 'alpha', 'workflow', 'dag.yaml'), 'utf8')).toBe('workflow_id: alpha\n')
    expect(fs.readFileSync(path.join(homeDir, 'roles', 'alpha', 'future', 'asset.txt'), 'utf8')).toBe('future\n')
    expect(fs.existsSync(path.join(homeDir, 'roles', 'alpha', 'obsolete.txt'))).toBe(false)
    expect(fs.readFileSync(path.join(homeDir, 'roles', 'beta', 'sentinel.txt'), 'utf8')).toBe('preserve\n')
  })

  it('maps repository-native asset roots declared by the canonical role manifest', async () => {
    const { root, homeDir } = createFixture()
    const roleRoot = repoPath(homeDir, 'canonical-source', 'roles', 'alpha')
    writeFile(path.join(roleRoot, '.native', 'skills', 'native-skill', 'SKILL.md'), '# native skill\n')
    writeFile(path.join(roleRoot, '.native', 'agents', 'native-agent.md'), validAgent('native-agent'))
    writeFile(path.join(roleRoot, 'AGENTS.md'), '# native rules\n')
    writeFile(path.join(roleRoot, 'constants', 'skills.ts'), 'export const vendors = []\n')
    writeFile(path.join(roleRoot, 'role.yaml'), [
      'role_id: alpha',
      'assets:',
      '  skills: .native/skills',
      '  agents: .native/agents',
      '  rules: .',
      '',
    ].join('\n'))
    const manifestPath = writeManifest(root, 'native-role-assets', [
      vendorDefinition('canonical-source', [{ kind: 'role-assets', sourceDir: 'roles/alpha' }]),
    ])

    const inventory = await rebuildVendorAssets({ homeDir, role: 'alpha', manifestPath })

    expect(inventory.skills).toEqual(['native-skill'])
    expect(fs.readFileSync(path.join(homeDir, 'vendor', 'skills', 'native-skill', 'SKILL.md'), 'utf8')).toBe('# native skill\n')
    expect(fs.existsSync(path.join(homeDir, 'vendor', 'agents', 'native-agent.md'))).toBe(false)
    expect(fs.existsSync(path.join(homeDir, 'vendor', 'AGENTS.md'))).toBe(false)
    expect(fs.existsSync(path.join(homeDir, 'roles', 'alpha', '.native', 'skills', 'native-skill'))).toBe(true)
  })

  it('treats managed target names as case-insensitive', async () => {
    const { root, homeDir } = createFixture()
    writeFile(repoPath(homeDir, 'one', 'skills', 'Review', 'SKILL.md'), '# one\n')
    writeFile(repoPath(homeDir, 'two', 'skills', 'review', 'SKILL.md'), '# two\n')
    const manifestPath = writeManifest(root, 'case-collision', [
      vendorDefinition('one', [{ kind: 'skills', sourceBaseDir: 'skills', skills: ['Review'] }]),
      vendorDefinition('two', [{ kind: 'skills', sourceBaseDir: 'skills', skills: ['review'] }]),
    ])

    await expect(rebuildVendorAssets({ homeDir, role: 'alpha', manifestPath })).rejects.toThrow(/target conflict.*review/i)
  })

  it('rejects a recursive source symlink that escapes its vendor checkout', async () => {
    const { root, homeDir } = createFixture()
    const skillDir = repoPath(homeDir, 'remote', 'skills', 'escaped')
    const outsideDir = path.join(root, 'outside-assets')
    writeFile(path.join(skillDir, 'SKILL.md'), '# escaped\n')
    writeFile(path.join(outsideDir, 'secret.txt'), 'secret\n')
    fs.symlinkSync(outsideDir, path.join(skillDir, 'assets'), process.platform === 'win32' ? 'junction' : 'dir')
    const manifestPath = writeManifest(root, 'symlink-escape', [
      vendorDefinition('remote', [{ kind: 'skills', sourceBaseDir: 'skills', skills: ['escaped'] }]),
    ])

    await expect(rebuildVendorAssets({ homeDir, role: 'alpha', manifestPath })).rejects.toThrow(/source.*outside.*checkout|symlink.*escape/i)
    expect(fs.existsSync(path.join(homeDir, 'vendor', 'skills', 'escaped'))).toBe(false)
  })

  it('rejects skill source paths outside their checkout', async () => {
    const { root, homeDir } = createFixture()
    writeFile(repoPath(homeDir, 'outside-skill', 'SKILL.md'), '# outside\n')
    const sourceEscapeManifest = writeManifest(root, 'source-escape', [
      vendorDefinition('remote', [{ kind: 'skills', sourceBaseDir: '..', skills: ['outside-skill'] }]),
    ])
    await expect(rebuildVendorAssets({ homeDir, role: 'alpha', manifestPath: sourceEscapeManifest })).rejects.toThrow(/source.*outside.*checkout/i)
  })

  it('requires the unique role-assets source to match the selected role exactly', async () => {
    const { root, homeDir } = createFixture()
    fs.mkdirSync(repoPath(homeDir, 'moluoxixi', 'roles', 'beta'), { recursive: true })
    const manifestPath = writeManifest(root, 'wrong-role', [
      vendorDefinition('moluoxixi', [{ kind: 'role-assets', sourceDir: 'roles/beta' }]),
    ])

    await expect(rebuildVendorAssets({ homeDir, role: 'alpha', manifestPath })).rejects.toThrow(/moluoxixi.*roles\/alpha/i)
  })

  it('accepts one canonical role source from an arbitrary vendor', async () => {
    const { root, homeDir } = createFixture()
    writeFile(repoPath(homeDir, 'canonical-source', 'roles', 'alpha', 'role.yaml'), 'role_id: alpha\n')
    writeFile(repoPath(homeDir, 'canonical-source', 'roles', 'alpha', 'rules', 'AGENTS.md'), '# alpha\n')
    writeRoleContract(homeDir, 'canonical-source', 'alpha')
    const manifestPath = writeManifest(root, 'generic-role-owner', [
      vendorDefinition('canonical-source', [{ kind: 'role-assets', sourceDir: 'roles/alpha' }]),
    ])

    const inventory = await rebuildVendorAssets({ homeDir, role: 'alpha', manifestPath })

    expect(inventory.roleRoot).toBe(path.join(homeDir, 'roles', 'alpha'))
    expect(fs.readFileSync(path.join(homeDir, 'roles', 'alpha', 'role.yaml'), 'utf8')).toBe('role_id: alpha\n')
    expect(fs.existsSync(path.join(homeDir, 'vendor', 'AGENTS.md'))).toBe(false)
    expect(fs.readFileSync(path.join(homeDir, 'roles', 'alpha', 'rules', 'AGENTS.md'), 'utf8')).toBe('# alpha\n')
  })

  it('requires the canonical role manifest and bootstrap constants', async () => {
    const missingManifest = createFixture()
    writeFile(
      repoPath(missingManifest.homeDir, 'canonical-source', 'roles', 'alpha', 'constants', 'skills.ts'),
      'export const vendors = []\n',
    )
    const missingManifestPath = writeManifest(missingManifest.root, 'missing-role-manifest', [
      vendorDefinition('canonical-source', [{ kind: 'role-assets', sourceDir: 'roles/alpha' }]),
    ])
    await expect(rebuildVendorAssets({
      homeDir: missingManifest.homeDir,
      role: 'alpha',
      manifestPath: missingManifestPath,
    })).rejects.toThrow(/role manifest.*plain file/i)

    const missingConstants = createFixture()
    writeFile(
      repoPath(missingConstants.homeDir, 'canonical-source', 'roles', 'alpha', 'role.yaml'),
      'role_id: alpha\n',
    )
    const missingConstantsPath = writeManifest(missingConstants.root, 'missing-role-constants', [
      vendorDefinition('canonical-source', [{ kind: 'role-assets', sourceDir: 'roles/alpha' }]),
    ])
    await expect(rebuildVendorAssets({
      homeDir: missingConstants.homeDir,
      role: 'alpha',
      manifestPath: missingConstantsPath,
    })).rejects.toThrow(/role constants.*plain file/i)
  })

  it.each([
    ['a mismatched role id', 'role_id: beta\n', /role_id must equal selected role/i],
    ['a mismatched canonical root', 'role_id: alpha\ncanonical_root: roles/beta\n', /canonical_root must equal roles\/alpha/i],
    ['duplicate manifest keys', 'role_id: alpha\nrole_id: alpha\n', /role\.yaml is invalid/i],
    ['a non-object assets field', 'role_id: alpha\nassets: []\n', /assets must be an object/i],
    ['a null native asset root', 'role_id: alpha\nassets:\n  skills: null\n', /asset root "skills" must be a non-empty relative path/i],
    ['an escaping native asset root', 'role_id: alpha\nassets:\n  skills: ..\\outside\n', /asset root "skills" must stay inside/i],
  ])('rejects %s', async (_name, manifestContents, expected) => {
    const { root, homeDir } = createFixture()
    writeFile(
      repoPath(homeDir, 'canonical-source', 'roles', 'alpha', 'role.yaml'),
      manifestContents as string,
    )
    writeFile(
      repoPath(homeDir, 'canonical-source', 'roles', 'alpha', 'constants', 'skills.ts'),
      'export const vendors = []\n',
    )
    const manifestPath = writeManifest(root, 'invalid-role-contract', [
      vendorDefinition('canonical-source', [{ kind: 'role-assets', sourceDir: 'roles/alpha' }]),
    ])

    await expect(
      rebuildVendorAssets({ homeDir, role: 'alpha', manifestPath }),
    ).rejects.toThrow(expected as RegExp)
  })

  it('rejects a role constants directory in place of the bootstrap file', async () => {
    const { root, homeDir } = createFixture()
    writeFile(repoPath(homeDir, 'canonical-source', 'roles', 'alpha', 'role.yaml'), 'role_id: alpha\n')
    fs.mkdirSync(repoPath(homeDir, 'canonical-source', 'roles', 'alpha', 'constants', 'skills.ts'), {
      recursive: true,
    })
    const manifestPath = writeManifest(root, 'directory-role-constants', [
      vendorDefinition('canonical-source', [{ kind: 'role-assets', sourceDir: 'roles/alpha' }]),
    ])

    await expect(
      rebuildVendorAssets({ homeDir, role: 'alpha', manifestPath }),
    ).rejects.toThrow(/role constants.*plain file/i)
  })

  it('rejects project instance state embedded in a canonical role or project template', async () => {
    const { root, homeDir } = createFixture()
    writeRoleContract(homeDir, 'canonical-source', 'alpha')
    writeFile(
      repoPath(
        homeDir,
        'canonical-source',
        'roles',
        'alpha',
        'templates',
        'project-root',
        '.airules',
        'state',
        'snapshot.json',
      ),
      '{}\n',
    )
    const manifestPath = writeManifest(root, 'role-with-project-state', [
      vendorDefinition('canonical-source', [{ kind: 'role-assets', sourceDir: 'roles/alpha' }]),
    ])

    await expect(
      rebuildVendorAssets({ homeDir, role: 'alpha', manifestPath }),
    ).rejects.toThrow(/forbidden project instance state.*\.airules\/state/i)
    expect(fs.existsSync(path.join(homeDir, 'roles', 'alpha'))).toBe(false)
  })

  it('rejects multiple canonical role sources', async () => {
    const { root, homeDir } = createFixture()
    const manifestPath = writeManifest(root, 'duplicate-role-owners', [
      vendorDefinition('one', [{ kind: 'role-assets', sourceDir: 'roles/alpha' }]),
      vendorDefinition('two', [{ kind: 'role-assets', sourceDir: 'roles/alpha' }]),
    ])

    await expect(rebuildVendorAssets({ homeDir, role: 'alpha', manifestPath })).rejects.toThrow(/at most one canonical role-assets/i)
  })

  it('rejects links from the selected role into a sibling role', async () => {
    const { root, homeDir } = createFixture()
    const alphaRoot = repoPath(homeDir, 'canonical-source', 'roles', 'alpha')
    const betaRoot = repoPath(homeDir, 'canonical-source', 'roles', 'beta')
    writeFile(path.join(alphaRoot, 'role.yaml'), 'role_id: alpha\n')
    writeFile(path.join(betaRoot, 'secret.txt'), 'beta-only\n')
    fs.symlinkSync(betaRoot, path.join(alphaRoot, 'linked-beta'), process.platform === 'win32' ? 'junction' : 'dir')
    const manifestPath = writeManifest(root, 'linked-sibling-role', [
      vendorDefinition('canonical-source', [{ kind: 'role-assets', sourceDir: 'roles/alpha' }]),
    ])

    await expect(rebuildVendorAssets({ homeDir, role: 'alpha', manifestPath })).rejects.toThrow(/role source.*symbolic link/i)
    expect(fs.existsSync(path.join(homeDir, 'roles', 'alpha'))).toBe(false)
  })

  it('rejects a linked ancestor in the selected role source path', async () => {
    const { root, homeDir } = createFixture()
    const checkoutRoot = repoPath(homeDir, 'canonical-source')
    const actualRoles = path.join(checkoutRoot, 'actual-roles')
    writeFile(path.join(actualRoles, 'alpha', 'role.yaml'), 'role_id: alpha\n')
    fs.symlinkSync(actualRoles, path.join(checkoutRoot, 'roles'), process.platform === 'win32' ? 'junction' : 'dir')
    const manifestPath = writeManifest(root, 'linked-role-source-ancestor', [
      vendorDefinition('canonical-source', [{ kind: 'role-assets', sourceDir: 'roles/alpha' }]),
    ])

    await expect(rebuildVendorAssets({ homeDir, role: 'alpha', manifestPath })).rejects.toThrow(/selected role source path.*symbolic link/i)
    expect(fs.existsSync(path.join(homeDir, 'roles', 'alpha'))).toBe(false)
  })

  it('rejects a linked selected role source root', async () => {
    const { root, homeDir } = createFixture()
    const rolesRoot = repoPath(homeDir, 'canonical-source', 'roles')
    const betaRoot = path.join(rolesRoot, 'beta')
    writeFile(path.join(betaRoot, 'role.yaml'), 'role_id: beta\n')
    fs.symlinkSync(betaRoot, path.join(rolesRoot, 'alpha'), process.platform === 'win32' ? 'junction' : 'dir')
    const manifestPath = writeManifest(root, 'linked-role-source-root', [
      vendorDefinition('canonical-source', [{ kind: 'role-assets', sourceDir: 'roles/alpha' }]),
    ])

    await expect(rebuildVendorAssets({ homeDir, role: 'alpha', manifestPath })).rejects.toThrow(/selected role source path.*symbolic link/i)
    expect(fs.existsSync(path.join(homeDir, 'roles', 'alpha'))).toBe(false)
  })

  it('keeps previous managed entries and repositories when skill validation fails', async () => {
    const { root, homeDir } = createFixture()
    writeFile(path.join(homeDir, 'vendor', 'skills', 'stable', 'SKILL.md'), '# stable\n')
    writeFile(path.join(homeDir, 'vendor', 'agents', 'stable.md'), validAgent('stable'))
    writeFile(path.join(homeDir, 'vendor', 'AGENTS.md'), '# stable rules\n')
    writeFile(path.join(homeDir, 'vendor', 'hooks', 'stable.mjs'), 'export default {}\n')
    writeFile(path.join(homeDir, 'vendor', 'mcp', 'mcp.json'), validMcp('stable'))
    writeFile(repoPath(homeDir, 'broken', '.git', 'keep'), 'repository marker\n')
    const manifestPath = writeManifest(root, 'missing-source', [
      vendorDefinition('broken', [{ kind: 'skills', sourceBaseDir: 'skills', skills: ['missing'] }]),
    ])

    await expect(rebuildVendorAssets({ homeDir, role: 'alpha', manifestPath })).rejects.toThrow(/missing configured source/i)

    expect(fs.readFileSync(path.join(homeDir, 'vendor', 'skills', 'stable', 'SKILL.md'), 'utf8')).toBe('# stable\n')
    expect(fs.readFileSync(path.join(homeDir, 'vendor', 'agents', 'stable.md'), 'utf8')).toContain('name: stable')
    expect(fs.readFileSync(path.join(homeDir, 'vendor', 'AGENTS.md'), 'utf8')).toBe('# stable rules\n')
    expect(fs.readFileSync(path.join(homeDir, 'vendor', 'hooks', 'stable.mjs'), 'utf8')).toBe('export default {}\n')
    expect(JSON.parse(fs.readFileSync(path.join(homeDir, 'vendor', 'mcp', 'mcp.json'), 'utf8'))).toHaveProperty('mcpServers.demo.command', 'stable')
    expect(fs.readFileSync(repoPath(homeDir, 'broken', '.git', 'keep'), 'utf8')).toBe('repository marker\n')
  })

  it('mirrors managed skills without replacing the watched skills root', async () => {
    const { root, homeDir } = createFixture()
    const skillsRoot = path.join(homeDir, 'vendor', 'skills')
    writeFile(path.join(skillsRoot, 'alpha', 'SKILL.md'), '# old alpha\n')
    writeFile(path.join(skillsRoot, 'alpha', 'assets', 'old.txt'), 'old asset\n')
    writeFile(path.join(skillsRoot, 'stale', 'SKILL.md'), '# stale\n')
    writeFile(repoPath(homeDir, 'remote', 'skills', 'alpha', 'SKILL.md'), '# new alpha\n')
    writeFile(repoPath(homeDir, 'remote', 'skills', 'alpha', 'assets', 'new.txt'), 'new asset\n')
    writeFile(repoPath(homeDir, 'remote', 'skills', 'fresh', 'SKILL.md'), '# fresh\n')
    const manifestPath = writeManifest(root, 'in-place-skills', [
      vendorDefinition('remote', [{ kind: 'skills', sourceBaseDir: 'skills', skills: ['alpha', 'fresh'] }]),
    ])
    const rootInode = fs.statSync(skillsRoot).ino
    const alphaRoot = path.join(skillsRoot, 'alpha')
    const assetsRoot = path.join(alphaRoot, 'assets')
    const alphaInode = fs.statSync(alphaRoot).ino
    const assetsInode = fs.statSync(assetsRoot).ino
    const watchedRoots = new Set([skillsRoot, alphaRoot, assetsRoot].map(root => path.resolve(root)))
    const renameSync = fs.renameSync.bind(fs)
    const renamedPaths: string[] = []
    const renameSpy = vi.spyOn(fs, 'renameSync').mockImplementation((source, destination) => {
      const resolvedSource = path.resolve(String(source))
      const resolvedDestination = path.resolve(String(destination))
      renamedPaths.push(resolvedSource, resolvedDestination)
      if (watchedRoots.has(resolvedSource) || watchedRoots.has(resolvedDestination)) {
        throw Object.assign(new Error('simulated watched directory lock'), { code: 'EPERM' })
      }
      renameSync(source, destination)
    })

    try {
      await rebuildVendorAssets({ homeDir, role: 'alpha', manifestPath })
    }
    finally {
      renameSpy.mockRestore()
    }

    expect(fs.statSync(skillsRoot).ino).toBe(rootInode)
    expect(fs.statSync(alphaRoot).ino).toBe(alphaInode)
    expect(fs.statSync(assetsRoot).ino).toBe(assetsInode)
    expect(renamedPaths).not.toContain(path.resolve(skillsRoot))
    expect(renamedPaths).not.toContain(path.resolve(alphaRoot))
    expect(renamedPaths).not.toContain(path.resolve(assetsRoot))
    expect(fs.readFileSync(path.join(skillsRoot, 'alpha', 'SKILL.md'), 'utf8')).toBe('# new alpha\n')
    expect(fs.existsSync(path.join(assetsRoot, 'old.txt'))).toBe(false)
    expect(fs.readFileSync(path.join(assetsRoot, 'new.txt'), 'utf8')).toBe('new asset\n')
    expect(fs.readFileSync(path.join(skillsRoot, 'fresh', 'SKILL.md'), 'utf8')).toBe('# fresh\n')
    expect(fs.existsSync(path.join(skillsRoot, 'stale'))).toBe(false)
  })

  it('restores every managed skill when an in-place mirror fails partway through', async () => {
    const { root, homeDir } = createFixture()
    const skillsRoot = path.join(homeDir, 'vendor', 'skills')
    writeFile(path.join(skillsRoot, 'alpha', 'SKILL.md'), '# old alpha\n')
    writeFile(path.join(skillsRoot, 'stale', 'SKILL.md'), '# stale\n')
    writeFile(repoPath(homeDir, 'remote', 'skills', 'alpha', 'SKILL.md'), '# new alpha\n')
    writeFile(repoPath(homeDir, 'remote', 'skills', 'z-fresh', 'SKILL.md'), '# fresh\n')
    const manifestPath = writeManifest(root, 'in-place-skills-rollback', [
      vendorDefinition('remote', [{ kind: 'skills', sourceBaseDir: 'skills', skills: ['alpha', 'z-fresh'] }]),
    ])
    const rootInode = fs.statSync(skillsRoot).ino
    const renameSync = fs.renameSync.bind(fs)
    const renameSpy = vi.spyOn(fs, 'renameSync').mockImplementation((source, destination) => {
      if (String(source).includes(`${path.sep}.airules-vendor-next-`)
        && String(source).endsWith(path.join('vendor', 'skills', 'z-fresh'))) {
        throw new Error('simulated skills install failure')
      }
      renameSync(source, destination)
    })

    try {
      await expect(rebuildVendorAssets({ homeDir, role: 'alpha', manifestPath })).rejects.toThrow(/simulated skills install failure/i)
    }
    finally {
      renameSpy.mockRestore()
    }

    expect(fs.statSync(skillsRoot).ino).toBe(rootInode)
    expect(fs.readFileSync(path.join(skillsRoot, 'alpha', 'SKILL.md'), 'utf8')).toBe('# old alpha\n')
    expect(fs.readFileSync(path.join(skillsRoot, 'stale', 'SKILL.md'), 'utf8')).toBe('# stale\n')
    expect(fs.existsSync(path.join(skillsRoot, 'z-fresh'))).toBe(false)
  })

  it('removes empty vendor skill directories after stale host links are projected away', () => {
    const { homeDir } = createFixture()
    const skillsRoot = path.join(homeDir, 'vendor', 'skills')
    fs.mkdirSync(path.join(skillsRoot, 'stale'), { recursive: true })
    writeFile(path.join(skillsRoot, 'active', 'SKILL.md'), '# active\n')

    cleanupEmptyVendorSkillDirectories(homeDir)

    expect(fs.existsSync(path.join(skillsRoot, 'stale'))).toBe(false)
    expect(fs.readFileSync(path.join(skillsRoot, 'active', 'SKILL.md'), 'utf8')).toBe('# active\n')
  })

  it('rejects a linked roles root without writing through it', async () => {
    const { root, homeDir } = createFixture()
    const outside = path.join(root, 'outside-roles')
    writeFile(path.join(outside, 'sentinel.txt'), 'outside\n')
    fs.symlinkSync(outside, path.join(homeDir, 'roles'), process.platform === 'win32' ? 'junction' : 'dir')
    writeFile(repoPath(homeDir, 'moluoxixi', 'roles', 'alpha', 'role.yaml'), 'role_id: alpha\n')
    writeRoleContract(homeDir, 'moluoxixi', 'alpha')
    const manifestPath = writeManifest(root, 'linked-roles-root', [
      vendorDefinition('moluoxixi', [{ kind: 'role-assets', sourceDir: 'roles/alpha' }]),
    ])

    await expect(rebuildVendorAssets({ homeDir, role: 'alpha', manifestPath })).rejects.toThrow(/roles root.*invalid type/i)
    expect(fs.readFileSync(path.join(outside, 'sentinel.txt'), 'utf8')).toBe('outside\n')
    expect(fs.existsSync(path.join(outside, 'alpha'))).toBe(false)
  })

  it('rejects a linked installed role root without writing through it', async () => {
    const { root, homeDir } = createFixture()
    const outside = path.join(root, 'outside-role')
    writeFile(path.join(outside, 'sentinel.txt'), 'outside\n')
    fs.mkdirSync(path.join(homeDir, 'roles'), { recursive: true })
    fs.symlinkSync(outside, path.join(homeDir, 'roles', 'alpha'), process.platform === 'win32' ? 'junction' : 'dir')
    writeFile(repoPath(homeDir, 'moluoxixi', 'roles', 'alpha', 'role.yaml'), 'role_id: alpha\n')
    writeRoleContract(homeDir, 'moluoxixi', 'alpha')
    const manifestPath = writeManifest(root, 'linked-installed-role-root', [
      vendorDefinition('moluoxixi', [{ kind: 'role-assets', sourceDir: 'roles/alpha' }]),
    ])

    await expect(rebuildVendorAssets({ homeDir, role: 'alpha', manifestPath })).rejects.toThrow(/installed AIRules role.*invalid type/i)
    expect(fs.readFileSync(path.join(outside, 'sentinel.txt'), 'utf8')).toBe('outside\n')
    expect(fs.existsSync(path.join(outside, 'role.yaml'))).toBe(false)
  })

  it('does not report failure when post-commit workspace cleanup fails', async () => {
    const { root, homeDir } = createFixture()
    writeFile(repoPath(homeDir, 'remote', 'skills', 'fresh', 'SKILL.md'), '# fresh\n')
    const manifestPath = writeManifest(root, 'cleanup-failure', [
      vendorDefinition('remote', [{ kind: 'skills', sourceBaseDir: 'skills', skills: ['fresh'] }]),
    ])
    const rmSync = fs.rmSync.bind(fs)
    const rmSpy = vi.spyOn(fs, 'rmSync').mockImplementation((target, options) => {
      if (String(target).includes(`${path.sep}.airules-vendor-next-`)) {
        throw new Error('simulated post-commit cleanup failure')
      }
      rmSync(target, options)
    })

    try {
      await expect(rebuildVendorAssets({ homeDir, role: 'alpha', manifestPath })).resolves.toMatchObject({
        skills: ['fresh'],
      })
    }
    finally {
      rmSpy.mockRestore()
    }
    expect(fs.readFileSync(path.join(homeDir, 'vendor', 'skills', 'fresh', 'SKILL.md'), 'utf8')).toBe('# fresh\n')
  })

  it('preserves vendor repositories after a successful rebuild', async () => {
    const { root, homeDir } = createFixture()
    writeFile(repoPath(homeDir, 'remote', 'skills', 'demo', 'SKILL.md'), '# demo\n')
    writeFile(repoPath(homeDir, 'remote', '.git', 'keep'), 'repository marker\n')
    const manifestPath = writeManifest(root, 'preserve-repos', [
      vendorDefinition('remote', [{ kind: 'skills', sourceBaseDir: 'skills', skills: ['demo'] }]),
    ])

    await rebuildVendorAssets({ homeDir, role: 'alpha', manifestPath })

    expect(fs.readFileSync(repoPath(homeDir, 'remote', '.git', 'keep'), 'utf8')).toBe('repository marker\n')
  })
})
