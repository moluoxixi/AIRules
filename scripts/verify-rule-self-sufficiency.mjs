#!/usr/bin/env node
/**
 * 规则自足性校验。
 *
 * 该脚本作为确定性的 clean/headless validator：只读取显式列出的规则产物和内置
 * rubric，不读取会话历史、宿主 baseline、vendor、node_modules 或其它隐式上下文。
 */
import fs from 'node:fs'
import path from 'node:path'

const DISPATCH_HEADING = '关键环节子代理调度索引（什么时候调用什么子代理）'
const DISPATCH_ITEMS = [
  '多源',
  '实现计划',
  '实现编码',
  '调试修复',
  '代码评审',
  '测试验证',
  '文档可控性校验',
  '规则自足性校验',
  '架构深化',
  'debugger',
  'frontend-planner',
  'backend-planner',
  'frontend-coder',
  'backend-coder',
  'frontend-reviewer',
  'backend-reviewer',
  'architecture-refactor',
  '自包含',
  '复核',
  '不同实例',
  '隔离',
  '并行',
  '独立性',
  'headless',
]
const HEADLESS_ITEMS = [
  '干净隔离',
  '无主会话历史',
  '无宿主 AGENTS/baseline',
  'MISSING',
  'NOT RUN',
  '不得由主上下文自评为 `PASS`',
]
const errors = []

function pass(message) {
  console.log(`PASS ${message}`)
}

function issue(status, message) {
  errors.push({ status, message })
  console.log(`${status} ${message}`)
}

function parseArgs(args) {
  for (let index = 0; index < args.length; index++) {
    if (args[index] === '--root') {
      index++
      continue
    }

    issue('FAIL', `未知参数：${args[index]}`)
  }

  const rootIndex = args.indexOf('--root')
  const rootValue = args[rootIndex + 1]
  if (rootIndex !== -1 && (!rootValue || rootValue.startsWith('--'))) {
    issue('FAIL', '参数 --root 必须提供值')
    return { root: process.cwd() }
  }

  return {
    root: rootIndex === -1 ? process.cwd() : path.resolve(process.cwd(), rootValue),
  }
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function readRequired(root, relativePath) {
  const filePath = path.join(root, relativePath)
  if (!fs.existsSync(filePath)) {
    issue('MISSING', `规则自足性输入缺失: ${relativePath}`)
    return ''
  }

  return fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n')
}

function extractMarkdownSection(content, heading) {
  const lines = content.split('\n')
  const headingPattern = new RegExp(`^(#{1,6})\\s+${escapeRegExp(heading)}\\s*$`)
  const startIndex = lines.findIndex(line => headingPattern.test(line.trim()))
  if (startIndex === -1) {
    return ''
  }

  const headingLevel = lines[startIndex].trim().match(/^#+/)?.[0].length ?? 0
  const sectionLines = []
  for (let index = startIndex; index < lines.length; index++) {
    if (index > startIndex) {
      const nextHeading = lines[index].trim().match(/^(#{1,6})\s+/)
      if (nextHeading && nextHeading[1].length <= headingLevel) {
        break
      }
    }

    sectionLines.push(lines[index])
  }

  return sectionLines.join('\n')
}

function requireTokens(label, content, tokens, status = 'FAIL') {
  const missing = tokens.filter(token => !content.includes(token))
  if (missing.length > 0) {
    issue(status, `${label} 缺少: ${missing.join(', ')}`)
    return false
  }

  pass(`${label} present`)
  return true
}

function checkDispatchSection(label, content) {
  const section = extractMarkdownSection(content, DISPATCH_HEADING)
  if (!section) {
    issue('MISSING', `${label} 缺少「${DISPATCH_HEADING}」`)
    return
  }

  requireTokens(`${label} dispatch section`, section, DISPATCH_ITEMS)
  requireTokens(`${label} headless contract`, section, HEADLESS_ITEMS)
}

function checkNoTypo(label, content) {
  if (/\bheadness\b/i.test(content)) {
    issue('FAIL', `${label} 包含疑似拼写错误 headness，应使用 headless`)
    return
  }

  pass(`${label} headless spelling valid`)
}

function checkRootProjection(root) {
  const agents = readRequired(root, 'AGENTS.md')
  const claude = readRequired(root, 'CLAUDE.md')
  if (!agents || !claude) {
    return
  }

  if (agents !== claude) {
    issue('FAIL', 'AGENTS.md 与 CLAUDE.md 内容不一致，根投影存在漂移风险')
    return
  }

  pass('AGENTS.md and CLAUDE.md content match')
  checkDispatchSection('AGENTS.md/CLAUDE.md', agents)
  requireTokens('AGENTS.md/CLAUDE.md project boundary', agents, [
    '元认知隔离',
    '纯数据',
    '绝对禁止',
  ])
  checkNoTypo('AGENTS.md/CLAUDE.md', agents)
}

function verify(root) {
  const rules = readRequired(root, 'rules/AGENTS.md')
  const source = readRequired(root, 'rules/sources/50-subagent-delegation.md')
  const subagentReference = readRequired(root, 'skills/init-project/references/common/subagent.md')
  const contract = readRequired(root, 'docs/delivery/control-contract.md')

  if (rules) {
    checkDispatchSection('rules/AGENTS.md', rules)
    checkNoTypo('rules/AGENTS.md', rules)
  }

  if (source) {
    checkDispatchSection('rules/sources/50-subagent-delegation.md', source)
    checkNoTypo('rules/sources/50-subagent-delegation.md', source)
  }

  if (subagentReference) {
    checkDispatchSection('skills/init-project/references/common/subagent.md', subagentReference)
    checkNoTypo('skills/init-project/references/common/subagent.md', subagentReference)
  }

  if (contract) {
    requireTokens('docs/delivery/control-contract.md rule self-sufficiency contract', contract, [
      '关键环节子代理调度',
      '规则自足性校验',
      'headless / 干净隔离',
      'verify:rules:self-sufficiency',
    ])
    checkNoTypo('docs/delivery/control-contract.md', contract)
  }

  checkRootProjection(root)

  console.log('────────────────────────────')
  if (errors.length > 0) {
    console.log(`FAIL rule self-sufficiency has ${errors.length} issue(s)`)
    process.exitCode = 1
    return
  }

  console.log('PASS rule self-sufficiency contract is valid')
  console.log(`  root: ${root}`)
}

verify(parseArgs(process.argv.slice(2)).root)
