#!/usr/bin/env npx tsx
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

// 项目记忆库周期性体检工具（只读、非重型治理、不自增度量）：
// recall-memory / reflect 已要求「引用前复核记忆命名的文件仍存在」与「按 created_at 复核时效」，
// 但只有 prose 约束、无工具承载，也无周期性扫描。本脚本补齐客观信号侧：
// - validate：schema 完整性门禁（created_at 可解析、status/type 合法枚举），违规 exit 1；
// - audit：只读 staleness 报告（恒 exit 0，软提示）——active 记忆超龄 + 正文反引号路径已不存在；
// - list：按 status 分组。
// 明确不做 last_recalled_at / recall 时回写 / 自动 supersede——那是运行时自动度量，
// 与 distill-candidates「无客观信号的重型治理违背 baseline 取舍」及 ADR/核验报告「自动度量不做」冲突。
// 命中只产报告，由人工经 remember 标 superseded，工具绝不改记忆本身。

export const MEMORY_STATUSES = ['active', 'superseded'] as const
export const MEMORY_TYPES = ['decision', 'gotcha', 'constraint', 'boundary', 'reference'] as const
const DEFAULT_AGE_DAYS = 180

export interface MemoryEntry {
  slug: string
  relPath: string
  /** 绝对路径，供 audit 读正文。 */
  absPath: string
  type?: string
  createdAt?: string
  status?: string
  parsed: boolean
}

export interface CheckResult {
  errors: string[]
}

export interface Finding {
  slug: string
  relPath: string
  reasons: string[]
}

export interface AuditResult {
  findings: Finding[]
  /** 库级软告警（非单条记忆问题）：如缺 active boundary/constraint 记忆。恒不影响 exit code。 */
  warnings: string[]
}

/** 解析记忆 frontmatter：取首块 `---...---`，收顶层标量键 + 一层 `metadata:` 下缩进键。 */
function parseFrontmatter(content: string): { ok: boolean, top: Record<string, string>, metadata: Record<string, string> } {
  const normalized = content.replace(/\r\n/g, '\n')
  if (!normalized.startsWith('---\n')) {
    return { ok: false, top: {}, metadata: {} }
  }
  const end = normalized.indexOf('\n---', 4)
  if (end === -1) {
    return { ok: false, top: {}, metadata: {} }
  }
  const body = normalized.slice(4, end)
  const top: Record<string, string> = {}
  const metadata: Record<string, string> = {}
  let inMetadata = false
  for (const line of body.split('\n')) {
    if (line.length === 0) {
      continue
    }
    const indented = /^\s/.test(line)
    const colon = line.indexOf(':')
    if (colon <= 0) {
      continue
    }
    const rawKey = line.slice(0, colon)
    const key = rawKey.trim()
    const value = line.slice(colon + 1).trim()
    if (!/^\w+$/.test(key)) {
      continue
    }
    if (!indented) {
      // 顶层键。metadata: 开块（值为空）。
      inMetadata = key === 'metadata' && value.length === 0
      if (!inMetadata) {
        top[key] = value
      }
    }
    else if (inMetadata) {
      // metadata 块内的缩进键。
      metadata[key] = value
    }
  }
  return { ok: true, top, metadata }
}

function memoryDir(repoRoot: string) {
  return path.join(repoRoot, 'knowledge', 'memory')
}

/** 扫描记忆库（排除 MEMORY.md 索引）。缺目录返回空。 */
export function scanMemory(repoRoot: string): MemoryEntry[] {
  const dir = memoryDir(repoRoot)
  if (!existsSync(dir)) {
    return []
  }
  const out: MemoryEntry[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.md') || entry.name === 'MEMORY.md') {
      continue
    }
    const absPath = path.join(dir, entry.name)
    const { ok, top, metadata } = parseFrontmatter(readFileSync(absPath, 'utf8'))
    out.push({
      slug: top.name ?? entry.name.replace(/\.md$/, ''),
      relPath: path.relative(repoRoot, absPath).replace(/\\/g, '/'),
      absPath,
      type: metadata.type,
      createdAt: metadata.created_at,
      status: metadata.status,
      parsed: ok,
    })
  }
  return out
}

/** YYYY-MM-DD 是否为可解析合法日期（含日历回环校验，拒 2026-02-30 等溢出日）。 */
function parseDate(value: string | undefined): Date | undefined {
  if (value === undefined || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return undefined
  }
  const d = new Date(`${value}T00:00:00Z`)
  if (Number.isNaN(d.getTime())) {
    return undefined
  }
  // 回环校验：Date 会把 02-30 静默回滚成 03-02，比对原串即可堵住日历溢出。
  return d.toISOString().slice(0, 10) === value ? d : undefined
}

/** schema 门禁：created_at 可解析、status/type 合法枚举（缺失也算违规）。 */
export function validateMemory(repoRoot: string): CheckResult {
  const errors: string[] = []
  for (const m of scanMemory(repoRoot)) {
    if (!m.parsed) {
      errors.push(`${m.relPath} frontmatter 无法解析（缺闭合 --- 分隔符）`)
      continue
    }
    if (parseDate(m.createdAt) === undefined) {
      errors.push(`${m.relPath} created_at 缺失或非法（应为 YYYY-MM-DD，实际 "${m.createdAt ?? ''}"）`)
    }
    if (m.status === undefined || !(MEMORY_STATUSES as readonly string[]).includes(m.status)) {
      errors.push(`${m.relPath} metadata.status 非法值 "${m.status ?? ''}"（应为 ${MEMORY_STATUSES.join('/')} 之一）`)
    }
    if (m.type === undefined || !(MEMORY_TYPES as readonly string[]).includes(m.type)) {
      errors.push(`${m.relPath} metadata.type 非法值 "${m.type ?? ''}"（应为 ${MEMORY_TYPES.join('/')} 之一）`)
    }
  }
  return { errors }
}

/** 从记忆正文提取反引号包裹、看起来像仓库相对路径的引用（含 / 且有扩展名）。 */
function referencedPaths(content: string): string[] {
  const body = content.replace(/\r\n/g, '\n')
  const refs = new Set<string>()
  const re = /`([^`]+)`/g
  let m: RegExpExecArray | null = re.exec(body)
  while (m !== null) {
    const token = m[1].trim()
    // 仅当像路径：含 /、有文件扩展名、不含空格/通配。
    if (/^[\w./-]+\.[a-z0-9]+$/i.test(token) && token.includes('/')) {
      refs.add(token)
    }
    m = re.exec(body)
  }
  return [...refs]
}

/** staleness 只读体检：active 记忆超龄 + 正文反引号路径不存在。superseded 不审。恒不改文件。 */
export function auditMemory(repoRoot: string, opts: { ageDays?: number, now?: Date } = {}): AuditResult {
  const ageDays = opts.ageDays ?? DEFAULT_AGE_DAYS
  const now = opts.now ?? new Date()
  const findings: Finding[] = []
  const entries = scanMemory(repoRoot)
  for (const m of entries) {
    // 默认只审 active；superseded / 解析失败的留给 validate。
    if (m.status !== 'active') {
      continue
    }
    const reasons: string[] = []
    const created = parseDate(m.createdAt)
    if (created !== undefined) {
      const ageMs = now.getTime() - created.getTime()
      const days = Math.floor(ageMs / 86_400_000)
      if (days > ageDays) {
        reasons.push(`stale(${days}d>${ageDays}d)`)
      }
    }
    for (const ref of referencedPaths(readFileSync(m.absPath, 'utf8'))) {
      if (!existsSync(path.join(repoRoot, ref))) {
        reasons.push(`dangling(${ref})`)
      }
    }
    if (reasons.length > 0) {
      findings.push({ slug: m.slug, relPath: m.relPath, reasons })
    }
  }

  // 库级软告警：边界保护激活度。recall-memory「边界最低召回」要求每次召回至少含一条
  // constraint/boundary；若库中无 active 的此类记忆，纯执行类经验会在高权重召回中持续覆盖
  // 应谨慎/拒绝的判断（安全边界侵蚀）。这里只产可观测信号、恒 exit 0、绝不改记忆——
  // 与 recall-memory SKILL.md「跳过不静默」提示对齐，便于 reflect 的「安全边界侵蚀」归因。
  const warnings: string[] = []
  const boundaryActive = entries.filter(
    m => m.status === 'active' && (m.type === 'boundary' || m.type === 'constraint'),
  ).length
  if (boundaryActive < 1) {
    warnings.push('当前项目未定义 active 的 boundary/constraint 记忆，安全边界侵蚀保护未激活')
  }

  return { findings, warnings }
}

/** 按 status 分组列出记忆。返回可打印文本。 */
export function formatList(entries: MemoryEntry[]): string {
  if (entries.length === 0) {
    return '记忆库为空。'
  }
  // 归桶：active/superseded 合法枚举各自成组；缺 status→unknown；非空非法值（如 archived）→malformed
  // catch-all（validate 会拦，但 list 独立运行须显示出来，绝不让畸形记忆从视图消失）。
  const bucketOf = (e: MemoryEntry): string => {
    if (e.status === undefined) {
      return 'unknown'
    }
    return (MEMORY_STATUSES as readonly string[]).includes(e.status) ? e.status : 'malformed'
  }
  const order = ['active', 'superseded', 'unknown', 'malformed']
  const lines: string[] = []
  for (const status of order) {
    const group = entries.filter(e => bucketOf(e) === status)
    if (group.length === 0) {
      continue
    }
    lines.push(`[${status}] ${group.length} 条`)
    for (const e of group) {
      // malformed 桶附上实际的非法 status 值，方便人工定位要改什么。
      const suffix = status === 'malformed' ? ` !status=${e.status}` : ''
      lines.push(`  - ${e.slug} (${e.type ?? '?'}, ${e.createdAt ?? '?'}) — ${e.relPath}${suffix}`)
    }
  }
  return lines.join('\n')
}

/** 格式化 audit 报告。 */
export function formatAudit(result: AuditResult): string {
  const { findings, warnings } = result
  const lines: string[] = []
  if (findings.length === 0) {
    lines.push('记忆体检：未发现超龄或悬空引用的 active 记忆。')
  }
  else {
    lines.push(`记忆体检：${findings.length} 条 active 记忆建议人工复核（经 remember 标 superseded 或更新）：`)
    for (const f of findings) {
      lines.push(`  - ${f.slug} — ${f.relPath} [${f.reasons.join(', ')}]`)
    }
  }
  // 库级软告警单独成段，前缀 [warn] 便于与单条 finding 区分（恒不改 exit code）。
  for (const w of warnings) {
    lines.push(`[warn] ${w}`)
  }
  return lines.join('\n')
}

function printHelp() {
  console.log(`Usage:
  memory:health validate [repo-root]              校验记忆 schema（created_at/status/type），违规 exit 1
  memory:health audit [repo-root] [--age-days N]  只读 staleness 报告（超龄 + 悬空引用），恒 exit 0
  memory:health list [repo-root]                  按 status 分组列出记忆

软提示工具：audit 只产报告、绝不改记忆；命中由人工经 remember 标 superseded。
status 枚举：${MEMORY_STATUSES.join(' / ')}；type 枚举：${MEMORY_TYPES.join(' / ')}
`)
}

/** 从 argv 取 --age-days 值（缺省返回 undefined）。 */
function parseAgeDays(args: string[]): number | undefined {
  const i = args.indexOf('--age-days')
  if (i === -1 || i + 1 >= args.length) {
    return undefined
  }
  const n = Number(args[i + 1])
  return Number.isFinite(n) && n >= 0 ? n : undefined
}

/** 从位置参数取 repo-root，跳过 --flag 及其紧随的值（如 --age-days N 的 N）。 */
function parseRepoRoot(args: string[]): string {
  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    if (a === '--age-days') {
      i++ // 跳过该 flag 的值，避免被误当作 repo-root
      continue
    }
    if (!a.startsWith('--')) {
      return path.resolve(a)
    }
  }
  return process.cwd()
}

function main() {
  const [subcommand, ...rest] = process.argv.slice(2)
  const repoRoot = parseRepoRoot(rest)

  if (subcommand === undefined || subcommand === 'help' || subcommand === '--help' || subcommand === '-h') {
    printHelp()
    return
  }

  if (subcommand === 'list') {
    console.log(formatList(scanMemory(repoRoot)))
    return
  }

  if (subcommand === 'audit') {
    console.log(formatAudit(auditMemory(repoRoot, { ageDays: parseAgeDays(rest) })))
    return
  }

  if (subcommand === 'validate') {
    const { errors } = validateMemory(repoRoot)
    if (errors.length > 0) {
      for (const e of errors) {
        console.log(`FAIL ${e}`)
      }
      console.log(`────────────────────────────\nFAIL memory:health ${errors.length} 个 schema 违规`)
      process.exit(1)
    }
    console.log('PASS memory:health 记忆 schema 合规')
    return
  }

  console.error(`Unknown subcommand: ${subcommand}`)
  process.exit(1)
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isCli) {
  main()
}
