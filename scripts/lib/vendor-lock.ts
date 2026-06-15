import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

/**
 * 单个 vendor 的版本锁定记录。
 */
export interface VendorLockEntry {
  /** vendor 仓库地址，与 constants/skills.ts 中的 source 对应，用于校验锁定项未串仓库 */
  repo: string
  /** 锁定的提交 SHA；同步时 checkout 此 SHA 而非默认分支 HEAD */
  sha: string
  /** 该锁定项写入时间（ISO8601），便于审计何时固定版本 */
  locked_at: string
}

/**
 * vendor-lock.json 的结构。
 * vendors 为空对象时表示未锁定任何 vendor，同步退回「拉取默认分支最新」的行为。
 */
export interface VendorLock {
  version: number
  locked_at: string
  vendors: Record<string, VendorLockEntry>
}

const LOCK_VERSION = 1

/**
 * 读取 vendor-lock.json。文件不存在返回 null（表示未启用锁定，按最新同步）。
 * 文件存在但结构非法时抛出错误——锁文件是边界输入，损坏必须显式暴露而非静默退回最新。
 */
export function loadVendorLock(lockPath: string): VendorLock | null {
  if (!existsSync(lockPath)) {
    return null
  }

  const raw = readFileSync(lockPath, 'utf8')
  const parsed = JSON.parse(raw) as unknown
  if (
    !parsed
    || typeof parsed !== 'object'
    || typeof (parsed as VendorLock).version !== 'number'
    || typeof (parsed as VendorLock).vendors !== 'object'
    || (parsed as VendorLock).vendors === null
  ) {
    throw new Error(`vendor-lock 文件结构非法: ${lockPath}（需包含 version:number 与 vendors:object）`)
  }

  return parsed as VendorLock
}

/**
 * 取指定 vendor 的锁定 SHA。
 * 锁定项存在但 repo 与当前配置不一致时抛错，避免锁文件与配置漂移后静默 checkout 错误仓库。
 * @returns 锁定的 SHA；无锁定项时返回 undefined（调用方应退回默认分支最新）
 */
export function getLockedSha(lock: VendorLock | null, vendorName: string, repo: string): string | undefined {
  if (!lock) {
    return undefined
  }

  const entry = lock.vendors[vendorName]
  if (!entry) {
    return undefined
  }

  if (entry.repo !== repo) {
    throw new Error(`vendor-lock 与配置不一致：vendor "${vendorName}" 锁定 repo=${entry.repo}，但配置 repo=${repo}`)
  }

  return entry.sha
}

/**
 * 创建一个空锁（未锁定任何 vendor）。
 */
export function createEmptyLock(): VendorLock {
  return {
    version: LOCK_VERSION,
    locked_at: new Date().toISOString(),
    vendors: {},
  }
}

/**
 * 写入/更新单个 vendor 的锁定项（就地修改 lock 对象）。
 */
export function upsertLockEntry(lock: VendorLock, vendorName: string, repo: string, sha: string): void {
  lock.vendors[vendorName] = {
    repo,
    sha,
    locked_at: new Date().toISOString(),
  }
}

/**
 * 将锁对象序列化写回磁盘（带尾随换行，稳定排序 vendor key 便于 diff review）。
 */
export function writeVendorLock(lockPath: string, lock: VendorLock): void {
  const orderedVendors: Record<string, VendorLockEntry> = {}
  for (const name of Object.keys(lock.vendors).sort()) {
    orderedVendors[name] = lock.vendors[name]
  }

  const serialized = {
    version: lock.version,
    locked_at: lock.locked_at,
    vendors: orderedVendors,
  }

  mkdirSync(dirname(lockPath), { recursive: true })
  writeFileSync(lockPath, `${JSON.stringify(serialized, null, 2)}\n`, 'utf8')
}
