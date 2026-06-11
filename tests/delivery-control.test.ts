import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { it } from 'vitest'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '..')
const scriptPath = path.join(projectRoot, 'scripts', 'verify-delivery-control.mjs')

/**
 * 运行交付控制校验脚本，并固定 cwd，避免测试受调用目录影响。
 */
function runScript(...args: string[]) {
  return execFileSync(process.execPath, [scriptPath, ...args], {
    cwd: projectRoot,
    encoding: 'utf8',
  })
}

/**
 * 运行脚本并保留退出码，用于断言失败路径会显式暴露错误。
 */
function runScriptResult(...args: string[]) {
  return spawnSync(process.execPath, [scriptPath, ...args], {
    cwd: projectRoot,
    encoding: 'utf8',
  })
}

/**
 * 构造最小 AIRules 交付目录，覆盖规则层、技能层、执行层三个控制面。
 */
function createMinimalDeliveryRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'airules-delivery-'))
  fs.mkdirSync(path.join(root, 'rules'), { recursive: true })
  fs.mkdirSync(path.join(root, 'skills', 'demo-skill'), { recursive: true })
  fs.mkdirSync(path.join(root, 'scripts'), { recursive: true })
  fs.mkdirSync(path.join(root, 'docs', 'delivery'), { recursive: true })

  fs.writeFileSync(path.join(root, 'rules', 'AGENTS.md'), [
    '# AIRules',
    '## 核心规则',
    '- 禁止错误绕行，失败必须显式暴露。',
    '## 交付验证',
    '- 检查状态统一使用 `PASS`、`FAIL`、`MISSING`、`NOT RUN`、`N/A`。',
    '## 变更分级与确认门禁',
    '- L0 可直接执行；L1 既有边界内执行；L2 必须先确认。',
    '## 澄清门禁',
    '- 命中 L2 或关键事实缺失时先输出澄清问题清单。',
  ].join('\n'))

  fs.writeFileSync(path.join(root, 'skills', 'demo-skill', 'SKILL.md'), [
    '---',
    'name: demo-skill',
    'description: 用于验证交付目录包含至少一个可分发 skill。',
    '---',
    '# Demo Skill',
  ].join('\n'))

  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({
    files: ['docs', 'rules', 'scripts', 'skills'],
    scripts: {
      'delivery:verify': 'node scripts/verify-delivery-control.mjs',
    },
  }))
  fs.writeFileSync(path.join(root, 'scripts', 'verify-skill-frontmatter.mjs'), '#!/usr/bin/env node\n')
  fs.writeFileSync(path.join(root, 'scripts', 'verify-delivery-control.mjs'), '#!/usr/bin/env node\n')
  fs.writeFileSync(path.join(root, 'docs', 'delivery', 'control-contract.md'), [
    '# 交付控制契约',
    '## 三层控制面',
    '- 规则层：定义禁止事项和失败语义。',
    '- 技能层：定义触发条件、应用边界和产出边界。',
    '- 执行层：定义脚本、CI、PR 检查和验收状态。',
    '## 变更分级闸门',
    '- L0/L1 可直接执行，L2 必须先确认。',
    '## 澄清触发机制',
    '- 命中 L2 或关键事实缺失时先输出澄清问题清单。',
    '## 环节控制矩阵',
    '| 环节 | 控制资产 | 验证方式 |',
    '|---|---|---|',
    '| 需求 | prd-docs | PASS/FAIL |',
    '## 质量门禁',
    '- 交付前运行 npm run delivery:verify。',
  ].join('\n'))

  return root
}

it('verify-delivery-control - 当前仓库满足三层交付控制契约', () => {
  const output = runScript('--root', projectRoot)

  assert.match(output, /PASS delivery control contract is valid/)
  assert.match(output, /PASS rule layer present/)
  assert.match(output, /PASS skill layer present/)
  assert.match(output, /PASS execution layer present/)
})

it('verify-delivery-control - 最小有效交付目录通过校验', () => {
  const root = createMinimalDeliveryRoot()
  const output = runScript('--root', root)

  assert.match(output, /PASS delivery control contract is valid/)
})

it('verify-delivery-control - 缺少执行层时显式失败', () => {
  const root = createMinimalDeliveryRoot()
  fs.rmSync(path.join(root, 'scripts', 'verify-skill-frontmatter.mjs'))

  const result = runScriptResult('--root', root)

  assert.notEqual(result.status, 0)
  assert.match(result.stdout, /FAIL execution layer missing/)
})

it('verify-delivery-control - 未知参数显式失败', () => {
  const result = runScriptResult('--unknown')

  assert.notEqual(result.status, 0)
  assert.match(result.stdout, /FAIL 未知参数：--unknown/)
})

it('verify-delivery-control - 当前仓库携带 control reference', () => {
  const output = runScript('--root', projectRoot)

  assert.match(output, /PASS control reference present/)
})

it('verify-delivery-control - 规则层缺少变更分级定义时显式失败', () => {
  const root = createMinimalDeliveryRoot()
  fs.writeFileSync(path.join(root, 'rules', 'AGENTS.md'), [
    '# AIRules',
    '## 核心规则',
    '- 禁止错误绕行，失败必须显式暴露。',
    '## 交付验证',
    '- 检查状态统一使用 `PASS`、`FAIL`、`MISSING`、`NOT RUN`、`N/A`。',
  ].join('\n'))

  const result = runScriptResult('--root', root)

  assert.notEqual(result.status, 0)
  assert.match(result.stdout, /FAIL rule layer incomplete: rules\/AGENTS\.md 必须定义变更分级/)
})

it('verify-delivery-control - 契约缺少澄清触发机制时显式失败', () => {
  const root = createMinimalDeliveryRoot()
  fs.writeFileSync(path.join(root, 'docs', 'delivery', 'control-contract.md'), [
    '# 交付控制契约',
    '## 三层控制面',
    '- 规则层、技能层、执行层。',
    '## 环节控制矩阵',
    '- 需求到评审。',
    '## 质量门禁',
    '- 交付前运行校验。',
  ].join('\n'))

  const result = runScriptResult('--root', root)

  assert.notEqual(result.status, 0)
  assert.match(result.stdout, /FAIL delivery contract incomplete/)
})
