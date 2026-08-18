import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'

const roleRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const entry = path.join(roleRoot, 'overlays', 'packages', 'cli', 'src', 'templates', 'additions', 'project', 'scripts', 'spec-proposals.mjs')
const roots = []

afterEach(() => {
  for (const root of roots.splice(0))
    fs.rmSync(root, { recursive: true, force: true })
})

function project() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'airules-spec-proposals-'))
  roots.push(root)
  fs.mkdirSync(path.join(root, '.moluoxixi', 'spec'), { recursive: true })
  return root
}

function write(root, relativePath, content) {
  const target = path.join(root, ...relativePath.split('/'))
  fs.mkdirSync(path.dirname(target), { recursive: true })
  fs.writeFileSync(target, content)
  return target
}

function run(root, args) {
  const result = spawnSync(process.execPath, [entry, ...args], { cwd: root, encoding: 'utf8' })
  return { status: result.status ?? -1, stdout: result.stdout, stderr: result.stderr }
}

function sha256(content) {
  return createHash('sha256').update(content).digest('hex')
}

function propose(root, target, content = '# Proposed\n') {
  const candidate = write(root, `candidate-${Math.random().toString(16).slice(2)}.md`, content)
  const result = run(root, ['propose', '--target', target, '--content-file', candidate, '--reason', 'test evidence'])
  expect(result).toMatchObject({ status: 0, stderr: '' })
  return result.stdout.trim()
}

describe('spec proposal governance', () => {
  it('requires a human approval record before promoting formal knowledge', () => {
    const root = project()
    const id = propose(root, 'backend/contracts.md', '# Contract\n')

    expect(run(root, ['apply', id]).stderr).toContain('--user-approved')
    expect(run(root, ['apply', id, '--user-approved'])).toMatchObject({ status: 1 })
    expect(run(root, ['review', id, '--decision', 'promote', '--by', 'tester']).stderr).toContain('--user-approved')
    expect(fs.existsSync(path.join(root, '.moluoxixi', 'spec', 'backend', 'contracts.md'))).toBe(false)

    expect(run(root, ['review', id, '--decision', 'promote', '--by', 'tester', '--user-approved'])).toMatchObject({ status: 0, stderr: '' })
    expect(run(root, ['apply', id, '--user-approved'])).toMatchObject({ status: 0, stderr: '' })
    expect(fs.readFileSync(path.join(root, '.moluoxixi', 'spec', 'backend', 'contracts.md'), 'utf8')).toBe('# Contract\n')
    expect(run(root, ['apply', id, '--user-approved']).stdout).toContain('already applied')
  })

  it('rejects stale approvals and backs up reviewed replacements', () => {
    const root = project()
    const changedCandidateId = propose(root, 'backend/candidate.md', '# Original\n')
    fs.writeFileSync(
      path.join(root, '.moluoxixi', 'spec-proposals', 'content', `${changedCandidateId}.md`),
      '# Changed before review\n',
    )
    expect(run(root, ['review', changedCandidateId, '--decision', 'promote', '--by', 'tester', '--user-approved']).stderr).toContain('content changed after creation')

    const target = write(root, '.moluoxixi/spec/backend/index.md', '# Old\n')
    const staleId = propose(root, 'backend/index.md', '# New\n')
    expect(run(root, ['review', staleId, '--decision', 'promote', '--by', 'tester', '--user-approved'])).toMatchObject({ status: 0 })
    fs.writeFileSync(target, '# Concurrent edit\n')
    expect(run(root, ['apply', staleId, '--user-approved']).stderr).toContain('changed after approval')
    expect(fs.readFileSync(target, 'utf8')).toBe('# Concurrent edit\n')

    const freshId = propose(root, 'backend/index.md', '# Reviewed\n')
    expect(run(root, ['review', freshId, '--decision', 'promote', '--by', 'tester', '--user-approved'])).toMatchObject({ status: 0 })
    expect(run(root, ['apply', freshId, '--user-approved'])).toMatchObject({ status: 0, stderr: '' })
    expect(fs.readFileSync(target, 'utf8')).toBe('# Reviewed\n')
    expect(fs.readFileSync(path.join(root, '.moluoxixi', 'spec-proposals', 'backups', freshId, 'backend', 'index.md'), 'utf8')).toBe('# Concurrent edit\n')
  })

  it('supports reviewed deletion and read-only periodic duplicate audits', () => {
    const root = project()
    write(root, '.moluoxixi/spec/retired.md', '# Retired\n')
    const deletion = run(root, ['propose', '--target', 'retired.md', '--delete', '--reason', 'obsolete'])
    expect(deletion).toMatchObject({ status: 0, stderr: '' })
    const deleteId = deletion.stdout.trim()
    expect(run(root, ['review', deleteId, '--decision', 'promote', '--by', 'tester', '--user-approved'])).toMatchObject({ status: 0 })
    expect(run(root, ['apply', deleteId, '--user-approved'])).toMatchObject({ status: 0, stderr: '' })
    expect(fs.existsSync(path.join(root, '.moluoxixi', 'spec', 'retired.md'))).toBe(false)

    propose(root, 'guides/safety.md', '# Same\n')
    propose(root, 'guides/safety.md', '# Same\n')
    const before = fs.readFileSync(path.join(root, '.moluoxixi', 'spec-proposals', 'history', 'events.jsonl'), 'utf8')
    const audit = run(root, ['audit', '--json'])
    expect(audit).toMatchObject({ status: 0, stderr: '' })
    expect(JSON.parse(audit.stdout)).toMatchObject({ due: true, pendingCount: 2 })
    expect(JSON.parse(audit.stdout).duplicateSets).toHaveLength(1)
    expect(fs.readFileSync(path.join(root, '.moluoxixi', 'spec-proposals', 'history', 'events.jsonl'), 'utf8')).toBe(before)
  })

  it('rejects unsafe targets and approval without explicit human control', () => {
    const root = project()
    const candidate = write(root, 'candidate.md', '# Candidate\n')
    expect(run(root, ['propose', '--target', '../outside.md', '--content-file', candidate]).stderr).toContain('Unsafe spec target')
    expect(run(root, ['audit', '--mark-reviewed', '--by', 'tester']).stderr).toContain('--user-approved')
    expect(fs.existsSync(path.join(root, 'outside.md'))).toBe(false)
  })

  it('binds approvals to the reviewed record and validates content before writing', () => {
    const root = project()
    const id = propose(root, 'backend/integrity.md', '# Reviewed\n')
    expect(run(root, ['review', id, '--decision', 'promote', '--by', 'tester', '--user-approved'])).toMatchObject({ status: 0 })

    const approvalFile = path.join(root, '.moluoxixi', 'spec-proposals', 'approvals', `${id}.json`)
    const approval = JSON.parse(fs.readFileSync(approvalFile, 'utf8'))
    approval.resolvedContent = '# Rewritten after review\n'
    approval.resolvedHash = sha256(approval.resolvedContent)
    fs.writeFileSync(approvalFile, `${JSON.stringify(approval, null, 2)}\n`)
    expect(run(root, ['apply', id, '--user-approved']).stderr).toContain('changed after human review')
    expect(fs.existsSync(path.join(root, '.moluoxixi', 'spec', 'backend', 'integrity.md'))).toBe(false)

    const eventsFile = path.join(root, '.moluoxixi', 'spec-proposals', 'history', 'events.jsonl')
    const events = fs.readFileSync(eventsFile, 'utf8').trimEnd().split(/\r?\n/u).map(line => JSON.parse(line))
    approval.resolvedHash = sha256('# Different content\n')
    fs.writeFileSync(approvalFile, `${JSON.stringify(approval, null, 2)}\n`)
    events.at(-1).approvalHash = sha256(fs.readFileSync(approvalFile))
    fs.writeFileSync(eventsFile, `${events.map(event => JSON.stringify(event)).join('\n')}\n`)
    expect(run(root, ['apply', id, '--user-approved']).stderr).toContain('does not match its recorded hash')
    expect(fs.existsSync(path.join(root, '.moluoxixi', 'spec', 'backend', 'integrity.md'))).toBe(false)
  })

  it('promotes reviewed text examples as well as Markdown guidance', () => {
    const root = project()
    const id = propose(root, 'backend/examples/client.ts.template', 'export const client = {}\n')
    expect(run(root, ['review', id, '--decision', 'promote', '--by', 'tester', '--user-approved'])).toMatchObject({ status: 0 })
    expect(run(root, ['apply', id, '--user-approved'])).toMatchObject({ status: 0, stderr: '' })
    expect(fs.readFileSync(path.join(root, '.moluoxixi', 'spec', 'backend', 'examples', 'client.ts.template'), 'utf8')).toBe('export const client = {}\n')
  })

  it('keeps every knowledge workflow on the proposal path', () => {
    const assetRoot = path.join(roleRoot, 'skills', 'init-project', 'assets')
    const files = []
    const visit = (directory) => {
      for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const target = path.join(directory, entry.name)
        if (entry.isDirectory())
          visit(target)
        else if (entry.isFile() && entry.name.endsWith('.md'))
          files.push(target)
      }
    }
    visit(assetRoot)
    const corpus = files.map(file => fs.readFileSync(file, 'utf8')).join('\n')
    for (const forbidden of [
      'Guidelines content -> Write to `.moluoxixi/spec/',
      '### Step 4: Make the Update',
      '**Commit the spec updates**',
      'Start filling in `.moluoxixi/spec/',
      'If YES, update the relevant spec doc',
      'Either edit the jsonl file directly',
    ]) {
      expect(corpus).not.toContain(forbidden)
    }
  })
})
