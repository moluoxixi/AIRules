import { execSync } from 'child_process';
import { resolve, join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { rmSync, mkdirSync, cpSync, existsSync } from 'fs';
import { vendors as vendorsConfig } from '../constants/skills.js';
import { walkVendorTree, type Vendor } from './lib/vendors.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = resolve(__dirname, '..');
const VENDOR_SKILLS_DIR = join(PROJECT_ROOT, 'vendor', 'skills');
const CACHE_DIR = join(PROJECT_ROOT, '.cache-git');

/**
 * 执行 Git 命令并实时输出
 * @param cmd Git 命令
 * @param cwd 运行目录
 */
function runGitQuery(cmd: string, cwd: string) {
  console.log(`[GIT] ${cmd} (in ${cwd})`);
  return execSync(cmd, { cwd, stdio: 'inherit' });
}

/**
 * 供应商技能同步脚本 (核心逻辑)
 * 该脚本负责克隆远程仓库，并根据 manifest 计划将技能提取到 vendor/skills。
 * 目前支持混合数组结构的递归发现。
 */
async function main() {
  console.log('[SYNC] 正在启动供应商技能同步...');

  // 1. 清理环境：移除旧的 vendor/skills 和 git 缓存
  if (existsSync(VENDOR_SKILLS_DIR)) {
    rmSync(VENDOR_SKILLS_DIR, { recursive: true, force: true });
  }
  if (existsSync(CACHE_DIR)) {
    rmSync(CACHE_DIR, { recursive: true, force: true });
  }
  
  mkdirSync(VENDOR_SKILLS_DIR, { recursive: true });
  mkdirSync(CACHE_DIR, { recursive: true });

  // 2. 构造同步清单：通过递归遍历配置，获取所有供应商及其链接计划
  const vendorsMap: Record<string, Vendor> = {};
  walkVendorTree(vendorsConfig, [], vendorsMap);

  // 3. 处理每个供应商
  for (const [vendorName, vendor] of Object.entries(vendorsMap)) {
    if (!vendor.repo) continue;

    const cacheTarget = join(CACHE_DIR, vendorName);
    console.log(`\n--- 正在拉取远程供应商: ${vendorName} ---`);
    
    try {
      // 3.1 极速克隆 (blobless & no-checkout)：仅下载提交历史，不下载文件
      runGitQuery(`git clone --filter=blob:none --no-checkout ${vendor.repo} ${vendorName}`, CACHE_DIR);

      // 3.2 收集所有需要检出的路径 (Sparse Checkout)
      const checkoutPaths = new Set<string>();
      for (const link of vendor.links) {
        checkoutPaths.add(link.source);
      }

      if (checkoutPaths.size > 0) {
        // 仅拉取我们真正需要的路径，节省带宽和磁盘空间
        runGitQuery(`git sparse-checkout set ${[...checkoutPaths].join(' ')}`, cacheTarget);
      }
      
      runGitQuery(`git checkout`, cacheTarget);

      // 3.3 按照 Manifest 计划分发技能到 vendor/skills
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

  // 4. 清除远程 Git 缓存
  console.log('\n[SYNC] 正在清理远程缓存...');
  rmSync(CACHE_DIR, { recursive: true, force: true });

  console.log('\n[SYNC] 供应商技能同步完成。');
}

main().catch(console.error);
