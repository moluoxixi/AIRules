import test from 'node:test';
import assert from 'node:assert/strict';
import {
  cpSync,
  existsSync,
  mkdtempSync,
  mkdirSync,
  readdirSync,
  rmSync,
  writeFileSync
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  ensureInstallRoot,
  getDefaultInstallPaths,
  projectToClaude,
  projectToCodex,
  projectToOpenCode,
  projectToQoder,
  projectToTare,
  rebuildVendorSkillLinks,
  syncFirstPartyToHome
} from '../scripts/lib/install.mjs';
import { loadVendorManifest } from '../scripts/lib/vendors.mjs';

function stageRepoFixture(tempDir, { includeAgents = true } = {}) {
  const repoRoot = path.join(tempDir, 'repo');
  mkdirSync(repoRoot, { recursive: true });

  const entries = [
    'AGENTS.md',
    '.codex',
    'manifests',
    'scripts',
    'skills'
  ];

  if (includeAgents) {
    entries.splice(1, 0, 'agents');
  }

  for (const entry of entries) {
    cpSync(path.resolve(entry), path.join(repoRoot, entry), { recursive: true });
  }

  return repoRoot;
}

function materializeVendorSources(homeDir, manifest) {
  for (const vendor of Object.values(manifest.vendors ?? {})) {
    for (const link of vendor.links ?? []) {
      const sourceDir = path.join(homeDir, vendor.cloneDir, link.source);
      mkdirSync(sourceDir, { recursive: true });
      writeFileSync(path.join(sourceDir, 'SKILL.md'), `# ${link.target}\n`);
    }
  }
}

test('install flow projects first-party content into skills-first host entrypoints', () => {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), 'ai-rules-install-'));
  const repoRoot = stageRepoFixture(tempDir);
  const userHome = path.join(tempDir, 'home');
  const paths = getDefaultInstallPaths(userHome);
  const manifestPath = path.join(repoRoot, 'manifests', 'vendors.jsonc');
  const manifest = loadVendorManifest(manifestPath);

  try {
    ensureInstallRoot(paths);
    syncFirstPartyToHome(repoRoot, paths.moluoHome);

    materializeVendorSources(paths.moluoHome, manifest);
    const linkPlan = rebuildVendorSkillLinks({ homeDir: paths.moluoHome, manifestPath });

    projectToClaude({
      moluoHome: paths.moluoHome,
      claudeHome: paths.claudeHome
    });

    projectToQoder({
      moluoHome: paths.moluoHome,
      qoderHome: paths.qoderHome
    });

    projectToCodex({
      moluoHome: paths.moluoHome,
      codexHome: paths.codexHome,
      codexAgentSkillsHome: paths.codexAgentSkillsHome
    });

    projectToTare({
      moluoHome: paths.moluoHome,
      tareHome: paths.tareHome,
      codexAgentSkillsHome: paths.codexAgentSkillsHome
    });

    projectToOpenCode({
      moluoHome: paths.moluoHome,
      opencodeHome: paths.opencodeHome,
      opencodeSkillsHome: paths.opencodeSkillsHome
    });

    assert.equal(existsSync(path.join(paths.moluoHome, 'skills', 'standard-workflow', 'SKILL.md')), true);
    assert.equal(existsSync(path.join(paths.moluoHome, 'AGENTS.md')), true);
    assert.equal(existsSync(path.join(paths.moluoHome, 'rules')), false);

    assert.equal(existsSync(path.join(paths.claudeHome, 'skills', 'standard-workflow', 'SKILL.md')), true);
    assert.equal(existsSync(path.join(paths.claudeHome, 'CLAUDE.md')), true);
    assert.equal(existsSync(path.join(paths.claudeHome, 'rules')), false);

    assert.equal(existsSync(path.join(paths.qoderHome, 'skills', 'standard-workflow', 'SKILL.md')), true);
    assert.equal(existsSync(path.join(paths.qoderHome, 'AGENTS.md')), true);
    assert.equal(existsSync(path.join(paths.qoderHome, 'rules')), false);

    assert.equal(existsSync(path.join(paths.codexHome, 'AGENTS.md')), true);
    assert.equal(existsSync(path.join(paths.opencodeSkillsHome, 'standard-workflow', 'SKILL.md')), true);
    assert.equal(existsSync(path.join(paths.opencodeHome, 'AGENTS.md')), true);
    assert.equal(existsSync(path.join(paths.tareHome, 'AGENTS.md')), true);

    const codexAgentSkills = readdirSync(paths.codexAgentSkillsHome);
    assert.deepEqual(codexAgentSkills, ['moluoxixi']);
    assert.equal(
      existsSync(path.join(paths.codexAgentSkillsHome, 'moluoxixi', 'standard-workflow', 'SKILL.md')),
      true
    );

    assert.ok(linkPlan.some((entry) => entry.target.endsWith('/skills/superpowers')));
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test('install flow removes stale projected agents when the optional source disappears', () => {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), 'ai-rules-install-optional-agents-'));
  const repoRoot = stageRepoFixture(tempDir);
  const userHome = path.join(tempDir, 'home');
  const paths = getDefaultInstallPaths(userHome);
  const manifestPath = path.join(repoRoot, 'manifests', 'vendors.jsonc');
  const manifest = loadVendorManifest(manifestPath);

  try {
    ensureInstallRoot(paths);
    materializeVendorSources(paths.moluoHome, manifest);

    syncFirstPartyToHome(repoRoot, paths.moluoHome);
    rebuildVendorSkillLinks({ homeDir: paths.moluoHome, manifestPath });
    projectToClaude({
      moluoHome: paths.moluoHome,
      claudeHome: paths.claudeHome
    });
    assert.equal(existsSync(path.join(paths.claudeHome, 'CLAUDE.md')), true);

    assert.equal(existsSync(path.join(paths.moluoHome, 'agents')), true);
    assert.equal(existsSync(path.join(paths.claudeHome, 'agents')), true);

    rmSync(path.join(repoRoot, 'agents'), { recursive: true, force: true });

    syncFirstPartyToHome(repoRoot, paths.moluoHome);
    projectToClaude({
      moluoHome: paths.moluoHome,
      claudeHome: paths.claudeHome
    });

    assert.equal(existsSync(path.join(paths.moluoHome, 'agents')), false);
    assert.equal(existsSync(path.join(paths.claudeHome, 'agents')), false);
    assert.equal(existsSync(path.join(paths.claudeHome, 'CLAUDE.md')), true);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test('install flow works when agents are absent from the source tree from the start', () => {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), 'ai-rules-install-no-agents-'));
  const repoRoot = stageRepoFixture(tempDir, { includeAgents: false });
  const userHome = path.join(tempDir, 'home');
  const paths = getDefaultInstallPaths(userHome);
  const manifestPath = path.join(repoRoot, 'manifests', 'vendors.jsonc');
  const manifest = loadVendorManifest(manifestPath);

  try {
    ensureInstallRoot(paths);
    materializeVendorSources(paths.moluoHome, manifest);

    syncFirstPartyToHome(repoRoot, paths.moluoHome);
    rebuildVendorSkillLinks({ homeDir: paths.moluoHome, manifestPath });
    projectToClaude({
      moluoHome: paths.moluoHome,
      claudeHome: paths.claudeHome
    });
    projectToQoder({
      moluoHome: paths.moluoHome,
      qoderHome: paths.qoderHome
    });
    projectToTare({
      moluoHome: paths.moluoHome,
      tareHome: paths.tareHome,
      codexAgentSkillsHome: paths.codexAgentSkillsHome
    });
    projectToOpenCode({
      moluoHome: paths.moluoHome,
      opencodeHome: paths.opencodeHome,
      opencodeSkillsHome: paths.opencodeSkillsHome
    });

    assert.equal(existsSync(path.join(paths.moluoHome, 'agents')), false);
    assert.equal(existsSync(path.join(paths.claudeHome, 'agents')), false);
    assert.equal(existsSync(path.join(paths.qoderHome, 'agents')), false);
    assert.equal(existsSync(path.join(paths.moluoHome, 'skills', 'standard-workflow', 'SKILL.md')), true);
    assert.equal(existsSync(path.join(paths.claudeHome, 'CLAUDE.md')), true);
    assert.equal(existsSync(path.join(paths.qoderHome, 'AGENTS.md')), true);
    assert.equal(existsSync(path.join(paths.tareHome, 'AGENTS.md')), true);
    assert.equal(existsSync(path.join(paths.opencodeHome, 'AGENTS.md')), true);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});
