import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('host docs and host baseline files describe the skills-first projections', () => {
  const claudeInstall = readFileSync(new URL('../.claude/INSTALL.md', import.meta.url), 'utf8');
  const claudeUpgrade = readFileSync(new URL('../.claude/UPGRADE.md', import.meta.url), 'utf8');
  const claudeGlobal = readFileSync(new URL('../.claude/CLAUDE.md', import.meta.url), 'utf8');
  const codexInstall = readFileSync(new URL('../.codex/INSTALL.md', import.meta.url), 'utf8');
  const codexUpgrade = readFileSync(new URL('../.codex/UPGRADE.md', import.meta.url), 'utf8');
  const codexAgents = readFileSync(new URL('../.codex/AGENTS.md', import.meta.url), 'utf8');
  const qoderInstall = readFileSync(new URL('../.qoder/INSTALL.md', import.meta.url), 'utf8');
  const qoderUpgrade = readFileSync(new URL('../.qoder/UPGRADE.md', import.meta.url), 'utf8');
  const qoderAgents = readFileSync(new URL('../.qoder/AGENTS.md', import.meta.url), 'utf8');
  const tareInstall = readFileSync(new URL('../.tare/INSTALL.md', import.meta.url), 'utf8');
  const tareUpgrade = readFileSync(new URL('../.tare/UPGRADE.md', import.meta.url), 'utf8');
  const tareAgents = readFileSync(new URL('../.tare/AGENTS.md', import.meta.url), 'utf8');
  const opencodeInstall = readFileSync(new URL('../.opencode/INSTALL.md', import.meta.url), 'utf8');
  const opencodeUpgrade = readFileSync(new URL('../.opencode/UPGRADE.md', import.meta.url), 'utf8');
  const opencodeAgents = readFileSync(new URL('../.opencode/AGENTS.md', import.meta.url), 'utf8');

  for (const doc of [claudeInstall, claudeUpgrade, claudeGlobal]) {
    assert.match(doc, /~\/\.claude\/skills|~\\\.claude\\skills/);
    assert.match(doc, /~\/\.moluoxixi\/skills|~\\\.moluoxixi\\skills/);
    assert.doesNotMatch(doc, /~\/\.claude\/rules|~\\\.claude\\rules/);
  }
  assert.match(claudeGlobal, /skills-first/i);
  assert.match(claudeGlobal, /superpowers/i);

  for (const doc of [codexInstall, codexUpgrade, codexAgents]) {
    assert.match(doc, /~\/\.agents\/skills\/moluoxixi|~\\\.agents\\skills\\moluoxixi/);
    assert.match(doc, /~\/\.moluoxixi\/skills|~\\\.moluoxixi\\skills/);
  }
  assert.match(codexAgents, /superpowers/i);
  assert.match(codexAgents, /skills-first/i);

  for (const doc of [qoderInstall, qoderUpgrade, qoderAgents]) {
    assert.match(doc, /~\/\.qoder\/skills|~\\\.qoder\\skills|~\/\.agents\/skills\/moluoxixi|~\\\.agents\\skills\\moluoxixi/);
    assert.match(doc, /~\/\.moluoxixi\/skills|~\\\.moluoxixi\\skills/);
    assert.doesNotMatch(doc, /~\/\.qoder\/rules|~\\\.qoder\\rules/);
  }
  assert.match(qoderAgents, /skills-first/i);
  assert.match(qoderAgents, /superpowers/i);

  for (const doc of [tareInstall, tareUpgrade, tareAgents]) {
    assert.match(doc, /~\/\.agents\/skills\/moluoxixi|~\\\.agents\\skills\\moluoxixi/);
    assert.match(doc, /~\/\.moluoxixi\/skills|~\\\.moluoxixi\\skills/);
  }
  assert.match(tareAgents, /skills-first/i);
  assert.match(tareAgents, /superpowers/i);

  for (const doc of [opencodeInstall, opencodeUpgrade, opencodeAgents]) {
    assert.match(doc, /~\/\.config\/opencode\/skills|~\\\.config\\opencode\\skills|~\/\.agents\/skills\/moluoxixi|~\\\.agents\\skills\\moluoxixi/);
    assert.match(doc, /~\/\.moluoxixi\/skills|~\\\.moluoxixi\\skills/);
  }
  assert.match(opencodeAgents, /skills-first/i);
  assert.match(opencodeAgents, /superpowers/i);
});
