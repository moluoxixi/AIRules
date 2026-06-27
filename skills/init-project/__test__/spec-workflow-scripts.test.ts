import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { it } from 'vitest'

const scriptsDir = path.join(process.cwd(), 'skills', 'init-project', 'scripts')

function withTempDir<T>(run: (tmpDir: string) => T): T {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'airules-spec-'))
  try {
    return run(tmpDir)
  }
  finally {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  }
}

function run(script: string, ...args: string[]) {
  return spawnSync(process.execPath, [path.join(scriptsDir, script), ...args], { encoding: 'utf8' })
}

function writeMainSpec(root: string, capability: string, content: string) {
  const dir = path.join(root, '.airules', 'specs', capability)
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, 'spec.md'), content)
}

function writeDelta(root: string, changeId: string, capability: string, content: string) {
  const dir = path.join(root, '.airules', 'changes', changeId, 'specs', capability)
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, 'spec.md'), content)
}

// 填入有效 proposal（Why/What Changes 非空）+ 全部完成的 tasks，满足 archive/validate 内容门禁。
function seedValidChange(root: string, changeId: string) {
  const dir = path.join(root, '.airules', 'changes', changeId)
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, 'proposal.md'), `## Why\n\n解决一个真实问题。\n\n## What Changes\n\n- 增加能力 X\n\n## Impact\n\n无。\n`)
  fs.writeFileSync(path.join(dir, 'tasks.md'), `## 1. 组\n\n- [x] 1.1 完成任务\n`)
}

const MAIN_TWO_REQ = `# auth Specification

## Purpose
Auth.

## Requirements

### Requirement: Login
The system SHALL log in users.

#### Scenario: ok
- WHEN x
- THEN y

### Requirement: Logout
The system MUST log out users.

#### Scenario: ok
- WHEN a
- THEN b
`

const ADDED_DELTA = `## ADDED Requirements

### Requirement: Reset Password
The system SHALL allow password reset via email.

#### Scenario: reset
- WHEN user requests reset
- THEN an email is sent
`

it('spec-init - 建立 .airules spec 骨架且幂等', () => {
  withTempDir((root) => {
    const first = run('spec-init.mjs', root)
    assert.equal(first.status, 0, first.stderr)
    assert.equal(fs.existsSync(path.join(root, '.airules', 'specs')), true)
    assert.equal(fs.existsSync(path.join(root, '.airules', 'changes', 'archive')), true)

    const second = run('spec-init.mjs', root)
    assert.equal(second.status, 0)
    assert.match(second.stdout, /已存在，跳过/)
  })
})

it('spec-new-change - 建变更骨架，重复 id 报错', () => {
  withTempDir((root) => {
    run('spec-init.mjs', root)
    const r = run('spec-new-change.mjs', root, 'add-login')
    assert.equal(r.status, 0, r.stderr)
    assert.equal(fs.existsSync(path.join(root, '.airules', 'changes', 'add-login', 'proposal.md')), true)
    assert.equal(fs.existsSync(path.join(root, '.airules', 'changes', 'add-login', 'tasks.md')), true)

    const dup = run('spec-new-change.mjs', root, 'add-login')
    assert.notEqual(dup.status, 0)
    assert.match(dup.stderr, /已存在/)
  })
})

it('spec-new-change - 非法 change-id 报错', () => {
  withTempDir((root) => {
    run('spec-init.mjs', root)
    const r = run('spec-new-change.mjs', root, 'Bad_ID')
    assert.notEqual(r.status, 0)
    assert.match(r.stderr, /change-id 必须是小写/)
  })
})

it('spec-archive - 新 capability 的 ADDED 合并并归档', () => {
  withTempDir((root) => {
    run('spec-init.mjs', root)
    run('spec-new-change.mjs', root, 'add-reset')
    seedValidChange(root, 'add-reset')
    writeDelta(root, 'add-reset', 'auth', ADDED_DELTA)

    const r = run('spec-archive.mjs', root, 'add-reset')
    assert.equal(r.status, 0, r.stderr)

    const mainSpec = fs.readFileSync(path.join(root, '.airules', 'specs', 'auth', 'spec.md'), 'utf8')
    assert.match(mainSpec, /### Requirement: Reset Password/)
    assert.match(mainSpec, /## Purpose/)

    // change 已移到 archive，带日期前缀
    const archiveEntries = fs.readdirSync(path.join(root, '.airules', 'changes', 'archive'))
    assert.equal(archiveEntries.some(e => /^\d{4}-\d{2}-\d{2}-add-reset$/.test(e)), true)
    assert.equal(fs.existsSync(path.join(root, '.airules', 'changes', 'add-reset')), false)
  })
})

it('spec-archive - MODIFIED 替换、REMOVED 删除', () => {
  withTempDir((root) => {
    run('spec-init.mjs', root)
    writeMainSpec(root, 'auth', MAIN_TWO_REQ)
    run('spec-new-change.mjs', root, 'change1')
    seedValidChange(root, 'change1')
    writeDelta(root, 'change1', 'auth', `## MODIFIED Requirements

### Requirement: Login
The system SHALL log in users via OAuth.

#### Scenario: oauth
- WHEN o
- THEN p

## REMOVED Requirements

### Requirement: Logout
`)

    const r = run('spec-archive.mjs', root, 'change1')
    assert.equal(r.status, 0, r.stderr)

    const mainSpec = fs.readFileSync(path.join(root, '.airules', 'specs', 'auth', 'spec.md'), 'utf8')
    assert.match(mainSpec, /log in users via OAuth/)
    assert.doesNotMatch(mainSpec, /Requirement: Logout/)
  })
})

it('spec-archive - RENAMED 改名保留正文', () => {
  withTempDir((root) => {
    run('spec-init.mjs', root)
    writeMainSpec(root, 'auth', MAIN_TWO_REQ)
    run('spec-new-change.mjs', root, 'rename1')
    seedValidChange(root, 'rename1')
    writeDelta(root, 'rename1', 'auth', `## RENAMED Requirements

- FROM: \`### Requirement: Login\`
- TO: \`### Requirement: Sign In\`
`)

    const r = run('spec-archive.mjs', root, 'rename1')
    assert.equal(r.status, 0, r.stderr)
    const mainSpec = fs.readFileSync(path.join(root, '.airules', 'specs', 'auth', 'spec.md'), 'utf8')
    assert.match(mainSpec, /### Requirement: Sign In/)
    assert.match(mainSpec, /The system SHALL log in users\./)
    assert.doesNotMatch(mainSpec, /### Requirement: Login\b/)
  })
})

it('spec-archive - MODIFIED 不存在的 requirement 硬失败且不归档', () => {
  withTempDir((root) => {
    run('spec-init.mjs', root)
    writeMainSpec(root, 'auth', MAIN_TWO_REQ)
    run('spec-new-change.mjs', root, 'bad')
    seedValidChange(root, 'bad')
    writeDelta(root, 'bad', 'auth', `## MODIFIED Requirements

### Requirement: Nonexistent
The system SHALL do x.

#### Scenario: s
- WHEN x
- THEN y
`)

    const r = run('spec-archive.mjs', root, 'bad')
    assert.notEqual(r.status, 0)
    // 冲突时不部分写、不归档
    assert.equal(fs.existsSync(path.join(root, '.airules', 'changes', 'bad')), true)
    assert.equal(fs.readdirSync(path.join(root, '.airules', 'changes', 'archive')).length, 0)
    const mainSpec = fs.readFileSync(path.join(root, '.airules', 'specs', 'auth', 'spec.md'), 'utf8')
    assert.doesNotMatch(mainSpec, /Nonexistent/)
  })
})

it('spec-archive - 新 capability 用 MODIFIED 报错（只允许 ADDED）', () => {
  withTempDir((root) => {
    run('spec-init.mjs', root)
    run('spec-new-change.mjs', root, 'newcap')
    seedValidChange(root, 'newcap')
    writeDelta(root, 'newcap', 'billing', `## MODIFIED Requirements

### Requirement: Invoice
The system SHALL issue invoices.

#### Scenario: s
- WHEN x
- THEN y
`)

    const r = run('spec-archive.mjs', root, 'newcap')
    assert.notEqual(r.status, 0)
  })
})

it('spec-validate - 缺少 SHALL/MUST 或 Scenario 时失败', () => {
  withTempDir((root) => {
    run('spec-init.mjs', root)
    run('spec-new-change.mjs', root, 'badfmt')
    writeDelta(root, 'badfmt', 'auth', `## ADDED Requirements

### Requirement: No Modal Verb
The system allows something.

#### Scenario: s
- WHEN x
- THEN y
`)

    const r = run('spec-validate.mjs', root, 'badfmt')
    assert.notEqual(r.status, 0)
    assert.match(r.stdout, /缺少 SHALL\/MUST/)
  })
})

it('spec-validate - 合法 delta 通过', () => {
  withTempDir((root) => {
    run('spec-init.mjs', root)
    run('spec-new-change.mjs', root, 'okfmt')
    seedValidChange(root, 'okfmt')
    writeDelta(root, 'okfmt', 'auth', ADDED_DELTA)

    const r = run('spec-validate.mjs', root, 'okfmt')
    assert.equal(r.status, 0, r.stdout)
    assert.match(r.stdout, /PASS spec validate/)
  })
})
