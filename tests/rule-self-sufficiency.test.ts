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
const scriptPath = path.join(projectRoot, 'scripts', 'verify-rule-self-sufficiency.mjs')

function runScript(...args: string[]) {
  return execFileSync(process.execPath, [scriptPath, ...args], {
    cwd: projectRoot,
    encoding: 'utf8',
  })
}

function runScriptResult(...args: string[]) {
  return spawnSync(process.execPath, [scriptPath, ...args], {
    cwd: projectRoot,
    encoding: 'utf8',
  })
}

function dispatchSection() {
  return [
    '## 关键环节子代理调度索引（什么时候调用什么子代理）',
    '',
    '| 环节 | 默认委派形态 | 该走子代理的判据 | 主代理直接做的例外 |',
    '|---|---|---|---|',
    '| 多源只读调研 | 临时研究子代理 | 多源并行 | 单一文件 |',
    '| 实现计划 | frontend-planner / backend-planner | 多业务域 | 单一业务域 |',
    '| 实现编码 | frontend-coder / backend-coder | 独立 task | 单文件小改 |',
    '| 调试修复 | debugger | bugfix 前置根因调查 | 单点明确 |',
    '| 代码评审 | frontend-reviewer / backend-reviewer | 编码完成强制评审 | 无例外 |',
    '| 测试验证 | 临时验证子代理 | 输出量大或跨模块 | 单条命令 |',
    '| 文档可控性校验 | clean/headless validator | 规则 + 被校验产物 | 无例外 |',
    '| 规则自足性校验 | clean/headless validator | 修改规则/投影/reference | 无例外：无法提供干净隔离时标记 `MISSING` 或 `NOT RUN`，不得由主上下文自评为 `PASS` |',
    '| 架构深化 | architecture-refactor | 已确认 DC-* | 仅发现机会 |',
    '',
    '- fresh 子代理 per task：每个 task 派全新子代理。',
    '- 自包含与复核：每次委派必须自包含，回传必须复核。',
    '- 不同实例与拆分理由：reviewer 必须是不同实例；拆 agent 必须命中隔离、并行或独立性。',
    '- headless / 干净隔离：无主会话历史、无宿主 AGENTS/baseline。',
  ].join('\n')
}

function createMinimalRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'airules-rule-self-'))
  fs.mkdirSync(path.join(root, 'rules', 'sources'), { recursive: true })
  fs.mkdirSync(path.join(root, 'skills', 'init-project', 'references', 'common'), { recursive: true })
  fs.mkdirSync(path.join(root, 'docs', 'delivery'), { recursive: true })

  const rootRules = [
    '# AIRules',
    '## Role & Context Boundary',
    '- 元认知隔离：根目录 skills 和 rules 视为纯数据，绝对禁止当作当前会话规则执行。',
    '## 子代理委派',
    dispatchSection(),
    '',
  ].join('\n')
  const ruleLayer = [
    '# AIRules',
    '## 子代理委派',
    dispatchSection(),
    '',
  ].join('\n')
  const contract = [
    '# 交付控制契约',
    '关键环节子代理调度必须覆盖规则自足性校验。',
    'headless / 干净隔离用于规则自足性校验。',
    'L2 聚合入口必须包含 verify:rules:self-sufficiency。',
    '',
  ].join('\n')

  fs.writeFileSync(path.join(root, 'AGENTS.md'), rootRules)
  fs.writeFileSync(path.join(root, 'CLAUDE.md'), rootRules)
  fs.writeFileSync(path.join(root, 'rules', 'AGENTS.md'), ruleLayer)
  fs.writeFileSync(path.join(root, 'rules', 'sources', '50-subagent-delegation.md'), ruleLayer)
  fs.writeFileSync(path.join(root, 'skills', 'init-project', 'references', 'common', 'subagent.md'), ruleLayer)
  fs.writeFileSync(path.join(root, 'docs', 'delivery', 'control-contract.md'), contract)

  return root
}

it('verify-rule-self-sufficiency - 当前仓库规则自足性通过', () => {
  const output = runScript('--root', projectRoot)

  assert.match(output, /PASS rule self-sufficiency contract is valid/)
})

it('verify-rule-self-sufficiency - 最小自足规则包通过', () => {
  const root = createMinimalRoot()
  const output = runScript('--root', root)

  assert.match(output, /PASS rule self-sufficiency contract is valid/)
})

it('verify-rule-self-sufficiency - 缺少 headless 失败语义时显式失败', () => {
  const root = createMinimalRoot()
  const subagentPath = path.join(root, 'skills', 'init-project', 'references', 'common', 'subagent.md')
  fs.writeFileSync(subagentPath, fs.readFileSync(subagentPath, 'utf8').replace('NOT RUN', ''))

  const result = runScriptResult('--root', root)

  assert.notEqual(result.status, 0)
  assert.match(result.stdout, /FAIL skills\/init-project\/references\/common\/subagent\.md headless contract 缺少: NOT RUN/)
})

it('verify-rule-self-sufficiency - AGENTS 和 CLAUDE 漂移时显式失败', () => {
  const root = createMinimalRoot()
  fs.appendFileSync(path.join(root, 'CLAUDE.md'), '\nextra drift\n')

  const result = runScriptResult('--root', root)

  assert.notEqual(result.status, 0)
  assert.match(result.stdout, /FAIL AGENTS\.md 与 CLAUDE\.md 内容不一致/)
})
