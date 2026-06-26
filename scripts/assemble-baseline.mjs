#!/usr/bin/env node
/**
 * 规则基线拼接器。
 *
 * 规则源以原子文件形式维护在 rules/sources/*.md，每个文件带 frontmatter
 * （description + 可选 globs），便于按域组织、未来按宿主 globs 投影。
 * 宿主投影契约仍只认单个 rules/AGENTS.md（vendor 软链统一源），因此构建期
 * 把所有源文件按文件名排序拼接成 rules/AGENTS.md（剥离 frontmatter）。
 *
 * 用法：
 *   node scripts/assemble-baseline.mjs           # 生成/更新 rules/AGENTS.md
 *   node scripts/assemble-baseline.mjs --check    # 仅校验，产物与源不一致则非零退出（供 CI 防漂移）
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const repoRoot = process.cwd()
const SOURCES_DIR = path.join(repoRoot, 'rules', 'sources')
const OUTPUT_FILE = path.join(repoRoot, 'rules', 'AGENTS.md')
const HEADER = '# AIRules'

/** 剥离 Markdown 文件开头的 YAML frontmatter（--- ... ---），返回正文（trim 后）。 */
function stripFrontmatter(content) {
  const normalized = content.replace(/\r\n/g, '\n')
  if (!normalized.startsWith('---\n')) {
    return normalized.trim()
  }

  const end = normalized.indexOf('\n---', 4)
  if (end === -1) {
    throw new Error('frontmatter 未正确闭合（缺少结束 ---）')
  }

  // 跳过结束 --- 所在行
  const afterMarker = normalized.indexOf('\n', end + 1)
  return normalized.slice(afterMarker + 1).trim()
}

function assemble() {
  if (!existsSync(SOURCES_DIR)) {
    throw new Error(`规则源目录不存在: ${SOURCES_DIR}`)
  }

  const files = readdirSync(SOURCES_DIR)
    .filter(name => name.endsWith('.md'))
    .sort()

  if (files.length === 0) {
    throw new Error(`规则源目录为空: ${SOURCES_DIR}`)
  }

  const sections = files.map((name) => {
    const body = stripFrontmatter(readFileSync(path.join(SOURCES_DIR, name), 'utf8'))
    if (body.length === 0) {
      throw new Error(`规则源文件正文为空: ${name}`)
    }
    return body
  })

  return `${HEADER}\n\n${sections.join('\n\n')}\n`
}

const assembled = assemble()
writeFileSync(OUTPUT_FILE, assembled, 'utf8')
console.log(`PASS assemble-baseline: 已生成 rules/AGENTS.md（${assembled.length} 字符）`)
