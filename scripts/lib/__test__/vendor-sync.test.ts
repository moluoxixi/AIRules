import assert from 'node:assert'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { it } from 'vitest'
import { ensureVendorRepo, getRemoteDefaultBranch } from '../vendor-sync.js'

const GIT_INTEGRATION_TIMEOUT_MS = 30000

function git(cwd: string, args: string[]): string {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim()
}

function commitAll(cwd: string, message: string) {
  git(cwd, ['add', '.'])
  git(cwd, ['-c', 'user.name=Test User', '-c', 'user.email=test@example.com', 'commit', '-m', message])
}

function withTempGitDir<T>(run: (tempRoot: string) => T): T {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'vendor-sync-'))

  try {
    return run(tempRoot)
  }
  finally {
    fs.rmSync(tempRoot, { recursive: true, force: true })
  }
}

it('ensureVendorRepo - overwrites a diverged local vendor repo with remote state', () => {
  withTempGitDir((tempRoot) => {
    const originRepo = path.join(tempRoot, 'origin.git')
    const remoteWork = path.join(tempRoot, 'remote-work')
    const homeDir = path.join(tempRoot, 'home')

    git(tempRoot, ['init', '--bare', originRepo])
    git(tempRoot, ['clone', originRepo, remoteWork])
    git(remoteWork, ['checkout', '-b', 'main'])

    const skillDir = path.join(remoteWork, 'skills', 'demo')
    fs.mkdirSync(skillDir, { recursive: true })
    fs.writeFileSync(path.join(skillDir, 'SKILL.md'), 'remote initial\n')
    commitAll(remoteWork, 'initial remote skill')
    git(remoteWork, ['push', '-u', 'origin', 'main'])

    const vendor = {
      repo: originRepo,
      cloneDir: 'vendor/repos/demo',
      links: [{
        kind: 'skill',
        source: 'skills/demo',
        target: 'vendor/skills/demo',
      }],
    }

    const cloneDir = ensureVendorRepo(homeDir, vendor)

    fs.writeFileSync(path.join(cloneDir, 'skills', 'demo', 'LOCAL_ONLY.md'), 'local only\n')
    commitAll(cloneDir, 'local-only commit')

    fs.writeFileSync(path.join(remoteWork, 'skills', 'demo', 'SKILL.md'), 'remote latest\n')
    commitAll(remoteWork, 'remote latest skill')
    git(remoteWork, ['push'])

    fs.writeFileSync(path.join(cloneDir, 'skills', 'demo', 'SKILL.md'), 'dirty local edit\n')

    ensureVendorRepo(homeDir, vendor)

    assert.strictEqual(
      fs.readFileSync(path.join(cloneDir, 'skills', 'demo', 'SKILL.md'), 'utf8').replace(/\r\n/g, '\n'),
      'remote latest\n',
    )
    assert.strictEqual(
      fs.existsSync(path.join(cloneDir, 'skills', 'demo', 'LOCAL_ONLY.md')),
      false,
      'local-only commit should be overwritten by remote state',
    )
  })
}, GIT_INTEGRATION_TIMEOUT_MS)

it('ensureVendorRepo - handles non-fast-forward remote branch updates', () => {
  withTempGitDir((tempRoot) => {
    const originRepo = path.join(tempRoot, 'origin.git')
    const remoteWork = path.join(tempRoot, 'remote-work')
    const homeDir = path.join(tempRoot, 'home')

    git(tempRoot, ['init', '--bare', originRepo])
    git(tempRoot, ['clone', originRepo, remoteWork])
    git(remoteWork, ['checkout', '-b', 'main'])

    const skillDir = path.join(remoteWork, 'skills', 'demo')
    fs.mkdirSync(skillDir, { recursive: true })
    fs.writeFileSync(path.join(skillDir, 'SKILL.md'), 'remote initial\n')
    commitAll(remoteWork, 'initial remote skill')
    git(remoteWork, ['push', '-u', 'origin', 'main'])

    const vendor = {
      repo: originRepo,
      cloneDir: 'vendor/repos/demo',
      links: [{
        kind: 'skill',
        source: 'skills/demo',
        target: 'vendor/skills/demo',
      }],
    }

    const cloneDir = ensureVendorRepo(homeDir, vendor)

    fs.writeFileSync(path.join(skillDir, 'SKILL.md'), 'remote rewritten\n')
    git(remoteWork, ['add', '.'])
    git(remoteWork, ['-c', 'user.name=Test User', '-c', 'user.email=test@example.com', 'commit', '--amend', '-m', 'rewritten remote skill'])
    git(remoteWork, ['push', '--force', 'origin', 'main'])

    ensureVendorRepo(homeDir, vendor)

    assert.strictEqual(
      fs.readFileSync(path.join(cloneDir, 'skills', 'demo', 'SKILL.md'), 'utf8').replace(/\r\n/g, '\n'),
      'remote rewritten\n',
    )
  })
}, GIT_INTEGRATION_TIMEOUT_MS)

it('getRemoteDefaultBranch - 从 origin/HEAD symbolic-ref 读取默认分支', () => {
  withTempGitDir((tempRoot) => {
    const originRepo = path.join(tempRoot, 'origin.git')
    const remoteWork = path.join(tempRoot, 'remote-work')
    const cloneDir = path.join(tempRoot, 'clone')

    git(tempRoot, ['init', '--bare', originRepo])
    git(tempRoot, ['clone', originRepo, remoteWork])
    git(remoteWork, ['checkout', '-b', 'trunk'])
    fs.writeFileSync(path.join(remoteWork, 'README.md'), 'demo\n')
    commitAll(remoteWork, 'initial')
    git(remoteWork, ['push', '-u', 'origin', 'trunk'])
    git(tempRoot, ['clone', originRepo, cloneDir])

    assert.strictEqual(getRemoteDefaultBranch(cloneDir), 'trunk')
  })
}, GIT_INTEGRATION_TIMEOUT_MS)

it('getRemoteDefaultBranch - 只有单个远端分支时作为 fallback', () => {
  withTempGitDir((tempRoot) => {
    const originRepo = path.join(tempRoot, 'origin.git')
    const remoteWork = path.join(tempRoot, 'remote-work')
    const cloneDir = path.join(tempRoot, 'clone')

    git(tempRoot, ['init', '--bare', originRepo])
    git(tempRoot, ['clone', originRepo, remoteWork])
    git(remoteWork, ['checkout', '-b', 'feature-only'])
    fs.writeFileSync(path.join(remoteWork, 'README.md'), 'demo\n')
    commitAll(remoteWork, 'initial')
    git(remoteWork, ['push', '-u', 'origin', 'feature-only'])
    git(tempRoot, ['clone', originRepo, cloneDir])
    git(cloneDir, ['remote', 'set-head', 'origin', '--delete'])

    assert.strictEqual(getRemoteDefaultBranch(cloneDir), 'feature-only')
  })
}, GIT_INTEGRATION_TIMEOUT_MS)

it('getRemoteDefaultBranch - 无法判断默认分支时显式失败', () => {
  withTempGitDir((tempRoot) => {
    const originRepo = path.join(tempRoot, 'origin.git')
    const remoteWork = path.join(tempRoot, 'remote-work')
    const cloneDir = path.join(tempRoot, 'clone')

    git(tempRoot, ['init', '--bare', originRepo])
    git(tempRoot, ['clone', originRepo, remoteWork])
    git(remoteWork, ['checkout', '-b', 'first'])
    fs.writeFileSync(path.join(remoteWork, 'README.md'), 'first\n')
    commitAll(remoteWork, 'initial first')
    git(remoteWork, ['push', '-u', 'origin', 'first'])
    git(remoteWork, ['checkout', '-b', 'second'])
    fs.writeFileSync(path.join(remoteWork, 'README.md'), 'second\n')
    commitAll(remoteWork, 'initial second')
    git(remoteWork, ['push', '-u', 'origin', 'second'])
    git(tempRoot, ['clone', originRepo, cloneDir])
    git(cloneDir, ['remote', 'set-head', 'origin', '--delete'])

    assert.throws(
      () => getRemoteDefaultBranch(cloneDir),
      /Unable to determine origin default branch/,
    )
  })
}, GIT_INTEGRATION_TIMEOUT_MS)

it('ensureVendorRepo - 远程仓库使用 sparse clone 和 reapply', () => {
  withTempGitDir((tempRoot) => {
    const originRepo = path.join(tempRoot, 'origin.git')
    const remoteWork = path.join(tempRoot, 'remote-work')
    const homeDir = path.join(tempRoot, 'home')
    const repoUrl = `file://${normalizePath(originRepo)}`

    git(tempRoot, ['init', '--bare', originRepo])
    git(tempRoot, ['clone', originRepo, remoteWork])
    git(remoteWork, ['checkout', '-b', 'main'])
    fs.mkdirSync(path.join(remoteWork, 'skills', 'demo'), { recursive: true })
    fs.mkdirSync(path.join(remoteWork, 'docs'), { recursive: true })
    fs.writeFileSync(path.join(remoteWork, 'skills', 'demo', 'SKILL.md'), 'remote\n')
    fs.writeFileSync(path.join(remoteWork, 'docs', 'README.md'), 'docs\n')
    commitAll(remoteWork, 'initial remote')
    git(remoteWork, ['push', '-u', 'origin', 'main'])

    const cloneDir = ensureVendorRepo(homeDir, {
      repo: repoUrl,
      cloneDir: 'vendor/repos/remote-demo',
      links: [{
        kind: 'skill',
        source: 'skills/demo',
        target: 'vendor/skills/demo',
      }],
    })

    assert.ok(fs.existsSync(path.join(cloneDir, 'skills', 'demo', 'SKILL.md')))
    assert.equal(fs.existsSync(path.join(cloneDir, 'docs', 'README.md')), false)
  })
}, GIT_INTEGRATION_TIMEOUT_MS)

function normalizePath(value: string) {
  return value.replace(/\\/g, '/')
}
