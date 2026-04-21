import { execSync } from 'child_process';
import { resolve, join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { rmSync, mkdirSync, cpSync, existsSync, readdirSync, readFileSync, writeFileSync } from 'fs';
import { createHash } from 'crypto';
import { vendors as vendorsConfig } from '../constants/skills.js';
import { walkVendorTree, type Vendor } from './lib/vendors.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = resolve(__dirname, '..');
const VENDOR_SKILLS_DIR = join(PROJECT_ROOT, 'vendor', 'skills');
const CACHE_DIR = join(PROJECT_ROOT, '.cache-git');
const CONSTANTS_DIR = join(PROJECT_ROOT, 'constants');

/** 同步状态文件：记录上次同步时 constants/ 的内容指纹 */
const SYNC_FINGERPRINT_FILE = join(PROJECT_ROOT, 'vendor', '.sync-fingerprint');

/**
 * 计算 constants/ 目录下所有文件的内容指纹（SHA-256）。
 * 排序保证结果稳定，与文件系统列出顺序无关。
 */
function computeConstantsFingerprint(): string {
  const hash = createHash('sha256');

  const files = readdirSync(CONSTANTS_DIR)
    .filter(f => !f.startsWith('.'))
    .sort();

  for (const file of files) {
    const content = readFileSync(join(CONSTANTS_DIR, file));
    hash.update(file);       // 文件名也纳入哈希，防止重命名被忽略
    hash.update(content);
  }

  return hash.digest('hex');
}

/**
 * 读取上次同步时保存的指纹，不存在则返回空字符串。
 */
function readSavedFingerprint(): string {
  if (!existsSync(SYNC_FINGERPRINT_FILE)) return '';
  return readFileSync(SYNC_FINGERPRINT_FILE, 'utf8').trim();
}

/**
 * 将当前指纹写入 lockfile。
 */
function saveSyncFingerprint(fingerprint: string): void {
  mkdirSync(dirname(SYNC_FINGERPRINT_FILE), { recursive: true });
  writeFileSync(SYNC_FINGERPRINT_FILE, fingerprint, 'utf8');
}

/**
 * 执行 Git 命令并实时输出
 */
function runGitQuery(cmd: string, cwd: string) {
  console.log(`[GIT] ${cmd} (in ${cwd})`);
  return execSync(cmd, { cwd, stdio: 'inherit' });
}

/**
 * 供应商技能同步脚本 (核心逻辑)
 *
 * 缓存策略：
 *   - 计算 constants/ 目录的内容指纹
 *   - 与上次同步时保存的指纹对比
 *   - 指纹相同 → 跳过同步（constants 未变化）
 *   - 指纹不同 / 无 lockfile → 执行完整同步并更新指纹
 *
 * 使用方式：
 *   npx tsx scripts/sync-vendors.ts          # 自动判断是否需要同步
 *   npx tsx scripts/sync-vendors.ts --force  # 忽略缓存，强制重新克隆
 */
async function main() {
  const force = process.argv.includes('--force');
  const currentFingerprint = computeConstantsFingerprint();
  const savedFingerprint = readSavedFingerprint();

  if (!force && currentFingerprint === savedFingerprint) {
    console.log('[SYNC] constants/ 未发生变化，跳过供应商同步。');
    console.log('[SYNC] 使用 --force 可忽略缓存强制重新克隆。');
    return;
  }

  if (force) {
    console.log('[SYNC] --force 模式：忽略缓存，强制重新同步。');
  } else {
    console.log('[SYNC] 检测到 constants/ 已变化，开始重新同步...');
  }

  // 1. 清理环境
  if (existsSync(VENDOR_SKILLS_DIR)) {
    rmSync(VENDOR_SKILLS_DIR, { recursive: true, force: true });
  }
  if (existsSync(CACHE_DIR)) {
    rmSync(CACHE_DIR, { recursive: true, force: true });
  }

  mkdirSync(VENDOR_SKILLS_DIR, { recursive: true });
  mkdirSync(CACHE_DIR, { recursive: true });

  // 2. 构造同步清单
  const vendorsMap: Record<string, Vendor> = {};
  walkVendorTree(vendorsConfig, [], vendorsMap);

  // 3. 处理每个供应商
  for (const [vendorName, vendor] of Object.entries(vendorsMap)) {
    if (!vendor.repo) continue;

    const cacheTarget = join(CACHE_DIR, vendorName);
    console.log(`\n--- 正在拉取远程供应商: ${vendorName} ---`);

    try {
      runGitQuery(`git clone --filter=blob:none --no-checkout ${vendor.repo} ${vendorName}`, CACHE_DIR);

      const checkoutPaths = new Set<string>();
      for (const link of vendor.links) {
        checkoutPaths.add(link.source);
      }

      if (checkoutPaths.size > 0) {
        runGitQuery(`git sparse-checkout set ${[...checkoutPaths].join(' ')}`, cacheTarget);
      }

      runGitQuery(`git checkout`, cacheTarget);

      for (const link of vendor.links) {
        const sourcePath = join(cacheTarget, link.source);
        const finalTargetDir = join(PROJECT_ROOT, link.target);

        if (!existsSync(sourcePath)) {
          console.warn(`[WARN] 跳过缺失的源目录: ${link.source}`);
          continue;
        }

        mkdirSync(dirname(finalTargetDir), { recursive: true });
        cpSync(sourcePath, finalTargetDir, { recursive: true });
        console.log(`[COPIED] ${vendorName} -> ${link.target}`);
      }

    } catch (err) {
      console.error(`[ERROR] 供应商 ${vendorName} 同步失败:`, err);
    }
  }

  // 4. 清除 Git 缓存
  console.log('\n[SYNC] 正在清理远程缓存...');
  rmSync(CACHE_DIR, { recursive: true, force: true });

  // 5. 保存本次同步的指纹
  saveSyncFingerprint(currentFingerprint);
  console.log(`[SYNC] 已更新同步指纹: ${currentFingerprint.slice(0, 12)}...`);

  console.log('\n[SYNC] 供应商技能同步完成。');
}

main().catch(console.error);
