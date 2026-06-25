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
    '- 实现性改动后默认在编码后、测试验证前走 consistency-reviewer 核对最终 diff；不得替代编码前 consistency-check。纯文档、纯注释、纯格式或无行为配置改动可标 N/A；缺少可核对上游时标 MISSING blocked。',
    '- clean/headless validator 指干净隔离：无主会话历史、无宿主 AGENTS/baseline、无额外引导；无法提供时标 `MISSING` 或 `NOT RUN`，不得由主上下文自评为 `PASS`。',
  ].join('\n')
}

function projectDocsReference() {
  return [
    '# 项目知识源读取规范',
    '- 读取 airules.knowledge.json 后再查 docs。',
    '## 测试文档结构',
    '- 跨模块端到端旅程写入 docs/test/e2e/<旅程名>.md。',
    '- 在 docs/test/index.md 维护旅程清单。',
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
    '## AIRules 规则资产层级判定',
    '- repo-maintenance：根 AGENTS.md、CLAUDE.md、docs/delivery/**、scripts/verify-*.mjs。',
    '- global-baseline：rules/sources/** 与生成产物 rules/AGENTS.md。',
    '- project-init：skills/init-project/references/** 只能写项目级规则。',
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
    '关键环节子代理调度必须使用 Mermaid flowchart，并点名 debugger、frontend-planner、backend-planner、frontend-coder、backend-coder、frontend-reviewer、backend-reviewer、consistency-reviewer、architecture-deepening、architecture-refactor。',
    '后置一致性评审必须说明 consistency-reviewer 在编码后、测试验证前读取最终 diff，且不得替代 consistency-check；缺少上游时标 MISSING blocked。',
    '调度图必须标出临时研究子代理、临时验证子代理和临时 clean/headless validator。',
    '规则自足性校验属于 AIRules repo-maintenance 门禁，不得下沉到 project-init 子代理调度。',
    'L2 聚合入口必须包含 verify:rules:self-sufficiency。',
    '',
  ].join('\n')

  fs.writeFileSync(path.join(root, 'AGENTS.md'), rootRules)
  fs.writeFileSync(path.join(root, 'CLAUDE.md'), rootRules)
  fs.writeFileSync(path.join(root, 'rules', 'AGENTS.md'), ruleLayer)
  fs.writeFileSync(path.join(root, 'rules', 'sources', '50-subagent-delegation.md'), ruleLayer)
  fs.writeFileSync(path.join(root, 'skills', 'init-project', 'references', 'common', 'docs.md'), projectDocsReference())
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
  const sourcePath = path.join(root, 'rules', 'sources', '50-subagent-delegation.md')
  fs.writeFileSync(sourcePath, fs.readFileSync(sourcePath, 'utf8').replace('NOT RUN', ''))

  const result = runScriptResult('--root', root)

  assert.notEqual(result.status, 0)
  assert.match(result.stdout, /FAIL rules\/sources\/50-subagent-delegation\.md headless contract 缺少: NOT RUN/)
})

it('verify-rule-self-sufficiency - 缺少 headless 干净隔离定义时显式失败', () => {
  const root = createMinimalRoot()
  const sourcePath = path.join(root, 'rules', 'sources', '50-subagent-delegation.md')
  fs.writeFileSync(sourcePath, fs.readFileSync(sourcePath, 'utf8').replace('无额外引导', ''))

  const result = runScriptResult('--root', root)

  assert.notEqual(result.status, 0)
  assert.match(result.stdout, /FAIL rules\/sources\/50-subagent-delegation\.md headless contract 缺少: 无额外引导/)
})

it('verify-rule-self-sufficiency - 缺少 consistency-reviewer 调度时显式失败', () => {
  const root = createMinimalRoot()
  const sourcePath = path.join(root, 'rules', 'sources', '50-subagent-delegation.md')
  fs.writeFileSync(sourcePath, fs.readFileSync(sourcePath, 'utf8').replaceAll('consistency-reviewer', 'implementation-reviewer'))

  const result = runScriptResult('--root', root)

  assert.notEqual(result.status, 0)
  assert.match(result.stdout, /FAIL rules\/sources\/50-subagent-delegation\.md dispatch section 缺少: consistency-reviewer/)
})

it('verify-rule-self-sufficiency - project-init reference 泄漏 AIRules 维护资产时显式失败', () => {
  const root = createMinimalRoot()
  const docsPath = path.join(root, 'skills', 'init-project', 'references', 'common', 'docs.md')
  fs.appendFileSync(docsPath, '\n- 修改 rules/sources/*.md 后执行规则自足性校验。\n')

  const result = runScriptResult('--root', root)

  assert.notEqual(result.status, 0)
  assert.match(result.stdout, /FAIL skills\/init-project\/references\/common\/docs\.md 不得包含 AIRules 维护者资产: rules\/sources/)
})

it('verify-rule-self-sufficiency - 任意 project-init reference 泄漏维护资产时显式失败', () => {
  const root = createMinimalRoot()
  const codeCorePath = path.join(root, 'skills', 'init-project', 'references', 'code-core.md')
  fs.writeFileSync(codeCorePath, '# 代码规则\n\n- 修改 rules/AGENTS.md 后执行维护门禁。\n')

  const result = runScriptResult('--root', root)

  assert.notEqual(result.status, 0)
  assert.match(result.stdout, /FAIL skills\/init-project\/references\/code-core\.md 不得包含 AIRules 维护者资产: rules\/AGENTS/)
})

it('verify-rule-self-sufficiency - project-init reference 泄漏中文维护流程时显式失败', () => {
  const root = createMinimalRoot()
  const docsPath = path.join(root, 'skills', 'init-project', 'references', 'common', 'docs.md')
  fs.appendFileSync(docsPath, '\n- host 投影、发布/PR 默认流程和纯净测试由本节控制。\n')

  const result = runScriptResult('--root', root)

  assert.notEqual(result.status, 0)
  assert.match(result.stdout, /FAIL skills\/init-project\/references\/common\/docs\.md 不得包含 AIRules 维护者资产: host 投影, 发布\/PR 默认流程, PR 默认流程, 纯净测试/)
})

it('verify-rule-self-sufficiency - project-init reference 引用 AIRules 全局 scripts 时显式失败', () => {
  const root = createMinimalRoot()
  const docsPath = path.join(root, 'skills', 'init-project', 'references', 'common', 'docs.md')
  fs.appendFileSync(docsPath, '\n- 运行 `node <AIRules>/scripts/verify-knowledge-sources.mjs airules.knowledge.json`。\n')

  const result = runScriptResult('--root', root)

  assert.notEqual(result.status, 0)
  assert.match(result.stdout, /FAIL skills\/init-project\/references\/common\/docs\.md 不得引用 AIRules 安装根全局 scripts/)
})

it('verify-rule-self-sufficiency - AGENTS 和 CLAUDE 漂移时显式失败', () => {
  const root = createMinimalRoot()
  fs.appendFileSync(path.join(root, 'CLAUDE.md'), '\nextra drift\n')

  const result = runScriptResult('--root', root)

  assert.notEqual(result.status, 0)
  assert.match(result.stdout, /FAIL AGENTS\.md 与 CLAUDE\.md 内容不一致/)
})
