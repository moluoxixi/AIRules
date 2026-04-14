import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { buildLinkPlan } from './links.mjs';
import { loadVendorManifest, normalizePath } from './vendors.mjs';

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

function syncOptionalDir(sourceDir, targetDir) {
  if (!existsSync(sourceDir)) {
    rmSync(targetDir, { recursive: true, force: true });
    return;
  }

  resetDir(targetDir);
  copyDirContents(sourceDir, targetDir);
}

function collectLeafSkillDirs(rootDir) {
  if (!existsSync(rootDir)) {
    return [];
  }

  const leaves = [];

  function walk(currentDir) {
    if (existsSync(path.join(currentDir, 'SKILL.md'))) {
      leaves.push(currentDir);
      return;
    }

    for (const entry of readdirSync(currentDir, { withFileTypes: true })) {
      const entryPath = path.join(currentDir, entry.name);
      const stats = lstatSync(entryPath);
      if (!stats.isDirectory() && !stats.isSymbolicLink()) {
        continue;
      }

      walk(entryPath);
    }
  }

  walk(rootDir);
  return leaves.sort((left, right) => left.localeCompare(right));
}

function projectLeafSkillLinks(vendorSkillsDir, skillsDir) {
  const projectedSkills = new Map();

  for (const leafDir of collectLeafSkillDirs(vendorSkillsDir)) {
    const leafName = path.basename(leafDir);
    if (projectedSkills.has(leafName)) {
      const existing = projectedSkills.get(leafName);
      throw new Error(`Duplicate projected skill "${leafName}" from "${existing}" and "${leafDir}"`);
    }

    projectedSkills.set(leafName, leafDir);
  }

  resetDir(skillsDir);

  for (const [leafName, sourceDir] of projectedSkills) {
    const projectionTarget = path.join(skillsDir, leafName);
    symlinkSync(sourceDir, projectionTarget, linkTypeForCurrentPlatform());
  }

  return [...projectedSkills.keys()].sort();
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
    path.join(paths.moluoHome, 'vendor'),
    path.join(paths.moluoHome, 'vendor', 'repos'),
    path.join(paths.moluoHome, 'vendor', 'skills'),
    path.join(paths.moluoHome, 'skills')
  ]) {
    mkdirSync(dir, { recursive: true });
  }
}

export function syncFirstPartyToHome(repoRoot, moluoHome) {
  syncOptionalDir(path.join(repoRoot, 'agents'), path.join(moluoHome, 'agents'));
  copyRequiredFile(path.join(repoRoot, 'AGENTS.md'), path.join(moluoHome, 'AGENTS.md'));
}

export function rebuildVendorSkillLinks({ homeDir, manifestPath }) {
  return loadVendorManifest(manifestPath).then((manifest) => {
    const plan = buildLinkPlan(manifest, homeDir);
    const vendorSkillsDir = path.join(homeDir, 'vendor', 'skills');
    const skillsDir = path.join(homeDir, 'skills');

    resetDir(vendorSkillsDir);

    for (const entry of plan) {
      if (!existsSync(entry.source)) {
        continue;
      }

      mkdirSync(path.dirname(entry.target), { recursive: true });
      rmSync(entry.target, { recursive: true, force: true });
      symlinkSync(entry.source, entry.target, linkTypeForCurrentPlatform());
    }

    const projectedSkillNames = projectLeafSkillLinks(vendorSkillsDir, skillsDir);

    const gitignoreContent = [
      '# 由 rebuild-links.mjs 自动生成，请勿手动编辑',
      '# 这些 vendor skill 软链接应被 git 忽略',
      ...projectedSkillNames,
      ''
    ].join('\n');

    mkdirSync(skillsDir, { recursive: true });
    writeFileSync(path.join(skillsDir, '.gitignore'), gitignoreContent, 'utf8');

    return plan;
  });
}

export function projectSkillsToHost(userHome, moluoHome, hostSkillsHome) {
  const sourceSkillsDir = path.join(moluoHome, 'skills');
  const agentsDir = path.join(userHome, '.agents');
  const agentsSkillsDir = path.join(agentsDir, 'skills');

  mkdirSync(hostSkillsHome, { recursive: true });

  const skillDirs = [];
  if (existsSync(sourceSkillsDir)) {
    for (const entry of readdirSync(sourceSkillsDir, { withFileTypes: true })) {
      if (entry.name !== '.gitignore' && (entry.isDirectory() || entry.isSymbolicLink())) {
        skillDirs.push(entry.name);
      }
    }
  }

  const useAgents = existsSync(agentsDir);
  if (useAgents) {
    mkdirSync(agentsSkillsDir, { recursive: true });
  }

  rmSync(hostSkillsHome, { recursive: true, force: true });
  mkdirSync(hostSkillsHome, { recursive: true });

  for (const skillName of skillDirs) {
    const moluoSkillPath = path.join(sourceSkillsDir, skillName);
    
    let finalSource = moluoSkillPath;
    if (useAgents) {
      const agentSkillPath = path.join(agentsSkillsDir, skillName);
      replaceWithSymlink(moluoSkillPath, agentSkillPath, linkTypeForCurrentPlatform());
      finalSource = agentSkillPath;
    }
    
    replaceWithSymlink(finalSource, path.join(hostSkillsHome, skillName), linkTypeForCurrentPlatform());
  }
}

function projectSharedSkillsHost(userHome, hostHome, moluoHome) {
  mkdirSync(hostHome, { recursive: true });
  rmSync(path.join(hostHome, 'rules'), { recursive: true, force: true });
  rmSync(path.join(hostHome, 'agents'), { recursive: true, force: true });

  projectSkillsToHost(userHome, moluoHome, path.join(hostHome, 'skills'));

  if (existsSync(path.join(moluoHome, 'agents'))) {
    symlinkSync(path.join(moluoHome, 'agents'), path.join(hostHome, 'agents'), linkTypeForCurrentPlatform());
  }
}

export function projectToClaude({ moluoHome, claudeHome, userHome }) {
  projectSharedSkillsHost(userHome, claudeHome, moluoHome);
  replaceWithSymlink(
    path.join(moluoHome, 'AGENTS.md'),
    path.join(claudeHome, 'CLAUDE.md'),
    linkFileForCurrentPlatform()
  );
}

export function projectToQoder({ moluoHome, qoderHome, userHome }) {
  projectSharedSkillsHost(userHome, qoderHome, moluoHome);
  replaceWithSymlink(
    path.join(moluoHome, 'AGENTS.md'),
    path.join(qoderHome, 'AGENTS.md'),
    linkFileForCurrentPlatform()
  );
}

export function projectToCodex({ moluoHome, codexHome, userHome }) {
  projectSharedSkillsHost(userHome, codexHome, moluoHome);
  replaceWithSymlink(
    path.join(moluoHome, 'AGENTS.md'),
    path.join(codexHome, 'AGENTS.md'),
    linkFileForCurrentPlatform()
  );
}

export function projectToTare({ moluoHome, tareHome, userHome }) {
  projectSharedSkillsHost(userHome, tareHome, moluoHome);
  replaceWithSymlink(
    path.join(moluoHome, 'AGENTS.md'),
    path.join(tareHome, 'AGENTS.md'),
    linkFileForCurrentPlatform()
  );
}

export function projectToOpenCode({ moluoHome, opencodeHome, userHome }) {
  projectSharedSkillsHost(userHome, opencodeHome, moluoHome);
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
