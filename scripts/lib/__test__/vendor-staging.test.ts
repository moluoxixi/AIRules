import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { rebuildVendorAssets } from '../vendor-staging.js'

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

  it('forwards remote skills, namespace skills, agents, rules, hooks, and mcp as copies', async () => {
    const { root, homeDir } = createFixture()
    writeFile(repoPath(homeDir, 'platform', 'skills', 'core-skill', 'SKILL.md'), '# core\n')
    writeFile(repoPath(homeDir, 'platform', 'skills', 'core-skill', 'assets', 'fixture.txt'), 'complete\n')
    writeFile(repoPath(homeDir, 'platform', 'catalog', 'quality', 'remote-review', 'SKILL.md'), '# review\n')
    writeFile(repoPath(homeDir, 'platform', 'agents', 'reviewer.md'), validAgent('reviewer'))
    writeFile(repoPath(homeDir, 'platform', 'rules', 'AGENTS.md'), '# remote rules\n')
    writeFile(repoPath(homeDir, 'platform', 'hooks', 'stop.mjs'), 'export default {}\n')
    writeFile(repoPath(homeDir, 'platform', 'mcp', 'mcp.json'), validMcp())

    const manifestPath = writeManifest(root, 'all-assets', [
      vendorDefinition('platform', [
        { kind: 'skills', sourceBaseDir: 'skills', skills: ['core-skill'] },
        { kind: 'namespace', sourceDir: 'catalog', output: 'unused-namespace' },
        { kind: 'agents', sourceDir: 'agents' },
        { kind: 'rules', sourceFile: 'rules/AGENTS.md' },
        { kind: 'hooks', sourceDir: 'hooks' },
        { kind: 'mcp', sourceFile: 'mcp/mcp.json' },
      ]),
    ])

    const inventory = await rebuildVendorAssets({ homeDir, role: 'alpha', manifestPath })

    expect(inventory).toEqual({
      role: 'alpha',
      skills: ['core-skill', 'remote-review'],
      agents: ['reviewer.md'],
      rules: path.join(homeDir, 'vendor', 'AGENTS.md'),
      hooks: ['stop.mjs'],
      mcp: path.join(homeDir, 'vendor', 'mcp', 'mcp.json'),
    })
    expect(fs.readFileSync(path.join(homeDir, 'vendor', 'skills', 'core-skill', 'assets', 'fixture.txt'), 'utf8')).toBe('complete\n')
    expect(fs.lstatSync(path.join(homeDir, 'vendor', 'skills', 'core-skill')).isSymbolicLink()).toBe(false)
    expect(fs.readFileSync(path.join(homeDir, 'vendor', 'agents', 'reviewer.md'), 'utf8')).toContain('name: reviewer')
    expect(fs.readFileSync(path.join(homeDir, 'vendor', 'AGENTS.md'), 'utf8')).toBe('# remote rules\n')
    expect(fs.readFileSync(path.join(homeDir, 'vendor', 'hooks', 'stop.mjs'), 'utf8')).toBe('export default {}\n')
    expect(JSON.parse(fs.readFileSync(path.join(homeDir, 'vendor', 'mcp', 'mcp.json'), 'utf8'))).toHaveProperty('mcpServers.demo')
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
    expect(inventory.agents).toEqual(['alpha-agent.md'])
    expect(inventory.hooks).toEqual(['alpha-stop.mjs'])
    expect(inventory.roleRoot).toBe(path.join(homeDir, 'roles', 'alpha'))
    expect(fs.existsSync(path.join(homeDir, 'vendor', 'skills', 'alpha-skill', 'SKILL.md'))).toBe(true)
    expect(fs.existsSync(path.join(homeDir, 'vendor', 'skills', 'alpha-skill', 'scripts', 'run.mjs'))).toBe(true)
    expect(fs.existsSync(path.join(homeDir, 'vendor', 'agents', 'alpha-agent.md'))).toBe(true)
    expect(fs.readFileSync(path.join(homeDir, 'vendor', 'AGENTS.md'), 'utf8')).toContain('alpha rules')
    expect(fs.existsSync(path.join(homeDir, 'vendor', 'hooks', 'alpha-stop.mjs'))).toBe(true)
    expect(fs.existsSync(path.join(homeDir, 'vendor', 'mcp', 'mcp.json'))).toBe(true)
    expect(fs.existsSync(path.join(homeDir, 'vendor', 'skills', 'beta-skill'))).toBe(false)
    expect(fs.existsSync(path.join(homeDir, 'vendor', 'constants'))).toBe(false)
    expect(fs.readFileSync(path.join(homeDir, 'roles', 'alpha', 'constants', 'skills.ts'), 'utf8')).toBe('must not copy\n')
    expect(fs.readFileSync(path.join(homeDir, 'roles', 'alpha', 'role.yaml'), 'utf8')).toBe('role_id: alpha\n')
    expect(fs.readFileSync(path.join(homeDir, 'roles', 'alpha', 'workflow', 'dag.yaml'), 'utf8')).toBe('workflow_id: alpha\n')
    expect(fs.readFileSync(path.join(homeDir, 'roles', 'alpha', 'future', 'asset.txt'), 'utf8')).toBe('future\n')
    expect(fs.existsSync(path.join(homeDir, 'roles', 'alpha', 'obsolete.txt'))).toBe(false)
    expect(fs.readFileSync(path.join(homeDir, 'roles', 'beta', 'sentinel.txt'), 'utf8')).toBe('preserve\n')
  })

  it('rejects an invalid role hook manifest before replacing vendor assets', async () => {
    const { root, homeDir } = createFixture()
    writeFile(path.join(homeDir, 'vendor', 'hooks', 'stable.mjs'), 'export const stable = true\n')
    writeFile(repoPath(homeDir, 'moluoxixi', 'roles', 'alpha', 'hooks', 'hooks.json'), `${JSON.stringify({
      version: 1,
      hooks: [{ event: 'Stop', script: '../escape.mjs' }],
    })}\n`)
    writeRoleContract(homeDir, 'moluoxixi', 'alpha')
    const manifestPath = writeManifest(root, 'invalid-role-hooks', [
      vendorDefinition('moluoxixi', [{ kind: 'role-assets', sourceDir: 'roles/alpha' }]),
    ])

    await expect(rebuildVendorAssets({ homeDir, role: 'alpha', manifestPath })).rejects.toThrow(/safe \.mjs file name/i)
    expect(fs.readFileSync(path.join(homeDir, 'vendor', 'hooks', 'stable.mjs'), 'utf8')).toBe('export const stable = true\n')
  })

  it.each([
    {
      name: 'the same target',
      vendors: [
        vendorDefinition('one', [{ kind: 'rules', sourceFile: 'rules/AGENTS.md' }]),
        vendorDefinition('two', [{ kind: 'rules', sourceFile: 'rules/AGENTS.md' }]),
      ],
      sources: [
        ['one', 'rules', 'AGENTS.md'],
        ['two', 'rules', 'AGENTS.md'],
      ],
    },
    {
      name: 'ancestor and child targets',
      vendors: [
        vendorDefinition('one', [{ kind: 'agents', sourceDir: 'agents', targetDir: 'vendor/agents/review' }]),
        vendorDefinition('two', [{ kind: 'agents', sourceDir: 'agents', targetDir: 'vendor/agents/review', agents: ['reviewer'] }]),
      ],
      sources: [
        ['one', 'agents', 'one.md'],
        ['two', 'agents', 'reviewer.md'],
      ],
    },
  ])('rejects ordinary vendor conflicts for $name before copying', async ({ vendors, sources }) => {
    const { root, homeDir } = createFixture()
    for (const [vendor, directory, file] of sources) {
      writeFile(repoPath(homeDir, vendor, directory, file), directory === 'rules' ? '# rules\n' : validAgent(path.parse(file).name))
    }
    const manifestPath = writeManifest(root, `conflict-${sources[0][0]}`, vendors)

    await expect(rebuildVendorAssets({ homeDir, role: 'alpha', manifestPath })).rejects.toThrow(/ordinary vendor target conflict/i)
    expect(fs.existsSync(path.join(homeDir, 'vendor', 'AGENTS.md'))).toBe(false)
    expect(fs.existsSync(path.join(homeDir, 'vendor', 'agents', 'review'))).toBe(false)
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

  it('applies moluoxixi last while preserving unrelated ordinary vendor assets', async () => {
    const { root, homeDir } = createFixture()
    writeFile(repoPath(homeDir, 'remote', 'skills', 'shared', 'SKILL.md'), '# remote shared\n')
    writeFile(repoPath(homeDir, 'remote', 'skills', 'remote-only', 'SKILL.md'), '# remote only\n')
    writeFile(repoPath(homeDir, 'remote', 'rules', 'AGENTS.md'), '# remote rules\n')
    writeFile(repoPath(homeDir, 'moluoxixi', 'roles', 'alpha', 'skills', 'shared', 'SKILL.md'), '# alpha shared\n')
    writeFile(repoPath(homeDir, 'moluoxixi', 'roles', 'alpha', 'rules', 'AGENTS.md'), '# alpha rules\n')
    writeRoleContract(homeDir, 'moluoxixi', 'alpha')
    const manifestPath = writeManifest(root, 'overlay', [
      vendorDefinition('remote', [
        { kind: 'skills', sourceBaseDir: 'skills', skills: ['shared', 'remote-only'] },
        { kind: 'rules', sourceFile: 'rules/AGENTS.md' },
      ]),
      vendorDefinition('moluoxixi', [{ kind: 'role-assets', sourceDir: 'roles/alpha' }]),
    ])

    const inventory = await rebuildVendorAssets({ homeDir, role: 'alpha', manifestPath })

    expect(inventory.skills).toEqual(['remote-only', 'shared'])
    expect(fs.readFileSync(path.join(homeDir, 'vendor', 'skills', 'shared', 'SKILL.md'), 'utf8')).toBe('# alpha shared\n')
    expect(fs.readFileSync(path.join(homeDir, 'vendor', 'skills', 'remote-only', 'SKILL.md'), 'utf8')).toBe('# remote only\n')
    expect(fs.readFileSync(path.join(homeDir, 'vendor', 'AGENTS.md'), 'utf8')).toBe('# alpha rules\n')
  })

  it('fully replaces all five managed asset classes when switching roles', async () => {
    const { root, homeDir } = createFixture()
    writeFile(repoPath(homeDir, 'moluoxixi', 'roles', 'alpha', 'skills', 'alpha-only', 'SKILL.md'), '# alpha\n')
    writeFile(repoPath(homeDir, 'moluoxixi', 'roles', 'alpha', 'agents', 'alpha-only.md'), validAgent('alpha-only'))
    writeFile(repoPath(homeDir, 'moluoxixi', 'roles', 'alpha', 'rules', 'AGENTS.md'), '# alpha rules\n')
    writeFile(repoPath(homeDir, 'moluoxixi', 'roles', 'alpha', 'hooks', 'alpha-only.mjs'), 'export const role = "alpha"\n')
    writeFile(repoPath(homeDir, 'moluoxixi', 'roles', 'alpha', 'mcp', 'mcp.json'), validMcp('alpha'))
    writeFile(repoPath(homeDir, 'moluoxixi', 'roles', 'beta', 'skills', 'beta-only', 'SKILL.md'), '# beta\n')
    writeFile(repoPath(homeDir, 'moluoxixi', 'roles', 'beta', 'agents', 'beta-only.md'), validAgent('beta-only'))
    writeFile(repoPath(homeDir, 'moluoxixi', 'roles', 'beta', 'rules', 'AGENTS.md'), '# beta rules\n')
    writeFile(repoPath(homeDir, 'moluoxixi', 'roles', 'beta', 'hooks', 'beta-only.mjs'), 'export const role = "beta"\n')
    writeFile(repoPath(homeDir, 'moluoxixi', 'roles', 'beta', 'mcp', 'mcp.json'), validMcp('beta'))
    writeRoleContract(homeDir, 'moluoxixi', 'alpha')
    writeRoleContract(homeDir, 'moluoxixi', 'beta')
    writeFile(repoPath(homeDir, 'moluoxixi', '.git', 'keep'), 'repository marker\n')
    const alphaManifest = writeManifest(root, 'switch-alpha', [
      vendorDefinition('moluoxixi', [{ kind: 'role-assets', sourceDir: 'roles/alpha' }]),
    ])
    const betaManifest = writeManifest(root, 'switch-beta', [
      vendorDefinition('moluoxixi', [{ kind: 'role-assets', sourceDir: 'roles/beta' }]),
    ])

    await rebuildVendorAssets({ homeDir, role: 'alpha', manifestPath: alphaManifest })
    writeFile(path.join(homeDir, 'roles', 'alpha', 'local-sentinel.txt'), 'alpha installed\n')
    const inventory = await rebuildVendorAssets({ homeDir, role: 'beta', manifestPath: betaManifest })

    expect(inventory).toMatchObject({
      role: 'beta',
      skills: ['beta-only'],
      agents: ['beta-only.md'],
      hooks: ['beta-only.mjs'],
    })
    expect(fs.existsSync(path.join(homeDir, 'vendor', 'skills', 'alpha-only'))).toBe(false)
    expect(fs.existsSync(path.join(homeDir, 'vendor', 'agents', 'alpha-only.md'))).toBe(false)
    expect(fs.existsSync(path.join(homeDir, 'vendor', 'hooks', 'alpha-only.mjs'))).toBe(false)
    expect(fs.existsSync(path.join(homeDir, 'vendor', 'skills', 'beta-only', 'SKILL.md'))).toBe(true)
    expect(fs.existsSync(path.join(homeDir, 'vendor', 'agents', 'beta-only.md'))).toBe(true)
    expect(fs.existsSync(path.join(homeDir, 'vendor', 'hooks', 'beta-only.mjs'))).toBe(true)
    expect(fs.readFileSync(path.join(homeDir, 'vendor', 'AGENTS.md'), 'utf8')).toBe('# beta rules\n')
    expect(JSON.parse(fs.readFileSync(path.join(homeDir, 'vendor', 'mcp', 'mcp.json'), 'utf8'))).toHaveProperty('mcpServers.demo.command', 'beta')
    expect(fs.readFileSync(repoPath(homeDir, 'moluoxixi', '.git', 'keep'), 'utf8')).toBe('repository marker\n')
    expect(fs.readFileSync(path.join(homeDir, 'roles', 'alpha', 'local-sentinel.txt'), 'utf8')).toBe('alpha installed\n')
    expect(fs.existsSync(path.join(homeDir, 'roles', 'beta', 'skills', 'beta-only', 'SKILL.md'))).toBe(true)
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

  it('rejects source and target paths outside their checkout and managed staging roots', async () => {
    const { root, homeDir } = createFixture()
    writeFile(repoPath(homeDir, 'outside-skill', 'SKILL.md'), '# outside\n')
    writeFile(repoPath(homeDir, 'remote', 'rules', 'AGENTS.md'), '# rules\n')
    const sourceEscapeManifest = writeManifest(root, 'source-escape', [
      vendorDefinition('remote', [{ kind: 'skills', sourceBaseDir: '..', skills: ['outside-skill'] }]),
    ])
    const targetEscapeManifest = writeManifest(root, 'target-escape', [
      vendorDefinition('remote', [{ kind: 'rules', sourceFile: 'rules/AGENTS.md', targetFile: '../outside/AGENTS.md' }]),
    ])

    await expect(rebuildVendorAssets({ homeDir, role: 'alpha', manifestPath: sourceEscapeManifest })).rejects.toThrow(/source.*outside.*checkout/i)
    await expect(rebuildVendorAssets({ homeDir, role: 'alpha', manifestPath: targetEscapeManifest })).rejects.toThrow(/target.*outside.*managed/i)
    expect(fs.existsSync(path.join(homeDir, 'outside', 'AGENTS.md'))).toBe(false)
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
    expect(fs.readFileSync(path.join(homeDir, 'vendor', 'AGENTS.md'), 'utf8')).toBe('# alpha\n')
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

  it('rejects invalid staged assets and neutral MCP configuration', async () => {
    const { root, homeDir } = createFixture()
    writeFile(repoPath(homeDir, 'remote', 'skills', 'broken', 'README.md'), 'not a skill\n')
    writeFile(repoPath(homeDir, 'remote', 'mcp', 'mcp.json'), '{"mcpServers":[]}\n')
    const invalidSkillManifest = writeManifest(root, 'invalid-skill', [
      vendorDefinition('remote', [{ kind: 'skills', sourceBaseDir: 'skills', skills: ['broken'] }]),
    ])
    const invalidMcpManifest = writeManifest(root, 'invalid-mcp', [
      vendorDefinition('remote', [{ kind: 'mcp', sourceFile: 'mcp/mcp.json' }]),
    ])

    await expect(rebuildVendorAssets({ homeDir, role: 'alpha', manifestPath: invalidSkillManifest })).rejects.toThrow(/SKILL\.md/i)
    await expect(rebuildVendorAssets({ homeDir, role: 'alpha', manifestPath: invalidMcpManifest })).rejects.toThrow(/mcpServers.*object/i)
  })

  it('keeps the previous five staging assets and repositories when validation fails', async () => {
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

  it('restores every previous managed asset when a commit rename fails', async () => {
    const { root, homeDir } = createFixture()
    writeFile(path.join(homeDir, 'vendor', 'skills', 'stable', 'SKILL.md'), '# stable\n')
    writeFile(path.join(homeDir, 'vendor', 'agents', 'stable.md'), validAgent('stable'))
    writeFile(path.join(homeDir, 'vendor', 'AGENTS.md'), '# stable rules\n')
    writeFile(path.join(homeDir, 'vendor', 'hooks', 'stable.mjs'), 'export default {}\n')
    writeFile(path.join(homeDir, 'vendor', 'mcp', 'mcp.json'), validMcp('stable'))
    writeFile(repoPath(homeDir, 'remote', 'skills', 'fresh', 'SKILL.md'), '# fresh\n')
    writeFile(repoPath(homeDir, 'remote', 'agents', 'fresh.md'), validAgent('fresh'))
    writeFile(repoPath(homeDir, 'remote', '.git', 'keep'), 'repository marker\n')
    const manifestPath = writeManifest(root, 'commit-failure', [
      vendorDefinition('remote', [
        { kind: 'skills', sourceBaseDir: 'skills', skills: ['fresh'] },
        { kind: 'agents', sourceDir: 'agents' },
      ]),
    ])

    const renameSync = fs.renameSync.bind(fs)
    const renameSpy = vi.spyOn(fs, 'renameSync').mockImplementation((source, target) => {
      if (
        String(source).includes(`${path.sep}.airules-vendor-next-`)
        && path.resolve(String(target)) === path.join(homeDir, 'vendor', 'agents')
      ) {
        throw new Error('simulated commit rename failure')
      }
      renameSync(source, target)
    })

    try {
      await expect(rebuildVendorAssets({ homeDir, role: 'alpha', manifestPath })).rejects.toThrow(/commit rename failure/i)
    }
    finally {
      renameSpy.mockRestore()
    }

    expect(fs.readFileSync(path.join(homeDir, 'vendor', 'skills', 'stable', 'SKILL.md'), 'utf8')).toBe('# stable\n')
    expect(fs.readFileSync(path.join(homeDir, 'vendor', 'agents', 'stable.md'), 'utf8')).toContain('name: stable')
    expect(fs.readFileSync(path.join(homeDir, 'vendor', 'AGENTS.md'), 'utf8')).toBe('# stable rules\n')
    expect(fs.readFileSync(path.join(homeDir, 'vendor', 'hooks', 'stable.mjs'), 'utf8')).toBe('export default {}\n')
    expect(JSON.parse(fs.readFileSync(path.join(homeDir, 'vendor', 'mcp', 'mcp.json'), 'utf8'))).toHaveProperty('mcpServers.demo.command', 'stable')
    expect(fs.existsSync(path.join(homeDir, 'vendor', 'skills', 'fresh'))).toBe(false)
    expect(fs.readFileSync(repoPath(homeDir, 'remote', '.git', 'keep'), 'utf8')).toBe('repository marker\n')
  })

  it('rolls back the selected full role and vendor assets as one controlled transaction', async () => {
    const { root, homeDir } = createFixture()
    writeFile(path.join(homeDir, 'roles', 'alpha', 'role.yaml'), 'version: old\n')
    writeFile(path.join(homeDir, 'vendor', 'skills', 'stable', 'SKILL.md'), '# stable\n')
    writeFile(path.join(homeDir, 'vendor', 'agents', 'stable.md'), validAgent('stable'))
    writeFile(repoPath(homeDir, 'moluoxixi', 'roles', 'alpha', 'role.yaml'), 'role_id: alpha\nversion: new\n')
    writeRoleContract(homeDir, 'moluoxixi', 'alpha')
    writeFile(repoPath(homeDir, 'moluoxixi', 'roles', 'alpha', 'skills', 'fresh', 'SKILL.md'), '# fresh\n')
    writeFile(repoPath(homeDir, 'moluoxixi', 'roles', 'alpha', 'agents', 'fresh.md'), validAgent('fresh'))
    const manifestPath = writeManifest(root, 'role-commit-failure', [
      vendorDefinition('moluoxixi', [{ kind: 'role-assets', sourceDir: 'roles/alpha' }]),
    ])
    const renameSync = fs.renameSync.bind(fs)
    const renameSpy = vi.spyOn(fs, 'renameSync').mockImplementation((source, target) => {
      if (
        String(source).includes(`${path.sep}.airules-vendor-next-`)
        && path.resolve(String(target)) === path.join(homeDir, 'vendor', 'agents')
      ) {
        throw new Error('simulated joint commit failure')
      }
      renameSync(source, target)
    })

    try {
      await expect(rebuildVendorAssets({ homeDir, role: 'alpha', manifestPath })).rejects.toThrow(/joint commit failure/i)
    }
    finally {
      renameSpy.mockRestore()
    }

    expect(fs.readFileSync(path.join(homeDir, 'roles', 'alpha', 'role.yaml'), 'utf8')).toBe('version: old\n')
    expect(fs.readFileSync(path.join(homeDir, 'vendor', 'skills', 'stable', 'SKILL.md'), 'utf8')).toBe('# stable\n')
    expect(fs.readFileSync(path.join(homeDir, 'vendor', 'agents', 'stable.md'), 'utf8')).toContain('name: stable')
    expect(fs.existsSync(path.join(homeDir, 'vendor', 'skills', 'fresh'))).toBe(false)
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
