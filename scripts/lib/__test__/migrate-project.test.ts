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
    repository: 'https://github.com/moluoxixi/AIRules',
  }, null, 2))
  return { root, source, target }
}

function runMigrator(source: string, target: string | undefined, ...args: string[]) {
  return runMigratorWithEnvironment(source, target, {}, ...args)
}

function runMigratorWithEnvironment(
  source: string,
  target: string | undefined,
  environment: Record<string, string>,
  ...args: string[]
) {
  const childEnvironment = { ...process.env }
  delete childEnvironment.AIRULES_MIGRATE_TARGET
  delete childEnvironment.AIRULES_MIGRATE_REPOSITORY_URL
  return spawnSync(process.execPath, [
    path.join(source, 'scripts', 'migrate-project.mjs'),
    ...(target ? [target] : []),
    ...args,
  ], {
    cwd: source,
    encoding: 'utf8',
    env: { ...childEnvironment, ...environment },
  })
}

function expectNoTrellis(root: string, current = root): void {
  for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
    const entryPath = path.join(current, entry.name)
    const relativePath = path.relative(root, entryPath)
    if (current === root && (
      entry.name === '.git'
      || entry.name === 'node_modules'
      || /^README.*\.md$/iu.test(entry.name)
    )) {
      continue
    }
    expect(relativePath.toLowerCase()).not.toContain('trellis')
    if (entry.isDirectory()) {
      expectNoTrellis(root, entryPath)
    }
    else if (!entry.isSymbolicLink()) {
      expect(fs.readFileSync(entryPath).toString('latin1').toLowerCase()).not.toContain('trellis')
    }
  }
}

function snapshotTree(root: string, current = root): Array<{ content?: string, path: string, type: string }> {
  const snapshot: Array<{ content?: string, path: string, type: string }> = []
  for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
    const entryPath = path.join(current, entry.name)
    const relativePath = path.relative(root, entryPath)
    if (entry.isDirectory()) {
      snapshot.push({ path: relativePath, type: 'directory' })
      snapshot.push(...snapshotTree(root, entryPath))
    }
    else if (entry.isSymbolicLink()) {
      snapshot.push({ content: fs.readlinkSync(entryPath), path: relativePath, type: 'symlink' })
    }
    else {
      snapshot.push({ content: fs.readFileSync(entryPath).toString('base64'), path: relativePath, type: 'file' })
    }
  }
  return snapshot
}

describe('project migration', () => {
  it('copies every non-protected entry, preserves target dependencies, and removes only Trellis README sections', () => {
    const { source, target } = createFixture()
    for (const relativePath of trellisReferenceFixtures)
      copyRepositoryFile(source, relativePath)

    writeFile(path.join(source, 'README.md'), [
      '# Moluoxixi',
      '',
      'This overview keeps an ordinary Trellis reference.',
      '',
      '```md',
      '## `trellis`',
      'This fenced example is not a role section.',
      '```',
      '',
      '## `moluoxixi`',
      '',
      'Custom Moluoxixi details that the migration must retain.',
      '',
      '## `trellis`',
      '',
      '### Unknown future content',
      '',
      '| Trellis | data |',
      '| --- | --- |',
      '| workflow | custom |',
      '',
      '## `matt`',
      '',
      'Custom Matt details that the migration must retain.',
      '',
      '## Development',
      '',
      'Keep this custom development section.',
      '',
    ].join('\n'))
    writeFile(path.join(source, 'README-en.md'), '# Moluoxixi\n\n## `trellis`\n\nRemove this role.\n\n## Notes\n\nKeep English notes.\n')
    writeFile(path.join(source, 'README-zh.md'), '# Moluoxixi\n\n## `trellis`\n\n删除这个角色。\n\n## 说明\n\n保留中文说明。\n')
    writeFile(path.join(source, 'src', 'app.ts'), 'export class Moluoxixi {}\nexport const env = "MOLUOXIXI_CONTEXT_ID"\n')
    writeFile(path.join(source, 'src', 'repository-links.txt'), [
      'https://github.com/moluoxixi/AIRules',
      'https://github.com/moluoxixi/AIRules.git',
      'https://github.com/external/tool',
    ].join('\n'))
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
    writeFile(path.join(source, '.env.local'), 'UNRELATED_LOCAL_SETTING=source-only\n')
    writeFile(path.join(source, 'node_modules', 'example', 'index.js'))
    writeFile(path.join(source, 'roles', 'moluoxixi', 'packages', 'demo', 'node_modules', 'example', 'index.js'))
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
    writeFile(path.join(target, 'node_modules', 'cached-package', 'index.js'), 'Trellis dependency cache\n')
    writeFile(path.join(target, 'stale.txt'))
    const sourceBefore = snapshotTree(source)

    const repositoryUrl = 'https://git.example.local/team/moluoxixi-rules'
    const result = runMigrator(source, target, '--repository-url', repositoryUrl, '--yes')

    expect(result.status, result.stderr).toBe(0)
    expect(result.stdout).toContain('Migration complete')
    expect(fs.readFileSync(path.join(target, '.git', 'HEAD'), 'utf8')).toBe('ref: refs/heads/main\n')
    expect(fs.existsSync(path.join(target, 'stale.txt'))).toBe(false)
    expect(fs.existsSync(path.join(target, 'roles', 'busyming', 'role.yaml'))).toBe(true)
    expect(fs.existsSync(path.join(target, 'roles', 'busyming', '.sync', 'baseline.txt'))).toBe(true)
    expect(fs.existsSync(path.join(target, 'roles', 'matt', 'role.yaml'))).toBe(true)
    expect(fs.existsSync(path.join(target, '.busyming', 'busyming-context.js'))).toBe(true)
    expect(fs.readFileSync(path.join(target, 'node_modules', 'cached-package', 'index.js'), 'utf8')).toBe('Trellis dependency cache\n')
    expect(fs.existsSync(path.join(target, 'roles', 'busyming', 'packages', 'demo', 'node_modules'))).toBe(false)
    expect(fs.existsSync(path.join(target, 'coverage', 'lcov.info'))).toBe(true)
    expect(fs.existsSync(path.join(target, '.codegraph', 'index.json'))).toBe(true)
    expect(fs.existsSync(path.join(target, 'vendor', 'cache.txt'))).toBe(true)
    expect(fs.existsSync(path.join(target, 'logs', 'migration.log'))).toBe(true)
    expect(fs.readFileSync(path.join(target, 'src', 'app.ts'), 'utf8')).toContain('class Busyming')
    expect(fs.readFileSync(path.join(target, 'src', 'app.ts'), 'utf8')).toContain('BUSYMING_CONTEXT_ID')
    expect(JSON.parse(fs.readFileSync(path.join(target, 'package.json'), 'utf8')).repository).toBe(repositoryUrl)
    expect(fs.readFileSync(path.join(target, 'src', 'repository-links.txt'), 'utf8')).toBe([
      repositoryUrl,
      repositoryUrl,
      'https://github.com/external/tool',
    ].join('\n'))
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
    expect(fs.existsSync(path.join(target, '.env.local'))).toBe(false)
    expect(fs.existsSync(path.join(target, 'roles', 'trellis'))).toBe(false)
    expect(fs.existsSync(path.join(target, 'scripts', 'migrate-project.mjs'))).toBe(false)
    expect(fs.existsSync(path.join(target, 'scripts', 'lib', '__test__', 'migrate-project.test.ts'))).toBe(false)

    expect(snapshotTree(source)).toEqual(sourceBefore)

    const readme = fs.readFileSync(path.join(target, 'README.md'), 'utf8')
    const readmeEn = fs.readFileSync(path.join(target, 'README-en.md'), 'utf8')
    const readmeZh = fs.readFileSync(path.join(target, 'README-zh.md'), 'utf8')
    expect(readme).toContain('## `busyming`')
    expect(readme).toContain('## `matt`')
    expect(readme).toContain('This overview keeps an ordinary Trellis reference.')
    expect(readme).toContain('## `trellis`\nThis fenced example is not a role section.')
    expect(readme).toContain('Custom Busyming details that the migration must retain.')
    expect(readme).toContain('Custom Matt details that the migration must retain.')
    expect(readme).toContain('Keep this custom development section.')
    expect(readme).not.toContain('Unknown future content')
    expect(readmeEn).toBe('# Busyming\n\n## Notes\n\nKeep English notes.\n')
    expect(readmeZh).toBe('# Busyming\n\n## 说明\n\n保留中文说明。\n')
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

    const result = runMigrator(source, target, '--preserve', 'cache/downloads', '--dry-run')

    expect(result.status, result.stderr).toBe(0)
    expect(result.stdout).toContain('Mode: dry-run')
    expect(result.stdout).toContain('Project name: busyming')
    expect(result.stdout).toContain('Preserved target paths: .git, node_modules, cache/downloads')
    expect(fs.existsSync(path.join(source, 'src', 'app.ts'))).toBe(true)
    expect(fs.existsSync(path.join(target, 'stale.txt'))).toBe(true)
    expect(fs.existsSync(path.join(target, 'src', 'app.ts'))).toBe(false)
  })

  it('preserves multiple configured target paths and removes their unpreserved siblings', () => {
    const { source, target } = createFixture()
    writeFile(path.join(source, 'src', 'app.ts'))
    writeFile(path.join(target, 'cache', 'downloads', 'archive.bin'), 'cached\n')
    writeFile(path.join(target, 'cache', 'stale.txt'))
    writeFile(path.join(target, 'local-only', 'settings.json'), '{"source":"Trellis"}\n')
    writeFile(path.join(target, 'remove-me', 'stale.txt'))

    const result = runMigrator(
      source,
      target,
      '--preserve',
      'cache/downloads',
      '--preserve',
      'local-only',
      '--preserve',
      'cache/downloads',
      '--yes',
    )

    expect(result.status, result.stderr).toBe(0)
    expect(result.stdout).toContain('Preserved target paths: .git, node_modules, cache/downloads, local-only')
    expect(fs.readFileSync(path.join(target, 'cache', 'downloads', 'archive.bin'), 'utf8')).toBe('cached\n')
    expect(fs.existsSync(path.join(target, 'cache', 'stale.txt'))).toBe(false)
    expect(fs.readFileSync(path.join(target, 'local-only', 'settings.json'), 'utf8')).toBe('{"source":"Trellis"}\n')
    expect(fs.existsSync(path.join(target, 'remove-me'))).toBe(false)
  })

  it.each([
    '.',
    '..',
    '../escape',
    'a/../b',
    'a//b',
    'a\\b',
    'name.',
    'name ',
    '/absolute',
    'C:/escape',
  ])('rejects unsafe preserve path %s before cleaning the target', (preservedPath) => {
    const { source, target } = createFixture()
    writeFile(path.join(source, 'src', 'app.ts'))
    writeFile(path.join(target, 'stale.txt'))

    const result = runMigrator(source, target, '--preserve', preservedPath, '--yes')

    expect(result.status).not.toBe(0)
    expect(result.stderr).toMatch(/preserve.*relative path/i)
    expect(fs.existsSync(path.join(target, 'stale.txt'))).toBe(true)
  })

  it('rejects preserve paths that overlap migration output before cleaning the target', () => {
    const { source, target } = createFixture()
    writeFile(path.join(source, 'cache', 'generated.txt'))
    writeFile(path.join(target, 'cache', 'downloads', 'archive.bin'))
    writeFile(path.join(target, 'stale.txt'))

    const result = runMigrator(source, target, '--preserve', 'cache/downloads', '--yes')

    expect(result.status).not.toBe(0)
    expect(result.stderr).toMatch(/preserve.*overlap.*migration output/i)
    expect(fs.existsSync(path.join(target, 'stale.txt'))).toBe(true)
    expect(fs.existsSync(path.join(target, 'cache', 'downloads', 'archive.bin'))).toBe(true)
  })

  it('rejects preserve paths that overlap Trellis cleanup roots before cleaning the target', () => {
    const { source, target } = createFixture()
    writeFile(path.join(target, '.trellis', 'tasks', 'state.json'))
    writeFile(path.join(target, 'stale.txt'))

    const result = runMigrator(source, target, '--preserve', '.trellis/tasks', '--yes')

    expect(result.status).not.toBe(0)
    expect(result.stderr).toMatch(/preserve.*Trellis cleanup/i)
    expect(fs.existsSync(path.join(target, 'stale.txt'))).toBe(true)
    expect(fs.existsSync(path.join(target, '.trellis', 'tasks', 'state.json'))).toBe(true)
  })

  it('rejects a preserve path below a symbolic-link parent before cleaning the target', () => {
    const { root, source, target } = createFixture()
    const outside = path.join(root, 'outside')
    writeFile(path.join(source, 'src', 'app.ts'))
    writeFile(path.join(outside, 'sentinel.txt'))
    fs.mkdirSync(target, { recursive: true })
    fs.symlinkSync(outside, path.join(target, 'linked'), process.platform === 'win32' ? 'junction' : 'dir')
    writeFile(path.join(target, 'stale.txt'))

    const result = runMigrator(source, target, '--preserve', 'linked/child', '--yes')

    expect(result.status).not.toBe(0)
    expect(result.stderr).toMatch(/symbolic-link.*preserve/i)
    expect(fs.existsSync(path.join(target, 'stale.txt'))).toBe(true)
    expect(fs.readFileSync(path.join(outside, 'sentinel.txt'), 'utf8')).toBe('content\n')
  })

  it('removes Trellis H2 sections without changing README line endings, BOM, or fenced examples', () => {
    const { source, target } = createFixture()
    const sourceText = [
      '# Moluoxixi',
      '',
      'Overview keeps Trellis.',
      '',
      '```md',
      '## `trellis`',
      'fenced example',
      '```',
      '',
      '## `moluoxixi`',
      '',
      'Keep Moluoxixi.',
      '',
      '  ## `TrElLiS` ###',
      '### Unknown internals',
      '~~~md',
      '## fake boundary',
      '~~~',
      '',
      '## Next',
      '',
      'Keep after.',
      '',
      '## TRELLIS',
      'remove second block',
      '',
      '# Final',
      '',
      'Keep final.',
      '',
    ].join('\r\n')
    fs.writeFileSync(path.join(source, 'README-custom.MD'), Buffer.concat([
      Buffer.from([0xEF, 0xBB, 0xBF]),
      Buffer.from(sourceText),
    ]))

    const result = runMigrator(source, target, '--yes')

    expect(result.status, result.stderr).toBe(0)
    expect(fs.readFileSync(path.join(target, 'README-custom.MD'))).toEqual(Buffer.concat([
      Buffer.from([0xEF, 0xBB, 0xBF]),
      Buffer.from([
        '# Busyming',
        '',
        'Overview keeps Trellis.',
        '',
        '```md',
        '## `trellis`',
        'fenced example',
        '```',
        '',
        '## `busyming`',
        '',
        'Keep Busyming.',
        '',
        '## Next',
        '',
        'Keep after.',
        '',
        '# Final',
        '',
        'Keep final.',
        '',
      ].join('\r\n')),
    ]))
  })

  it('rejects a non-UTF-8 root README before cleaning the target', () => {
    const { source, target } = createFixture()
    fs.writeFileSync(path.join(source, 'README.md'), Buffer.from([0xFF, 0xFE, 0x00, 0x00]))
    writeFile(path.join(target, 'stale.txt'))

    const result = runMigrator(source, target, '--yes')

    expect(result.status).not.toBe(0)
    expect(result.stderr).toMatch(/README\.md.*UTF-8/i)
    expect(fs.existsSync(path.join(target, 'stale.txt'))).toBe(true)
  })

  it('removes the complete Trellis tree entry from skills organization when later siblings exist', () => {
    const { source, target } = createFixture()
    writeFile(path.join(source, 'SKILLS_ORGANIZATION.md'), [
      '# Skills',
      '',
      '```text',
      'roles/',
      '├── trellis/',
      '│   ├── constants/',
      '│   └── skills/',
      '│       └── init-project/',
      '└── matt/',
      '    └── skills/',
      '```',
      '',
      'Keep this note.',
      '',
    ].join('\n'))

    const result = runMigrator(source, target, '--yes')

    expect(result.status, result.stderr).toBe(0)
    expect(fs.readFileSync(path.join(target, 'SKILLS_ORGANIZATION.md'), 'utf8')).toBe([
      '# Skills',
      '',
      '```text',
      'roles/',
      '└── matt/',
      '    └── skills/',
      '```',
      '',
      'Keep this note.',
      '',
    ].join('\n'))
  })

  it('loads the target directory and repository link from .env.local', () => {
    const { source, target } = createFixture()
    const repositoryUrl = 'https://git.example.local/team/from-local-file'
    writeFile(path.join(source, '.env.local'), [
      `AIRULES_MIGRATE_TARGET=${target.replaceAll('\\', '/')}`,
      `AIRULES_MIGRATE_REPOSITORY_URL=${repositoryUrl}`,
    ].join('\n'))

    const result = runMigrator(source, undefined, '--yes')

    expect(result.status, result.stderr).toBe(0)
    expect(result.stdout).toContain(`Target: ${target}`)
    expect(JSON.parse(fs.readFileSync(path.join(target, 'package.json'), 'utf8')).repository).toBe(repositoryUrl)
    expect(fs.existsSync(path.join(target, '.env.local'))).toBe(false)
  })

  it('supports process environment variables and lets CLI arguments override them', () => {
    const { root, source, target } = createFixture()
    const localTarget = path.join(root, 'local-target')
    const environmentTarget = path.join(root, 'environment-target')
    const environmentUrl = 'https://git.example.local/team/from-environment'
    const cliUrl = 'https://git.example.local/team/from-cli'
    writeFile(path.join(source, '.env.local'), [
      `AIRULES_MIGRATE_TARGET=${localTarget.replaceAll('\\', '/')}`,
      'AIRULES_MIGRATE_REPOSITORY_URL=https://git.example.local/team/from-local-file',
    ].join('\n'))

    const environmentResult = runMigratorWithEnvironment(source, undefined, {
      AIRULES_MIGRATE_REPOSITORY_URL: environmentUrl,
      AIRULES_MIGRATE_TARGET: environmentTarget,
    }, '--yes')
    expect(environmentResult.status, environmentResult.stderr).toBe(0)
    expect(JSON.parse(fs.readFileSync(path.join(environmentTarget, 'package.json'), 'utf8')).repository).toBe(environmentUrl)
    expect(fs.existsSync(localTarget)).toBe(false)

    const cliResult = runMigratorWithEnvironment(source, target, {
      AIRULES_MIGRATE_REPOSITORY_URL: environmentUrl,
      AIRULES_MIGRATE_TARGET: environmentTarget,
    }, '--repository-url', cliUrl, '--yes')
    expect(cliResult.status, cliResult.stderr).toBe(0)
    expect(JSON.parse(fs.readFileSync(path.join(target, 'package.json'), 'utf8')).repository).toBe(cliUrl)
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

  it('rejects repository links containing whitespace before cleaning the target', () => {
    const { source, target } = createFixture()
    writeFile(path.join(source, 'src', 'app.ts'))
    writeFile(path.join(target, 'stale.txt'))

    const result = runMigrator(source, target, '--repository-url', 'not a valid link', '--yes')

    expect(result.status).not.toBe(0)
    expect(result.stderr).toMatch(/without whitespace/i)
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
