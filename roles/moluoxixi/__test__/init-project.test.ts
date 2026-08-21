import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { rebuildVendorAssets } from '../../../scripts/lib/vendor-staging.js'

const roleRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const skillRoot = path.join(roleRoot, 'skills', 'init-project')
const initializer = path.join(skillRoot, 'scripts', 'run-role-cli.mjs')
const temporaryRoots: string[] = []

afterEach(() => {
  for (const root of temporaryRoots.splice(0))
    fs.rmSync(root, { recursive: true, force: true })
})

function temporaryDirectory(prefix: string): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix))
  temporaryRoots.push(root)
  return root
}

function walkFiles(root: string): string[] {
  const files: string[] = []
  function visit(current: string): void {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const target = path.join(current, entry.name)
      if (entry.isDirectory())
        visit(target)
      else if (entry.isFile())
        files.push(path.relative(root, target).split(path.sep).join('/'))
    }
  }
  visit(root)
  return files.sort()
}

describe('init-project skill', () => {
  it('keeps the discoverable skill as a package CLI adapter only', () => {
    expect(walkFiles(skillRoot)).toEqual([
      'SKILL.md',
      'agents/openai.yaml',
      'scripts/run-role-cli.mjs',
    ])
    expect(fs.existsSync(path.join(skillRoot, 'assets'))).toBe(false)
    expect(fs.existsSync(path.join(skillRoot, 'references'))).toBe(false)
    const adapterSource = fs.readFileSync(initializer, 'utf8')
    expect(adapterSource).toContain('@moluoxixi/airules-moluoxixi-cli')
    expect(adapterSource).not.toMatch(/pnpm|npm\s+link|install.*workspace|build.*(?:core|cli)/iu)
  })

  it('initializes an isolated project through the published package CLI contract', () => {
    const projectRoot = temporaryDirectory('airules-package-init-')
    const cliEntry = path.join(projectRoot, 'fake-moluoxixi.mjs')
    fs.writeFileSync(cliEntry, [
      'import fs from \'node:fs\'',
      'import path from \'node:path\'',
      'fs.writeFileSync(path.join(process.cwd(), \'cli-invocation.json\'), JSON.stringify(process.argv.slice(2)))',
      'fs.mkdirSync(path.join(process.cwd(), \'.moluoxixi\'), { recursive: true })',
      'fs.writeFileSync(path.join(process.cwd(), \'.moluoxixi\', \'workflow.md\'), \'# workflow\\n\')',
      'fs.writeFileSync(path.join(process.cwd(), \'.moluoxixi\', \'.version\'), \'0.6.20\\n\')',
      'fs.mkdirSync(path.join(process.cwd(), \'.codex\'), { recursive: true })',
      'fs.mkdirSync(path.join(process.cwd(), \'.agents\', \'skills\'), { recursive: true })',
    ].join('\n'))
    const result = spawnSync(process.execPath, [
      initializer,
      '--project',
      projectRoot,
      '--platform',
      'codex',
      '--user',
      'test-user',
      '--no-monorepo',
      '--yes',
    ], {
      cwd: roleRoot,
      encoding: 'utf8',
      env: { ...process.env, NO_COLOR: '1', MOLUOXIXI_CLI_ENTRY: cliEntry },
      timeout: 120_000,
    })

    expect(result.status, result.stderr).toBe(0)
    expect(fs.existsSync(path.join(projectRoot, '.moluoxixi', 'workflow.md'))).toBe(true)
    expect(fs.existsSync(path.join(projectRoot, '.moluoxixi', '.version'))).toBe(true)
    expect(fs.existsSync(path.join(projectRoot, '.codex'))).toBe(true)
    expect(fs.existsSync(path.join(projectRoot, '.agents', 'skills'))).toBe(true)
    expect(fs.existsSync(path.join(projectRoot, '.moluoxixi', 'runtime'))).toBe(false)
    expect(JSON.parse(fs.readFileSync(path.join(projectRoot, 'cli-invocation.json'), 'utf8'))).toEqual([
      'init',
      '--user',
      'test-user',
      '--no-monorepo',
      '--yes',
      '--codex',
    ])
  }, 120_000)

  it('stages the thin skill and complete local package workspace', async () => {
    const root = temporaryDirectory('airules-package-staging-')
    const homeDir = path.join(root, 'home')
    const repository = path.join(homeDir, 'vendor', 'repos', 'moluoxixi')
    fs.mkdirSync(path.join(repository, 'roles'), { recursive: true })
    fs.cpSync(roleRoot, path.join(repository, 'roles', 'moluoxixi'), {
      recursive: true,
      filter: source => !['.sync', 'node_modules', 'dist'].includes(path.basename(source)),
    })
    const manifestPath = path.join(root, 'manifest.mjs')
    fs.writeFileSync(manifestPath, `export const vendors = ${JSON.stringify([{
      name: 'moluoxixi',
      official: true,
      source: 'https://github.com/moluoxixi/AIRules.git',
      projections: [{ kind: 'role-assets', sourceDir: 'roles/moluoxixi' }],
    }])}\n`)

    const inventory = await rebuildVendorAssets({ homeDir, role: 'moluoxixi', manifestPath })
    const stagedSkill = path.join(homeDir, 'vendor', 'skills', 'init-project')
    const installedRole = path.join(homeDir, 'roles', 'moluoxixi')

    expect(inventory.skills).toEqual(['init-project'])
    expect(walkFiles(stagedSkill)).toEqual([
      'SKILL.md',
      'agents/openai.yaml',
      'scripts/run-role-cli.mjs',
    ])
    expect(fs.existsSync(path.join(installedRole, 'packages', 'core', 'package.json'))).toBe(true)
    expect(fs.existsSync(path.join(installedRole, 'packages', 'cli', 'bin', 'moluoxixi.js'))).toBe(true)
    expect(fs.existsSync(path.join(installedRole, 'packages', 'cli', 'src', 'templates'))).toBe(true)
    expect(fs.existsSync(path.join(installedRole, '.sync'))).toBe(false)
  }, 120_000)
})
