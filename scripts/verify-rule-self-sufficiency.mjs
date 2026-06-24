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
  'flowchart',
  '多源',
  '实现计划',
  '实现编码',
  '调试修复',
  '代码评审',
  '后置一致性评审',
  '测试验证',
  '文档可控性校验',
  '架构深化',
  'architecture-deepening',
  '临时研究子代理',
  '临时验证子代理',
  'clean/headless validator',
  'debugger',
  'frontend-planner',
  'backend-planner',
  'frontend-coder',
  'backend-coder',
  'frontend-reviewer',
  'backend-reviewer',
  'consistency-reviewer',
  'architecture-refactor',
  '编码后',
  '测试验证前',
  'MISSING blocked',
  '不得替代',
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
  '无额外引导',
  'MISSING',
  'NOT RUN',
  '不得由主上下文自评为 `PASS`',
]
const MAINTENANCE_LEAK_TOKENS = [
  'rules/sources',
  'rules/AGENTS',
  'init-project reference',
  'host 投影',
  'host projection',
  '发布/PR 默认流程',
  'PR 默认流程',
  '纯净测试',
  'skill 纯净测试',
  'git_safety',
  '提交本地 PR',
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

function checkNoMaintenanceLeak(label, content) {
  const leaked = MAINTENANCE_LEAK_TOKENS.filter(token => content.includes(token))
  if (leaked.length > 0) {
    issue('FAIL', `${label} 不得包含 AIRules 维护者资产: ${leaked.join(', ')}`)
    return
  }

  pass(`${label} maintenance leak free`)
}

function collectMarkdownFiles(root, relativeDir) {
  const absoluteDir = path.join(root, relativeDir)
  if (!fs.existsSync(absoluteDir)) {
    issue('MISSING', `规则自足性输入缺失: ${relativeDir}`)
    return []
  }

  const files = []
  function visit(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const absolutePath = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        visit(absolutePath)
        continue
      }

      if (entry.isFile() && entry.name.endsWith('.md')) {
        files.push(path.relative(root, absolutePath).replace(/\\/g, '/'))
      }
    }
  }

  visit(absoluteDir)
  return files.sort()
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
  requireTokens('AGENTS.md/CLAUDE.md project boundary', agents, [
    '元认知隔离',
    '纯数据',
    '绝对禁止',
    'AIRules 规则资产层级判定',
    'repo-maintenance',
    'global-baseline',
    'project-init',
  ])
  checkNoTypo('AGENTS.md/CLAUDE.md', agents)
}

function verify(root) {
  const rules = readRequired(root, 'rules/AGENTS.md')
  const source = readRequired(root, 'rules/sources/50-subagent-delegation.md')
  const docsReference = readRequired(root, 'skills/init-project/references/common/docs.md')
  const contract = readRequired(root, 'docs/delivery/control-contract.md')
  const projectReferences = collectMarkdownFiles(root, 'skills/init-project/references')

  if (rules) {
    checkDispatchSection('rules/AGENTS.md', rules)
    checkNoTypo('rules/AGENTS.md', rules)
  }

  if (source) {
    checkDispatchSection('rules/sources/50-subagent-delegation.md', source)
    checkNoTypo('rules/sources/50-subagent-delegation.md', source)
  }

  if (docsReference) {
    requireTokens('skills/init-project/references/common/docs.md project reference', docsReference, [
      '项目知识源读取规范',
      '测试文档结构',
      'docs/test/e2e',
    ])
  }

  for (const relativePath of projectReferences) {
    const content = readRequired(root, relativePath)
    if (!content) {
      continue
    }

    checkNoTypo(relativePath, content)
    checkNoMaintenanceLeak(relativePath, content)
  }

  if (contract) {
    requireTokens('docs/delivery/control-contract.md rule self-sufficiency contract', contract, [
      '关键环节子代理调度',
      'Mermaid',
      '规则自足性校验',
      'repo-maintenance',
      'verify:rules:self-sufficiency',
      'consistency-reviewer',
      '后置一致性评审',
      '编码后',
      '测试验证前',
      'MISSING blocked',
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
