import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  realpathSync,
  rmSync,
  symlinkSync
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { buildLinkPlan } from './links.mjs';
import { loadVendorManifest } from './vendors.mjs';

function resetDir(targetDir) {
  rmSync(targetDir, { recursive: true, force: true });
  mkdirSync(targetDir, { recursive: true });
}

function copyDirContents(sourceDir, targetDir) {
  mkdirSync(targetDir, { recursive: true });

  for (const entry of readdirSync(sourceDir, { withFileTypes: true })) {
    const source = path.join(sourceDir, entry.name);
    const target = path.join(targetDir, entry.name);
    const sourceStats = lstatSync(source);
    const copySource = sourceStats.isSymbolicLink() ? realpathSync(source) : source;

    rmSync(target, { recursive: true, force: true });
    cpSync(copySource, target, { recursive: true });
  }
}

function linkTypeForCurrentPlatform() {
  return process.platform === 'win32' ? 'junction' : 'dir';
}

export function getDefaultInstallPaths(userHome = os.homedir()) {
  const moluoHome = path.join(userHome, '.moluoxixi');

  return {
    userHome,
    moluoHome,
    repoRoot: path.join(moluoHome, 'source', 'aiRules'),
    claudeHome: path.join(userHome, '.claude'),
    codexHome: path.join(userHome, '.codex'),
    codexAgentSkillsHome: path.join(userHome, '.agents', 'skills')
  };
}

export function ensureInstallRoot(paths) {
  for (const dir of [
    paths.moluoHome,
    path.join(paths.moluoHome, 'vendors'),
    path.join(paths.moluoHome, 'rules'),
    path.join(paths.moluoHome, 'skills'),
    path.join(paths.moluoHome, 'agents'),
    path.join(paths.moluoHome, 'source')
  ]) {
    mkdirSync(dir, { recursive: true });
  }
}

export function syncFirstPartyToHome(repoRoot, moluoHome) {
  copyDirContents(path.join(repoRoot, 'rules'), path.join(moluoHome, 'rules'));
  copyDirContents(path.join(repoRoot, 'skills'), path.join(moluoHome, 'skills'));
  copyDirContents(path.join(repoRoot, 'agents'), path.join(moluoHome, 'agents'));
}

export function rebuildVendorSkillLinks({ homeDir, manifestPath }) {
  const manifest = loadVendorManifest(manifestPath);
  const plan = buildLinkPlan(manifest, homeDir);

  for (const entry of plan) {
    if (!existsSync(entry.source)) {
      continue;
    }

    mkdirSync(path.dirname(entry.target), { recursive: true });
    rmSync(entry.target, { recursive: true, force: true });
    symlinkSync(entry.source, entry.target, linkTypeForCurrentPlatform());
  }

  return plan;
}

export function projectToClaude({ repoRoot, moluoHome, claudeHome }) {
  resetDir(path.join(claudeHome, 'rules'));
  resetDir(path.join(claudeHome, 'skills'));
  resetDir(path.join(claudeHome, 'agents'));

  copyDirContents(path.join(moluoHome, 'rules'), path.join(claudeHome, 'rules'));
  copyDirContents(path.join(moluoHome, 'skills'), path.join(claudeHome, 'skills'));
  copyDirContents(path.join(moluoHome, 'agents'), path.join(claudeHome, 'agents'));

  cpSync(path.join(repoRoot, '.claude', 'INSTALL.md'), path.join(claudeHome, 'INSTALL.md'));
  cpSync(path.join(repoRoot, '.claude', 'UPGRADE.md'), path.join(claudeHome, 'UPGRADE.md'));
}

export function projectToCodex({ repoRoot, moluoHome, codexHome, codexAgentSkillsHome }) {
  resetDir(path.join(codexHome, 'rules'));
  resetDir(path.join(codexHome, 'skills'));
  resetDir(path.join(codexHome, 'agents'));
  resetDir(codexAgentSkillsHome);

  copyDirContents(path.join(moluoHome, 'rules'), path.join(codexHome, 'rules'));
  copyDirContents(path.join(moluoHome, 'skills'), path.join(codexHome, 'skills'));
  copyDirContents(path.join(moluoHome, 'agents'), path.join(codexHome, 'agents'));

  cpSync(path.join(repoRoot, '.codex', 'AGENTS.md'), path.join(codexHome, 'AGENTS.md'));
  cpSync(path.join(repoRoot, '.codex', 'INSTALL.md'), path.join(codexHome, 'INSTALL.md'));
  cpSync(path.join(repoRoot, '.codex', 'UPGRADE.md'), path.join(codexHome, 'UPGRADE.md'));

  const superpowersSkills = path.join(moluoHome, 'vendors', 'superpowers', 'skills');
  if (existsSync(superpowersSkills)) {
    symlinkSync(superpowersSkills, path.join(codexAgentSkillsHome, 'superpowers'), linkTypeForCurrentPlatform());
  }

  const aggregatedSkillsDir = path.join(moluoHome, 'skills');
  for (const entry of readdirSync(aggregatedSkillsDir, { withFileTypes: true })) {
    if ((!entry.isDirectory() && !entry.isSymbolicLink()) || entry.name === 'superpowers') {
      continue;
    }

    symlinkSync(
      path.join(aggregatedSkillsDir, entry.name),
      path.join(codexAgentSkillsHome, entry.name),
      linkTypeForCurrentPlatform()
    );
  }
}
