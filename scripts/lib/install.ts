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

import { buildLinkPlan, type LinkEntry } from './links.js';
import { loadVendorManifest, normalizePath } from './vendors.js';

function resetDir(targetDir: string) {
  rmSync(targetDir, { recursive: true, force: true });
  mkdirSync(targetDir, { recursive: true });
}

function copyDirContents(sourceDir: string, targetDir: string, options: { skipSymlinks?: boolean } = {}) {
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

function copyRequiredFile(sourceFile: string, targetFile: string) {
  mkdirSync(path.dirname(targetFile), { recursive: true });
  rmSync(targetFile, { recursive: true, force: true });
  cpSync(sourceFile, targetFile);
}

function syncOptionalDir(sourceDir: string, targetDir: string) {
  if (!existsSync(sourceDir)) {
    rmSync(targetDir, { recursive: true, force: true });
    return;
  }

  resetDir(targetDir);
  copyDirContents(sourceDir, targetDir);
}

function collectLeafSkillDirs(rootDir: string): string[] {
  if (!existsSync(rootDir)) {
    return [];
  }

  const leaves: string[] = [];

  function walk(currentDir: string) {
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

function projectLeafSkillLinks(vendorSkillsDir: string, skillsDir: string): string[] {
  const projectedSkills = new Map<string, string>();

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

function linkTypeForCurrentPlatform(): 'junction' | 'dir' {
  return process.platform === 'win32' ? 'junction' : 'dir';
}

function linkFileForCurrentPlatform(): 'file' {
  return 'file';
}

export function replaceWithSymlink(source: string, target: string, type: 'junction' | 'dir' | 'file') {
  mkdirSync(path.dirname(target), { recursive: true });
  rmSync(target, { recursive: true, force: true });
  symlinkSync(source, target, type);
}

export interface InstallPaths {
  userHome: string;
  moluoHome: string;
  repoRoot: string;
  claudeHome: string;
  codexHome: string;
  cursorHome: string;
  codexAgentSkillsHome: string;
  qoderHome: string;
  tareHome: string;
  opencodeHome: string;
  opencodeSkillsHome: string;
  moluoBaselineFile: string;
  claudeBaselineFile: string;
  codexBaselineFile: string;
  cursorBaselineFile: string;
  qoderBaselineFile: string;
  tareBaselineFile: string;
  opencodeBaselineFile: string;
  [key: string]: string;
}

export function getDefaultInstallPaths(userHome = os.homedir()): InstallPaths {
  const moluoHome = path.join(userHome, '.moluoxixi');
  const opencodeHome = path.join(userHome, '.config', 'opencode');

  return {
    userHome,
    moluoHome,
    repoRoot: moluoHome,
    claudeHome: path.join(userHome, '.claude'),
    codexHome: path.join(userHome, '.codex'),
    cursorHome: path.join(userHome, '.cursor'),
    codexAgentSkillsHome: path.join(userHome, '.agents', 'skills'),
    qoderHome: path.join(userHome, '.qoder'),
    tareHome: path.join(userHome, '.tare'),
    opencodeHome,
    opencodeSkillsHome: path.join(opencodeHome, 'skills'),
    moluoBaselineFile: path.join(moluoHome, 'AGENTS.md'),
    claudeBaselineFile: path.join(userHome, '.claude', 'CLAUDE.md'),
    codexBaselineFile: path.join(userHome, '.codex', 'AGENTS.md'),
    cursorBaselineFile: path.join(userHome, '.cursor', 'AGENTS.md'),
    qoderBaselineFile: path.join(userHome, '.qoder', 'AGENTS.md'),
    tareBaselineFile: path.join(userHome, '.tare', 'AGENTS.md'),
    opencodeBaselineFile: path.join(opencodeHome, 'AGENTS.md')
  };
}

export function ensureInstallRoot(paths: InstallPaths) {
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

export function syncFirstPartyToHome(repoRoot: string, moluoHome: string) {
  syncOptionalDir(path.join(repoRoot, 'agents'), path.join(moluoHome, 'agents'));
  copyRequiredFile(path.join(repoRoot, 'AGENTS.md'), path.join(moluoHome, 'AGENTS.md'));
}

export async function rebuildVendorSkillLinks({ homeDir, manifestPath }: { homeDir: string, manifestPath: string }): Promise<LinkEntry[]> {
  const manifest = await loadVendorManifest(manifestPath);
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
    '# 由 rebuild-links.ts 自动生成，请勿手动编辑',
    '# 这些 vendor skill 软链接应被 git 忽略',
    ...projectedSkillNames,
    ''
  ].join('\n');

  mkdirSync(skillsDir, { recursive: true });
  writeFileSync(path.join(skillsDir, '.gitignore'), gitignoreContent, 'utf8');

  return plan;
}

export function projectSkillsToHost(userHome: string, moluoHome: string, hostSkillsHome: string) {
  const sourceSkillsDir = path.join(moluoHome, 'skills');
  const ccSwitchDir = path.join(userHome, '.cc-switch');
  const ccSwitchSkillsDir = path.join(ccSwitchDir, 'skills');
  const agentsDir = path.join(userHome, '.agents');
  const agentsSkillsDir = path.join(agentsDir, 'skills');

  mkdirSync(hostSkillsHome, { recursive: true });

  const skillDirs: string[] = [];
  if (existsSync(sourceSkillsDir)) {
    for (const entry of readdirSync(sourceSkillsDir, { withFileTypes: true })) {
      if (entry.name !== '.gitignore' && (entry.isDirectory() || entry.isSymbolicLink())) {
        skillDirs.push(entry.name);
      }
    }
  }

  const useCcSwitch = existsSync(ccSwitchDir);
  if (useCcSwitch) {
    mkdirSync(ccSwitchSkillsDir, { recursive: true });
  }

  const useAgents = existsSync(agentsDir);
  if (useAgents) {
    mkdirSync(agentsSkillsDir, { recursive: true });
  }

  rmSync(hostSkillsHome, { recursive: true, force: true });
  mkdirSync(hostSkillsHome, { recursive: true });

  for (const skillName of skillDirs) {
    let currentSource = path.join(sourceSkillsDir, skillName);
    
    if (useCcSwitch) {
      const ccSwitchSkillPath = path.join(ccSwitchSkillsDir, skillName);
      replaceWithSymlink(currentSource, ccSwitchSkillPath, linkTypeForCurrentPlatform());
      currentSource = ccSwitchSkillPath;
    }

    if (useAgents) {
      const agentSkillPath = path.join(agentsSkillsDir, skillName);
      replaceWithSymlink(currentSource, agentSkillPath, linkTypeForCurrentPlatform());
      currentSource = agentSkillPath;
    }
    
    replaceWithSymlink(currentSource, path.join(hostSkillsHome, skillName), linkTypeForCurrentPlatform());
  }
}

function projectSharedSkillsHost(userHome: string, hostHome: string, moluoHome: string, customSkillsDirName: string = 'skills') {
  mkdirSync(hostHome, { recursive: true });
  rmSync(path.join(hostHome, 'rules'), { recursive: true, force: true });
  rmSync(path.join(hostHome, 'agents'), { recursive: true, force: true });

  projectSkillsToHost(userHome, moluoHome, path.join(hostHome, customSkillsDirName));

  if (existsSync(path.join(moluoHome, 'agents'))) {
    const agentsSource = path.join(moluoHome, 'agents');
    const agentsTarget = path.join(hostHome, 'agents');
    replaceWithSymlink(agentsSource, agentsTarget, linkTypeForCurrentPlatform());
  }
}

export function projectToHost({ 
  userHome, 
  moluoHome, 
  hostHome, 
  hostBaselineFile, 
  customSkillsDirName = 'skills' 
}: { 
  userHome: string, 
  moluoHome: string, 
  hostHome: string, 
  hostBaselineFile: string, 
  customSkillsDirName?: string 
}) {
  projectSharedSkillsHost(userHome, hostHome, moluoHome, customSkillsDirName);
  replaceWithSymlink(
    path.join(moluoHome, 'AGENTS.md'),
    hostBaselineFile,
    linkFileForCurrentPlatform()
  );
}

export function linkHostBaseline({ moluoHome, host, userHome = os.homedir() }: { moluoHome: string, host: string, userHome?: string }): string {
  const source = path.join(moluoHome, 'AGENTS.md');
  const targets: Record<string, string> = {
    claude: path.join(userHome, '.claude', 'CLAUDE.md'),
    codex: path.join(userHome, '.codex', 'AGENTS.md'),
    cursor: path.join(userHome, '.cursor', 'AGENTS.md'),
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
