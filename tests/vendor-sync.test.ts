import assert from 'node:assert'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { it } from 'vitest'
import { ensureVendorRepo } from '../scripts/lib/vendor-sync.js'

function git(cwd: string, args: string[]): string {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim()
}

function commitAll(cwd: string, message: string) {
  git(cwd, ['add', '.'])
  git(cwd, ['-c', 'user.name=Test User', '-c', 'user.email=test@example.com', 'commit', '-m', message])
}

it('ensureVendorRepo - overwrites a diverged local vendor repo with remote state', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'vendor-sync-'))
  const originRepo = path.join(tempRoot, 'origin.git')
  const remoteWork = path.join(tempRoot, 'remote-work')
  const homeDir = path.join(tempRoot, 'home')

  try {
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
  }
  finally {
    fs.rmSync(tempRoot, { recursive: true, force: true })
  }
})
