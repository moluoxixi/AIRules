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

function projectLeafSkillLinks(sourceDirs: string[], skillsDir: string): string[] {
  const projectedSkills = new Map<string, string>();

  for (const rootDir of sourceDirs) {
    if (!existsSync(rootDir)) {
      continue;
    }

    for (const entry of readdirSync(rootDir, { withFileTypes: true })) {
      const entryName = entry.name;
      if (entryName === '.gitignore') {
        continue;
      }

      if (entry.isDirectory() || entry.isSymbolicLink()) {
        const sourcePath = path.join(rootDir, entryName);
        if (projectedSkills.has(entryName)) {
          console.warn(`[link] Warning: Duplicate skill "${entryName}" ignored (already found in "${projectedSkills.get(entryName)}")`);
          continue;
        }

        projectedSkills.set(entryName, sourcePath);
      }
    }
  }

  resetDir(skillsDir);

  for (const [skillName, sourcePath] of projectedSkills) {
    const projectionTarget = path.join(skillsDir, skillName);
    symlinkSync(sourcePath, projectionTarget, linkTypeForCurrentPlatform());
  }

  return [...projectedSkills.keys()].sort();
}

function linkTypeForCurrentPlatform(): 'junction' | 'dir' {
  return process.platform === 'win32' ? 'junction' : 'dir';
}

function linkFileForCurrentPlatform(): 'file' {
  return 'file';
}

function isSamePath(path1: string, path2: string): boolean {
  return path.resolve(path1) === path.resolve(path2);
}

export function replaceWithSymlink(source: string, target: string, type: 'junction' | 'dir' | 'file') {
  mkdirSync(path.dirname(target), { recursive: true });
  rmSync(target, { recursive: true, force: true });
  try {
    symlinkSync(source, target, type);
  } catch (error: any) {
    if (type === 'file' && error?.code === 'EPERM' && process.platform === 'win32') {
      console.warn(`[link] Warning: symlink failed for ${target} (EPERM), falling back to copy.`);
      cpSync(source, target);
      return;
    }
    throw error;
  }
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
  globalAgentSkillsHome: string;
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
    globalAgentSkillsHome: path.join(userHome, '.agents', 'skills'),
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
    path.join(paths.moluoHome, 'skills'),
    paths.globalAgentSkillsHome
  ]) {
    mkdirSync(dir, { recursive: true });
  }
}

export function ensureGlobalSkillLink(paths: InstallPaths) {
  const sourceSkillsDir = path.join(paths.moluoHome, 'skills');
  const targetLinkDir = paths.globalAgentSkillsHome;

  syncFlattenedSkills(sourceSkillsDir, targetLinkDir, paths.moluoHome);
}

export function syncFlattenedSkills(sourceDir: string, targetDir: string, moluoHome: string) {
  if (!existsSync(sourceDir)) {
    return;
  }

  mkdirSync(targetDir, { recursive: true });

  const currentSkills = new Set(readdirSync(sourceDir).filter(n => n !== '.gitignore'));
  
  // Cleanup stale links
  if (existsSync(targetDir)) {
    for (const entry of readdirSync(targetDir, { withFileTypes: true })) {
      const targetPath = path.join(targetDir, entry.name);
      
      // We only care about symbolic links that we might have created
      if (entry.isSymbolicLink()) {
        try {
          const resolvedPath = realpathSync(targetPath);
          const normalizedResolved = path.resolve(resolvedPath);
          const normalizedMoluo = path.resolve(moluoHome);

          // If the link points into moluoxixi home but is not in the current set, remove it
          if (normalizedResolved.startsWith(normalizedMoluo) && !currentSkills.has(entry.name)) {
            rmSync(targetPath, { recursive: true, force: true });
          }
        } catch (error) {
          // If the link is broken or inaccessible, but it matches our naming pattern in a dangerous way?
          // Actually, if it's broken, it's safer to leave it unless we are sure it was ours.
          // But usually, broken links should be cleaned up if they are in the way.
        }
      }
    }
  }

  // Link current skills
  for (const skillName of currentSkills) {
    const source = path.join(sourceDir, skillName);
    const target = path.join(targetDir, skillName);
    replaceWithSymlink(source, target, linkTypeForCurrentPlatform());
  }
}

export function syncFirstPartyToHome(repoRoot: string, moluoHome: string) {
  if (isSamePath(repoRoot, moluoHome)) {
    return;
  }

  syncOptionalDir(path.join(repoRoot, 'agents'), path.join(moluoHome, 'agents'));
  copyRequiredFile(path.join(repoRoot, 'AGENTS.md'), path.join(moluoHome, 'AGENTS.md'));
}

export async function rebuildVendorSkillLinks({ homeDir, repoRoot, manifestPath }: { homeDir: string, repoRoot: string, manifestPath: string }): Promise<LinkEntry[]> {
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

  const projectedSkillNames = projectLeafSkillLinks([vendorSkillsDir, path.join(repoRoot, 'skills')], skillsDir);

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
  const ccSwitchSkillsDir = path.join(userHome, '.cc-switch', 'skills');
  const agentsSkillsDir = path.join(userHome, '.agents', 'skills');

  let currentSource = sourceSkillsDir;

  if (existsSync(path.join(userHome, '.cc-switch'))) {
    syncFlattenedSkills(currentSource, ccSwitchSkillsDir, moluoHome);
    currentSource = ccSwitchSkillsDir;
  }

  if (existsSync(path.join(userHome, '.agents'))) {
    syncFlattenedSkills(currentSource, agentsSkillsDir, moluoHome);
    currentSource = agentsSkillsDir;
  }

  syncFlattenedSkills(currentSource, hostSkillsHome, moluoHome);
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
