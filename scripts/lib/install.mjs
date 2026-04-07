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

function syncOptionalDir(sourceDir, targetDir) {
  if (!existsSync(sourceDir)) {
    return;
  }

  copyDirContents(sourceDir, targetDir);
}

function linkTypeForCurrentPlatform() {
  return process.platform === 'win32' ? 'junction' : 'dir';
}

export function getDefaultInstallPaths(userHome = os.homedir()) {
  const moluoHome = path.join(userHome, '.moluoxixi');
  const opencodeHome = path.join(userHome, '.config', 'opencode');

  return {
    userHome,
    moluoHome,
    repoRoot: moluoHome,
    claudeHome: path.join(userHome, '.claude'),
    codexHome: path.join(userHome, '.codex'),
    codexAgentSkillsHome: path.join(userHome, '.agents', 'skills'),
    qoderHome: path.join(userHome, '.qoder'),
    opencodeHome,
    opencodeSkillsHome: path.join(opencodeHome, 'skills')
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
  syncOptionalDir(path.join(repoRoot, 'skills'), path.join(moluoHome, 'skills'));
  syncOptionalDir(path.join(repoRoot, 'agents'), path.join(moluoHome, 'agents'));
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

function projectSharedSkillsHost(hostHome, moluoHome) {
  mkdirSync(hostHome, { recursive: true });
  rmSync(path.join(hostHome, 'rules'), { recursive: true, force: true });
  rmSync(path.join(hostHome, 'skills'), { recursive: true, force: true });
  rmSync(path.join(hostHome, 'agents'), { recursive: true, force: true });

  symlinkSync(path.join(moluoHome, 'skills'), path.join(hostHome, 'skills'), linkTypeForCurrentPlatform());

  if (existsSync(path.join(moluoHome, 'agents'))) {
    symlinkSync(path.join(moluoHome, 'agents'), path.join(hostHome, 'agents'), linkTypeForCurrentPlatform());
  }
}

export function projectToClaude({ moluoHome, claudeHome }) {
  projectSharedSkillsHost(claudeHome, moluoHome);
}

export function projectToQoder({ moluoHome, qoderHome }) {
  projectSharedSkillsHost(qoderHome, moluoHome);
}

export function projectToCodex({ repoRoot, moluoHome, codexHome, codexAgentSkillsHome }) {
  mkdirSync(codexHome, { recursive: true });
  resetDir(codexAgentSkillsHome);

  rmSync(path.join(codexHome, 'AGENTS.md'), { recursive: true, force: true });
  cpSync(path.join(repoRoot, '.codex', 'AGENTS.md'), path.join(codexHome, 'AGENTS.md'));

  symlinkSync(path.join(moluoHome, 'skills'), path.join(codexAgentSkillsHome, 'moluoxixi'), linkTypeForCurrentPlatform());
}

export function projectToOpenCode({ moluoHome, opencodeSkillsHome }) {
  mkdirSync(path.dirname(opencodeSkillsHome), { recursive: true });
  rmSync(opencodeSkillsHome, { recursive: true, force: true });
  symlinkSync(path.join(moluoHome, 'skills'), opencodeSkillsHome, linkTypeForCurrentPlatform());
}
