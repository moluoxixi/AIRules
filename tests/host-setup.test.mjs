import test from 'node:test';
import assert from 'node:assert/strict';
import {
  cpSync,
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

function stageRepoFixture(tempDir) {
  const repoRoot = path.join(tempDir, 'repo');
  mkdirSync(repoRoot, { recursive: true });

  for (const entry of [
    'AGENTS.md',
    '.codex',
    '.claude',
    '.qoder',
    '.tare',
    '.opencode',
    'agents',
    'constants',
    'scripts',
    'skills'
  ]) {
    cpSync(path.resolve(entry), path.join(repoRoot, entry), { recursive: true });
  }

  return repoRoot;
}

function runNode(args, cwd) {
  const result = spawnSync('node', args, {
    cwd,
    encoding: 'utf8',
    shell: process.platform === 'win32'
  });

  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || `node ${args.join(' ')} failed`);
  }

  return result.stdout;
}

test('host-setup installs the selected host baseline and skills projection', () => {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), 'ai-rules-host-setup-'));
  const repoRoot = stageRepoFixture(tempDir);
  const homeRoot = path.join(tempDir, 'home');
  const moluoHome = path.join(homeRoot, '.moluoxixi');

  try {
    runNode([
      'scripts/host-setup.mjs',
      '--host', 'codex',
      '--mode', 'install',
      '--home', moluoHome,
      '--skip-vendors'
    ], repoRoot);

    assert.equal(existsSync(path.join(moluoHome, 'AGENTS.md')), true);
    assert.equal(existsSync(path.join(moluoHome, 'skills')), true);
    assert.equal(existsSync(path.join(homeRoot, '.agents', 'skills', 'moluoxixi')), true);
    assert.equal(existsSync(path.join(homeRoot, '.codex', 'AGENTS.md')), true);

    const sharedBaseline = readFileSync(path.join(moluoHome, 'AGENTS.md'), 'utf8');
    const codexBaseline = readFileSync(path.join(homeRoot, '.codex', 'AGENTS.md'), 'utf8');
    assert.equal(sharedBaseline, codexBaseline);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});
