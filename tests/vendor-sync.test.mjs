import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import { ensureVendorRepo, getRemoteDefaultBranch } from '../scripts/lib/vendor-sync.mjs';

function runGit(args, cwd) {
  const result = spawnSync('git', args, {
    cwd,
    encoding: 'utf8',
    shell: process.platform === 'win32'
  });

  if (result.status !== 0) {
    throw new Error(`git ${args.join(' ')} failed: ${(result.stderr ?? '').trim()}`);
  }

  return (result.stdout ?? '').trim();
}

test('ensureVendorRepo recovers detached HEAD and syncs to origin default branch', () => {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), 'ai-rules-vendor-sync-'));
  const remoteDir = path.join(tempDir, 'remote.git');
  const seedDir = path.join(tempDir, 'seed');
  const homeDir = path.join(tempDir, 'home');
  const cloneDir = path.join(homeDir, 'vendors', 'sample-repo');

  try {
    mkdirSync(seedDir, { recursive: true });
    runGit(['init', '--bare', remoteDir], tempDir);
    runGit(['init', '-b', 'canary', seedDir], tempDir);
    runGit(['config', 'user.name', 'Test User'], seedDir);
    runGit(['config', 'user.email', 'test@example.com'], seedDir);

    writeFileSync(path.join(seedDir, 'README.md'), 'v1\n');
    runGit(['add', 'README.md'], seedDir);
    runGit(['commit', '-m', 'init'], seedDir);
    runGit(['remote', 'add', 'origin', remoteDir], seedDir);
    runGit(['push', '-u', 'origin', 'canary'], seedDir);

    ensureVendorRepo(homeDir, {
      repo: remoteDir,
      cloneDir: 'vendors/sample-repo'
    });

    const firstCommit = runGit(['rev-parse', 'HEAD'], cloneDir);
    runGit(['checkout', firstCommit], cloneDir);

    writeFileSync(path.join(seedDir, 'README.md'), 'v2\n');
    runGit(['add', 'README.md'], seedDir);
    runGit(['commit', '-m', 'update'], seedDir);
    runGit(['push', 'origin', 'canary'], seedDir);

    ensureVendorRepo(homeDir, {
      repo: remoteDir,
      cloneDir: 'vendors/sample-repo'
    });

    const currentBranch = runGit(['branch', '--show-current'], cloneDir);
    const fileContent = runGit(['show', 'HEAD:README.md'], cloneDir);

    assert.equal(getRemoteDefaultBranch(cloneDir), 'canary');
    assert.equal(currentBranch, 'canary');
    assert.equal(fileContent, 'v2');
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});
