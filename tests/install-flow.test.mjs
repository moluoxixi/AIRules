import test from 'node:test';
import assert from 'node:assert/strict';
import {
  cpSync,
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
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
  rebuildVendorSkillLinks,
  syncFirstPartyToHome
} from '../scripts/lib/install.mjs';
import { loadVendorManifest } from '../scripts/lib/vendors.mjs';

function stageRepoFixture(tempDir) {
  const repoRoot = path.join(tempDir, 'repo');
  mkdirSync(repoRoot, { recursive: true });

  for (const entry of [
    '.claude',
    '.codex',
    'agents',
    'manifests',
    'rules',
    'scripts',
    'skills'
  ]) {
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

test('install flow projects first-party content and aggregated skills into Claude and Codex homes', () => {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), 'ai-rules-install-'));
  const repoRoot = stageRepoFixture(tempDir);
  const userHome = path.join(tempDir, 'home');
  const paths = getDefaultInstallPaths(userHome);
  const manifestPath = path.join(repoRoot, 'manifests', 'vendors.jsonc');
  const manifest = loadVendorManifest(manifestPath);

  try {
    ensureInstallRoot(paths);
    cpSync(repoRoot, paths.repoRoot, { recursive: true });

    materializeVendorSources(paths.moluoHome, manifest);
    const linkPlan = rebuildVendorSkillLinks({ homeDir: paths.moluoHome, manifestPath });

    projectToClaude({
      repoRoot: paths.repoRoot,
      moluoHome: paths.moluoHome,
      claudeHome: paths.claudeHome
    });

    projectToCodex({
      repoRoot: paths.repoRoot,
      moluoHome: paths.moluoHome,
      codexHome: paths.codexHome,
      codexAgentSkillsHome: paths.codexAgentSkillsHome
    });

    assert.equal(existsSync(path.join(paths.moluoHome, 'rules', 'frontend', 'workflow.md')), true);
    assert.equal(existsSync(path.join(paths.moluoHome, 'rules', 'frontend', 'jsdoc.md')), true);
    assert.equal(existsSync(path.join(paths.moluoHome, 'rules', 'common', 'comments.md')), true);

    assert.equal(existsSync(path.join(paths.claudeHome, 'rules')), true);
    assert.equal(existsSync(path.join(paths.claudeHome, 'skills')), true);
    assert.equal(existsSync(path.join(paths.codexHome, 'AGENTS.md')), true);

    const codexAgentSkills = readdirSync(paths.codexAgentSkillsHome);
    assert.deepEqual(codexAgentSkills, ['superpowers']);

    const codexWorkflow = readFileSync(path.join(paths.moluoHome, 'rules', 'frontend', 'workflow.md'), 'utf8');
    assert.match(codexWorkflow, /MCP/i);
    assert.ok(linkPlan.some((entry) => entry.target.endsWith('/skills/superpowers')));
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});
