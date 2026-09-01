import { Buffer } from 'node:buffer'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'

const roots: string[] = []
const sourceScript = fileURLToPath(new URL('../../migrate-project.mjs', import.meta.url))
const repositoryRoot = path.resolve(path.dirname(sourceScript), '..')

const trellisReferenceFixtures = [
  '.gitattributes',
  'AGENTS.md',
  'SKILLS_ORGANIZATION.md',
  'capabilities/README.md',
  'eslint.config.ts',
  'scripts/verify-packed-airules.mjs',
  'skills/common/spec-organization/SKILL.md',
]

afterEach(() => {
  for (const root of roots.splice(0))
    fs.rmSync(root, { force: true, recursive: true })
})

function writeFile(filePath: string, content = 'content\n'): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, content, 'utf8')
}

function copyRepositoryFile(source: string, relativePath: string): void {
  const target = path.join(source, relativePath)
  fs.mkdirSync(path.dirname(target), { recursive: true })
  fs.copyFileSync(path.join(repositoryRoot, relativePath), target)
}

function createFixture(): { root: string, source: string, target: string } {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'airules-migrate-project-'))
  const source = path.join(root, 'source')
  const target = path.join(root, 'target')
  roots.push(root)

  fs.mkdirSync(path.join(source, 'scripts'), { recursive: true })
  fs.copyFileSync(sourceScript, path.join(source, 'scripts', 'migrate-project.mjs'))
  writeFile(path.join(source, 'package.json'), JSON.stringify({
    description: 'Moluoxixi role distribution.',
    license: 'MIT',
    name: 'moluoxixi-ai-rules',
  }, null, 2))
  return { root, source, target }
}

function runMigrator(source: string, target: string, ...args: string[]) {
  return spawnSync(process.execPath, [path.join(source, 'scripts', 'migrate-project.mjs'), target, ...args], {
    cwd: source,
    encoding: 'utf8',
  })
}

function expectNoTrellis(root: string, current = root): void {
  for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
    if (current === root && entry.name === '.git')
      continue
    const entryPath = path.join(current, entry.name)
    expect(path.relative(root, entryPath).toLowerCase()).not.toContain('trellis')
    if (entry.isDirectory()) {
      expectNoTrellis(root, entryPath)
    }
    else if (!entry.isSymbolicLink()) {
      expect(fs.readFileSync(entryPath).toString('latin1').toLowerCase()).not.toContain('trellis')
    }
  }
}

describe('project migration', () => {
  it('moves every non-protected entry, removes Trellis content, and rebuilds role-based READMEs', () => {
    const { source, target } = createFixture()
    for (const relativePath of trellisReferenceFixtures)
      copyRepositoryFile(source, relativePath)

    writeFile(path.join(source, 'README.md'), '# Moluoxixi\n\nTrellis content\n')
    writeFile(path.join(source, 'README-zh.md'), '# Moluoxixi\n\nTrellis 内容\n')
    writeFile(path.join(source, 'src', 'app.ts'), 'export class Moluoxixi {}\nexport const env = "MOLUOXIXI_CONTEXT_ID"\n')
    writeFile(path.join(source, 'scripts', 'keep.mjs'), 'export const command = "moluoxixi"\n')
    writeFile(path.join(source, 'scripts', 'lib', '__test__', 'migrate-project.test.ts'))
    writeFile(path.join(source, 'roles', 'moluoxixi', 'role.yaml'), 'role_id: moluoxixi\ndescription: Moluoxixi\n')
    writeFile(path.join(source, 'roles', 'moluoxixi', '.sync', 'baseline.txt'))
    writeFile(path.join(source, 'roles', 'moluoxixi', 'skills', 'init-project', 'SKILL.md'))
    writeFile(path.join(source, 'roles', 'matt', 'role.yaml'), 'role_id: matt\n')
    writeFile(path.join(source, 'roles', 'matt', 'skills', 'demo', 'SKILL.md'))
    writeFile(path.join(source, 'roles', 'trellis', 'role.yaml'), 'role_id: trellis\n')
    writeFile(path.join(source, '.github', 'workflows', 'release.yml'))
    writeFile(path.join(source, '.claude', 'settings.json'))
    writeFile(path.join(source, '.git', 'HEAD'), 'source git\n')
    writeFile(path.join(source, '.trellis', 'workflow.md'), 'Trellis workflow\n')
    writeFile(path.join(source, '.agents', 'skills', 'trellis-start', 'SKILL.md'), 'Trellis skill\n')
    writeFile(path.join(source, '.codex', 'agents', 'trellis-check.toml'), 'name = "Trellis"\n')
    writeFile(path.join(source, 'node_modules', 'example', 'index.js'))
    writeFile(path.join(source, 'coverage', 'lcov.info'))
    writeFile(path.join(source, '.codegraph', 'index.json'))
    writeFile(path.join(source, 'vendor', 'cache.txt'))
    writeFile(path.join(source, 'logs', 'migration.log'))
    writeFile(path.join(source, '.moluoxixi', 'moluoxixi-context.js'), 'const root = ".moluoxixi"\n')
    const binaryContent = Buffer.from([0, ...Buffer.from('moluoxixi'), 255])
    fs.mkdirSync(path.join(source, 'assets'), { recursive: true })
    fs.writeFileSync(path.join(source, 'assets', 'moluoxixi.bin'), binaryContent)
    const textWithByteOrderMark = Buffer.concat([
      Buffer.from([0xEF, 0xBB, 0xBF]),
      Buffer.from('Moluoxixi\n'),
    ])
    fs.writeFileSync(path.join(source, 'src', 'branded.txt'), textWithByteOrderMark)
    writeFile(path.join(target, '.git', 'HEAD'), 'ref: refs/heads/main\n')
    writeFile(path.join(target, 'stale.txt'))

    const result = runMigrator(source, target, '--yes')

    expect(result.status, result.stderr).toBe(0)
    expect(result.stdout).toContain('Migration complete')
    expect(fs.readFileSync(path.join(target, '.git', 'HEAD'), 'utf8')).toBe('ref: refs/heads/main\n')
    expect(fs.existsSync(path.join(target, 'stale.txt'))).toBe(false)
    expect(fs.existsSync(path.join(target, 'roles', 'busyming', 'role.yaml'))).toBe(true)
    expect(fs.existsSync(path.join(target, 'roles', 'busyming', '.sync', 'baseline.txt'))).toBe(true)
    expect(fs.existsSync(path.join(target, 'roles', 'matt', 'role.yaml'))).toBe(true)
    expect(fs.existsSync(path.join(target, '.busyming', 'busyming-context.js'))).toBe(true)
    expect(fs.existsSync(path.join(target, 'node_modules', 'example', 'index.js'))).toBe(true)
    expect(fs.existsSync(path.join(target, 'coverage', 'lcov.info'))).toBe(true)
    expect(fs.existsSync(path.join(target, '.codegraph', 'index.json'))).toBe(true)
    expect(fs.existsSync(path.join(target, 'vendor', 'cache.txt'))).toBe(true)
    expect(fs.existsSync(path.join(target, 'logs', 'migration.log'))).toBe(true)
    expect(fs.readFileSync(path.join(target, 'src', 'app.ts'), 'utf8')).toContain('class Busyming')
    expect(fs.readFileSync(path.join(target, 'src', 'app.ts'), 'utf8')).toContain('BUSYMING_CONTEXT_ID')
    expect(fs.readFileSync(path.join(target, 'assets', 'busyming.bin'))).toEqual(binaryContent)
    expect(fs.readFileSync(path.join(target, 'src', 'branded.txt'))).toEqual(Buffer.concat([
      Buffer.from([0xEF, 0xBB, 0xBF]),
      Buffer.from('Busyming\n'),
    ]))

    expect(fs.existsSync(path.join(target, '.github'))).toBe(false)
    expect(fs.existsSync(path.join(target, '.claude'))).toBe(false)
    expect(fs.existsSync(path.join(target, '.trellis'))).toBe(false)
    expect(fs.existsSync(path.join(target, '.agents'))).toBe(false)
    expect(fs.existsSync(path.join(target, '.codex'))).toBe(false)
    expect(fs.existsSync(path.join(target, 'roles', 'trellis'))).toBe(false)
    expect(fs.existsSync(path.join(target, 'scripts', 'migrate-project.mjs'))).toBe(false)
    expect(fs.existsSync(path.join(target, 'scripts', 'lib', '__test__', 'migrate-project.test.ts'))).toBe(false)

    expect(fs.existsSync(path.join(source, '.git', 'HEAD'))).toBe(true)
    expect(fs.existsSync(path.join(source, '.github', 'workflows', 'release.yml'))).toBe(true)
    expect(fs.existsSync(path.join(source, '.claude', 'settings.json'))).toBe(true)
    expect(fs.existsSync(path.join(source, 'roles', 'trellis', 'role.yaml'))).toBe(true)
    expect(fs.existsSync(path.join(source, 'scripts', 'migrate-project.mjs'))).toBe(true)
    expect(fs.existsSync(path.join(source, 'scripts', 'lib', '__test__', 'migrate-project.test.ts'))).toBe(true)
    expect(fs.existsSync(path.join(source, 'roles', 'moluoxixi'))).toBe(false)
    expect(fs.existsSync(path.join(source, '.trellis'))).toBe(false)
    expect(fs.existsSync(path.join(source, '.agents'))).toBe(false)
    expect(fs.existsSync(path.join(source, '.codex'))).toBe(false)
    expect(fs.existsSync(path.join(source, 'node_modules'))).toBe(false)

    const readme = fs.readFileSync(path.join(target, 'README.md'), 'utf8')
    const readmeZh = fs.readFileSync(path.join(target, 'README-zh.md'), 'utf8')
    expect(readme).toContain('### `busyming`')
    expect(readme).toContain('### `matt`')
    expect(readmeZh).toContain('### `busyming`')
    expect(readmeZh).toContain('### `matt`')
    expectNoTrellis(target)

    const verifySyntax = spawnSync(process.execPath, ['--check', path.join(target, 'scripts', 'verify-packed-airules.mjs')], {
      encoding: 'utf8',
    })
    expect(verifySyntax.status, verifySyntax.stderr).toBe(0)
  })

  it('supports a dry run without changing the source or target', () => {
    const { source, target } = createFixture()
    writeFile(path.join(source, 'src', 'app.ts'))
    writeFile(path.join(target, 'stale.txt'))

    const result = runMigrator(source, target, '--dry-run')

    expect(result.status, result.stderr).toBe(0)
    expect(result.stdout).toContain('Mode: dry-run')
    expect(result.stdout).toContain('Project name: busyming')
    expect(fs.existsSync(path.join(source, 'src', 'app.ts'))).toBe(true)
    expect(fs.existsSync(path.join(target, 'stale.txt'))).toBe(true)
    expect(fs.existsSync(path.join(target, 'src', 'app.ts'))).toBe(false)
  })

  it('requires explicit confirmation for destructive migration', () => {
    const { source, target } = createFixture()
    writeFile(path.join(source, 'src', 'app.ts'))
    writeFile(path.join(target, 'stale.txt'))

    const result = runMigrator(source, target)

    expect(result.status).not.toBe(0)
    expect(result.stderr).toMatch(/without --yes/i)
    expect(fs.existsSync(path.join(source, 'src', 'app.ts'))).toBe(true)
    expect(fs.existsSync(path.join(target, 'stale.txt'))).toBe(true)
  })

  it('supports a custom kebab-case project name and derives display and constant forms', () => {
    const { source, target } = createFixture()
    writeFile(
      path.join(source, '.moluoxixi', 'moluoxixi-context.ts'),
      'export class MoluoxixiContext {}\nexport const key = "MOLUOXIXI_CONTEXT_ID"\n',
    )

    const result = runMigrator(source, target, '--name', 'busy-ming', '--yes')

    expect(result.status, result.stderr).toBe(0)
    const migrated = path.join(target, '.busy-ming', 'busy-ming-context.ts')
    expect(fs.existsSync(migrated)).toBe(true)
    expect(fs.readFileSync(migrated, 'utf8')).toContain('class BusyMingContext')
    expect(fs.readFileSync(migrated, 'utf8')).toContain('BUSY_MING_CONTEXT_ID')
    expectNoTrellis(target)
  })

  it('rejects invalid project names before cleaning the target', () => {
    const { source, target } = createFixture()
    writeFile(path.join(source, 'src', 'app.ts'))
    writeFile(path.join(target, 'stale.txt'))

    const result = runMigrator(source, target, '--name', '../Busy Ming', '--yes')

    expect(result.status).not.toBe(0)
    expect(result.stderr).toMatch(/lowercase kebab-case/i)
    expect(fs.existsSync(path.join(source, 'src', 'app.ts'))).toBe(true)
    expect(fs.existsSync(path.join(target, 'stale.txt'))).toBe(true)
  })

  it('rejects rename collisions before cleaning the target', () => {
    const { source, target } = createFixture()
    writeFile(path.join(source, 'moluoxixi.txt'))
    writeFile(path.join(source, 'busyming.txt'))
    writeFile(path.join(target, 'stale.txt'))

    const result = runMigrator(source, target, '--yes')

    expect(result.status).not.toBe(0)
    expect(result.stderr).toMatch(/rename collision/i)
    expect(fs.existsSync(path.join(source, 'moluoxixi.txt'))).toBe(true)
    expect(fs.existsSync(path.join(target, 'stale.txt'))).toBe(true)
  })

  it('rejects overlapping source and target directories', () => {
    const { root, source } = createFixture()
    writeFile(path.join(source, 'src', 'app.ts'))

    const nestedResult = runMigrator(source, path.join(source, 'nested-target'), '--yes')
    const parentResult = runMigrator(source, root, '--yes')

    expect(nestedResult.status).not.toBe(0)
    expect(nestedResult.stderr).toMatch(/must not overlap/i)
    expect(parentResult.status).not.toBe(0)
    expect(parentResult.stderr).toMatch(/must not overlap/i)
    expect(fs.existsSync(path.join(source, 'src', 'app.ts'))).toBe(true)
  })

  it('rejects a symbolic-link target without touching its contents', () => {
    const { root, source } = createFixture()
    const realTarget = path.join(root, 'real-target')
    const linkedTarget = path.join(root, 'linked-target')
    writeFile(path.join(source, 'src', 'app.ts'))
    writeFile(path.join(realTarget, 'sentinel.txt'))
    fs.symlinkSync(realTarget, linkedTarget, process.platform === 'win32' ? 'junction' : 'dir')

    const result = runMigrator(source, linkedTarget, '--yes')

    expect(result.status).not.toBe(0)
    expect(result.stderr).toMatch(/symbolic-link target/i)
    expect(fs.existsSync(path.join(source, 'src', 'app.ts'))).toBe(true)
    expect(fs.readFileSync(path.join(realTarget, 'sentinel.txt'), 'utf8')).toBe('content\n')
  })
})
