import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DEFAULT_ROLE, resolveRoleManifestPath } from './lib/roles.js'
import { collectFlattenedSkillSources, flattenedSkillName } from './lib/skill-projection.js'
import { createEmptyLock, getLockedSha, loadVendorLock, upsertLockEntry, writeVendorLock } from './lib/vendor-lock.js'
import { loadVendorManifest } from './lib/vendors.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const PROJECT_ROOT = resolve(__dirname, '..')
const VENDOR_SKILLS_DIR = join(PROJECT_ROOT, 'vendor', 'skills')
const CACHE_DIR = join(PROJECT_ROOT, '.cache-git')
const REMOVE_DIR_OPTIONS = { recursive: true, force: true, maxRetries: 5, retryDelay: 200 } as const

/** vendor 版本锁文件：固定每个 vendor 的提交 SHA，纳入 git 版本控制 */
const VENDOR_LOCK_FILE = join(PROJECT_ROOT, 'vendor-lock.json')

/**
 * 计算角色 constants/ 目录下所有文件的内容指纹（SHA-256）。
 * 排序保证结果稳定，与文件系统列出顺序无关。
 */
function computeConstantsFingerprint(role: string): string {
  const hash = createHash('sha256')
  const constantsDir = join(PROJECT_ROOT, 'roles', role, 'constants')

  const files = readdirSync(constantsDir)
    .filter(f => !f.startsWith('.'))
    .sort()

  for (const file of files) {
    const content = readFileSync(join(constantsDir, file))
    hash.update(file) // 文件名也纳入哈希，防止重命名被忽略
    hash.update(content)
  }

  return hash.digest('hex')
}

function syncFingerprintFile(role: string): string {
  return join(PROJECT_ROOT, 'vendor', `.sync-fingerprint-${role}`)
}

/**
 * 读取上次同步时保存的指纹，不存在则返回空字符串。
 */
function readSavedFingerprint(role: string): string {
  const file = syncFingerprintFile(role)
  if (!existsSync(file))
    return ''
  return readFileSync(file, 'utf8').trim()
}

/**
 * 将当前指纹写入 lockfile。
 */
function saveSyncFingerprint(role: string, fingerprint: string): void {
  const file = syncFingerprintFile(role)
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, fingerprint, 'utf8')
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

/**
 * 以参数数组执行 Git 并捕获 stdout（用于读取 rev-parse 等结果）。
 * 失败时抛出带 stderr 的错误，不静默吞掉非零退出码。
 */
function runGitCapture(args: string[], cwd: string): string {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8', stdio: 'pipe' })
  if (result.error) {
    throw result.error
  }

  if (result.status !== 0) {
    const stderr = (result.stderr ?? '').trim()
    throw new Error(`Git command failed with exit code ${result.status}: git ${args.join(' ')}${stderr ? `: ${stderr}` : ''}`)
  }

  return (result.stdout ?? '').trim()
}

function rememberTarget(targets: Map<string, string>, target: string, source: string) {
  const key = resolve(target).toLowerCase()
  const existingSource = targets.get(key)
  if (existingSource && resolve(existingSource) !== resolve(source)) {
    throw new Error(`Flattened vendor skill target collision "${target}": ${existingSource} conflicts with ${source}`)
  }

  targets.set(key, source)
}

function resolveVendorTarget(link: { kind: string, target: string }): string {
  if (link.kind === 'skill') {
    return join(PROJECT_ROOT, 'vendor', 'skills', flattenedSkillName(link.target))
  }

  return join(PROJECT_ROOT, link.target)
}

function readArgValue(name: string): string | undefined {
  const index = process.argv.indexOf(name)
  if (index === -1) {
    return undefined
  }

  const value = process.argv[index + 1]
  if (!value || value.startsWith('--')) {
    throw new Error(`Missing value for ${name}`)
  }

  return value
}

/**
 * 供应商技能同步脚本 (核心逻辑)
 *
 * 缓存策略：
 *   - 计算 roles/<role>/constants/ 目录的内容指纹
 *   - 与上次同步时保存的指纹对比
 *   - 指纹相同 → 跳过同步（角色 constants 未变化）
 *   - 指纹不同 / 无 lockfile → 执行完整同步并更新指纹
 *
 * 使用方式：
 *   npx tsx scripts/sync-vendors.ts                  # 同步默认 openspec-development 角色
 *   npx tsx scripts/sync-vendors.ts --role product   # 同步 product 角色
 *   npx tsx scripts/sync-vendors.ts --force          # 忽略缓存，强制重新克隆
 */
async function main() {
  const force = process.argv.includes('--force')
  const role = readArgValue('--role') ?? DEFAULT_ROLE
  if (role === '') {
    console.log('[SYNC] 未选择 role，跳过供应商同步。')
    return
  }

  const manifestPath = resolveRoleManifestPath(PROJECT_ROOT, role)
  // --update-lock：拉取默认分支最新，并把每个 vendor 的 HEAD SHA 写回 vendor-lock.json。
  // 不带该标志时：若 vendor-lock.json 存在锁定项，则 checkout 锁定 SHA（可复现）；否则按默认分支最新同步。
  const updateLock = process.argv.includes('--update-lock')
  const currentFingerprint = computeConstantsFingerprint(role)
  const savedFingerprint = readSavedFingerprint(role)

  // --update-lock 必须强制重新克隆，否则指纹未变会跳过同步、拿不到 HEAD。
  if (!force && !updateLock && currentFingerprint === savedFingerprint) {
    console.log(`[SYNC] roles/${role}/constants/ 未发生变化，跳过供应商同步。`)
    console.log('[SYNC] 使用 --force 可忽略缓存强制重新克隆。')
    return
  }

  if (force) {
    console.log('[SYNC] --force 模式：忽略缓存，强制重新同步。')
  }
  else if (updateLock) {
    console.log('[SYNC] --update-lock 模式：拉取最新并更新 vendor-lock.json。')
  }
  else {
    console.log(`[SYNC] 检测到 roles/${role}/constants/ 已变化，开始重新同步...`)
  }

  // vendor 版本锁：存在则读取，用于固定 SHA；--update-lock 模式下从空锁重建。
  const vendorLock = updateLock ? createEmptyLock() : loadVendorLock(VENDOR_LOCK_FILE)

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
  const { vendors: vendorsMap } = await loadVendorManifest(manifestPath)

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

        // 版本固定：非 --update-lock 且锁文件存在该 vendor 的 SHA 时，checkout 锁定提交以保证可复现。
        const lockedSha = updateLock ? undefined : getLockedSha(vendorLock, vendorName, vendor.repo)
        if (lockedSha) {
          console.log(`[LOCK] ${vendorName} 固定到 ${lockedSha.slice(0, 12)}`)
          runGit(['checkout', lockedSha], cacheTarget)
        }
        else {
          runGit(['checkout'], cacheTarget)
        }

        // --update-lock 模式：记录当前 HEAD 的 SHA，稍后统一写回 vendor-lock.json。
        if (updateLock && vendorLock) {
          const headSha = runGitCapture(['rev-parse', 'HEAD'], cacheTarget)
          upsertLockEntry(vendorLock, vendorName, vendor.repo, headSha)
          console.log(`[LOCK] 记录 ${vendorName} -> ${headSha.slice(0, 12)}`)
        }
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
              target: resolveVendorTarget(link),
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

  // --update-lock 模式：把本次采集的 SHA 写回 vendor-lock.json（纳入 git diff 供 review）。
  if (updateLock && vendorLock) {
    writeVendorLock(VENDOR_LOCK_FILE, vendorLock)
    console.log(`[LOCK] 已更新 vendor-lock.json（${Object.keys(vendorLock.vendors).length} 个 vendor）`)
  }

  // 5. 保存本次同步的指纹
  saveSyncFingerprint(role, currentFingerprint)
  console.log(`[SYNC] 已更新同步指纹: ${currentFingerprint.slice(0, 12)}...`)

  console.log('\n[SYNC] 供应商技能同步完成。')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
