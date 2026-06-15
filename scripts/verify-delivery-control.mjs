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

  const hasDeliveryContract = content.includes('交付验证') && REQUIRED_STATUS_MARKERS.every(marker => content.includes(marker))
  const hasGradingContract = content.includes('变更分级')
    && ['L0', 'L1', 'L2'].every(level => content.includes(level))
  const hasClarifyGate = content.includes('澄清门禁')

  if (!hasErrorContract) {
    fail('rule layer incomplete: skills/init-project/references/code-core.md 必须包含错误暴露契约（禁止错误绕行）')
    return
  }

  if (!hasDeliveryContract) {
    fail('rule layer incomplete: rules/AGENTS.md 必须包含交付验证状态契约')
    return
  }

  if (!hasGradingContract || !hasClarifyGate) {
    fail('rule layer incomplete: rules/AGENTS.md 必须定义变更分级（L0/L1/L2）和澄清门禁')
    return
  }

  pass('rule layer present')
}

/**
 * 校验下发到下游项目的控制 reference 是否完整。
 * control.md 承载分级闸门、澄清门禁和开发链路编排，由 init-project 注入各宿主 AGENTS.md，
 * 是各 agent 获得需求-计划-测试-评审全程可控能力的入口。
 */
function checkControlReference(root) {
  const initProjectRoot = path.join(root, 'skills', 'init-project')
  if (!fs.existsSync(initProjectRoot)) {
    // 交付包未携带 init-project skill 时，控制 reference 不适用，跳过该检查。
    pass('control reference n/a: 未携带 init-project skill')
    return
  }

  const controlPath = path.join(initProjectRoot, 'references', 'common', 'control.md')
  if (!fs.existsSync(controlPath)) {
    fail('control reference missing: skills/init-project/references/common/control.md')
    return
  }

  const content = fs.readFileSync(controlPath, 'utf8')
  const hasGrading = content.includes('变更分级') && ['L0', 'L1', 'L2'].every(level => content.includes(level))
  const hasClarify = content.includes('澄清门禁')
  const hasPipeline = content.includes('开发链路控制')

  if (!hasGrading || !hasClarify || !hasPipeline) {
    fail('control reference incomplete: control.md 必须包含变更分级、澄清门禁和开发链路控制')
    return
  }

  const injectScriptPath = path.join(root, 'skills', 'init-project', 'scripts', 'inject-rules.mjs')
  if (!fs.existsSync(injectScriptPath)) {
    fail('control reference incomplete: 缺少 inject-rules.mjs 无法保证 control.md 注入')
    return
  }

  const injectContent = fs.readFileSync(injectScriptPath, 'utf8')
  if (!injectContent.includes('common\', \'control.md') && !injectContent.includes('control.md')) {
    fail('control reference incomplete: inject-rules.mjs 未将 control.md 纳入注入链路')
    return
  }

  pass('control reference present')
}

function checkSkillLayer(root) {
  if (!hasSkill(root)) {
    fail('skill layer missing: skills/*/SKILL.md')
    return
  }

  pass('skill layer present')
}

function checkExecutionLayer(root) {
  const requiredFiles = [
    'scripts/verify-skill-frontmatter.mjs',
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
  const requiredPackageFiles = ['docs', 'rules', 'scripts', 'skills']
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

  pass('execution layer present')
}

function checkDeliveryContract(root) {
  const contractPath = path.join(root, 'docs', 'delivery', 'control-contract.md')
  if (!fs.existsSync(contractPath)) {
    fail('delivery contract missing: docs/delivery/control-contract.md')
    return
  }

  const content = fs.readFileSync(contractPath, 'utf8')
  const requiredSections = ['三层控制面', '变更分级闸门', '澄清触发机制', '环节控制矩阵', '质量门禁']
  const missingSections = requiredSections.filter(section => !content.includes(section))

  if (missingSections.length > 0) {
    fail(`delivery contract incomplete: 缺少 ${missingSections.join(', ')}`)
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
  checkControlReference(root)
  checkSkillLayer(root)
  checkExecutionLayer(root)
  checkDeliveryContract(root)
  finish(root)
}

verify(parseArgs(process.argv.slice(2)).root)
