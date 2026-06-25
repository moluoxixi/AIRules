#!/usr/bin/env node
/**
 * AIRules 交付控制校验脚本。
 *
 * 该脚本验证可分发包是否同时包含规则层、技能层、执行层和交付契约文档。
 * 它只检查交付控制资产是否齐备，不替代 lint、typecheck、test、coverage 或宿主安装验证。
 */
import fs from 'node:fs'
import path from 'node:path'

const REQUIRED_STATUS_MARKERS = ['PASS', 'FAIL', 'MISSING', 'NOT RUN', 'N/A']
const REQUIRED_DELIVERY_VERIFICATION_ITEMS = [
  '```mermaid',
  '高风险',
  '已修复',
  '已通过',
  '自我质疑',
  '任务复杂度',
  '全量回归',
  'coverage',
  '构建',
  '项目现有脚本',
  '均不低于 80%',
  'PASS',
  'FAIL',
  'MISSING',
  'NOT RUN',
  'N/A',
  '不得伪装通过',
  '变更分级',
  'L0/L1/L2 及判定依据',
  '改动内容',
  '涉及文件与范围',
  '验证',
  '实际运行的命令',
  '结果状态',
  '未执行项',
  '风险',
  '没有则显式写"无"',
]
const REQUIRED_DELIVERY_VERIFICATION_FLOW_ITEMS = [
  '高风险',
  '已修复',
  '已通过',
  '自我质疑',
  '项目现有脚本',
  'MISSING',
  'NOT RUN',
  'PASS',
  'FAIL',
  'N/A',
  '五项交付汇报',
]
const REQUIRED_DELIVERY_VERIFICATION_FLOW_PATTERNS = [
  /\bDone(?:\[[^\]]+\])?\s+-->\s+Scope\b/,
  /\bScope(?:\[[^\]]+\])?\s+-->\s+Risk\b/,
  /\bRisk\s+-->\|是\|\s+Doubt\b/,
  /\bDoubt\s+-->\s+AddChecks\b/,
  /\bRisk\s+-->\|否\|\s+Existing\b/,
  /\bAddChecks\s+-->\s+Existing\b/,
  /\bExisting\s+-->\s+Missing\b/,
  /\bMissing\s+-->\|是\|\s+MarkMissing\b/,
  /\bMissing\s+-->\|否\|\s+Run\b/,
  /\bRun\s+-->\s+Status\b/,
  /\bMarkMissing\s+-->\s+Report\b/,
  /\bStatus\s+-->\s+Report\b/,
]
const REQUIRED_CHANGE_LEVEL_ITEMS = [
  '```mermaid',
  '生成',
  '修改',
  '删除',
  'L0',
  'L1',
  'L2',
  'MISSING',
  '歧义',
  '澄清问题清单',
  '目标',
  '角色',
  '边界',
  '流程',
  '字段',
  '状态',
  '验收标准',
  '冲突',
  '风险',
  '苏格拉底式问题',
  '不得用推断',
  '默认值',
  '代码反推',
  '不得定稿',
  '不得写入正式产物',
  '不得声明完成',
  '用户确认',
  '权限模型',
  '数据一致性',
  '安全边界',
  'rules',
  'skills',
  '初始化流程',
  '默认分发配置',
]
const REQUIRED_CHANGE_LEVEL_FLOW_ITEMS = [
  '生成',
  '修改',
  '删除',
  'L0',
  'L1',
  'L2',
  'MISSING',
  '歧义',
  '澄清问题清单',
  '不得定稿',
  '不得写入正式产物',
  '不得声明完成',
  '用户确认',
  '权限模型',
  '数据一致性',
  '安全边界',
  'rules',
  'skills',
  '初始化流程',
  '默认分发配置',
]
const REQUIRED_CHANGE_LEVEL_FLOW_PATTERNS = [
  /\bMissing\s+-->\|是\|\s+Questions\b/,
  /\bL2\s+-->\s+Questions\b/,
  /\bQuestions\s+-->\s+Expose\b/,
  /\bQuestions\s+-->\s+Expose\["逐项暴露目标\s*\/\s*角色\s*\/\s*边界\s*\/\s*流程\s*\/\s*字段\s*\/\s*状态\s*\/\s*验收标准\s*\/\s*冲突\s*\/\s*风险"\]/,
  /\bExpose\s+-->\s+Mark\b/,
  /\bMark\s+-->\s+Stop\b/,
  /\bStop\s+-->\s+Confirm\b/,
  /\bConfirm\s+-->\|否\|\s+Stop\b/,
  /\bConfirm\s+-->\|是\|\s+Continue\b/,
]
const REQUIRED_SUBAGENT_DISPATCH_ITEMS = [
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
]
const REQUIRED_SUBAGENT_DISPATCH_FLOW_ITEMS = [
  'flowchart',
  '任务分诊',
  '任务类型与规模',
  '多源只读调研',
  '实现计划',
  '实现编码',
  '调试修复',
  '代码评审',
  '后置一致性评审',
  '测试验证',
  '文档可控性校验',
  '架构深化',
  '架构重构',
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
  'architecture-deepening',
  'architecture-refactor',
]
const REQUIRED_SUBAGENT_DISPATCH_FLOW_PATTERNS = [
  /\bT(?:\[[^\]]+\])?\s+-->\s+D\b/,
  /\bD\s+-->\|多源只读调研\|\s+Research\b/,
  /\bD\s+-->\|实现计划:\s*前端\|\s+FrontendPlan\b/,
  /\bD\s+-->\|实现计划:\s*后端\|\s+BackendPlan\b/,
  /\bD\s+-->\|实现编码:\s*前端\|\s+FrontendCode\b/,
  /\bD\s+-->\|实现编码:\s*后端\|\s+BackendCode\b/,
  /\bD\s+-->\|调试修复\|\s+Debug\b/,
  /\bD\s+-->\|代码评审:\s*前端\|\s+FrontendReview\b/,
  /\bD\s+-->\|代码评审:\s*后端\|\s+BackendReview\b/,
  /\bD\s+-->\|后置一致性评审\|\s+ConsistencyReview\b/,
  /\bD\s+-->\|测试验证\|\s+Verify\b/,
  /\bD\s+-->\|文档可控性校验\|\s+DocCheck\b/,
  /\bD\s+-->\|架构深化:\s*候选发现\|\s+Deepening\b/,
  /\bD\s+-->\|架构重构:\s*已确认 DC-\*\|\s+Refactor\b/,
]
const REQUIRED_CONSISTENCY_REVIEWER_ITEMS = [
  'name: consistency-reviewer',
  'description:',
  'consistency-check',
  '编码后',
  '测试验证前',
  '最终 diff',
  '只读',
  'PASS',
  'FAIL',
  'MISSING',
  'N/A',
]
const errors = []

function pass(message) {
  console.log(`PASS ${message}`)
}

function fail(message) {
  errors.push(message)
  console.log(`FAIL ${message}`)
}

function parseArgs(args) {
  for (let index = 0; index < args.length; index++) {
    if (args[index] === '--root') {
      index++
      continue
    }

    fail(`未知参数：${args[index]}`)
  }

  const rootIndex = args.indexOf('--root')
  const rootValue = args[rootIndex + 1]
  if (rootIndex !== -1 && (!rootValue || rootValue.startsWith('--'))) {
    fail('参数 --root 必须提供值')
    return { root: process.cwd() }
  }

  return {
    root: rootIndex === -1 ? process.cwd() : path.resolve(process.cwd(), rootValue),
  }
}

function hasFile(root, relativePath) {
  return fs.existsSync(path.join(root, relativePath))
}

function hasSkill(root) {
  const skillsRoot = path.join(root, 'skills')
  if (!fs.existsSync(skillsRoot)) {
    return false
  }

  return fs.readdirSync(skillsRoot, { withFileTypes: true }).some((entry) => {
    return entry.isDirectory() && fs.existsSync(path.join(skillsRoot, entry.name, 'SKILL.md'))
  })
}

function extractMarkdownSection(content, heading) {
  const lines = content.replace(/\r\n/g, '\n').split('\n')
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

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function hasSubagentDispatchIndex(content) {
  const section = extractMarkdownSection(content, '关键环节子代理调度索引（什么时候调用什么子代理）')
  return section.includes('什么时候调用什么子代理')
    && section.includes('```mermaid')
    && section.includes('skill')
    && section.includes('subagent')
    && section.includes('headless')
    && REQUIRED_SUBAGENT_DISPATCH_ITEMS.every(item => section.includes(item))
    && hasFlowchartBlock(section, REQUIRED_SUBAGENT_DISPATCH_FLOW_ITEMS, REQUIRED_SUBAGENT_DISPATCH_FLOW_PATTERNS)
}

function extractMermaidBlocks(section) {
  const blocks = []

  let inMermaid = false
  let currentBlock = []
  for (const line of section.replace(/\r\n/g, '\n').split('\n')) {
    if (!inMermaid && line.trim() === '```mermaid') {
      inMermaid = true
      currentBlock = []
      continue
    }

    if (inMermaid && line.trim() === '```') {
      blocks.push(currentBlock.join('\n'))
      inMermaid = false
      currentBlock = []
      continue
    }

    if (inMermaid) {
      currentBlock.push(line)
    }
  }

  return blocks
}

function hasFlowchartBlock(section, requiredFlowItems, requiredFlowPatterns = []) {
  return extractMermaidBlocks(section).some((block) => {
    const hasFlowchart = block
      .split('\n')
      .some(line => /^flowchart\s+\w+/.test(line.trim()))

    return hasFlowchart
      && requiredFlowItems.every(item => block.includes(item))
      && requiredFlowPatterns.every(pattern => pattern.test(block))
  })
}

function hasRuleFlowSection(content, heading, requiredItems, requiredFlowItems, requiredFlowPatterns) {
  const section = extractMarkdownSection(content, heading)
  return requiredItems.every(item => section.includes(item))
    && hasFlowchartBlock(section, requiredFlowItems, requiredFlowPatterns)
}

function hasCoreInlineReference(injectContent, referenceVariableName) {
  return injectContent.includes('const coreInlinePaths = [')
    && injectContent.includes(`${referenceVariableName},`)
}

function hasLegacyReference(injectContent, referenceVariableName) {
  return injectContent.includes(referenceVariableName)
}

function checkRuleLayer(root) {
  const rulesPath = path.join(root, 'rules', 'AGENTS.md')
  if (!fs.existsSync(rulesPath)) {
    fail('rule layer missing: rules/AGENTS.md')
    return
  }

  const content = fs.readFileSync(rulesPath, 'utf8')

  // 错误暴露契约已从全局 baseline 下沉到 init-project 的按需代码核心纪律（code-core.md）；
  // 校验改为检查该文件，确保契约在分发体系中仍然存在，而非要求它常驻全局 baseline。
  const codeCorePath = path.join(root, 'skills', 'init-project', 'references', 'code-core.md')
  const codeCoreContent = fs.existsSync(codeCorePath) ? fs.readFileSync(codeCorePath, 'utf8') : ''
  const hasErrorContract = codeCoreContent.includes('禁止错误绕行') && codeCoreContent.includes('失败')

  const hasDeliveryFlow = hasRuleFlowSection(
    content,
    '交付验证',
    REQUIRED_DELIVERY_VERIFICATION_ITEMS,
    REQUIRED_DELIVERY_VERIFICATION_FLOW_ITEMS,
    REQUIRED_DELIVERY_VERIFICATION_FLOW_PATTERNS,
  )
  const hasDeliveryContract = hasDeliveryFlow && REQUIRED_STATUS_MARKERS.every(marker => content.includes(marker))
  const hasGradingContract = hasRuleFlowSection(
    content,
    '变更分级与澄清门禁',
    REQUIRED_CHANGE_LEVEL_ITEMS,
    REQUIRED_CHANGE_LEVEL_FLOW_ITEMS,
    REQUIRED_CHANGE_LEVEL_FLOW_PATTERNS,
  )
  const hasSubagentDispatch = hasSubagentDispatchIndex(content)

  if (!hasErrorContract) {
    fail('rule layer incomplete: skills/init-project/references/code-core.md 必须包含错误暴露契约（禁止错误绕行）')
    return
  }

  if (!hasDeliveryContract) {
    fail('rule layer incomplete: rules/AGENTS.md 必须包含交付验证图约束与状态契约')
    return
  }

  if (!hasGradingContract) {
    fail('rule layer incomplete: rules/AGENTS.md 必须定义变更分级（L0/L1/L2）和澄清门禁')
    return
  }

  if (!hasSubagentDispatch) {
    fail('rule layer incomplete: rules/AGENTS.md 必须包含子代理调度流程图（场景、具体子代理、触发条件、headless 边界）')
    return
  }

  pass('rule layer present')
}

/** 校验下发到下游项目的 project-init reference 是否只承载项目级规则。 */
function checkProjectReference(root) {
  const initProjectRoot = path.join(root, 'skills', 'init-project')
  if (!fs.existsSync(initProjectRoot)) {
    // 交付包未携带 init-project skill 时，项目 reference 不适用，跳过该检查。
    pass('project reference n/a: 未携带 init-project skill')
    return
  }

  const docsPath = path.join(initProjectRoot, 'references', 'common', 'docs.md')
  if (!fs.existsSync(docsPath)) {
    fail('project reference missing: skills/init-project/references/common/docs.md')
    return
  }

  const legacyReferencePaths = [
    path.join(initProjectRoot, 'references', 'common', 'control.md'),
    path.join(initProjectRoot, 'references', 'common', 'subagent.md'),
  ]
  const existingLegacyReferences = legacyReferencePaths
    .filter(filePath => fs.existsSync(filePath))
    .map(filePath => path.relative(root, filePath).replace(/\\/g, '/'))
  if (existingLegacyReferences.length > 0) {
    fail(`project reference incomplete: init-project 不得重新携带旧 reference 文件 ${existingLegacyReferences.join(', ')}`)
    return
  }

  const docsContent = fs.readFileSync(docsPath, 'utf8')
  const hasProjectDocs = docsContent.includes('项目知识源读取规范')
    && docsContent.includes('airules.knowledge.json')
    && docsContent.includes('测试文档结构')
    && docsContent.includes('docs/test/e2e')
    && docsContent.includes('docs/test/index.md')
  if (!hasProjectDocs) {
    fail('project reference incomplete: docs.md 必须包含知识源读取与项目测试文档结构')
    return
  }

  const requiredInitProjectScripts = [
    'inject-rules.mjs',
    'verify-knowledge-sources.mjs',
    'verify-stage-gate.mjs',
  ]
  const missingInitProjectScripts = requiredInitProjectScripts.filter(fileName =>
    !fs.existsSync(path.join(root, 'skills', 'init-project', 'scripts', fileName)),
  )
  if (missingInitProjectScripts.length > 0) {
    fail(`project reference incomplete: 缺少 init-project script ${missingInitProjectScripts.join(', ')}`)
    return
  }

  const injectScriptPath = path.join(root, 'skills', 'init-project', 'scripts', 'inject-rules.mjs')
  const injectContent = fs.readFileSync(injectScriptPath, 'utf8')
  if (!hasCoreInlineReference(injectContent, 'normalizedDocsReferencePath')) {
    fail('project reference incomplete: inject-rules.mjs 未将 docs.md 纳入注入链路')
    return
  }

  if (
    hasLegacyReference(injectContent, 'normalizedControlReferencePath')
    || hasLegacyReference(injectContent, 'normalizedSubagentReferencePath')
    || /\bcontrol\.md\b/.test(injectContent)
    || /\bsubagent\.md\b/.test(injectContent)
  ) {
    fail('project reference incomplete: inject-rules.mjs 不得再注入 control.md 或 subagent.md')
    return
  }

  pass('project reference present')
}

function checkSkillLayer(root) {
  if (!hasSkill(root)) {
    fail('skill layer missing: skills/*/SKILL.md')
    return
  }

  pass('skill layer present')
}

function checkAgentLayer(root) {
  const agentPath = path.join(root, 'agents', 'consistency-reviewer.md')
  if (!fs.existsSync(agentPath)) {
    fail('agent layer missing: agents/consistency-reviewer.md')
    return
  }

  const content = fs.readFileSync(agentPath, 'utf8')
  const missingItems = REQUIRED_CONSISTENCY_REVIEWER_ITEMS.filter(item => !content.includes(item))
  if (missingItems.length > 0) {
    fail(`agent layer incomplete: consistency-reviewer 缺少 ${missingItems.join(', ')}`)
    return
  }

  pass('agent layer present')
}

function checkExecutionLayer(root) {
  const requiredFiles = [
    'scripts/assemble-baseline.mjs',
    'scripts/verify-change-packs.mjs',
    'scripts/verify-knowledge-sources.mjs',
    'scripts/verify-rule-self-sufficiency.mjs',
    'scripts/verify-skill-frontmatter.mjs',
    'scripts/verify-skills.mjs',
    'scripts/verify-delivery-control.mjs',
  ]

  const missingFiles = requiredFiles.filter(relativePath => !hasFile(root, relativePath))
  if (missingFiles.length > 0) {
    fail(`execution layer missing: ${missingFiles.join(', ')}`)
    return
  }

  const packageJsonPath = path.join(root, 'package.json')
  if (!fs.existsSync(packageJsonPath)) {
    fail('execution layer missing: package.json')
    return
  }

  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))
  const requiredPackageFiles = ['agents', 'docs', 'mcp', 'rules', 'scripts', 'skills']
  const publishedFiles = new Set(packageJson.files ?? [])
  const missingPackageFiles = requiredPackageFiles.filter(file => !publishedFiles.has(file))
  if (missingPackageFiles.length > 0) {
    fail(`execution layer incomplete: package.json files 缺少 ${missingPackageFiles.join(', ')}`)
    return
  }

  if (packageJson.scripts?.['delivery:verify'] !== 'node scripts/verify-delivery-control.mjs') {
    fail('execution layer incomplete: package.json scripts 缺少 delivery:verify')
    return
  }

  if (packageJson.scripts?.['rules:check'] !== 'node scripts/assemble-baseline.mjs --check') {
    fail('execution layer incomplete: package.json scripts 缺少 rules:check')
    return
  }

  if (packageJson.scripts?.['verify:skills'] !== 'node scripts/verify-skills.mjs') {
    fail('execution layer incomplete: package.json scripts 缺少 verify:skills')
    return
  }

  if (packageJson.scripts?.['verify:knowledge-sources'] !== 'node scripts/verify-knowledge-sources.mjs airules.knowledge.json') {
    fail('execution layer incomplete: package.json scripts 缺少 verify:knowledge-sources')
    return
  }

  if (packageJson.scripts?.['verify:rules:self-sufficiency'] !== 'node scripts/verify-rule-self-sufficiency.mjs') {
    fail('execution layer incomplete: package.json scripts 缺少 verify:rules:self-sufficiency')
    return
  }

  if (packageJson.scripts?.['verify:changes'] !== 'node scripts/verify-change-packs.mjs') {
    fail('execution layer incomplete: package.json scripts 缺少 verify:changes')
    return
  }

  const expectedL2Script = 'npm run rules:check && npm run delivery:verify && npm run verify:changes && npm run verify:rules:self-sufficiency && npm run verify:skills && npm run verify:knowledge-sources'
  if (packageJson.scripts?.['verify:control:l2'] !== expectedL2Script) {
    fail('execution layer incomplete: package.json scripts 缺少 verify:control:l2')
    return
  }

  pass('execution layer present')
}

function checkDeliveryContract(root) {
  const contractPath = path.join(root, 'docs', 'delivery', 'control-contract.md')
  if (!fs.existsSync(contractPath)) {
    fail('delivery contract missing: docs/delivery/control-contract.md')
    return
  }

  const content = fs.readFileSync(contractPath, 'utf8')
  const requiredSections = ['三层控制面', '变更分级闸门', '澄清触发机制', '环节控制矩阵', 'L2 变更包', '质量门禁']
  const missingSections = requiredSections.filter(section => !content.includes(section))
  const hasSubagentDispatch = content.includes('关键环节子代理调度')
    && content.includes('什么时候调用什么子代理')
    && content.includes('skill')
    && content.includes('subagent')
    && content.includes('headless')
    && REQUIRED_SUBAGENT_DISPATCH_ITEMS.every(item => content.includes(item))

  if (missingSections.length > 0) {
    fail(`delivery contract incomplete: 缺少 ${missingSections.join(', ')}`)
    return
  }

  if (!hasSubagentDispatch) {
    fail('delivery contract incomplete: 必须声明关键环节子代理调度流程图、skill/subagent 边界与 headless 要求')
    return
  }

  pass('delivery contract present')
}

function finish(root) {
  console.log('────────────────────────────')
  if (errors.length > 0) {
    console.log(`FAIL ${errors.length} errors`)
    process.exitCode = 1
    return
  }

  console.log('PASS delivery control contract is valid')
  console.log(`  root: ${root}`)
}

function verify(root) {
  checkRuleLayer(root)
  checkProjectReference(root)
  checkSkillLayer(root)
  checkAgentLayer(root)
  checkExecutionLayer(root)
  checkDeliveryContract(root)
  finish(root)
}

verify(parseArgs(process.argv.slice(2)).root)
