import { execSync } from 'child_process';
import { resolve, join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { rmSync, mkdirSync, cpSync, existsSync, readdirSync } from 'fs';
import { vendors } from '../constants/skills.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = resolve(__dirname, '..');
const VENDOR_SKILLS_DIR = join(PROJECT_ROOT, 'vendor', 'skills');
const LOCAL_SKILLS_DIR = join(PROJECT_ROOT, 'skills');
const CACHE_DIR = join(PROJECT_ROOT, '.cache-git');

function runGitQuery(cmd: string, cwd: string) {
  console.log(`[GIT] ${cmd} (in ${cwd})`);
  return execSync(cmd, { cwd, stdio: 'inherit' });
}

async function main() {
  console.log('[SYNC] Starting vendor skills synchronization...');

  // Clean and prepare the vendor directory
  if (existsSync(VENDOR_SKILLS_DIR)) {
    rmSync(VENDOR_SKILLS_DIR, { recursive: true, force: true });
  }
  if (existsSync(CACHE_DIR)) {
    rmSync(CACHE_DIR, { recursive: true, force: true });
  }
  
  mkdirSync(VENDOR_SKILLS_DIR, { recursive: true });
  mkdirSync(CACHE_DIR, { recursive: true });

  // 1. Process Remote Vendors
  for (const [namespace, vendorList] of Object.entries(vendors)) {
    for (const vendor of vendorList) {
      if (!vendor.source) continue;

      const cacheTarget = join(CACHE_DIR, vendor.name);
      
      console.log(`\n--- Fetching remote supplier: ${vendor.name} ---`);
      
      try {
        // Clone with blobless and no-checkout for blazing speed
        runGitQuery(`git clone --filter=blob:none --no-checkout ${vendor.source} ${vendor.name}`, CACHE_DIR);

        const baseDir = vendor.sourceBaseDir || vendor.sourceDir;
        let checkoutPaths: string[] = [];

        if (vendor.skills) {
          // If specific skills are listed, add them to sparse checkout paths
          for (const skillKey of Object.values(vendor.skills)) {
            const skillPath = baseDir ? `${baseDir}/${skillKey}` : skillKey;
            checkoutPaths.push(skillPath);
          }
        } else if (baseDir) {
          // If no specific skills but has a base dir, checkout the whole base dir
          checkoutPaths.push(baseDir);
        } else {
          // Fallback to checking out everything if no mapping is provided
          console.warn(`[WARN] No specific skills mapping or baseDir for ${vendor.name}. Checking out everything.`);
        }

        if (checkoutPaths.length > 0) {
          runGitQuery(`git sparse-checkout set ${checkoutPaths.join(' ')}`, cacheTarget);
        }
        
        runGitQuery(`git checkout`, cacheTarget);

        // Copy out the specific skills to the final vendor/skills path
        if (vendor.skills) {
          for (const [skillId, skillPathKey] of Object.entries(vendor.skills)) {
            const finalTargetDir = join(VENDOR_SKILLS_DIR, skillId);
            const sourcePath = join(cacheTarget, baseDir ? baseDir : '', skillPathKey);
            
            mkdirSync(finalTargetDir, { recursive: true });
            cpSync(sourcePath, finalTargetDir, { recursive: true });
            console.log(`[COPIED] ${vendor.name}/${skillId}`);
          }
        } else if (baseDir) {
            const finalTargetDir = join(VENDOR_SKILLS_DIR, vendor.name);
            const sourcePath = join(cacheTarget, baseDir);
            mkdirSync(finalTargetDir, { recursive: true });
            cpSync(sourcePath, finalTargetDir, { recursive: true });
            console.log(`[COPIED] ${vendor.name} (whole baseDir)`);
        } else {
            const finalTargetDir = join(VENDOR_SKILLS_DIR, vendor.name);
            mkdirSync(finalTargetDir, { recursive: true });
            cpSync(cacheTarget, finalTargetDir, { recursive: true });
            console.log(`[COPIED] ${vendor.name} (full repo fallback)`);
        }
        
      } catch (err) {
        console.error(`[ERROR] Failed to fetch vendor ${vendor.name}:`, err);
      }
    }
  }

  // 清除远程缓存
  console.log('\n[SYNC] Cleaning up remote caches...');
  rmSync(CACHE_DIR, { recursive: true, force: true });

  console.log('\n[SYNC] Vendor skills initialization completed successfully.');
}

main().catch(console.error);
