import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('host docs describe the skills-first projections and shared baseline source', () => {
  const sharedBaseline = readFileSync(new URL('../AGENTS.md', import.meta.url), 'utf8');
  const claudeInstall = readFileSync(new URL('../.claude/INSTALL.md', import.meta.url), 'utf8');
  const claudeUpgrade = readFileSync(new URL('../.claude/UPGRADE.md', import.meta.url), 'utf8');
  const codexInstall = readFileSync(new URL('../.codex/INSTALL.md', import.meta.url), 'utf8');
  const codexUpgrade = readFileSync(new URL('../.codex/UPGRADE.md', import.meta.url), 'utf8');
  const qoderInstall = readFileSync(new URL('../.qoder/INSTALL.md', import.meta.url), 'utf8');
  const qoderUpgrade = readFileSync(new URL('../.qoder/UPGRADE.md', import.meta.url), 'utf8');
  const tareInstall = readFileSync(new URL('../.tare/INSTALL.md', import.meta.url), 'utf8');
  const tareUpgrade = readFileSync(new URL('../.tare/UPGRADE.md', import.meta.url), 'utf8');
  const opencodeInstall = readFileSync(new URL('../.opencode/INSTALL.md', import.meta.url), 'utf8');
  const opencodeUpgrade = readFileSync(new URL('../.opencode/UPGRADE.md', import.meta.url), 'utf8');

  assert.match(sharedBaseline, /skills-first/i);
  assert.match(sharedBaseline, /superpowers/i);
  assert.match(sharedBaseline, /第一方/);

  for (const doc of [claudeInstall, claudeUpgrade]) {
    assert.match(doc, /~\/\.claude\/skills|~\\\.claude\\skills/);
    assert.match(doc, /~\/\.claude\/CLAUDE\.md|~\\\.claude\\CLAUDE\.md/);
    assert.match(doc, /~\/\.moluoxixi\/AGENTS\.md|~\\\.moluoxixi\\AGENTS\.md/);
    assert.match(doc, /scripts\/host-setup\.mjs|scripts\\host-setup\.mjs/);
  }

  for (const doc of [codexInstall, codexUpgrade]) {
    assert.match(doc, /~\/\.agents\/skills\/moluoxixi|~\\\.agents\\skills\\moluoxixi/);
    assert.match(doc, /~\/\.codex\/AGENTS\.md|~\\\.codex\\AGENTS\.md/);
    assert.match(doc, /~\/\.moluoxixi\/AGENTS\.md|~\\\.moluoxixi\\AGENTS\.md/);
    assert.match(doc, /scripts\/host-setup\.mjs|scripts\\host-setup\.mjs/);
  }

  for (const doc of [qoderInstall, qoderUpgrade]) {
    assert.match(doc, /~\/\.qoder\/skills|~\\\.qoder\\skills/);
    assert.match(doc, /~\/\.qoder\/AGENTS\.md|~\\\.qoder\\AGENTS\.md/);
    assert.match(doc, /~\/\.moluoxixi\/AGENTS\.md|~\\\.moluoxixi\\AGENTS\.md/);
    assert.match(doc, /scripts\/host-setup\.mjs|scripts\\host-setup\.mjs/);
  }

  for (const doc of [tareInstall, tareUpgrade]) {
    assert.match(doc, /~\/\.agents\/skills\/moluoxixi|~\\\.agents\\skills\\moluoxixi/);
    assert.match(doc, /~\/\.tare\/AGENTS\.md|~\\\.tare\\AGENTS\.md/);
    assert.match(doc, /~\/\.moluoxixi\/AGENTS\.md|~\\\.moluoxixi\\AGENTS\.md/);
    assert.match(doc, /scripts\/host-setup\.mjs|scripts\\host-setup\.mjs/);
  }

  for (const doc of [opencodeInstall, opencodeUpgrade]) {
    assert.match(doc, /~\/\.config\/opencode\/skills|~\\\.config\\opencode\\skills/);
    assert.match(doc, /~\/\.config\/opencode\/AGENTS\.md|~\\\.config\\opencode\\AGENTS\.md/);
    assert.match(doc, /~\/\.moluoxixi\/AGENTS\.md|~\\\.moluoxixi\\AGENTS\.md/);
    assert.match(doc, /scripts\/host-setup\.mjs|scripts\\host-setup\.mjs/);
  }
});
