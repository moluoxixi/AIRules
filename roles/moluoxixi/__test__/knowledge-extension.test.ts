import { Buffer } from 'node:buffer'
import { execFileSync, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'

// The initializer is distributed as role-local JavaScript rather than a public TS module.
// @ts-expect-error no declaration file is shipped for the role-local entrypoint
import { installExtension } from '../skills/init-project/scripts/install-extension.mjs'
// @ts-expect-error no declaration file is shipped for the role-local entrypoint
import { localizeBootstrapTask } from '../skills/init-project/scripts/localize-bootstrap.mjs'

const roleRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const skillRoot = path.join(roleRoot, 'skills', 'init-project')
const temporaryRoots: string[] = []

afterEach(() => {
  for (const root of temporaryRoots.splice(0))
    fs.rmSync(root, { recursive: true, force: true })
})

function projectFixture(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'airules-knowledge-extension-'))
  temporaryRoots.push(root)
  fs.mkdirSync(path.join(root, '.moluoxixi'), { recursive: true })
  fs.writeFileSync(path.join(root, '.moluoxixi', 'workflow.md'), '# Workflow\n')
  fs.mkdirSync(path.join(root, '.codex'), { recursive: true })
  fs.writeFileSync(path.join(root, '.codex', 'hooks.json'), `${JSON.stringify({
    hooks: {
      UserPromptSubmit: [{ hooks: [{ type: 'command', command: 'python user-hook.py' }] }],
    },
    userSetting: true,
  }, null, 2)}\n`)
  return root
}

function resolvePython(): string | undefined {
  for (const candidate of ['python3', 'python']) {
    const result = spawnSync(candidate, ['--version'], { stdio: 'ignore' })
    if (result.status === 0)
      return candidate
  }
  return undefined
}

function sourceHash(root: string, name = 'api.md'): string {
  return createHash('sha256')
    .update(fs.readFileSync(path.join(root, '.moluoxixi', 'knowledge', 'sources', name)))
    .digest('hex')
}

function writeRelations(root: string, assets: Record<string, unknown>): void {
  fs.writeFileSync(
    path.join(root, '.moluoxixi', 'knowledge', 'relations.json'),
    `${JSON.stringify({ version: 1, assets }, null, 2)}\n`,
  )
}

function writeMappedAsset(root: string, hash = sourceHash(root)): void {
  const page = path.join(root, '.moluoxixi', 'knowledge', 'library', 'api.md')
  fs.writeFileSync(page, '# Organized API\n')
  writeRelations(root, {
    'concept:api': {
      page: 'library/api.md',
      sources: [{ path: 'api.md', sha256: hash }],
    },
  })
}

describe('role-owned knowledge extension', () => {
  it('installs knowledge data, skills, fallback rules, and an independent hook', () => {
    const root = projectFixture()
    const result = installExtension({ project: root, platforms: ['codex'] })

    expect(result.conflicts).toEqual([])
    expect(fs.readFileSync(path.join(root, '.moluoxixi', 'knowledge', 'index.md'), 'utf8')).toContain('# Project Knowledge')
    expect(fs.statSync(path.join(root, '.moluoxixi', 'knowledge', 'sources')).isDirectory()).toBe(true)
    expect(fs.statSync(path.join(root, '.moluoxixi', 'knowledge', 'library')).isDirectory()).toBe(true)
    expect(JSON.parse(fs.readFileSync(path.join(root, '.moluoxixi', 'knowledge', 'relations.json'), 'utf8'))).toEqual({
      version: 1,
      assets: {},
    })
    expect(fs.existsSync(path.join(root, '.moluoxixi', 'scripts', 'knowledge.py'))).toBe(true)
    expect(fs.existsSync(path.join(root, '.agents', 'skills', 'moluoxixi-knowledge', 'SKILL.md'))).toBe(true)
    expect(fs.readFileSync(path.join(root, 'AGENTS.md'), 'utf8')).toContain('MOLUOXIXI KNOWLEDGE:START')
    const expectedPython = process.platform === 'win32' ? 'python' : 'python3'
    const fallback = fs.readFileSync(path.join(root, 'AGENTS.md'), 'utf8')
    const knowledgeSkill = fs.readFileSync(path.join(root, '.agents', 'skills', 'moluoxixi-knowledge', 'SKILL.md'), 'utf8')
    expect(fallback).toContain(`${expectedPython} ./.moluoxixi/scripts/knowledge.py status --json`)
    expect(fallback).toContain('AIRULES:MOLUOXIXI-ZH-COMPAT:START')
    expect(fallback).toContain('Simplified Chinese')
    expect(fallback).toContain('explicit ASCII `--slug`')
    expect(knowledgeSkill).toContain(`${expectedPython} ./.moluoxixi/scripts/knowledge.py acknowledge`)
    expect(`${fallback}\n${knowledgeSkill}`).not.toContain('{{PYTHON_COMMAND}}')

    const hooks = JSON.parse(fs.readFileSync(path.join(root, '.codex', 'hooks.json'), 'utf8'))
    expect(hooks.userSetting).toBe(true)
    expect(JSON.stringify(hooks)).toContain('python user-hook.py')
    expect(JSON.stringify(hooks)).toContain('--airules-knowledge-hook')

    const manifest = JSON.parse(fs.readFileSync(path.join(root, '.moluoxixi', 'airules-init-manifest.json'), 'utf8'))
    expect(manifest.schemaVersion).toBe(1)
    expect(manifest.entries).toHaveProperty('.moluoxixi/scripts/knowledge.py')
    expect(manifest.entries).not.toHaveProperty('.moluoxixi/knowledge/index.md')
    expect(manifest.entries).not.toHaveProperty('.moluoxixi/knowledge/relations.json')
    expect(fs.existsSync(path.join(root, '.moluoxixi', '.template-hashes.json'))).toBe(false)
  })

  it('preserves all knowledge data on re-init and force', () => {
    const root = projectFixture()
    installExtension({ project: root, platforms: ['codex'] })
    fs.writeFileSync(path.join(root, '.moluoxixi', 'knowledge', 'index.md'), '# Custom Index\n')
    fs.writeFileSync(path.join(root, '.moluoxixi', 'knowledge', 'sources', 'api.md'), '# API\n')
    fs.writeFileSync(path.join(root, '.moluoxixi', 'knowledge', 'library', 'api.md'), '# Organized API\n')
    fs.writeFileSync(path.join(root, '.moluoxixi', 'knowledge', 'relations.json'), '{"version":1,"assets":{"custom":{}}}\n')
    fs.writeFileSync(path.join(root, '.moluoxixi', 'knowledge', '.state.json'), '{"custom":true}\n')

    const reinit = installExtension({ project: root, platforms: ['codex'] })
    const forced = installExtension({ project: root, platforms: ['codex'], force: true })

    expect(reinit.preserved).toContain('.moluoxixi/knowledge/index.md')
    expect(forced.preserved).toContain('.moluoxixi/knowledge/index.md')
    expect(fs.readFileSync(path.join(root, '.moluoxixi', 'knowledge', 'index.md'), 'utf8')).toBe('# Custom Index\n')
    expect(fs.readFileSync(path.join(root, '.moluoxixi', 'knowledge', 'sources', 'api.md'), 'utf8')).toBe('# API\n')
    expect(fs.readFileSync(path.join(root, '.moluoxixi', 'knowledge', 'library', 'api.md'), 'utf8')).toBe('# Organized API\n')
    expect(fs.readFileSync(path.join(root, '.moluoxixi', 'knowledge', 'relations.json'), 'utf8')).toBe('{"version":1,"assets":{"custom":{}}}\n')
    expect(fs.readFileSync(path.join(root, '.moluoxixi', 'knowledge', '.state.json'), 'utf8')).toBe('{"custom":true}\n')
  })

  it('treats a symlinked relation ledger as a conflict when the host supports symlinks', () => {
    const root = projectFixture()
    installExtension({ project: root, platforms: ['codex'] })
    const target = path.join(root, 'external-relations.json')
    const relationPath = path.join(root, '.moluoxixi', 'knowledge', 'relations.json')
    fs.writeFileSync(target, '{"version":1,"assets":{}}\n')
    fs.rmSync(relationPath)
    try {
      fs.symlinkSync(target, relationPath, 'file')
    }
    catch {
      return
    }

    const result = installExtension({ project: root, platforms: ['codex'] })
    expect(result.conflicts).toContain('.moluoxixi/knowledge/relations.json')
    expect(fs.lstatSync(relationPath).isSymbolicLink()).toBe(true)
  })

  it('merges its managed AGENTS block around existing project instructions', () => {
    const root = projectFixture()
    fs.writeFileSync(path.join(root, 'AGENTS.md'), '# Project Rules\n\nKeep this text.\n')

    installExtension({ project: root, platforms: ['codex'] })
    const installed = fs.readFileSync(path.join(root, 'AGENTS.md'), 'utf8')
    expect(installed).toContain('# Project Rules')
    expect(installed).toContain('MOLUOXIXI KNOWLEDGE:START')

    fs.writeFileSync(path.join(root, 'AGENTS.md'), installed.replace('Keep this text.', 'Keep the changed text.'))
    installExtension({ project: root, platforms: ['codex'] })
    expect(fs.readFileSync(path.join(root, 'AGENTS.md'), 'utf8')).toContain('Keep the changed text.')
  })

  it('preserves a user-modified managed file unless force is explicit', () => {
    const root = projectFixture()
    installExtension({ project: root, platforms: ['codex'] })
    const target = path.join(root, '.moluoxixi', 'scripts', 'knowledge.py')
    fs.writeFileSync(target, '# user modification\n')

    const result = installExtension({ project: root, platforms: ['codex'] })
    expect(result.conflicts).toContain('.moluoxixi/scripts/knowledge.py')
    expect(fs.readFileSync(target, 'utf8')).toBe('# user modification\n')

    const forced = installExtension({ project: root, platforms: ['codex'], force: true })
    expect(forced.updated).toContain('.moluoxixi/scripts/knowledge.py')
    expect(fs.readFileSync(target, 'utf8')).toContain('from common.knowledge import main')
  })

  it('restores only missing managed files originally created by the extension', () => {
    const root = projectFixture()
    installExtension({ project: root, platforms: ['codex'] })
    const createdTarget = path.join(root, '.moluoxixi', 'scripts', 'knowledge.py')
    fs.rmSync(createdTarget)

    const restored = installExtension({ project: root, platforms: ['codex'] })
    expect(restored.created).toContain('.moluoxixi/scripts/knowledge.py')
    expect(fs.readFileSync(createdTarget, 'utf8')).toContain('from common.knowledge import main')

    const userRoot = projectFixture()
    const userTarget = path.join(userRoot, '.agents', 'skills', 'moluoxixi-knowledge', 'SKILL.md')
    fs.mkdirSync(path.dirname(userTarget), { recursive: true })
    fs.writeFileSync(userTarget, '# User skill\n')
    installExtension({ project: userRoot, platforms: ['codex'], force: true })
    fs.rmSync(userTarget)

    const preserved = installExtension({ project: userRoot, platforms: ['codex'] })
    expect(preserved.preserved).toContain('.agents/skills/moluoxixi-knowledge/SKILL.md')
    expect(fs.existsSync(userTarget)).toBe(false)
  })

  it('rolls back every extension write when its transaction fails', () => {
    const root = projectFixture()

    expect(() => installExtension({
      project: root,
      platforms: ['codex'],
      failAfter: 2,
    })).toThrow(/rolled back/u)

    expect(fs.existsSync(path.join(root, '.moluoxixi', 'airules-init-manifest.json'))).toBe(false)
    expect(fs.existsSync(path.join(root, '.moluoxixi', 'knowledge'))).toBe(false)
    expect(fs.existsSync(path.join(root, 'AGENTS.md'))).toBe(false)
    expect(JSON.stringify(JSON.parse(fs.readFileSync(path.join(root, '.codex', 'hooks.json'), 'utf8')))).not.toContain('--airules-knowledge-hook')
  })

  it('keeps dry-run read-only', () => {
    const root = projectFixture()
    const result = installExtension({ project: root, platforms: ['codex'], dryRun: true })

    expect(result.created).toContain('.moluoxixi/knowledge/index.md')
    expect(result.created).toContain('.moluoxixi/knowledge/relations.json')
    expect(fs.existsSync(path.join(root, '.moluoxixi', 'knowledge'))).toBe(false)
    expect(fs.existsSync(path.join(root, '.moluoxixi', 'airules-init-manifest.json'))).toBe(false)
  })

  const python = resolvePython()
  const detectorIt = python ? it : it.skip
  detectorIt('gates acknowledgement and traces affected assets across source changes', () => {
    const root = projectFixture()
    installExtension({ project: root, platforms: ['codex'] })
    const source = path.join(root, '.moluoxixi', 'knowledge', 'sources', 'api.md')
    fs.writeFileSync(source, '# API\nVersion one\n')
    const script = path.join(root, '.moluoxixi', 'scripts', 'knowledge.py')
    const run = (args: string[]) => execFileSync(python!, [script, ...args], { cwd: root, encoding: 'utf8' })

    const first = JSON.parse(run(['status', '--json']))
    expect(first.added.map((entry: { path: string }) => entry.path)).toEqual(['api.md'])
    expect(JSON.parse(run(['sources', '--json']))['api.md'].sha256).toBe(sourceHash(root))
    expect(first.relation_errors).toContainEqual({ code: 'source_unmapped', path: 'api.md' })
    expect(() => run(['acknowledge', '--batch', first.batch_id])).toThrow()

    writeMappedAsset(root)
    const organized = JSON.parse(run(['status', '--json']))
    fs.writeFileSync(path.join(root, '.moluoxixi', 'knowledge', '.state.lock'), 'interrupted process\n')
    run(['acknowledge', '--batch', organized.batch_id])
    expect(JSON.parse(run(['status', '--json'])).pending).toBe(false)

    fs.writeFileSync(source, '# API\nVersion two\n')
    const modified = JSON.parse(run(['status', '--json']))
    expect(modified.modified).toHaveLength(1)
    expect(modified.impacted).toEqual([
      { source: 'api.md', change: 'modified', assets: ['concept:api'] },
    ])
    expect(modified.relation_errors).toContainEqual({
      code: 'relation_source_hash_stale',
      asset: 'concept:api',
      path: 'api.md',
    })

    const hook = spawnSync(python!, [
      path.join(root, '.moluoxixi', 'scripts', 'knowledge-hook.py'),
      '--platform',
      'codex',
      '--event',
      'prompt',
      '--airules-knowledge-hook',
    ], {
      cwd: root,
      encoding: 'utf8',
      input: JSON.stringify({ cwd: root }),
    })
    expect(hook.status, hook.stderr).toBe(0)
    const context = JSON.parse(hook.stdout).hookSpecificOutput.additionalContext
    expect(context).toContain('trust="untrusted-project-data"')
    expect(context).toContain('modified: api.md')
    expect(context).toContain('impacted: api.md -> concept:api')
    expect(context).toContain('relation error: relation_source_hash_stale')

    writeMappedAsset(root)
    const refreshed = JSON.parse(run(['status', '--json']))
    run(['acknowledge', '--batch', refreshed.batch_id])
    fs.rmSync(source)
    const deleted = JSON.parse(run(['status', '--json']))
    expect(deleted.deleted).toHaveLength(1)
    expect(deleted.impacted[0].assets).toEqual(['concept:api'])

    writeRelations(root, {})
    fs.rmSync(path.join(root, '.moluoxixi', 'knowledge', 'library', 'api.md'))
    const detached = JSON.parse(run(['status', '--json']))
    expect(detached.impacted[0].assets).toEqual(['concept:api'])
    expect(detached.relation_errors).toEqual([])
    run(['acknowledge', '--batch', detached.batch_id])
    expect(JSON.parse(run(['status', '--json'])).pending).toBe(false)
  }, 15_000)

  detectorIt('rejects malformed relations, missing pages, and dangling sources', () => {
    const root = projectFixture()
    installExtension({ project: root, platforms: ['codex'] })
    const knowledge = path.join(root, '.moluoxixi', 'knowledge')
    fs.writeFileSync(path.join(knowledge, 'sources', 'api.md'), '# API\n')
    const script = path.join(root, '.moluoxixi', 'scripts', 'knowledge.py')
    const runStatus = () => JSON.parse(execFileSync(python!, [script, 'status', '--json'], { cwd: root, encoding: 'utf8' }))

    fs.writeFileSync(path.join(knowledge, 'relations.json'), '{broken\n')
    expect(runStatus().relation_errors).toEqual([{ code: 'relations_json_invalid' }])

    writeRelations(root, {
      'concept:api': {
        page: 'library/missing.md',
        sources: [{ path: 'api.md', sha256: sourceHash(root) }],
      },
    })
    expect(runStatus().relation_errors).toContainEqual({
      code: 'asset_page_missing',
      asset: 'concept:api',
      path: 'library/missing.md',
    })

    writeRelations(root, {
      'concept:missing': {
        page: 'library/missing.md',
        sources: [{ path: 'missing.md', sha256: '0'.repeat(64) }],
      },
    })
    expect(runStatus().relation_errors).toContainEqual({
      code: 'relation_source_missing',
      asset: 'concept:missing',
      path: 'missing.md',
    })

    writeRelations(root, {
      'concept:unsafe': {
        page: '../outside.md',
        sources: [{ path: '../outside.md', sha256: '0'.repeat(64) }],
      },
    })
    const unsafe = runStatus().relation_errors
    expect(unsafe).toContainEqual({ code: 'relations_page_invalid', asset: 'concept:unsafe' })
    expect(unsafe).toContainEqual({
      code: 'relations_source_path_invalid',
      asset: 'concept:unsafe',
      path: '../outside.md',
    })

    fs.writeFileSync(path.join(knowledge, 'library', 'orphan.md'), '# Orphan\n')
    writeRelations(root, {})
    const orphaned = runStatus()
    expect(orphaned.relation_errors).toContainEqual({
      code: 'library_page_unmapped',
      path: 'library/orphan.md',
    })
    const rejected = spawnSync(python!, [script, 'acknowledge', '--batch', orphaned.batch_id], {
      cwd: root,
      encoding: 'utf8',
    })
    expect(rejected.status).toBe(1)
    expect(rejected.stderr).toContain('library_page_unmapped')

    writeRelations(root, { ['x'.repeat(100_000)]: {} })
    const hook = spawnSync(
      python!,
      [path.join(root, '.moluoxixi', 'scripts', 'knowledge-hook.py'), '--platform', 'codex', '--event', 'prompt'],
      { cwd: root, encoding: 'utf8' },
    )
    expect(hook.status).toBe(0)
    const context = JSON.parse(hook.stdout).hookSpecificOutput.additionalContext
    expect(Buffer.byteLength(context, 'utf8')).toBeLessThanOrEqual(24 * 1024)
    expect(context).toContain('Knowledge context truncated')
    expect(context).toMatch(/<\/moluoxixi-knowledge>$/u)
  })

  detectorIt('rejects a symlinked relation ledger when the host supports symlinks', () => {
    const root = projectFixture()
    installExtension({ project: root, platforms: ['codex'] })
    const relationPath = path.join(root, '.moluoxixi', 'knowledge', 'relations.json')
    const target = path.join(root, 'external-relations.json')
    fs.writeFileSync(target, '{"version":1,"assets":{}}\n')
    fs.rmSync(relationPath)
    try {
      fs.symlinkSync(target, relationPath, 'file')
    }
    catch {
      return
    }
    const script = path.join(root, '.moluoxixi', 'scripts', 'knowledge.py')
    const status = JSON.parse(execFileSync(python!, [script, 'status', '--json'], { cwd: root, encoding: 'utf8' }))
    expect(status.relation_errors).toEqual([{ code: 'relations_path_unsafe' }])
  })

  detectorIt('reads version 1 state and upgrades it after a relation-only acknowledgement', () => {
    const root = projectFixture()
    installExtension({ project: root, platforms: ['codex'] })
    const source = path.join(root, '.moluoxixi', 'knowledge', 'sources', 'api.md')
    fs.writeFileSync(source, '# API\n')
    const hash = sourceHash(root)
    fs.writeFileSync(
      path.join(root, '.moluoxixi', 'knowledge', '.state.json'),
      `${JSON.stringify({
        version: 1,
        processed: { 'api.md': { sha256: hash, size: fs.statSync(source).size } },
      })}\n`,
    )
    const script = path.join(root, '.moluoxixi', 'scripts', 'knowledge.py')
    const run = (args: string[]) => execFileSync(python!, [script, ...args], { cwd: root, encoding: 'utf8' })

    const unmapped = JSON.parse(run(['status', '--json']))
    expect(unmapped.state_upgrade_required).toBe(true)
    expect(unmapped.relation_errors).toContainEqual({ code: 'source_unmapped', path: 'api.md' })

    writeMappedAsset(root, hash)
    const status = JSON.parse(run(['status', '--json']))
    expect(status.added).toEqual([])
    expect(status.modified).toEqual([])
    expect(status.relations_modified).toBe(true)
    run(['acknowledge', '--batch', status.batch_id])
    const state = JSON.parse(fs.readFileSync(path.join(root, '.moluoxixi', 'knowledge', '.state.json'), 'utf8'))
    expect(state.version).toBe(2)
    expect(state.assets).toHaveProperty('concept:api')
    expect(JSON.parse(run(['status', '--json'])).pending).toBe(false)
  })

  it('runs the extension after the role CLI succeeds', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'airules-knowledge-wrapper-'))
    temporaryRoots.push(root)
    const fakeCli = path.join(root, 'fake-cli.mjs')
    fs.writeFileSync(fakeCli, `import fs from 'node:fs'; import path from 'node:path'; const task = path.join(process.cwd(), '.moluoxixi', 'tasks', '00-bootstrap-guidelines'); fs.mkdirSync(task, { recursive: true }); fs.writeFileSync(path.join(process.cwd(), '.moluoxixi', 'workflow.md'), '# Workflow\\n'); fs.writeFileSync(path.join(task, 'task.json'), JSON.stringify({ id: '00-bootstrap-guidelines', name: '00-bootstrap-guidelines', title: 'Bootstrap Guidelines', description: 'Fill in project development guidelines for AI agents', relatedFiles: ['.moluoxixi/spec/backend/'], notes: 'First-time setup task created by moluoxixi init (backend project)' }, null, 2)); fs.writeFileSync(path.join(task, 'prd.md'), '# Bootstrap Task: Fill Project Development Guidelines\\n');\n`)
    const wrapper = path.join(skillRoot, 'scripts', 'run-role-cli.mjs')
    const result = spawnSync(process.execPath, [wrapper, '--project', root, '--platform', 'codex', '--yes'], {
      cwd: root,
      encoding: 'utf8',
      env: { ...process.env, MOLUOXIXI_ROLE_CLI: fakeCli },
    })

    expect(result.status, result.stderr).toBe(0)
    expect(JSON.parse(result.stdout)).toMatchObject({
      freshInitialization: true,
      bootstrapTaskCreated: true,
      bootstrapLocalization: { status: 'updated' },
    })
    expect(fs.existsSync(path.join(root, '.moluoxixi', 'knowledge', 'index.md'))).toBe(true)
    expect(fs.existsSync(path.join(root, '.moluoxixi', 'airules-init-manifest.json'))).toBe(true)
    expect(JSON.parse(fs.readFileSync(path.join(root, '.moluoxixi', 'tasks', '00-bootstrap-guidelines', 'task.json'), 'utf8')).title).toBe('初始化项目规范')
    expect(fs.readFileSync(path.join(root, '.moluoxixi', 'tasks', '00-bootstrap-guidelines', 'prd.md'), 'utf8')).toContain('# 初始化任务：补充项目开发规范')
  })

  it('preserves an existing or customized bootstrap task', () => {
    const root = projectFixture()
    const taskRoot = path.join(root, '.moluoxixi', 'tasks', '00-bootstrap-guidelines')
    fs.mkdirSync(taskRoot, { recursive: true })
    const task = {
      id: '00-bootstrap-guidelines',
      name: '00-bootstrap-guidelines',
      title: 'Custom bootstrap',
      description: 'Fill in project development guidelines for AI agents',
      notes: 'First-time setup task created by moluoxixi init (backend project)',
    }
    fs.writeFileSync(path.join(taskRoot, 'task.json'), `${JSON.stringify(task, null, 2)}\n`)
    fs.writeFileSync(path.join(taskRoot, 'prd.md'), '# Bootstrap Task: Fill Project Development Guidelines\nCustom text\n')

    expect(localizeBootstrapTask({ project: root })).toEqual({ status: 'preserved', reason: 'customized-bootstrap' })
    expect(JSON.parse(fs.readFileSync(path.join(taskRoot, 'task.json'), 'utf8')).title).toBe('Custom bootstrap')
    expect(localizeBootstrapTask({ project: root, enabled: false })).toEqual({ status: 'preserved', reason: 'preexisting-task' })
  })

  it('reports re-initialization without claiming ownership of an existing bootstrap task', () => {
    const root = projectFixture()
    const taskRoot = path.join(root, '.moluoxixi', 'tasks', '00-bootstrap-guidelines')
    fs.mkdirSync(taskRoot, { recursive: true })
    fs.writeFileSync(path.join(taskRoot, 'task.json'), '{"title":"Custom bootstrap"}\n')
    const fakeCli = path.join(root, 'fake-cli.mjs')
    fs.writeFileSync(fakeCli, 'process.exitCode = 0\n')
    const wrapper = path.join(skillRoot, 'scripts', 'run-role-cli.mjs')
    const result = spawnSync(process.execPath, [wrapper, '--project', root, '--platform', 'codex', '--yes'], {
      cwd: root,
      encoding: 'utf8',
      env: { ...process.env, MOLUOXIXI_ROLE_CLI: fakeCli },
    })

    expect(result.status, result.stderr).toBe(0)
    expect(JSON.parse(result.stdout)).toMatchObject({
      freshInitialization: false,
      bootstrapTaskCreated: false,
      bootstrapLocalization: { status: 'preserved', reason: 'preexisting-task' },
    })
    expect(fs.readFileSync(path.join(taskRoot, 'task.json'), 'utf8')).toBe('{"title":"Custom bootstrap"}\n')
  })

  it('does not localize a bootstrap task created during re-initialization', () => {
    const root = projectFixture()
    const taskRoot = path.join(root, '.moluoxixi', 'tasks', '00-bootstrap-guidelines')
    const fakeCli = path.join(root, 'fake-cli.mjs')
    fs.writeFileSync(fakeCli, `import fs from 'node:fs'; import path from 'node:path'; const task = path.join(process.cwd(), '.moluoxixi', 'tasks', '00-bootstrap-guidelines'); fs.mkdirSync(task, { recursive: true }); fs.writeFileSync(path.join(task, 'task.json'), JSON.stringify({ id: '00-bootstrap-guidelines', name: '00-bootstrap-guidelines', title: 'Bootstrap Guidelines', description: 'Fill in project development guidelines for AI agents', notes: 'First-time setup task created by moluoxixi init (backend project)' }, null, 2)); fs.writeFileSync(path.join(task, 'prd.md'), '# Bootstrap Task: Fill Project Development Guidelines\\n');\n`)
    const wrapper = path.join(skillRoot, 'scripts', 'run-role-cli.mjs')
    const result = spawnSync(process.execPath, [wrapper, '--project', root, '--platform', 'codex', '--yes'], {
      cwd: root,
      encoding: 'utf8',
      env: { ...process.env, MOLUOXIXI_ROLE_CLI: fakeCli },
    })

    expect(result.status, result.stderr).toBe(0)
    expect(JSON.parse(result.stdout)).toMatchObject({
      freshInitialization: false,
      bootstrapTaskCreated: true,
      bootstrapLocalization: { status: 'preserved', reason: 'reinitialization' },
    })
    expect(JSON.parse(fs.readFileSync(path.join(taskRoot, 'task.json'), 'utf8')).title).toBe('Bootstrap Guidelines')
  })

  it('does not install the extension when the role CLI fails', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'airules-knowledge-wrapper-failure-'))
    temporaryRoots.push(root)
    const fakeCli = path.join(root, 'fake-cli.mjs')
    fs.writeFileSync(fakeCli, 'process.exitCode = 7\n')
    const wrapper = path.join(skillRoot, 'scripts', 'run-role-cli.mjs')
    const result = spawnSync(process.execPath, [wrapper, '--project', root, '--platform', 'codex', '--yes'], {
      cwd: root,
      encoding: 'utf8',
      env: { ...process.env, MOLUOXIXI_ROLE_CLI: fakeCli },
    })

    expect(result.status).toBe(7)
    expect(fs.existsSync(path.join(root, '.moluoxixi', 'knowledge'))).toBe(false)
  })

  it('uses separate plugin files for plugin-based hook hosts', () => {
    const root = projectFixture()
    installExtension({ project: root, platforms: ['opencode', 'pi', 'omp', 'snow'] })

    expect(fs.existsSync(path.join(root, '.opencode', 'plugins', 'moluoxixi-knowledge.js'))).toBe(true)
    expect(fs.existsSync(path.join(root, '.pi', 'extensions', 'moluoxixi-knowledge.ts'))).toBe(true)
    expect(fs.existsSync(path.join(root, '.omp', 'extensions', 'moluoxixi-knowledge.ts'))).toBe(true)
    const snow = JSON.parse(fs.readFileSync(path.join(root, '.snow', 'hooks', 'onUserMessage.json'), 'utf8'))
    expect(JSON.stringify(snow)).toContain('--airules-knowledge-hook')
  })

  it('projects the knowledge skill to every distinct host skill root', () => {
    const root = projectFixture()
    installExtension({ project: root, platforms: ['all'] })

    const roots = [
      '.agents/skills',
      '.agent/skills',
      '.claude/skills',
      '.codebuddy/skills',
      '.cursor/skills',
      '.devin/skills',
      '.factory/skills',
      '.github/skills',
      '.grok/skills',
      '.kilocode/skills',
      '.kiro/skills',
      '.omp/skills',
      '.opencode/skills',
      '.qoder/skills',
      '.reasonix/skills',
      '.snow/skills',
      '.trae/skills',
      '.zcode/skills',
    ]
    for (const skillDir of roots)
      expect(fs.existsSync(path.join(root, skillDir, 'moluoxixi-knowledge', 'SKILL.md')), skillDir).toBe(true)
  })
})
