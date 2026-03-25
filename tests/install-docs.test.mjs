import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('install docs mention the superpowers-first flow and ~/.moluoxixi layout', () => {
  const claudeInstall = readFileSync(new URL('../.claude/INSTALL.md', import.meta.url), 'utf8');
  const codexInstall = readFileSync(new URL('../.codex/INSTALL.md', import.meta.url), 'utf8');

  assert.match(claudeInstall, /superpowers/i);
  assert.match(codexInstall, /superpowers/i);
  assert.match(claudeInstall, /~\/\.moluoxixi|~\\.moluoxixi/);
  assert.match(codexInstall, /~\/\.moluoxixi|~\\.moluoxixi/);
});
