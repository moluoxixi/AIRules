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
  const hasErrorContract = content.includes('禁止错误绕行') && content.includes('失败')
  const hasDeliveryContract = content.includes('交付验证') && REQUIRED_STATUS_MARKERS.every(marker => content.includes(marker))

  if (!hasErrorContract || !hasDeliveryContract) {
    fail('rule layer incomplete: rules/AGENTS.md 必须包含错误暴露和交付验证状态契约')
    return
  }

  pass('rule layer present')
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
  const requiredSections = ['三层控制面', '环节控制矩阵', '质量门禁']
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
  checkSkillLayer(root)
  checkExecutionLayer(root)
  checkDeliveryContract(root)
  finish(root)
}

verify(parseArgs(process.argv.slice(2)).root)
