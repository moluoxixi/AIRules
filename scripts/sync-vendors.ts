import type { Vendor } from './lib/vendors.js'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { vendors as vendorsConfig } from '../constants/skills.js'
import { collectFlattenedSkillSources, flattenedSkillName } from './lib/skill-projection.js'
import { walkVendorTree } from './lib/vendors.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const PROJECT_ROOT = resolve(__dirname, '..')
const VENDOR_SKILLS_DIR = join(PROJECT_ROOT, 'vendor', 'skills')
const CACHE_DIR = join(PROJECT_ROOT, '.cache-git')
const CONSTANTS_DIR = join(PROJECT_ROOT, 'constants')
const REMOVE_DIR_OPTIONS = { recursive: true, force: true, maxRetries: 5, retryDelay: 200 } as const

/** 同步状态文件：记录上次同步时 constants/ 的内容指纹 */
const SYNC_FINGERPRINT_FILE = join(PROJECT_ROOT, 'vendor', '.sync-fingerprint')

/**
 * 计算 constants/ 目录下所有文件的内容指纹（SHA-256）。
 * 排序保证结果稳定，与文件系统列出顺序无关。
 */
function computeConstantsFingerprint(): string {
  const hash = createHash('sha256')

  const files = readdirSync(CONSTANTS_DIR)
    .filter(f => !f.startsWith('.'))
    .sort()

  for (const file of files) {
    const content = readFileSync(join(CONSTANTS_DIR, file))
    hash.update(file) // 文件名也纳入哈希，防止重命名被忽略
    hash.update(content)
  }

  return hash.digest('hex')
}

/**
 * 读取上次同步时保存的指纹，不存在则返回空字符串。
 */
function readSavedFingerprint(): string {
  if (!existsSync(SYNC_FINGERPRINT_FILE))
    return ''
  return readFileSync(SYNC_FINGERPRINT_FILE, 'utf8').trim()
}

/**
 * 将当前指纹写入 lockfile。
 */
function saveSyncFingerprint(fingerprint: string): void {
  mkdirSync(dirname(SYNC_FINGERPRINT_FILE), { recursive: true })
  writeFileSync(SYNC_FINGERPRINT_FILE, fingerprint, 'utf8')
}

/**
 * 删除 Git 临时目录。Windows 上 Git 进程退出后文件句柄可能短暂滞留，
 * 这里使用 Node 的受限重试机制；重试耗尽后仍会抛出原始文件系统错误。
 */
function removeWorkingDir(targetDir: string): void {
  rmSync(targetDir, REMOVE_DIR_OPTIONS)
}

/**
 * 以参数数组执行 Git，避免把 vendor 配置拼进 shell 命令字符串。
 */
function runGit(args: string[], cwd: string) {
  const printableCommand = ['git', ...args].join(' ')
  console.log(`[GIT] ${printableCommand} (in ${cwd})`)

  const result = spawnSync('git', args, { cwd, stdio: 'inherit' })
  if (result.error) {
    throw result.error
  }

  if (result.status !== 0) {
    throw new Error(`Git command failed with exit code ${result.status}: ${printableCommand}`)
  }
}

function rememberTarget(targets: Map<string, string>, target: string, source: string) {
  const key = resolve(target).toLowerCase()
  const existingSource = targets.get(key)
  if (existingSource && resolve(existingSource) !== resolve(source)) {
    throw new Error(`Flattened vendor skill target collision "${target}": ${existingSource} conflicts with ${source}`)
  }

  targets.set(key, source)
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
  const force = process.argv.includes('--force')
  const currentFingerprint = computeConstantsFingerprint()
  const savedFingerprint = readSavedFingerprint()

  if (!force && currentFingerprint === savedFingerprint) {
    console.log('[SYNC] constants/ 未发生变化，跳过供应商同步。')
    console.log('[SYNC] 使用 --force 可忽略缓存强制重新克隆。')
    return
  }

  if (force) {
    console.log('[SYNC] --force 模式：忽略缓存，强制重新同步。')
  }
  else {
    console.log('[SYNC] 检测到 constants/ 已变化，开始重新同步...')
  }

  // 1. 清理环境
  if (existsSync(VENDOR_SKILLS_DIR)) {
    removeWorkingDir(VENDOR_SKILLS_DIR)
  }
  if (existsSync(CACHE_DIR)) {
    removeWorkingDir(CACHE_DIR)
  }

  mkdirSync(VENDOR_SKILLS_DIR, { recursive: true })
  mkdirSync(CACHE_DIR, { recursive: true })

  // 2. 构造同步清单
  const vendorsMap: Record<string, Vendor> = {}
  walkVendorTree(vendorsConfig, [], vendorsMap)

  // 3. 处理每个供应商
  const copiedTargets = new Map<string, string>()
  for (const [vendorName, vendor] of Object.entries(vendorsMap)) {
    if (!vendor.repo)
      continue

    const cacheTarget = join(CACHE_DIR, vendorName)
    const sourceRoot = vendor.sourceMode === 'workspace' ? PROJECT_ROOT : cacheTarget
    const vendorLabel = vendor.sourceMode === 'workspace' ? '本地 workspace 供应商' : '远程供应商'
    console.log(`\n--- 正在同步${vendorLabel}: ${vendorName} ---`)

    try {
      if (vendor.sourceMode !== 'workspace') {
        runGit(['clone', '--filter=blob:none', '--no-checkout', vendor.repo, vendorName], CACHE_DIR)

        const checkoutPaths = new Set<string>()
        for (const link of vendor.links) {
          checkoutPaths.add(link.source)
        }

        if (checkoutPaths.size > 0) {
          runGit(['sparse-checkout', 'set', ...checkoutPaths], cacheTarget)
        }

        runGit(['checkout'], cacheTarget)
      }

      for (const link of vendor.links) {
        const sourcePath = join(sourceRoot, link.source)

        if (!existsSync(sourcePath)) {
          throw new Error(`供应商 ${vendorName} 缺失配置的源目录: ${link.source}`)
        }

        const sources = link.kind === 'namespace-dir'
          ? collectFlattenedSkillSources(sourcePath).map(skill => ({
              source: skill.source,
              target: join(PROJECT_ROOT, 'vendor', 'skills', skill.name),
            }))
          : [{
              source: sourcePath,
              target: join(PROJECT_ROOT, 'vendor', 'skills', flattenedSkillName(link.target)),
            }]

        for (const source of sources) {
          rememberTarget(copiedTargets, source.target, source.source)
          mkdirSync(dirname(source.target), { recursive: true })
          cpSync(source.source, source.target, { recursive: true })
          console.log(`[COPIED] ${vendorName} -> ${source.target.replace(PROJECT_ROOT, '').replace(/^[/\\]/, '')}`)
        }
      }
    }
    catch (err) {
      console.error(`[ERROR] 供应商 ${vendorName} 同步失败:`, err)
      throw err
    }
  }

  // 4. 清除 Git 缓存
  console.log('\n[SYNC] 正在清理远程缓存...')
  removeWorkingDir(CACHE_DIR)

  // 5. 保存本次同步的指纹
  saveSyncFingerprint(currentFingerprint)
  console.log(`[SYNC] 已更新同步指纹: ${currentFingerprint.slice(0, 12)}...`)

  console.log('\n[SYNC] 供应商技能同步完成。')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
