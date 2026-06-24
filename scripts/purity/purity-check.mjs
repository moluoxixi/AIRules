#!/usr/bin/env node
/**
 * Skill 纯净校验工具（执行器无关）。
 *
 * 纯净校验验证 skill 是否「自足可控」：在不带本项目 AGENTS.md / baseline / 历史记忆的
 * 干净隔离环境里，仅凭 init-project references 规则 + 被测 skill 自身，能否产出符合
 * skill 声明的产物。本脚本不调用任何 LLM，只做两件确定性的事：
 *
 *   1. assemble（默认）：组装纯净上下文包到系统临时目录，或用 --out 指定输出根目录。
 *      用「什么 agent」跑这个包由用户环境决定——脚本不假设 claude/codex/opencode/delegate
 *      任意一种存在，保证换环境可用。
 *   2. check：拿纯净 run 的产物文件，对 rubric 的确定性断言做核对，输出可控性缺口报告。
 *
 * 用法：
 *   node scripts/purity/purity-check.mjs <skill>                    # 组装纯净包
 *   node scripts/purity/purity-check.mjs <skill> --out <输出根目录>  # 组装到指定目录
 *   node scripts/purity/purity-check.mjs <skill> --check <产物文件>   # 核对产物
 *
 * 执行纯净 run 的三种方式（脚本均不强制，由用户环境选择）：
 *   - 无 runner：把输出目录里的 <skill>/context.md 喂给你环境里任意干净 agent，
 *     产物存盘后用 --check 核对。
 *   - 命令行 runner：cat context.md | <你的 CLI，如 claude -p / codex exec / opencode run> > out.md
 *   - 由调用方（如主代理）用其子代理能力执行后回填产物。
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'

const repoRoot = process.cwd()
const REFERENCES_DIR = path.join(repoRoot, 'skills', 'init-project', 'references')
const RUBRIC_FILE = path.join(repoRoot, 'scripts', 'purity', 'rubric.json')
const DEFAULT_RUNS_DIR = path.join(os.tmpdir(), 'airules-purity-runs')

function fail(message) {
  console.log(`FAIL ${message}`)
  process.exit(1)
}

/** 递归收集 references 目录下所有 .md 规则文件（纯净环境的唯一规则来源）。 */
function collectReferenceFiles(dir) {
  const out = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      out.push(...collectReferenceFiles(full))
    }
    else if (entry.name.endsWith('.md')) {
      out.push(full)
    }
  }
  return out.sort()
}

function loadRubric() {
  if (!existsSync(RUBRIC_FILE)) {
    fail(`rubric 文件缺失: ${RUBRIC_FILE}`)
  }
  return JSON.parse(readFileSync(RUBRIC_FILE, 'utf8'))
}

function displayPath(targetPath) {
  const relative = path.relative(repoRoot, targetPath)
  return relative && !relative.startsWith('..') && !path.isAbsolute(relative)
    ? relative.replace(/\\/g, '/')
    : targetPath.replace(/\\/g, '/')
}

/** 组装纯净上下文包：references 规则 + 被测 skill + 最小任务指令。 */
function assemble(skillName, runsDir) {
  const skillFile = path.join(repoRoot, 'skills', skillName, 'SKILL.md')
  if (!existsSync(skillFile)) {
    fail(`被测 skill 不存在: ${skillFile}`)
  }

  const rubric = loadRubric()
  const skillRubric = rubric.skills?.[skillName]
  if (!skillRubric) {
    fail(`rubric.json 未声明 skill「${skillName}」的纯净校验断言，请先补充 rubric`)
  }

  if (!existsSync(REFERENCES_DIR)) {
    fail(`references 目录缺失: ${REFERENCES_DIR}`)
  }

  const referenceFiles = collectReferenceFiles(REFERENCES_DIR)
  const referenceBlocks = referenceFiles.map((file) => {
    const rel = path.relative(repoRoot, file).replace(/\\/g, '/')
    return `### 规则来源: ${rel}\n\n${readFileSync(file, 'utf8').trim()}`
  })

  const skillContent = readFileSync(skillFile, 'utf8').trim()

  const context = [
    '# 纯净校验上下文包',
    '',
    '> 你是一个干净隔离的代理。你**没有**本项目的 AGENTS.md、没有 baseline 规则、没有历史记忆。',
    '> 你能依据的全部信息就是下面的「规则」和「被测 skill」。不要假设任何未在此出现的项目约定。',
    '> 按被测 skill 的流程完成「最小任务」，产出 skill 自身声明的产物。不要追加额外解释。',
    '',
    '## 一、规则（init-project references）',
    '',
    referenceBlocks.join('\n\n---\n\n'),
    '',
    '## 二、被测 skill',
    '',
    skillContent,
    '',
    '## 三、最小任务',
    '',
    skillRubric.minimalTask,
    '',
  ].join('\n')

  const rubricMd = [
    `# 可控性核对清单: ${skillName}`,
    '',
    '纯净 run 的产物必须满足以下断言。带 `manual: true` 的项由人工复核，脚本不自动判定。',
    '',
    ...skillRubric.assertions.map((a) => {
      const kind = a.manual ? '（人工复核）' : a.anyOf ? `（含其一: ${a.anyOf.join(' / ')}）` : a.regex ? `（匹配: ${a.regex}）` : ''
      return `- [${a.id}] ${a.desc} ${kind}`
    }),
    '',
  ].join('\n')

  const runDir = path.join(runsDir, skillName)
  mkdirSync(runDir, { recursive: true })
  writeFileSync(path.join(runDir, 'context.md'), context, 'utf8')
  writeFileSync(path.join(runDir, 'rubric.md'), rubricMd, 'utf8')

  console.log(`PASS 纯净包已组装: ${displayPath(runDir)}/`)
  console.log(`  - context.md  纯净上下文（喂给任意干净 agent）`)
  console.log(`  - rubric.md   可控性核对清单`)
  console.log('')
  console.log('下一步（执行器自选，脚本不强制）：')
  console.log(`  · 用你环境里任意干净 agent 跑 context.md，产物存为 out.md`)
  console.log(`  · 再核对：node scripts/purity/purity-check.mjs ${skillName} --check <产物文件>`)
}

/** 核对纯净 run 产物：对 rubric 的确定性断言判定 PASS/MISSING/FAIL。 */
function check(skillName, artifactPath) {
  if (!existsSync(artifactPath)) {
    fail(`产物文件不存在: ${artifactPath}`)
  }

  const rubric = loadRubric()
  const skillRubric = rubric.skills?.[skillName]
  if (!skillRubric) {
    fail(`rubric.json 未声明 skill「${skillName}」`)
  }

  const artifact = readFileSync(artifactPath, 'utf8')
  const gaps = []
  let manualCount = 0

  for (const a of skillRubric.assertions) {
    if (a.manual) {
      manualCount++
      console.log(`MANUAL [${a.id}] 需人工复核: ${a.desc}`)
      continue
    }

    let ok = false
    if (a.anyOf) {
      ok = a.anyOf.some(token => artifact.includes(token))
    }
    else if (a.regex) {
      ok = new RegExp(a.regex).test(artifact)
    }

    if (ok) {
      console.log(`PASS [${a.id}] ${a.desc}`)
    }
    else {
      console.log(`MISSING [${a.id}] ${a.desc}`)
      gaps.push(a.id)
    }
  }

  console.log('────────────────────────────')
  if (gaps.length > 0) {
    console.log(`FAIL 可控性缺口: ${gaps.join(', ')}`)
    console.log('按治理要求，缺口必须先回填到 skill 再复测，不得用额外提示词在测试中补救。')
    process.exit(1)
  }
  console.log(`PASS 自动断言全部通过${manualCount > 0 ? `（另有 ${manualCount} 项待人工复核）` : ''}`)
}

function main() {
  const [skillName, ...rest] = process.argv.slice(2)
  if (!skillName) {
    fail('用法: node scripts/purity/purity-check.mjs <skill> [--out <输出根目录>] [--check <产物文件>]')
  }

  let outDir = DEFAULT_RUNS_DIR
  const checkIdx = rest.indexOf('--check')
  if (checkIdx !== -1) {
    const artifactPath = rest[checkIdx + 1]
    if (!artifactPath) {
      fail('--check 需要提供产物文件路径')
    }
    check(skillName, path.resolve(repoRoot, artifactPath))
    return
  }

  for (let index = 0; index < rest.length; index++) {
    const arg = rest[index]
    if (arg === '--out') {
      const value = rest[index + 1]
      if (!value || value.startsWith('--')) {
        fail('--out 需要提供输出根目录')
      }
      outDir = path.resolve(repoRoot, value)
      index++
      continue
    }

    fail(`未知参数：${arg}`)
  }

  assemble(skillName, outDir)
}

main()
