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

function subagentDispatchSection(): string[] {
  return [
    '## 关键环节子代理调度索引（什么时候调用什么子代理）',
    '',
    '```mermaid',
    'flowchart TD',
    '  T["任务分诊"] --> D{"任务类型与规模"}',
    '  D -->|多源只读调研| Research["临时研究子代理 / explorer"]',
    '  D -->|实现计划: 前端| FrontendPlan["frontend-planner"]',
    '  D -->|实现计划: 后端| BackendPlan["backend-planner"]',
    '  D -->|实现编码: 前端| FrontendCode["frontend-coder"]',
    '  D -->|实现编码: 后端| BackendCode["backend-coder"]',
    '  D -->|调试修复| Debug["debugger"]',
    '  D -->|代码评审: 前端| FrontendReview["frontend-reviewer"]',
    '  D -->|代码评审: 后端| BackendReview["backend-reviewer"]',
    '  D -->|后置一致性评审| ConsistencyReview["consistency-reviewer"]',
    '  D -->|测试验证| Verify["临时验证子代理"]',
    '  D -->|文档可控性校验| DocCheck["临时 clean/headless validator"]',
    '  D -->|架构深化: 候选发现| Deepening["architecture-deepening"]',
    '  D -->|架构重构: 已确认 DC-*| Refactor["architecture-refactor"]',
    '```',
    '',
    '图例 / 硬约束：',
    '',
    '- 图中具名 agent 是默认调度入口；宿主不支持同名 agent 时，用同职责、同隔离边界的可用子代理。',
    '- `skill` 决定方法论，`subagent` 决定隔离、并行和反自评边界；不得只因角色名不同拆 agent。',
    '- 每次委派必须自包含；子代理回传必须由主代理用文件、diff、命令输出、日志或 URL 复核。',
    '- reviewer 必须与 coder 是不同实例；拆 agent 必须命中隔离、并行或独立性之一。',
    '- 实现性改动后默认在编码后、测试验证前走 `consistency-reviewer` 核对最终 diff；不得替代编码前 `consistency-check`。纯文档、纯注释、纯格式或无行为配置改动可标 `N/A`；缺少可核对上游时标 `MISSING blocked`。',
    '- clean/headless validator 指干净隔离：无主会话历史、无宿主 AGENTS/baseline、无额外引导；无法提供时标 `MISSING` 或 `NOT RUN`，不得由主上下文自评为 `PASS`。',
  ]
}

function projectDocsReference(): string[] {
  return [
    '# 项目知识源读取规范',
    '- 读取 airules.knowledge.json 后再查 docs。',
    '## 测试文档结构',
    '- 跨模块端到端旅程写入 docs/test/e2e/<旅程名>.md。',
    '- 在 docs/test/index.md 维护旅程清单。',
  ]
}

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
    ...subagentDispatchSection(),
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

  // 引入 init-project skill 后，project reference 检查要求 common/docs.md 与 inject-rules.mjs 齐备
  fs.mkdirSync(path.join(root, 'skills', 'init-project', 'references', 'common'), { recursive: true })
  fs.mkdirSync(path.join(root, 'skills', 'init-project', 'scripts'), { recursive: true })
  fs.writeFileSync(path.join(root, 'skills', 'init-project', 'references', 'common', 'docs.md'), projectDocsReference().join('\n'))
  fs.writeFileSync(path.join(root, 'skills', 'init-project', 'scripts', 'inject-rules.mjs'), [
    '#!/usr/bin/env node',
    'const normalizedDocsReferencePath = "references/common/docs.md"',
    'const coreInlinePaths = [',
    '  normalizedDocsReferencePath,',
    ']',
  ].join('\n'))

  fs.writeFileSync(path.join(root, 'skills', 'demo-skill', 'SKILL.md'), [
    '---',
    'name: demo-skill',
    'description: 用于验证交付目录包含至少一个可分发 skill。',
    '---',
    '# Demo Skill',
  ].join('\n'))

  fs.writeFileSync(path.join(root, 'agents', 'consistency-reviewer.md'), [
    '---',
    'name: consistency-reviewer',
    'description: 实现编码完成后、交付前需要独立核对实现是否符合已确认需求、测试设计、实现计划或 bugfix 诊断时使用。',
    '---',
    '执行前加载 `consistency-check`。',
    '在编码后、测试验证前只读核对最终 diff。',
    '结论使用 PASS / FAIL / MISSING / N/A。',
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
    '关键环节子代理调度：规则层必须用 Mermaid flowchart 写明「什么时候调用什么子代理」，覆盖多源只读调研、实现计划、实现编码、调试修复、代码评审、后置一致性评审、测试验证、文档可控性校验和架构深化/重构，点名 debugger、frontend-planner、backend-planner、frontend-coder、backend-coder、frontend-reviewer、backend-reviewer、consistency-reviewer、architecture-deepening、architecture-refactor，并标出临时研究子代理、临时验证子代理和临时 clean/headless validator；consistency-reviewer 用于编码后、测试验证前核对最终 diff，不得替代 consistency-check，缺少可核对上游时标 MISSING blocked。',
    '调度规则区分 `skill` 与 `subagent`，并用图例硬约束说明自包含、复核、不同实例、隔离、并行、独立性。',
    '规则自足性校验属于 AIRules repo-maintenance 门禁；确定性入口为 `npm run verify:rules:self-sufficiency`，不得下沉到 project-init 子代理调度。',
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
  assert.match(output, /PASS agent layer present/)
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

it('verify-delivery-control - 当前仓库携带 project reference', () => {
  const output = runScript('--root', projectRoot)

  assert.match(output, /PASS project reference present/)
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

it('verify-delivery-control - 规则调度引用的 consistency-reviewer 缺失时显式失败', () => {
  const root = createMinimalDeliveryRoot()
  fs.rmSync(path.join(root, 'agents', 'consistency-reviewer.md'))

  const result = runScriptResult('--root', root)

  assert.notEqual(result.status, 0)
  assert.match(result.stdout, /FAIL agent layer missing: agents\/consistency-reviewer\.md/)
})

it('verify-delivery-control - consistency-reviewer 未加载 consistency-check 时显式失败', () => {
  const root = createMinimalDeliveryRoot()
  fs.writeFileSync(path.join(root, 'agents', 'consistency-reviewer.md'), [
    '---',
    'name: consistency-reviewer',
    'description: 实现编码完成后、交付前需要独立核对实现是否符合已确认需求、测试设计、实现计划或 bugfix 诊断时使用。',
    '---',
    '在编码后、测试验证前只读核对最终 diff。',
    '结论使用 PASS / FAIL / MISSING / N/A。',
  ].join('\n'))

  const result = runScriptResult('--root', root)

  assert.notEqual(result.status, 0)
  assert.match(result.stdout, /FAIL agent layer incomplete: consistency-reviewer 缺少 consistency-check/)
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

it('verify-delivery-control - project reference 缺少 docs.md 时显式失败', () => {
  const root = createMinimalDeliveryRoot()
  fs.rmSync(path.join(root, 'skills', 'init-project', 'references', 'common', 'docs.md'))

  const result = runScriptResult('--root', root)

  assert.notEqual(result.status, 0)
  assert.match(result.stdout, /FAIL project reference missing: skills\/init-project\/references\/common\/docs\.md/)
})

it('verify-delivery-control - project reference 缺少测试文档结构时显式失败', () => {
  const root = createMinimalDeliveryRoot()
  fs.writeFileSync(path.join(root, 'skills', 'init-project', 'references', 'common', 'docs.md'), [
    '# 项目知识源读取规范',
    '- 读取 airules.knowledge.json。',
  ].join('\n'))

  const result = runScriptResult('--root', root)

  assert.notEqual(result.status, 0)
  assert.match(result.stdout, /FAIL project reference incomplete: docs\.md 必须包含知识源读取与项目测试文档结构/)
})

it('verify-delivery-control - inject-rules 未将 docs.md 放入 core inline 时显式失败', () => {
  const root = createMinimalDeliveryRoot()
  fs.writeFileSync(path.join(root, 'skills', 'init-project', 'scripts', 'inject-rules.mjs'), [
    '#!/usr/bin/env node',
    'const normalizedDocsReferencePath = "references/common/docs.md"',
    'const coreInlinePaths = [',
    ']',
  ].join('\n'))

  const result = runScriptResult('--root', root)

  assert.notEqual(result.status, 0)
  assert.match(result.stdout, /FAIL project reference incomplete: inject-rules\.mjs 未将 docs\.md 纳入注入链路/)
})

it('verify-delivery-control - 当前仓库入口规则携带 AIRules 资产分层边界', () => {
  for (const entryFile of ['AGENTS.md', 'CLAUDE.md']) {
    const content = fs.readFileSync(path.join(projectRoot, entryFile), 'utf8')

    assert.match(content, /AIRules 规则资产层级判定/, `${entryFile} must include AIRules asset layers`)
    assert.match(content, /repo-maintenance/, `${entryFile} must define repo-maintenance layer`)
    assert.match(content, /global-baseline/, `${entryFile} must define global-baseline layer`)
    assert.match(content, /project-init/, `${entryFile} must define project-init layer`)
    assert.match(content, /skills\/init-project\/references\/\*\*.*禁止写入 AIRules 维护者规则/s, `${entryFile} must protect project-init boundary`)
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
  assert.match(result.stdout, /FAIL rule layer incomplete: rules\/AGENTS\.md 必须包含子代理调度流程图/)
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
  assert.match(result.stdout, /FAIL delivery contract incomplete: 必须声明关键环节子代理调度流程图/)
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
