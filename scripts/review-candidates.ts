#!/usr/bin/env npx tsx
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

// 进化闭环候选区审核工具（低成本、非重型治理）：
// distill-candidates 把提炼物落 knowledge/{skills,memory}-candidates/，每条带 review_status
// (pending|approved|rejected)；remember 只转正 approved。本脚本补齐写入端缺失的客观信号：
// - list：只读列出候选并按 review_status 分组，凸显 pending 待审项；
// - validate：客观门禁——frontmatter 可解析且 review_status 为合法枚举，否则 exit 1。
// review_status 与 metadata.status(active|superseded) 正交：前者是「审核了没」，后者是「记忆生命周期」。

/** 候选审核状态合法枚举。distill 写 pending，人工审核改 approved/rejected，remember 只转正 approved。 */
export const REVIEW_STATUSES = ['pending', 'approved', 'rejected'] as const
export type ReviewStatus = (typeof REVIEW_STATUSES)[number]

export interface Candidate {
  kind: 'skill' | 'memory'
  /** skill 候选取目录名，memory 候选取 <slug>。 */
  name: string
  /** 相对仓库根的候选文件路径（POSIX 分隔）。 */
  relPath: string
  /** 解析出的 review_status；缺失或非法时为 undefined（validate 会据此报错）。 */
  reviewStatus?: string
  /** frontmatter 是否成功闭合解析。false 表示坏文件。 */
  parsed: boolean
}

export interface CheckResult {
  errors: string[]
}

/**
 * 极简 frontmatter 解析：仅取首块 `---\n...\n---`，按 `key: value` 收顶层标量键。
 *  解析嵌套（如 metadata.* ）非本工具职责——只关心顶层 review_status 是否存在合法。
 */
function parseFrontmatter(content: string): { ok: boolean, fields: Record<string, string> } {
  const normalized = content.replace(/\r\n/g, '\n')
  if (!normalized.startsWith('---\n')) {
    return { ok: false, fields: {} }
  }
  const end = normalized.indexOf('\n---', 4)
  if (end === -1) {
    return { ok: false, fields: {} }
  }
  const body = normalized.slice(4, end)
  const fields: Record<string, string> = {}
  for (const line of body.split('\n')) {
    // 只收顶层（无缩进）的 `key: value`，跳过嵌套块（metadata: 下的缩进行）与空行。
    // 手动按首个冒号切分，避免相邻量词回溯（regexp/no-super-linear-backtracking）。
    const colon = line.indexOf(':')
    if (colon <= 0) {
      continue
    }
    const key = line.slice(0, colon)
    if (!/^\w+$/.test(key)) {
      continue
    }
    fields[key] = line.slice(colon + 1).trim()
  }
  return { ok: true, fields }
}

function candidatesRoot(repoRoot: string) {
  return {
    skills: path.join(repoRoot, 'knowledge', 'skills-candidates'),
    memory: path.join(repoRoot, 'knowledge', 'memory-candidates'),
  }
}

/** 扫描候选区，返回所有候选条目（缺目录返回空数组，pending 非错误）。 */
export function scanCandidates(repoRoot: string): Candidate[] {
  const { skills, memory } = candidatesRoot(repoRoot)
  const out: Candidate[] = []

  // skill 候选：每个子目录的 SKILL.md。
  if (existsSync(skills)) {
    for (const entry of readdirSync(skills, { withFileTypes: true })) {
      if (!entry.isDirectory()) {
        continue
      }
      const file = path.join(skills, entry.name, 'SKILL.md')
      if (!existsSync(file)) {
        continue
      }
      out.push(toCandidate('skill', entry.name, file, repoRoot))
    }
  }

  // memory 候选：目录下每个 .md（排除 README）。
  if (existsSync(memory)) {
    for (const entry of readdirSync(memory, { withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.endsWith('.md') || entry.name === 'README.md') {
        continue
      }
      const file = path.join(memory, entry.name)
      out.push(toCandidate('memory', entry.name.replace(/\.md$/, ''), file, repoRoot))
    }
  }

  return out
}

function toCandidate(kind: Candidate['kind'], name: string, file: string, repoRoot: string): Candidate {
  const { ok, fields } = parseFrontmatter(readFileSync(file, 'utf8'))
  return {
    kind,
    name,
    relPath: path.relative(repoRoot, file).replace(/\\/g, '/'),
    reviewStatus: fields.review_status,
    parsed: ok,
  }
}

/** 客观门禁：每条候选 frontmatter 须可解析、review_status 须为合法枚举。 */
export function validateCandidates(repoRoot: string): CheckResult {
  const errors: string[] = []
  for (const c of scanCandidates(repoRoot)) {
    if (!c.parsed) {
      errors.push(`${c.relPath} frontmatter 无法解析（缺闭合 --- 分隔符）`)
      continue
    }
    if (c.reviewStatus === undefined) {
      errors.push(`${c.relPath} 缺 review_status 字段（应为 ${REVIEW_STATUSES.join('/')} 之一）`)
      continue
    }
    if (!(REVIEW_STATUSES as readonly string[]).includes(c.reviewStatus)) {
      errors.push(`${c.relPath} review_status 非法值 "${c.reviewStatus}"（应为 ${REVIEW_STATUSES.join('/')} 之一）`)
    }
  }
  return { errors }
}

/** 把候选按 review_status 分组，pending 在前（待审最需被看见）。返回可打印文本。 */
export function formatList(candidates: Candidate[]): string {
  if (candidates.length === 0) {
    return '候选区为空：无 skill / memory 候选。'
  }
  // 把每条候选归入一个桶：合法枚举各自成组；缺字段→unknown；非空但非法值→malformed
  // （catch-all，绝不让畸形候选从人工审核主视图消失——list 的职责正是凸显待修项）。
  const bucketOf = (c: Candidate): ReviewStatus | 'unknown' | 'malformed' => {
    if (c.reviewStatus === undefined) {
      return 'unknown'
    }
    return (REVIEW_STATUSES as readonly string[]).includes(c.reviewStatus)
      ? (c.reviewStatus as ReviewStatus)
      : 'malformed'
  }
  const order: (ReviewStatus | 'unknown' | 'malformed')[] = ['pending', 'approved', 'rejected', 'unknown', 'malformed']
  const lines: string[] = []
  for (const status of order) {
    const group = candidates.filter(c => bucketOf(c) === status)
    if (group.length === 0) {
      continue
    }
    lines.push(`[${status}] ${group.length} 条`)
    for (const c of group) {
      // malformed 桶附上实际的非法值，方便人工定位要改什么。
      const suffix = status === 'malformed' ? ` (review_status=${c.reviewStatus})` : ''
      lines.push(`  - (${c.kind}) ${c.name} — ${c.relPath}${suffix}`)
    }
  }
  return lines.join('\n')
}

function printHelp() {
  console.log(`Usage:
  candidates:review list [repo-root]       列出候选区，按 review_status 分组
  candidates:review validate [repo-root]   校验候选 frontmatter 与 review_status，违规 exit 1

review_status 合法枚举：${REVIEW_STATUSES.join(' / ')}
`)
}

function main() {
  const [subcommand, repoArg] = process.argv.slice(2)
  const repoRoot = repoArg ? path.resolve(repoArg) : process.cwd()

  if (subcommand === undefined || subcommand === 'help' || subcommand === '--help' || subcommand === '-h') {
    printHelp()
    return
  }

  if (subcommand === 'list') {
    console.log(formatList(scanCandidates(repoRoot)))
    return
  }

  if (subcommand === 'validate') {
    const { errors } = validateCandidates(repoRoot)
    if (errors.length > 0) {
      for (const e of errors) {
        console.log(`FAIL ${e}`)
      }
      console.log(`────────────────────────────\nFAIL candidates:review ${errors.length} 个违规`)
      process.exit(1)
    }
    console.log('PASS candidates:review 候选区 frontmatter 与 review_status 合规')
    return
  }

  console.error(`Unknown subcommand: ${subcommand}`)
  process.exit(1)
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isCli) {
  main()
}
