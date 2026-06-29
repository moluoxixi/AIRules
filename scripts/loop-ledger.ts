#!/usr/bin/env npx tsx
import type { LoopLedger } from '../constants/loop-ledger.js'
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { createLedger, validateLedger } from '../constants/loop-ledger.js'

// 回路熔断进度账本 CLI（只读为主 + reset 重置）。账本是 rules/AGENTS.md 第 9 条
// max_loop/mismatch_loop 的运行时承载，主代理在跨阶段派发时维护，hooks/ 脚本读写。
// 本 CLI 给人工一个观察/校验/重置入口，schema 与决策逻辑见 constants/loop-ledger.ts（单一事实源）。
//
// 子命令：
// - list [repo-root]            列出所有未关闭（仍有 open blocked 或回路 iteration>0）账本
// - validate [repo-root]        校验所有账本 JSON 结构，违规 exit 1
// - reset <change-id> [repo-root]  把某账本重置为空（回路清零、blocked 清空），用于人工解锁后重来

const LEDGER_REL_DIR = path.join('.airules', 'runtime', 'loops')

function ledgerDir(repoRoot: string): string {
  return path.join(repoRoot, LEDGER_REL_DIR)
}

function listLedgerFiles(repoRoot: string): string[] {
  const dir = ledgerDir(repoRoot)
  if (!existsSync(dir)) {
    return []
  }
  return readdirSync(dir).filter(f => f.endsWith('.json')).map(f => path.join(dir, f))
}

function readLedger(file: string): { ledger?: LoopLedger, error?: string } {
  try {
    const raw = readFileSync(file, 'utf8')
    const parsed = JSON.parse(raw) as LoopLedger
    return { ledger: parsed }
  }
  catch (error) {
    return { error: String(error) }
  }
}

function isOpen(ledger: LoopLedger): boolean {
  const hasOpenBlocked = ledger.blocked_entries.some(e => e.status === 'open')
  const hasProgress = Object.values(ledger.loops).some(c => c.iteration > 0)
  return hasOpenBlocked || hasProgress
}

function formatList(repoRoot: string): string {
  const files = listLedgerFiles(repoRoot)
  if (files.length === 0) {
    return '（无账本：.airules/runtime/loops/ 为空或不存在）'
  }
  const lines: string[] = []
  for (const file of files) {
    const { ledger, error } = readLedger(file)
    const name = path.basename(file)
    if (error || !ledger) {
      lines.push(`  [损坏] ${name}: ${error ?? '解析失败'}`)
      continue
    }
    const open = isOpen(ledger) ? 'OPEN ' : 'idle '
    const loopStr = Object.entries(ledger.loops)
      .map(([id, c]) => `${id}=${c.iteration}/${c.max_loop}`)
      .join(' ')
    const blocked = ledger.blocked_entries.filter(e => e.status === 'open').length
    lines.push(`  ${open}${ledger.change_id}  [${loopStr}]  open_blocked=${blocked}`)
  }
  return `账本（${files.length}）：\n${lines.join('\n')}`
}

function runValidate(repoRoot: string): number {
  const files = listLedgerFiles(repoRoot)
  let failed = 0
  for (const file of files) {
    const name = path.basename(file)
    const { ledger, error } = readLedger(file)
    if (error || ledger === undefined) {
      console.log(`FAIL ${name}: ${error ?? 'JSON 解析失败'}`)
      failed++
      continue
    }
    const errors = validateLedger(ledger)
    if (errors.length > 0) {
      failed++
      for (const e of errors) {
        console.log(`FAIL ${name}: ${e}`)
      }
    }
  }
  if (failed > 0) {
    console.log(`────────────────────────────\nFAIL loop-ledger ${failed} 个账本不合规`)
    return 1
  }
  console.log(`PASS loop-ledger ${files.length} 个账本 schema 合规`)
  return 0
}

function runReset(repoRoot: string, changeId: string): number {
  const dir = ledgerDir(repoRoot)
  const file = path.join(dir, `${changeId}.json`)
  mkdirSync(dir, { recursive: true })
  // 首次建 runtime 目录时落 .gitignore：账本是运行时态，默认不入库（与 subagent-trace / session-log 一致）。
  const gitignore = path.join(repoRoot, '.airules', 'runtime', '.gitignore')
  if (!existsSync(gitignore)) {
    writeFileSync(gitignore, '# AIRules 运行时账本，默认不入库\n*\n', 'utf8')
  }
  const fresh = createLedger(changeId, new Date().toISOString())
  writeFileSync(file, `${JSON.stringify(fresh, null, 2)}\n`, 'utf8')
  console.log(`已重置账本：${path.relative(repoRoot, file)}`)
  return 0
}

function printHelp() {
  console.log(`loop-ledger — 回路熔断进度账本 CLI

用法：
  tsx scripts/loop-ledger.ts list [repo-root]
  tsx scripts/loop-ledger.ts validate [repo-root]
  tsx scripts/loop-ledger.ts reset <change-id> [repo-root]

账本路径：<repo-root>/.airules/runtime/loops/<change-id>.json
schema 与决策逻辑：constants/loop-ledger.ts（单一事实源）`)
}

function parseRepoRoot(args: string[]): string {
  const positional = args.filter(a => !a.startsWith('--'))
  return positional.length > 0 ? path.resolve(positional[positional.length - 1]) : process.cwd()
}

function main() {
  const [subcommand, ...rest] = process.argv.slice(2)

  if (subcommand === undefined || subcommand === 'help' || subcommand === '--help' || subcommand === '-h') {
    printHelp()
    return
  }

  if (subcommand === 'list') {
    console.log(formatList(parseRepoRoot(rest)))
    return
  }

  if (subcommand === 'validate') {
    process.exit(runValidate(parseRepoRoot(rest)))
  }

  if (subcommand === 'reset') {
    const changeId = rest.find(a => !a.startsWith('--'))
    if (!changeId) {
      console.error('reset 需要 <change-id> 参数')
      process.exit(1)
    }
    // change-id 之后的位置参数才是 repo-root。
    const repoRoot = parseRepoRoot(rest.filter(a => a !== changeId))
    process.exit(runReset(repoRoot, changeId))
  }

  console.error(`Unknown subcommand: ${subcommand}`)
  process.exit(1)
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isCli) {
  main()
}
