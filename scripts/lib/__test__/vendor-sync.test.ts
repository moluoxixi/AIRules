import type { Vendor } from '../vendors.js'
import assert from 'node:assert'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { it } from 'vitest'
import { ensureVendorRepo, getRemoteDefaultBranch, verifyVendorRepoRevision } from '../vendor-sync.js'

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

    const vendor: Vendor = {
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

    const vendor: Vendor = {
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

it('ensureVendorRepo - pinned revision remains stable after the remote branch advances', () => {
  withTempGitDir((tempRoot) => {
    const originRepo = path.join(tempRoot, 'origin.git')
    const remoteWork = path.join(tempRoot, 'remote-work')
    const homeDir = path.join(tempRoot, 'home')

    git(tempRoot, ['init', '--bare', originRepo])
    git(tempRoot, ['clone', originRepo, remoteWork])
    git(remoteWork, ['checkout', '-b', 'main'])

    const skillDir = path.join(remoteWork, 'skills', 'demo')
    fs.mkdirSync(skillDir, { recursive: true })
    fs.writeFileSync(path.join(skillDir, 'SKILL.md'), 'pinned\n')
    commitAll(remoteWork, 'pinned revision')
    const revision = git(remoteWork, ['rev-parse', 'HEAD'])
    git(remoteWork, ['push', '-u', 'origin', 'main'])

    fs.writeFileSync(path.join(skillDir, 'SKILL.md'), 'newer\n')
    commitAll(remoteWork, 'newer revision')
    git(remoteWork, ['push'])

    const cloneDir = ensureVendorRepo(homeDir, {
      repo: originRepo,
      revision,
      cloneDir: 'vendor/repos/demo',
      links: [{
        kind: 'skill',
        source: 'skills/demo',
        target: 'vendor/skills/demo',
      }],
    })

    assert.equal(fs.readFileSync(path.join(cloneDir, 'skills', 'demo', 'SKILL.md'), 'utf8').replace(/\r\n/gu, '\n'), 'pinned\n')
    assert.equal(git(cloneDir, ['rev-parse', 'HEAD']), revision)
    verifyVendorRepoRevision(homeDir, {
      repo: originRepo,
      revision,
      cloneDir: 'vendor/repos/demo',
      links: [],
    })
    git(cloneDir, ['checkout', 'main'])
    assert.throws(
      () => verifyVendorRepoRevision(homeDir, {
        repo: originRepo,
        revision,
        cloneDir: 'vendor/repos/demo',
        links: [],
      }),
      /checkout drifted/i,
    )
  })
}, GIT_INTEGRATION_TIMEOUT_MS)

it('verifyVendorRepoRevision - rejects dirty pinned and unpinned checkouts', () => {
  withTempGitDir((tempRoot) => {
    const originRepo = path.join(tempRoot, 'origin.git')
    const remoteWork = path.join(tempRoot, 'remote-work')
    const homeDir = path.join(tempRoot, 'home')

    git(tempRoot, ['init', '--bare', originRepo])
    git(tempRoot, ['clone', originRepo, remoteWork])
    git(remoteWork, ['checkout', '-b', 'main'])
    fs.mkdirSync(path.join(remoteWork, 'skills', 'demo'), { recursive: true })
    fs.writeFileSync(path.join(remoteWork, 'skills', 'demo', 'SKILL.md'), 'clean\n')
    fs.writeFileSync(path.join(remoteWork, '.gitignore'), 'scratch/\n')
    commitAll(remoteWork, 'initial')
    const revision = git(remoteWork, ['rev-parse', 'HEAD'])
    git(remoteWork, ['push', '-u', 'origin', 'main'])

    const baseVendor: Vendor = {
      repo: originRepo,
      cloneDir: 'vendor/repos/demo',
      links: [{
        kind: 'skill',
        source: 'skills/demo',
        target: 'vendor/skills/demo',
      }],
    }
    const cloneDir = ensureVendorRepo(homeDir, baseVendor)
    fs.writeFileSync(path.join(cloneDir, 'skills', 'demo', 'SKILL.md'), 'dirty\n')

    assert.throws(
      () => verifyVendorRepoRevision(homeDir, baseVendor),
      /checkout is dirty/i,
    )
    assert.throws(
      () => verifyVendorRepoRevision(homeDir, { ...baseVendor, revision }),
      /checkout is dirty/i,
    )

    git(cloneDir, ['reset', '--hard'])
    fs.mkdirSync(path.join(cloneDir, 'scratch'), { recursive: true })
    fs.writeFileSync(path.join(cloneDir, 'scratch', 'ignored.txt'), 'ignored but unsafe\n')
    assert.throws(
      () => verifyVendorRepoRevision(homeDir, baseVendor),
      /checkout is dirty/i,
    )
  })
}, GIT_INTEGRATION_TIMEOUT_MS)

it('verifyVendorRepoRevision - requires an existing checkout even when unpinned', () => {
  withTempGitDir((tempRoot) => {
    assert.throws(
      () => verifyVendorRepoRevision(path.join(tempRoot, 'home'), {
        repo: path.join(tempRoot, 'origin.git'),
        cloneDir: 'vendor/repos/demo',
        links: [],
      }),
      /checkout is missing/i,
    )
  })
})

it('verifyVendorRepoRevision - rejects clean unpinned remote role assets', () => {
  withTempGitDir((tempRoot) => {
    const originRepo = path.join(tempRoot, 'origin.git')
    const remoteWork = path.join(tempRoot, 'remote-work')
    const homeDir = path.join(tempRoot, 'home')

    git(tempRoot, ['init', '--bare', originRepo])
    git(tempRoot, ['clone', originRepo, remoteWork])
    git(remoteWork, ['checkout', '-b', 'main'])
    fs.mkdirSync(path.join(remoteWork, 'roles', 'demo'), { recursive: true })
    fs.writeFileSync(path.join(remoteWork, 'roles', 'demo', 'README.md'), 'fixture\n')
    commitAll(remoteWork, 'initial')
    git(remoteWork, ['push', '-u', 'origin', 'main'])

    ensureVendorRepo(homeDir, {
      repo: originRepo,
      cloneDir: 'vendor/repos/demo',
      links: [{
        kind: 'role-assets-dir',
        source: 'roles/demo',
        target: 'vendor',
      }],
    })

    assert.throws(
      () => verifyVendorRepoRevision(homeDir, {
        repo: originRepo,
        cloneDir: 'vendor/repos/demo',
        links: [{
          kind: 'role-assets-dir',
          source: 'roles/demo',
          target: 'vendor',
        }],
      }),
      /unpinned remote role assets.*--skip-vendors/i,
    )
  })
}, GIT_INTEGRATION_TIMEOUT_MS)

it('verifyVendorRepoRevision - rejects a checkout whose origin differs from the manifest', () => {
  withTempGitDir((tempRoot) => {
    const originRepo = path.join(tempRoot, 'origin.git')
    const otherRepo = path.join(tempRoot, 'other.git')
    const remoteWork = path.join(tempRoot, 'remote-work')
    const homeDir = path.join(tempRoot, 'home')

    git(tempRoot, ['init', '--bare', originRepo])
    git(tempRoot, ['init', '--bare', otherRepo])
    git(tempRoot, ['clone', originRepo, remoteWork])
    git(remoteWork, ['checkout', '-b', 'main'])
    fs.writeFileSync(path.join(remoteWork, 'README.md'), 'fixture\n')
    commitAll(remoteWork, 'initial')
    git(remoteWork, ['push', '-u', 'origin', 'main'])

    const vendor: Vendor = {
      repo: originRepo,
      cloneDir: 'vendor/repos/demo',
      links: [],
    }
    const cloneDir = ensureVendorRepo(homeDir, vendor)
    git(cloneDir, ['remote', 'set-url', 'origin', otherRepo])

    assert.throws(
      () => verifyVendorRepoRevision(homeDir, vendor),
      /origin mismatch/i,
    )
    assert.throws(
      () => ensureVendorRepo(homeDir, vendor),
      /origin mismatch/i,
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

it('ensureVendorRepo - 远程仓库只检出配置需要的 sparse 目录', () => {
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

it('ensureVendorRepo - 远程仓库重跑时修复历史空 sparse pattern', () => {
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

    const cloneDir = path.join(homeDir, 'vendor', 'repos', 'remote-demo')
    fs.mkdirSync(path.dirname(cloneDir), { recursive: true })
    git(path.dirname(cloneDir), ['clone', '--depth', '1', '--filter=blob:none', '--sparse', repoUrl, cloneDir])
    git(cloneDir, ['sparse-checkout', 'set', '--no-cone'])

    assert.equal(git(cloneDir, ['sparse-checkout', 'list']).includes('skills'), false)
    assert.equal(fs.existsSync(path.join(cloneDir, 'skills', 'demo', 'SKILL.md')), false)

    ensureVendorRepo(homeDir, {
      repo: repoUrl,
      cloneDir: 'vendor/repos/remote-demo',
      links: [{
        kind: 'skill',
        source: 'skills/demo',
        target: 'vendor/skills/demo',
      }],
    })

    assert.ok(fs.existsSync(path.join(cloneDir, 'skills', 'demo', 'SKILL.md')))
    assert.equal(git(cloneDir, ['sparse-checkout', 'list']), 'skills')
    assert.equal(fs.existsSync(path.join(cloneDir, 'docs', 'README.md')), false)
  })
}, GIT_INTEGRATION_TIMEOUT_MS)

function normalizePath(value: string) {
  return value.replace(/\\/g, '/')
}
