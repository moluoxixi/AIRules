import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const filesToScan = [
  '../README.md',
  '../.claude/INSTALL.md',
  '../.claude/UPGRADE.md',
  '../.codex/INSTALL.md',
  '../.codex/UPGRADE.md',
  '../.codex/AGENTS.md',
  '../.qoder/INSTALL.md',
  '../.qoder/UPGRADE.md',
  '../.opencode/INSTALL.md',
  '../.opencode/UPGRADE.md',
  '../scripts/lib/install.mjs'
];

const forbiddenPatterns = [
  /~\/\.moluoxixi\/rules|~\\\.moluoxixi\\rules/,
  /~\/\.claude\/rules|~\\\.claude\\rules/,
  /~\/\.qoder\/rules|~\\\.qoder\\rules/,
  /~\/\.agents\/skills\/superpowers|~\\\.agents\\skills\\superpowers/,
  /rules-first/i,
  /Layered Rule Inheritance/i
];

test('core entrypoints no longer describe a rules-first installation', () => {
  for (const relativePath of filesToScan) {
    const content = readFileSync(new URL(relativePath, import.meta.url), 'utf8');
    for (const pattern of forbiddenPatterns) {
      assert.doesNotMatch(content, pattern, `${relativePath} should not match ${pattern}`);
    }
  }
});
