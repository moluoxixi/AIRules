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

function copyDirContents(sourceDir, targetDir, options = {}) {
  mkdirSync(targetDir, { recursive: true });

  for (const entry of readdirSync(sourceDir, { withFileTypes: true })) {
    const source = path.join(sourceDir, entry.name);
    const target = path.join(targetDir, entry.name);
    const sourceStats = lstatSync(source);

    if (options.skipSymlinks && sourceStats.isSymbolicLink()) {
      continue;
    }

    const copySource = sourceStats.isSymbolicLink() ? realpathSync(source) : source;

    rmSync(target, { recursive: true, force: true });
    cpSync(copySource, target, { recursive: true });
  }
}

function copyRequiredFile(sourceFile, targetFile) {
  mkdirSync(path.dirname(targetFile), { recursive: true });
  rmSync(targetFile, { recursive: true, force: true });
  cpSync(sourceFile, targetFile);
}

function syncRequiredDir(sourceDir, targetDir, options = {}) {
  if (options.fullReset) {
    resetDir(targetDir);
  } else {
    mkdirSync(targetDir, { recursive: true });
  }

  copyDirContents(sourceDir, targetDir, options);
}

function syncOptionalDir(sourceDir, targetDir) {
  if (!existsSync(sourceDir)) {
    rmSync(targetDir, { recursive: true, force: true });
    return;
  }

  resetDir(targetDir);
  copyDirContents(sourceDir, targetDir);
}

function linkTypeForCurrentPlatform() {
  return process.platform === 'win32' ? 'junction' : 'dir';
}

function linkFileForCurrentPlatform() {
  return process.platform === 'win32' ? 'file' : 'file';
}

function replaceWithSymlink(source, target, type) {
  mkdirSync(path.dirname(target), { recursive: true });
  rmSync(target, { recursive: true, force: true });
  symlinkSync(source, target, type);
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
    tareHome: path.join(userHome, '.tare'),
    opencodeHome,
    opencodeSkillsHome: path.join(opencodeHome, 'skills'),
    moluoBaselineFile: path.join(moluoHome, 'AGENTS.md'),
    claudeBaselineFile: path.join(userHome, '.claude', 'CLAUDE.md'),
    codexBaselineFile: path.join(userHome, '.codex', 'AGENTS.md'),
    qoderBaselineFile: path.join(userHome, '.qoder', 'AGENTS.md'),
    tareBaselineFile: path.join(userHome, '.tare', 'AGENTS.md'),
    opencodeBaselineFile: path.join(opencodeHome, 'AGENTS.md')
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
  syncRequiredDir(path.join(repoRoot, 'skills'), path.join(moluoHome, 'skills'), {
    skipSymlinks: true,
    fullReset: false
  });
  syncOptionalDir(path.join(repoRoot, 'agents'), path.join(moluoHome, 'agents'));
  copyRequiredFile(path.join(repoRoot, 'AGENTS.md'), path.join(moluoHome, 'AGENTS.md'));
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
  replaceWithSymlink(
    path.join(moluoHome, 'AGENTS.md'),
    path.join(claudeHome, 'CLAUDE.md'),
    linkFileForCurrentPlatform()
  );
}

export function projectToQoder({ moluoHome, qoderHome }) {
  projectSharedSkillsHost(qoderHome, moluoHome);
  replaceWithSymlink(
    path.join(moluoHome, 'AGENTS.md'),
    path.join(qoderHome, 'AGENTS.md'),
    linkFileForCurrentPlatform()
  );
}

export function projectToCodex({ moluoHome, codexHome, codexAgentSkillsHome }) {
  mkdirSync(codexHome, { recursive: true });
  mkdirSync(codexAgentSkillsHome, { recursive: true });
  replaceWithSymlink(
    path.join(moluoHome, 'skills'),
    path.join(codexAgentSkillsHome, 'moluoxixi'),
    linkTypeForCurrentPlatform()
  );
  replaceWithSymlink(
    path.join(moluoHome, 'AGENTS.md'),
    path.join(codexHome, 'AGENTS.md'),
    linkFileForCurrentPlatform()
  );
}

export function projectToTare({ moluoHome, tareHome, codexAgentSkillsHome }) {
  mkdirSync(tareHome, { recursive: true });
  mkdirSync(codexAgentSkillsHome, { recursive: true });
  replaceWithSymlink(
    path.join(moluoHome, 'skills'),
    path.join(codexAgentSkillsHome, 'moluoxixi'),
    linkTypeForCurrentPlatform()
  );
  replaceWithSymlink(
    path.join(moluoHome, 'AGENTS.md'),
    path.join(tareHome, 'AGENTS.md'),
    linkFileForCurrentPlatform()
  );
}

export function projectToOpenCode({ moluoHome, opencodeHome, opencodeSkillsHome }) {
  mkdirSync(path.dirname(opencodeSkillsHome), { recursive: true });
  replaceWithSymlink(
    path.join(moluoHome, 'skills'),
    opencodeSkillsHome,
    linkTypeForCurrentPlatform()
  );
  replaceWithSymlink(
    path.join(moluoHome, 'AGENTS.md'),
    path.join(opencodeHome, 'AGENTS.md'),
    linkFileForCurrentPlatform()
  );
}

export function linkHostBaseline({ moluoHome, host, userHome = os.homedir() }) {
  const source = path.join(moluoHome, 'AGENTS.md');
  const targets = {
    claude: path.join(userHome, '.claude', 'CLAUDE.md'),
    codex: path.join(userHome, '.codex', 'AGENTS.md'),
    qoder: path.join(userHome, '.qoder', 'AGENTS.md'),
    tare: path.join(userHome, '.tare', 'AGENTS.md'),
    opencode: path.join(userHome, '.config', 'opencode', 'AGENTS.md')
  };

  if (!(host in targets)) {
    throw new Error(`Unknown host: ${host}`);
  }

  replaceWithSymlink(source, targets[host], linkFileForCurrentPlatform());
  return targets[host];
}
