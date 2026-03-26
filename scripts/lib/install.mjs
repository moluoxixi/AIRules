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
    repoRoot: moluoHome,
    claudeHome: path.join(userHome, '.claude'),
    codexHome: path.join(userHome, '.codex'),
    codexAgentSkillsHome: path.join(userHome, '.agents', 'skills')
  };
}

export function ensureInstallRoot(paths) {
  for (const dir of [
    paths.moluoHome,
    path.join(paths.moluoHome, 'vendors')
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
  mkdirSync(claudeHome, { recursive: true });
  rmSync(path.join(claudeHome, 'rules'), { recursive: true, force: true });
  rmSync(path.join(claudeHome, 'skills'), { recursive: true, force: true });
  rmSync(path.join(claudeHome, 'agents'), { recursive: true, force: true });

  symlinkSync(path.join(moluoHome, 'rules'), path.join(claudeHome, 'rules'), linkTypeForCurrentPlatform());
  symlinkSync(path.join(moluoHome, 'skills'), path.join(claudeHome, 'skills'), linkTypeForCurrentPlatform());
  symlinkSync(path.join(moluoHome, 'agents'), path.join(claudeHome, 'agents'), linkTypeForCurrentPlatform());
}

export function projectToCodex({ repoRoot, moluoHome, codexHome, codexAgentSkillsHome }) {
  mkdirSync(codexHome, { recursive: true });
  resetDir(codexAgentSkillsHome);

  rmSync(path.join(codexHome, 'AGENTS.md'), { recursive: true, force: true });
  cpSync(path.join(repoRoot, '.codex', 'AGENTS.md'), path.join(codexHome, 'AGENTS.md'));

  symlinkSync(path.join(moluoHome, 'skills'), path.join(codexAgentSkillsHome, 'superpowers'), linkTypeForCurrentPlatform());
}
