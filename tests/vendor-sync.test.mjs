import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
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
  // 使用本地路径（不用 file:// URL），本地 clone 不支持 --filter 但 depth/sparse 可以工作
  const remoteUrl = remoteDir;

  try {
    mkdirSync(seedDir, { recursive: true });
    runGit(['init', '--bare', remoteDir], tempDir);
    runGit(['init', '-b', 'canary', seedDir], tempDir);
    runGit(['config', 'user.name', 'Test User'], seedDir);
    runGit(['config', 'user.email', 'test@example.com'], seedDir);

    // 创建 skills 子目录和 docs 子目录（用于 sparse-checkout 测试）
    mkdirSync(path.join(seedDir, 'skills'), { recursive: true });
    mkdirSync(path.join(seedDir, 'docs'), { recursive: true });
    writeFileSync(path.join(seedDir, 'README.md'), 'v1\n');
    writeFileSync(path.join(seedDir, 'skills', 'example.md'), 'skill v1\n');
    writeFileSync(path.join(seedDir, 'docs', 'guide.md'), 'doc v1\n');
    runGit(['add', '.'], seedDir);
    runGit(['commit', '-m', 'init'], seedDir);
    runGit(['remote', 'add', 'origin', remoteDir], seedDir);
    runGit(['push', '-u', 'origin', 'canary'], seedDir);

    // 第一次 clone，带 links 配置以触发 sparse-checkout
    ensureVendorRepo(homeDir, {
      repo: remoteUrl,
      cloneDir: 'vendors/sample-repo',
      links: [
        { source: 'skills/example.md', target: 'skills/example.md' }
      ]
    });

    // 验证 sparse-checkout：skills 目录应该存在，docs 目录不应该存在
    assert.ok(existsSync(path.join(cloneDir, 'skills')), 'skills directory should exist after sparse-checkout');
    assert.ok(existsSync(path.join(cloneDir, 'skills', 'example.md')), 'skills/example.md should exist');
    assert.ok(!existsSync(path.join(cloneDir, 'docs')), 'docs directory should NOT exist after sparse-checkout (excluded)');

    const firstCommit = runGit(['rev-parse', 'HEAD'], cloneDir);
    runGit(['checkout', firstCommit], cloneDir);

    writeFileSync(path.join(seedDir, 'skills', 'example.md'), 'skill v2\n');
    runGit(['add', 'skills/example.md'], seedDir);
    runGit(['commit', '-m', 'update'], seedDir);
    runGit(['push', 'origin', 'canary'], seedDir);

    ensureVendorRepo(homeDir, {
      repo: remoteUrl,
      cloneDir: 'vendors/sample-repo',
      links: [
        { source: 'skills/example.md', target: 'skills/example.md' }
      ]
    });

    const currentBranch = runGit(['branch', '--show-current'], cloneDir);
    const fileContent = runGit(['show', 'HEAD:skills/example.md'], cloneDir);

    assert.equal(getRemoteDefaultBranch(cloneDir), 'canary');
    assert.equal(currentBranch, 'canary');
    assert.equal(fileContent, 'skill v2');
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});
