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
import { execSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';

import { buildLinkPlan, type LinkEntry } from './links.js';
import { loadVendorManifest, normalizePath, type VendorManifest } from './vendors.js';
import { findHostConfig, resolveHostPaths } from '../../constants/hosts.js';

function resetDir(targetDir: string) {
  rmSync(targetDir, { recursive: true, force: true });
  mkdirSync(targetDir, { recursive: true });
}

/**
 * 执行各 skill 的安装前置命令（per-skill 精度）。
 * 遍历 manifest 中所有 vendor 的 links，对具有 setup 字段的 link 执行其命令。
 * 任一命令失败均打印警告但不中断整体流程。
 * @param manifest 已解析的 VendorManifest
 */
export function runSkillSetupCommands(manifest: VendorManifest): void {
  for (const [vendorName, vendor] of Object.entries(manifest.vendors)) {
    for (const link of vendor.links) {
      if (!link.setup || link.setup.length === 0) continue;

      const skillName = path.basename(link.target);
      console.log(`\n[setup] 执行 ${vendorName}/${skillName} 的安装前置命令...`);
      for (const cmd of link.setup) {
        console.log(`[setup] > ${cmd}`);
        try {
          execSync(cmd, { stdio: 'inherit', shell: true });
        } catch (err: any) {
          console.warn(`[setup][warn] 命令执行失败，已跳过: ${cmd}`);
          console.warn(`[setup][warn] 失败原因: ${err?.message ?? String(err)}`);
        }
      }
    }
  }
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

export function isSamePath(p1: string, p2: string): boolean {
  if (!p1 || !p2) return false;
  const n1 = path.resolve(p1).toLowerCase().replace(/\\/g, '/').replace(/\/$/, '');
  const n2 = path.resolve(p2).toLowerCase().replace(/\\/g, '/').replace(/\/$/, '');
  return n1 === n2;
}

/**
 * 将各个来源的技能统一投影（软链接）到目标技能目录。
 * @param sourceDirs 技能来源目录列表（如 [vendorSkillsDir, repoRootSkillsDir]）
 * @param skillsDir 统一的投影目标目录（如 ~/.moluoxixi/skills）
 * @returns 最终投影的技能名称列表
 */
/**
 * 将各个来源的技能统一投影（软链接）到目标技能目录。
 * @param sourceDirs 技能来源目录列表（如 [vendorSkillsDir, repoRootSkillsDir]）
 * @param skillsDir 统一的投影目标目录（如 ~/.moluoxixi/skills）
 * @returns 最终投影的技能名称列表
 */
function projectLeafSkillLinks(sourceDirs: string[], skillsDir: string): string[] {
  const projectedSkills = new Map<string, string>(); // [skillName]: [sourcePath]
  
  const isInPlace = sourceDirs.some(dir => isSamePath(dir, skillsDir));

  // 如果不是原位安装，则清空目标目录以确保投影干净
  if (!isInPlace) {
    resetDir(skillsDir);
  }

  for (const rootDir of sourceDirs) {
    if (!existsSync(rootDir)) continue;

    for (const entry of readdirSync(rootDir, { withFileTypes: true })) {
      const entryName = entry.name;
      // 忽略隐藏文件/目录
      if (entryName.startsWith('.')) continue;

      if (entry.isDirectory() || entry.isSymbolicLink()) {
        const sourcePath = path.join(rootDir, entryName);
        const targetPath = path.join(skillsDir, entryName);
        
        // [原位安装防护] 如果当前扫描的目录就是目标目录（通常是 ~/.moluoxixi/skills），
        // 我们绝对不能把其中的“软链接”当作有效的源，否则会导致循环映射（例如指向了 .agents）。
        // 我们只在这里寻找第一方的“实体目录”。
        if (isSamePath(rootDir, skillsDir) && entry.isSymbolicLink()) {
          continue;
        }

        // 如果物理路径完全一致（例如 rootDir/skill 与 skillsDir/skill 是同一个地方），
        // 记录它存在即可，不需要建立链接。
        if (isSamePath(sourcePath, targetPath)) {
          if (!projectedSkills.has(entryName)) {
            projectedSkills.set(entryName, sourcePath);
          }
          continue;
        }

        projectedSkills.set(entryName, sourcePath);
      }
    }
  }

  for (const [skillName, sourcePath] of projectedSkills) {
    const projectionTarget = path.join(skillsDir, skillName);
    if (isSamePath(sourcePath, projectionTarget)) {
      continue;
    }

    replaceWithSymlink(sourcePath, projectionTarget, linkTypeForCurrentPlatform());
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
  if (isSamePath(source, target)) {
    return;
  }
  
  // 如果目标已经是一个软链接并指向了源码，则无需重复创建
  if (existsSync(target) && lstatSync(target).isSymbolicLink()) {
    try {
      if (isSamePath(realpathSync(target), source)) {
        return;
      }
    } catch {
      // ignore
    }
  }
  
  mkdirSync(path.dirname(target), { recursive: true });
  rmSync(target, { recursive: true, force: true });
  try {
    symlinkSync(source, target, type);
  } catch (error: any) {
    if (type === 'file' && error?.code === 'EPERM' && process.platform === 'win32') {
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
  moluoBaselineFile: string;
  globalAgentSkillsHome: string;
  [key: string]: string;
}

export function getDefaultInstallPaths(userHome = os.homedir()): InstallPaths {
  const moluoHome = path.join(userHome, '.moluoxixi');
  return {
    userHome,
    moluoHome,
    repoRoot: moluoHome,
    moluoBaselineFile: path.join(moluoHome, 'AGENTS.md'),
    globalAgentSkillsHome: path.join(userHome, '.agents', 'skills'),
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

/**
 * 确保全局 Agent 技能目录 (~/.agents/skills) 的链接正确。
 * ~/.agents 是行业标准共享层，始终存在。
 * 遵循层级自愈同步逻辑。
 */
export function ensureGlobalSkillLink(paths: InstallPaths) {
  const sourceSkillsDir = path.join(paths.moluoHome, 'skills');
  const targetLinkDir = paths.globalAgentSkillsHome;

  syncFlattenedSkills(sourceSkillsDir, targetLinkDir, paths.moluoHome);
}

/**
 * 同步展平的技能软链接，并清理过时链接。
 * @param sourceDir 源技能目录
 * @param targetDir 目标链接目录
 * @param moluoHome moluoxixi 根目录（用于识别自愈时需要删除的内部链接）
 */
export function syncFlattenedSkills(sourceDir: string, targetDir: string, moluoHome: string) {
  if (!existsSync(sourceDir)) {
    return;
  }
  mkdirSync(targetDir, { recursive: true });

  const currentSkills = new Set(readdirSync(sourceDir).filter(n => n !== '.gitignore'));
  
  // 自愈式同步：清理目标目录中不再需要的技能链接
  if (existsSync(targetDir)) {
    for (const entry of readdirSync(targetDir, { withFileTypes: true })) {
      const targetPath = path.join(targetDir, entry.name);
      
      if (entry.isSymbolicLink()) {
        const isBroken = !existsSync(targetPath);

        if (isBroken) {
          rmSync(targetPath, { recursive: true, force: true });
          console.log(`[cleanup] 已移除失效的死链接: ${entry.name}`);
          continue;
        }

        const resolvedPath = realpathSync(targetPath);
        const normalizedResolved = path.resolve(resolvedPath);
        const normalizedMoluo = path.resolve(moluoHome);
        const normalizedRepo = path.resolve(process.cwd()); // 仓库根目录

        const isInternal = normalizedResolved.startsWith(normalizedMoluo) || 
                           normalizedResolved.startsWith(normalizedRepo);

        // 如果该链接指向我们的项目，但不在当前技能集合中，则视为过时并移除
        if (isInternal && !currentSkills.has(entry.name)) {
          rmSync(targetPath, { recursive: true, force: true });
        }
      }
    }
  }

  // 为所有当前有效的技能创建或更新软链接
  for (const skillName of currentSkills) {
    const source = path.join(sourceDir, skillName);
    const target = path.join(targetDir, skillName);
    
    replaceWithSymlink(source, target, linkTypeForCurrentPlatform());
  }
}

/**
 * 同步第一方（当前仓库内）的技能到本地 moluoxixi 主目录。
 */
export function syncFirstPartyToHome(repoRoot: string, moluoHome: string) {
  if (isSamePath(repoRoot, moluoHome)) {
    return;
  }

  syncOptionalDir(path.join(repoRoot, 'agents'), path.join(moluoHome, 'agents'));
  syncOptionalDir(path.join(repoRoot, 'skills'), path.join(moluoHome, 'skills')); // 同步第一方技能目录
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

    if (isSamePath(entry.source, entry.target)) {
      console.log(`[link] Skip (source === target): ${entry.target}`);
      continue;
    }

    mkdirSync(path.dirname(entry.target), { recursive: true });
    replaceWithSymlink(entry.source, entry.target, linkTypeForCurrentPlatform());
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

/**
 * 将所有技能投影到宿主软件目录（如 .claude 或 .cursor）。
 * 该过程遵循两层链接：宿主 -> ~/.agents/skills -> 源码。
 * ~/.agents 是行业标准共享层，始终存在（不存在则创建）。
 */
export function projectSkillsToHost(userHome: string, moluoHome: string, hostSkillsHome: string) {
  const sourceSkillsDir = path.join(moluoHome, 'skills');
  const agentsSkillsDir = path.join(userHome, '.agents', 'skills');

  // 1. 始终同步到 ~/.agents/skills（行业标准层，必选）
  mkdirSync(path.join(userHome, '.agents'), { recursive: true });
  syncFlattenedSkills(sourceSkillsDir, agentsSkillsDir, moluoHome);

  // 2. 从 ~/.agents 投影到宿主技能目录
  syncFlattenedSkills(agentsSkillsDir, hostSkillsHome, moluoHome);
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
  const config = findHostConfig(host);
  if (!config) {
    throw new Error(`Unknown host: ${host}`);
  }

  const { hostBaselineFile } = resolveHostPaths(config, userHome);
  replaceWithSymlink(source, hostBaselineFile, linkFileForCurrentPlatform());
  return hostBaselineFile;
}

/**
 * 将技能和基线投影到指定宿主，并返回是否成功（宿主目录不存在则跳过）。
 */
export function projectHostById(
  host: string,
  userHome: string,
  moluoHome: string,
): { success: boolean; hostBaselineFile: string } {
  const config = findHostConfig(host);
  if (!config) {
    throw new Error(`Unknown host: ${host}`);
  }

  const { hostHome, hostBaselineFile, skillsDirName } = resolveHostPaths(config, userHome);

  const hostHomePath = path.resolve(hostHome);
  if (!existsSync(hostHomePath)) {
    console.warn(`[skip] 宿主目录不存在，跳过投影: ${host} (${hostHomePath})`);
    return { success: false, hostBaselineFile };
  }

  projectToHost({
    userHome,
    moluoHome,
    hostHome,
    hostBaselineFile,
    customSkillsDirName: skillsDirName,
  });

  return { success: true, hostBaselineFile };
}
