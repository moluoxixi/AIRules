import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('host docs describe the skills-first projections for Claude, Codex, Qoder, tare, and openCode', () => {
  const claudeInstall = readFileSync(new URL('../.claude/INSTALL.md', import.meta.url), 'utf8');
  const claudeUpgrade = readFileSync(new URL('../.claude/UPGRADE.md', import.meta.url), 'utf8');
  const codexInstall = readFileSync(new URL('../.codex/INSTALL.md', import.meta.url), 'utf8');
  const codexUpgrade = readFileSync(new URL('../.codex/UPGRADE.md', import.meta.url), 'utf8');
  const codexAgents = readFileSync(new URL('../.codex/AGENTS.md', import.meta.url), 'utf8');
  const qoderInstall = readFileSync(new URL('../.qoder/INSTALL.md', import.meta.url), 'utf8');
  const qoderUpgrade = readFileSync(new URL('../.qoder/UPGRADE.md', import.meta.url), 'utf8');
  const tareInstall = readFileSync(new URL('../.tare/INSTALL.md', import.meta.url), 'utf8');
  const tareUpgrade = readFileSync(new URL('../.tare/UPGRADE.md', import.meta.url), 'utf8');
  const tareAgents = readFileSync(new URL('../.tare/AGENTS.md', import.meta.url), 'utf8');
  const opencodeInstall = readFileSync(new URL('../.opencode/INSTALL.md', import.meta.url), 'utf8');
  const opencodeUpgrade = readFileSync(new URL('../.opencode/UPGRADE.md', import.meta.url), 'utf8');

  for (const doc of [claudeInstall, claudeUpgrade]) {
    assert.match(doc, /~\/\.claude\/skills|~\\\.claude\\skills/);
    assert.match(doc, /~\/\.claude\/agents|~\\\.claude\\agents/);
    assert.doesNotMatch(doc, /~\/\.claude\/rules|~\\\.claude\\rules/);
  }

  for (const doc of [codexInstall, codexUpgrade, codexAgents]) {
    assert.match(doc, /~\/\.agents\/skills\/moluoxixi|~\\\.agents\\skills\\moluoxixi/);
    assert.match(doc, /~\/\.moluoxixi\/skills|~\\\.moluoxixi\\skills/);
  }

  assert.match(codexAgents, /first-party/i);
  assert.match(codexAgents, /superpowers/i);

  for (const doc of [qoderInstall, qoderUpgrade]) {
    assert.match(doc, /~\/\.qoder\/skills|~\\\.qoder\\skills/);
    assert.match(doc, /~\/\.qoder\/agents|~\\\.qoder\\agents/);
    assert.doesNotMatch(doc, /~\/\.qoder\/rules|~\\\.qoder\\rules/);
  }

  for (const doc of [tareInstall, tareUpgrade, tareAgents]) {
    assert.match(doc, /~\/\.agents\/skills\/moluoxixi|~\\\.agents\\skills\\moluoxixi/);
    assert.match(doc, /~\/\.moluoxixi\/skills|~\\\.moluoxixi\\skills/);
  }

  for (const doc of [opencodeInstall, opencodeUpgrade]) {
    assert.match(doc, /~\/\.config\/opencode\/skills|~\\\.config\\opencode\\skills/);
    assert.match(doc, /~\/\.moluoxixi\/skills|~\\\.moluoxixi\\skills/);
  }
});
