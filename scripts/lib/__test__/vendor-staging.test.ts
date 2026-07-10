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

describe('rebuildVendorAssets', () => {
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
    writeFile(repoPath(homeDir, 'moluoxixi', 'roles', 'beta', 'skills', 'beta-skill', 'SKILL.md'), '# beta\n')

    const manifestPath = writeManifest(root, 'moluoxixi-alpha', [
      vendorDefinition('moluoxixi', [
        { kind: 'role-assets', sourceDir: 'roles/alpha' },
      ]),
    ])

    const inventory = await rebuildVendorAssets({ homeDir, role: 'alpha', manifestPath })

    expect(inventory.skills).toEqual(['alpha-skill'])
    expect(inventory.agents).toEqual(['alpha-agent.md'])
    expect(inventory.hooks).toEqual(['alpha-stop.mjs'])
    expect(fs.existsSync(path.join(homeDir, 'vendor', 'skills', 'alpha-skill', 'SKILL.md'))).toBe(true)
    expect(fs.existsSync(path.join(homeDir, 'vendor', 'skills', 'alpha-skill', 'scripts', 'run.mjs'))).toBe(true)
    expect(fs.existsSync(path.join(homeDir, 'vendor', 'agents', 'alpha-agent.md'))).toBe(true)
    expect(fs.readFileSync(path.join(homeDir, 'vendor', 'AGENTS.md'), 'utf8')).toContain('alpha rules')
    expect(fs.existsSync(path.join(homeDir, 'vendor', 'hooks', 'alpha-stop.mjs'))).toBe(true)
    expect(fs.existsSync(path.join(homeDir, 'vendor', 'mcp', 'mcp.json'))).toBe(true)
    expect(fs.existsSync(path.join(homeDir, 'vendor', 'skills', 'beta-skill'))).toBe(false)
    expect(fs.existsSync(path.join(homeDir, 'vendor', 'constants'))).toBe(false)
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
    writeFile(repoPath(homeDir, 'moluoxixi', '.git', 'keep'), 'repository marker\n')
    const alphaManifest = writeManifest(root, 'switch-alpha', [
      vendorDefinition('moluoxixi', [{ kind: 'role-assets', sourceDir: 'roles/alpha' }]),
    ])
    const betaManifest = writeManifest(root, 'switch-beta', [
      vendorDefinition('moluoxixi', [{ kind: 'role-assets', sourceDir: 'roles/beta' }]),
    ])

    await rebuildVendorAssets({ homeDir, role: 'alpha', manifestPath: alphaManifest })
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

  it('requires the unique moluoxixi role-assets source to match the selected role exactly', async () => {
    const { root, homeDir } = createFixture()
    fs.mkdirSync(repoPath(homeDir, 'moluoxixi', 'roles', 'beta'), { recursive: true })
    const manifestPath = writeManifest(root, 'wrong-role', [
      vendorDefinition('moluoxixi', [{ kind: 'role-assets', sourceDir: 'roles/beta' }]),
    ])

    await expect(rebuildVendorAssets({ homeDir, role: 'alpha', manifestPath })).rejects.toThrow(/moluoxixi.*roles\/alpha/i)
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
