import os from 'node:os';
import path from 'node:path';
import { existsSync, readdirSync, lstatSync, realpathSync } from 'node:fs';
import { findHostConfig, resolveHostPaths } from '../../constants/hosts.js';

/**
 * 验证指定宿主的技能链接完整性
 * @param host 宿主名称
 * @param moluoHome AIRules 的本地安装目录
 * @returns 是否验证通过
 */
export async function verifyHost(host: string, moluoHome: string): Promise<boolean> {
  console.log(`\n--- 正在验证宿主: ${host} ---`);

  const userHome = os.homedir();
  const config = findHostConfig(host);
  if (!config) return false;

  const { hostHome, skillsDirName } = resolveHostPaths(config, userHome);

  const resolvedHostHome = path.resolve(hostHome);
  if (!existsSync(resolvedHostHome)) {
    console.warn(`[SKIP] 宿主目录不存在: ${resolvedHostHome}`);
    return true; // 跳过但不视为失败
  }

  const targetSkillsDir = path.join(resolvedHostHome, skillsDirName);

  if (!existsSync(targetSkillsDir)) {
    console.error(`[FAIL] 技能目录缺失: ${targetSkillsDir}`);
    return false;
  }

  // 1. 获取预期技能列表 (从 vendor/skills)
  const expectedSkills = new Set<string>();

  const vendorSkillsDir = path.join(moluoHome, 'vendor', 'skills');
  if (existsSync(vendorSkillsDir)) {
    readdirSync(vendorSkillsDir).forEach(name => {
      if (name !== '.gitignore') expectedSkills.add(name);
    });
  }

  console.log(`[info] 预期技能总数: ${expectedSkills.size}`);

  // 2. 检查实际存在的链接
  let missingCount = 0;
  let brokenCount = 0;
  let validCount = 0;

  for (const skill of expectedSkills) {
    const skillPath = path.join(targetSkillsDir, skill);

    // existsSync 对断开的链接返回 false
    if (!existsSync(skillPath)) {
      try {
        if (lstatSync(skillPath).isSymbolicLink()) {
          console.error(`[FAIL] 损坏的软链接 (Broken Link): ${skill}`);
          brokenCount++;
          continue;
        }
      } catch (e) {}

      console.error(`[FAIL] 缺失技能链接 (Missing): ${skill}`);
      missingCount++;
      continue;
    }

    try {
      const stats = lstatSync(skillPath);
      if (!stats.isSymbolicLink()) {
        console.warn(`[WARN] 技能不是软链接 (可能是物理拷贝): ${skill}`);
        validCount++;
      } else {
        const real = realpathSync(skillPath);
        const normalizedReal = path.resolve(real);
        const normalizedMoluo = path.resolve(moluoHome);
        const normalizedRepo = path.resolve(process.cwd());

        // 验证指向是否在 moluoxixi 内部或仓库根目录
        if (normalizedReal.startsWith(normalizedMoluo) || normalizedReal.startsWith(normalizedRepo)) {
           validCount++;
        } else {
           console.warn(`[WARN] 链接指向外部路径: ${skill} -> ${real}`);
           validCount++;
        }
      }
    } catch (e) {
      console.error(`[FAIL] 无法访问技能状态: ${skill}`);
      brokenCount++;
    }
  }

  console.log(`[result] 有效=${validCount}, 缺失=${missingCount}, 损坏=${brokenCount}`);

  const success = missingCount === 0 && brokenCount === 0;
  if (success) {
    console.log(`✅ ${host} 验证通过`);
  } else {
    console.log(`❌ ${host} 验证失败`);
  }

  return success;
}
