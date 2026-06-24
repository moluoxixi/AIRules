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
  fs.mkdirSync(path.join(root, 'agents'), { recursive: true })
  fs.mkdirSync(path.join(root, 'mcp'), { recursive: true })
  fs.mkdirSync(path.join(root, 'skills', 'demo-skill'), { recursive: true })
  fs.mkdirSync(path.join(root, 'skills', 'init-project', 'references'), { recursive: true })
  fs.mkdirSync(path.join(root, 'scripts'), { recursive: true })
  fs.mkdirSync(path.join(root, 'docs', 'delivery'), { recursive: true })

  fs.writeFileSync(path.join(root, 'rules', 'AGENTS.md'), [
    '# AIRules',
    '## 交付验证',
    '- 检查状态统一使用 `PASS`、`FAIL`、`MISSING`、`NOT RUN`、`N/A`。',
    '## 变更分级与确认门禁',
    '- L0 可直接执行；L1 既有边界内执行；L2 必须先确认。',
    '## 澄清门禁',
    '- 命中 L2 或关键事实缺失时先输出澄清问题清单。',
    '## 子代理委派',
    '## 关键环节子代理调度索引（什么时候调用什么子代理）',
    '- `skill` 决定知识内容和方法论，`subagent` 决定上下文隔离、并行和反自评边界。',
    '- 覆盖多源只读调研、实现计划、实现编码、调试修复、代码评审、测试验证、文档可控性校验、规则自足性校验、架构深化/重构。',
    '- 具名 agent 包括 `debugger`、`frontend-planner`、`backend-planner`、`frontend-coder`、`backend-coder`、`frontend-reviewer`、`backend-reviewer`、`architecture-refactor`。',
    '- 子代理指令必须自包含，回传必须由主代理复核，reviewer 必须是不同实例，拆 agent 必须命中隔离、并行或独立性。',
    '- headless / 干净隔离上下文用于规则自足性和文档可控性校验。',
  ].join('\n'))

  // 错误暴露契约已下沉到 init-project 的按需代码核心纪律 code-core.md
  fs.writeFileSync(path.join(root, 'skills', 'init-project', 'references', 'code-core.md'), [
    '---',
    'ruleScope: code',
    'description: 写任何代码时遵循',
    '---',
    '# 代码实现核心纪律',
    '- 禁止错误绕行，失败必须显式暴露。',
  ].join('\n'))

  // 引入 init-project skill 后，control reference 检查要求 common/control.md 与 inject-rules.mjs 齐备
  fs.mkdirSync(path.join(root, 'skills', 'init-project', 'references', 'common'), { recursive: true })
  fs.mkdirSync(path.join(root, 'skills', 'init-project', 'scripts'), { recursive: true })
  fs.writeFileSync(path.join(root, 'skills', 'init-project', 'references', 'common', 'control.md'), [
    '# 变更分级与确认门禁',
    '- L0 L1 L2 分级执行。',
    '## 澄清门禁',
    '- 命中 L2 时先澄清。',
    '## 开发链路控制',
    '- 按环节顺序推进。',
  ].join('\n'))
  fs.writeFileSync(path.join(root, 'skills', 'init-project', 'references', 'common', 'subagent.md'), [
    '# 子代理委派',
    '## 关键环节子代理调度索引（什么时候调用什么子代理）',
    '- `skill` 决定知识内容和方法论，`subagent` 决定上下文隔离、并行和反自评边界。',
    '- 多源只读调研。',
    '- 实现计划。',
    '- 实现编码。',
    '- 调试修复。',
    '- 代码评审。',
    '- 测试验证。',
    '- 文档可控性校验。',
    '- 规则自足性校验。',
    '- 架构深化/重构。',
    '- debugger。',
    '- frontend-planner。',
    '- backend-planner。',
    '- frontend-coder。',
    '- backend-coder。',
    '- frontend-reviewer。',
    '- backend-reviewer。',
    '- architecture-refactor。',
    '- 子代理指令必须自包含。',
    '- 主代理必须复核回传。',
    '- reviewer 必须是不同实例。',
    '- 隔离、并行、独立性。',
    '- headless / 干净隔离用于文档可控性校验。',
  ].join('\n'))
  fs.writeFileSync(path.join(root, 'skills', 'init-project', 'scripts', 'inject-rules.mjs'), [
    '#!/usr/bin/env node',
    'const normalizedControlReferencePath = "references/common/control.md"',
    'const normalizedSubagentReferencePath = "references/common/subagent.md"',
    'const coreInlinePaths = [',
    '  normalizedControlReferencePath,',
    '  normalizedSubagentReferencePath,',
    ']',
  ].join('\n'))

  fs.writeFileSync(path.join(root, 'skills', 'demo-skill', 'SKILL.md'), [
    '---',
    'name: demo-skill',
    'description: 用于验证交付目录包含至少一个可分发 skill。',
    '---',
    '# Demo Skill',
  ].join('\n'))

  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({
    files: ['agents', 'docs', 'mcp', 'rules', 'scripts', 'skills'],
    scripts: {
      'delivery:verify': 'node scripts/verify-delivery-control.mjs',
      'rules:check': 'node scripts/assemble-baseline.mjs --check',
      'verify:skills': 'node scripts/verify-skills.mjs',
      'verify:knowledge-sources': 'node scripts/verify-knowledge-sources.mjs airules.knowledge.json',
      'verify:rules:self-sufficiency': 'node scripts/verify-rule-self-sufficiency.mjs',
      'verify:control:l2': 'npm run rules:check && npm run delivery:verify && npm run verify:rules:self-sufficiency && npm run verify:skills && npm run verify:knowledge-sources',
    },
  }))
  fs.writeFileSync(path.join(root, 'scripts', 'assemble-baseline.mjs'), '#!/usr/bin/env node\n')
  fs.writeFileSync(path.join(root, 'scripts', 'verify-knowledge-sources.mjs'), '#!/usr/bin/env node\n')
  fs.writeFileSync(path.join(root, 'scripts', 'verify-rule-self-sufficiency.mjs'), '#!/usr/bin/env node\n')
  fs.writeFileSync(path.join(root, 'scripts', 'verify-skill-frontmatter.mjs'), '#!/usr/bin/env node\n')
  fs.writeFileSync(path.join(root, 'scripts', 'verify-skills.mjs'), '#!/usr/bin/env node\n')
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
    '关键环节子代理调度：规则层必须写明「什么时候调用什么子代理」，覆盖多源调研、实现计划、实现编码、调试修复、代码评审、测试验证、文档可控性校验、规则自足性校验和架构深化/重构。',
    '调度索引必须点名 debugger、frontend-planner、backend-planner、frontend-coder、backend-coder、frontend-reviewer、backend-reviewer、architecture-refactor，并说明自包含、复核、不同实例、隔离、并行、独立性。',
    '调度规则区分 `skill` 与 `subagent`，并要求 headless / 干净隔离上下文。',
    'L2 控制聚合入口必须包含 `verify:rules:self-sufficiency`。',
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

it('verify-delivery-control - package files 缺少 agents 或 mcp 时显式失败', () => {
  const root = createMinimalDeliveryRoot()
  const packageJsonPath = path.join(root, 'package.json')
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))
  packageJson.files = ['docs', 'rules', 'scripts', 'skills']
  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson))

  const result = runScriptResult('--root', root)

  assert.notEqual(result.status, 0)
  assert.match(result.stdout, /FAIL execution layer incomplete: package\.json files 缺少 agents, mcp/)
})

it('verify-delivery-control - 缺少 L2 控制聚合入口时显式失败', () => {
  const root = createMinimalDeliveryRoot()
  const packageJsonPath = path.join(root, 'package.json')
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))
  delete packageJson.scripts['verify:control:l2']
  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson))

  const result = runScriptResult('--root', root)

  assert.notEqual(result.status, 0)
  assert.match(result.stdout, /FAIL execution layer incomplete: package\.json scripts 缺少 verify:control:l2/)
})

it('verify-delivery-control - 缺少规则自足性校验入口时显式失败', () => {
  const root = createMinimalDeliveryRoot()
  const packageJsonPath = path.join(root, 'package.json')
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))
  delete packageJson.scripts['verify:rules:self-sufficiency']
  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson))

  const result = runScriptResult('--root', root)

  assert.notEqual(result.status, 0)
  assert.match(result.stdout, /FAIL execution layer incomplete: package\.json scripts 缺少 verify:rules:self-sufficiency/)
})

it('verify-delivery-control - L2 控制聚合入口必须是真实 npm run 链', () => {
  const root = createMinimalDeliveryRoot()
  const packageJsonPath = path.join(root, 'package.json')
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))
  packageJson.scripts['verify:control:l2'] = 'echo rules:check delivery:verify verify:rules:self-sufficiency verify:skills verify:knowledge-sources'
  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson))

  const result = runScriptResult('--root', root)

  assert.notEqual(result.status, 0)
  assert.match(result.stdout, /FAIL execution layer incomplete: package\.json scripts 缺少 verify:control:l2/)
})

it('verify-delivery-control - control reference 缺少 subagent.md 时显式失败', () => {
  const root = createMinimalDeliveryRoot()
  fs.rmSync(path.join(root, 'skills', 'init-project', 'references', 'common', 'subagent.md'))

  const result = runScriptResult('--root', root)

  assert.notEqual(result.status, 0)
  assert.match(result.stdout, /FAIL control reference missing: skills\/init-project\/references\/common\/subagent\.md/)
})

it('verify-delivery-control - control reference 缺少子代理调度内容时显式失败', () => {
  const root = createMinimalDeliveryRoot()
  fs.writeFileSync(path.join(root, 'skills', 'init-project', 'references', 'common', 'subagent.md'), [
    '# 子代理委派',
    '## 关键环节子代理调度索引（什么时候调用什么子代理）',
    '- `skill` 决定知识内容和方法论，`subagent` 决定上下文隔离、并行和反自评边界。',
    '- headless / 干净隔离用于文档可控性校验。',
  ].join('\n'))

  const result = runScriptResult('--root', root)

  assert.notEqual(result.status, 0)
  assert.match(result.stdout, /FAIL control reference incomplete: subagent\.md 必须包含关键环节子代理调度索引和 headless 边界/)
})

it('verify-delivery-control - inject-rules 未将 subagent.md 放入 core inline 时显式失败', () => {
  const root = createMinimalDeliveryRoot()
  fs.writeFileSync(path.join(root, 'skills', 'init-project', 'scripts', 'inject-rules.mjs'), [
    '#!/usr/bin/env node',
    'const normalizedControlReferencePath = "references/common/control.md"',
    'const normalizedSubagentReferencePath = "references/common/subagent.md"',
    'const coreInlinePaths = [',
    '  normalizedControlReferencePath,',
    ']',
  ].join('\n'))

  const result = runScriptResult('--root', root)

  assert.notEqual(result.status, 0)
  assert.match(result.stdout, /FAIL control reference incomplete: inject-rules\.mjs 未将 subagent\.md 纳入注入链路/)
})

it('verify-delivery-control - 当前仓库入口规则携带任务分诊与子代理调度索引', () => {
  for (const entryFile of ['AGENTS.md', 'CLAUDE.md']) {
    const content = fs.readFileSync(path.join(projectRoot, entryFile), 'utf8')

    assert.match(content, /## 任务分诊（triage）/, `${entryFile} must include task triage`)
    assert.match(content, /关键环节子代理调度索引/, `${entryFile} must include subagent dispatch index`)
    assert.match(content, /frontend-planner/, `${entryFile} must include planner dispatch`)
    assert.match(content, /临时验证子代理/, `${entryFile} must distinguish temporary verification agent`)
    assert.match(content, /headless \/ 干净隔离/, `${entryFile} must include headless boundary`)
  }
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

it('verify-delivery-control - 规则层缺少子代理调度索引时显式失败', () => {
  const root = createMinimalDeliveryRoot()
  fs.writeFileSync(path.join(root, 'rules', 'AGENTS.md'), [
    '# AIRules',
    '## 交付验证',
    '- 检查状态统一使用 `PASS`、`FAIL`、`MISSING`、`NOT RUN`、`N/A`。',
    '## 变更分级与确认门禁',
    '- L0 可直接执行；L1 既有边界内执行；L2 必须先确认。',
    '## 澄清门禁',
    '- 命中 L2 或关键事实缺失时先输出澄清问题清单。',
  ].join('\n'))

  const result = runScriptResult('--root', root)

  assert.notEqual(result.status, 0)
  assert.match(result.stdout, /FAIL rule layer incomplete: rules\/AGENTS\.md 必须包含子代理调度索引/)
})

it('verify-delivery-control - 契约缺少子代理调度说明时显式失败', () => {
  const root = createMinimalDeliveryRoot()
  fs.writeFileSync(path.join(root, 'docs', 'delivery', 'control-contract.md'), [
    '# 交付控制契约',
    '## 三层控制面',
    '- 规则层、技能层、执行层。',
    '## 变更分级闸门',
    '- L0/L1 可直接执行，L2 必须先确认。',
    '## 澄清触发机制',
    '- 命中 L2 或关键事实缺失时先输出澄清问题清单。',
    '## 环节控制矩阵',
    '- 需求到评审。',
    '## 质量门禁',
    '- 交付前运行校验。',
  ].join('\n'))

  const result = runScriptResult('--root', root)

  assert.notEqual(result.status, 0)
  assert.match(result.stdout, /FAIL delivery contract incomplete: 必须声明关键环节子代理调度/)
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
