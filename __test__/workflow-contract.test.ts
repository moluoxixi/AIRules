import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'vitest'
import { checkRulesConsistency, firstPartySkillNames } from '../scripts/check-rules-consistency.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')
const specScriptsDir = path.join(repoRoot, 'skills', 'init-project', 'scripts')

function withTempDir<T>(run: (tmpDir: string) => T): T {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'airules-wf-'))
  try {
    return run(tmpDir)
  }
  finally {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  }
}

function read(rel: string): string {
  return fs.readFileSync(path.join(repoRoot, rel), 'utf8')
}

// ── 1. 自洽检查器：真实仓库 + 种入缺陷的 fixture ──────────────

describe('自洽检查器', () => {
  it('真实仓库 0 漂移', () => {
    const { errors } = checkRulesConsistency(repoRoot)
    assert.deepEqual(errors, [], `期望无漂移，实际：\n${errors.join('\n')}`)
  })

  // 构造一个最小 fixture 仓库，缺省值都是“干净的”，由各用例局部种入缺陷。
  function seedCleanRepo(root: string) {
    fs.mkdirSync(path.join(root, 'agents'), { recursive: true })
    fs.mkdirSync(path.join(root, 'skills', 'writing-plans'), { recursive: true })
    fs.mkdirSync(path.join(root, '.airules', 'knowledge', '架构'), { recursive: true })
    fs.mkdirSync(path.join(root, 'rules'), { recursive: true })
    for (const name of ['coder', 'debugger', 'consistency-reviewer', 'code-reviewer']) {
      fs.writeFileSync(path.join(root, 'agents', `${name}.md`), `---\nname: ${name}\n---\n\n## 加载 skill\n\n- \`writing-plans\`：x\n`)
    }
    // check #11：planner.md 必须包含 .airules/requirements/ 路径声明。
    fs.writeFileSync(
      path.join(root, 'agents', 'planner.md'),
      `---\nname: planner\n---\n\n## 加载 skill\n\n- \`writing-plans\`：x\n\n## 输入上下文包\n\n- 需求文档路径（\`.airules/requirements/<feature>.md\`）\n`,
    )
    // check #3 读 bundled constants/skills.ts 分发清单 → fixture 须备齐这些 skill 目录。
    for (const skill of firstPartySkillNames()) {
      fs.mkdirSync(path.join(root, 'skills', skill), { recursive: true })
    }
    // check #10：brainstorming/SKILL.md 必须声明需求落档路径。
    fs.writeFileSync(
      path.join(root, 'skills', 'brainstorming', 'SKILL.md'),
      '---\nname: brainstorming\n---\n\n落档路径（强制）：`.airules/requirements/<feature>.md`\n',
    )
    // check #12：writing-plans/SKILL.md 必须引用前后端参考文件。
    fs.writeFileSync(
      path.join(root, 'skills', 'writing-plans', 'SKILL.md'),
      '---\nname: writing-plans\n---\n\n加载 `writing-plans/references/frontend-plan.md`\n加载 `writing-plans/references/backend-plan.md`\n',
    )
    fs.writeFileSync(path.join(root, '.airules', 'knowledge', '架构', 'overview.md'), '质量门禁：lint:check / typecheck。\n')
    fs.mkdirSync(path.join(root, '.airules', 'knowledge', '架构', 'decisions'), { recursive: true })
    fs.writeFileSync(path.join(root, '.airules', 'knowledge', '架构', 'decisions', 'index.md'), '| ADR | 决策 |\n|---|---|\n')
    fs.writeFileSync(path.join(root, 'rules', 'AGENTS.md'), 'Consist -->|符合| Test\n')
    fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ scripts: { 'lint:check': 'x', 'typecheck': 'x' } }))
  }

  it('干净 fixture 通过', () => {
    withTempDir((root) => {
      seedCleanRepo(root)
      assert.deepEqual(checkRulesConsistency(root).errors, [])
    })
  })

  it('捕获：docs 残留旧 agent 名', () => {
    withTempDir((root) => {
      seedCleanRepo(root)
      fs.writeFileSync(path.join(root, '.airules', 'knowledge', '架构', 'agent-layer.md'), '本文档描述 frontend-planner 与 backend-coder。\n')
      const { errors } = checkRulesConsistency(root)
      assert.ok(errors.some(e => e.includes('frontend-planner')), errors.join('\n'))
    })
  })

  it('捕获：agent 引用不存在的 skill', () => {
    withTempDir((root) => {
      seedCleanRepo(root)
      fs.writeFileSync(path.join(root, 'agents', 'coder.md'), '---\nname: coder\n---\n\n## 加载 skill\n\n- \`nonexistent-skill\`：x\n')
      const { errors } = checkRulesConsistency(root)
      assert.ok(errors.some(e => e.includes('nonexistent-skill')), errors.join('\n'))
    })
  })

  it('捕获：overview 引用不存在的 npm script', () => {
    withTempDir((root) => {
      seedCleanRepo(root)
      fs.writeFileSync(path.join(root, '.airules', 'knowledge', '架构', 'overview.md'), '质量门禁跑 verify:knowledge-sources。\n')
      const { errors } = checkRulesConsistency(root)
      assert.ok(errors.some(e => e.includes('verify:knowledge-sources')), errors.join('\n'))
    })
  })

  it('捕获：rules 含旧时序边 Test -->|PASS| Consist', () => {
    withTempDir((root) => {
      seedCleanRepo(root)
      fs.writeFileSync(path.join(root, 'rules', 'AGENTS.md'), 'Test -->|PASS| Consist\n')
      const { errors } = checkRulesConsistency(root)
      assert.ok(errors.some(e => e.includes('旧时序边')), errors.join('\n'))
    })
  })

  it('捕获：skills 目录有 SKILL.md 但未登记 constants/skills.ts', () => {
    withTempDir((root) => {
      seedCleanRepo(root)
      const orphan = path.join(root, 'skills', 'unregistered-orphan-skill')
      fs.mkdirSync(orphan, { recursive: true })
      fs.writeFileSync(path.join(orphan, 'SKILL.md'), '---\nname: unregistered-orphan-skill\n---\n')
      const { errors } = checkRulesConsistency(root)
      assert.ok(errors.some(e => e.includes('unregistered-orphan-skill') && e.includes('未登记')), errors.join('\n'))
    })
  })

  it('捕获：ADR 文件未登记 decisions/index.md', () => {
    withTempDir((root) => {
      seedCleanRepo(root)
      fs.writeFileSync(
        path.join(root, '.airules', 'knowledge', '架构', 'decisions', 'ADR-0099-orphan.md'),
        '# ADR-0099 孤儿\n\n## 状态\n\naccepted\n',
      )
      const { errors } = checkRulesConsistency(root)
      assert.ok(errors.some(e => e.includes('ADR-0099-orphan.md') && e.includes('未登记')), errors.join('\n'))
    })
  })

  it('捕获：brainstorming 未声明需求落档路径', () => {
    withTempDir((root) => {
      seedCleanRepo(root)
      // 覆盖 brainstorming SKILL.md，故意去掉 .airules/requirements/ 引用
      fs.writeFileSync(
        path.join(root, 'skills', 'brainstorming', 'SKILL.md'),
        '---\nname: brainstorming\n---\n\n## 方法\n无需求路径声明\n',
      )
      const { errors } = checkRulesConsistency(root)
      assert.ok(errors.some(e => e.includes('.airules/requirements/')), errors.join('\n'))
    })
  })

  it('捕获：planner 输入包缺需求文档路径', () => {
    withTempDir((root) => {
      seedCleanRepo(root)
      // 覆盖 planner.md，移除需求文档路径声明
      fs.writeFileSync(
        path.join(root, 'agents', 'planner.md'),
        `---\nname: planner\n---\n\n## 加载 skill\n\n- \`writing-plans\`：x\n\n## 输入上下文包\n\n- 需求事实源\n`,
      )
      const { errors } = checkRulesConsistency(root)
      assert.ok(errors.some(e => e.includes('planner') && e.includes('.airules/requirements/')), errors.join('\n'))
    })
  })
})

// ── 2. spec 门禁行为：delta 存在性是唯一脚本门禁 ───────────────

describe('spec 门禁行为', () => {
  function runSpec(script: string, ...args: string[]) {
    return spawnSync(process.execPath, [path.join(specScriptsDir, script), ...args], { encoding: 'utf8' })
  }

  function newChange(root: string, id: string) {
    runSpec('spec-init.mjs', root)
    runSpec('spec-new-change.mjs', root, id)
  }

  function writeDelta(root: string, id: string, cap: string) {
    const dir = path.join(root, '.airules', 'changes', id, 'specs', cap)
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(path.join(dir, 'spec.md'), `## ADDED Requirements\n\n### Requirement: R\nThe system SHALL do x.\n\n#### Scenario: s\n- WHEN x\n- THEN y\n`)
  }

  it('空 delta archive 默认 FAIL，--allow-empty 放行', () => {
    withTempDir((root) => {
      newChange(root, 'empty')
      // 无 delta
      const fail = runSpec('spec-archive.mjs', root, 'empty')
      assert.notEqual(fail.status, 0)
      assert.match(fail.stdout, /无 delta spec/)

      const ok = runSpec('spec-archive.mjs', root, 'empty', '--allow-empty')
      assert.equal(ok.status, 0, ok.stdout)
    })
  })

  it('合法 delta → archive PASS（不再需要 proposal/tasks 文件）', () => {
    withTempDir((root) => {
      newChange(root, 'good')
      writeDelta(root, 'good', 'auth')
      const r = runSpec('spec-archive.mjs', root, 'good')
      assert.equal(r.status, 0, r.stdout)
      assert.equal(fs.existsSync(path.join(root, '.airules', 'specs', 'auth', 'spec.md')), true)
    })
  })
})

// ── 3. 红线文本断言 ──────────────────────────────────────────

describe('编排红线文本', () => {
  it('缺上游事实源 → coder/planner 含 MISSING blocked', () => {
    assert.match(read('agents/coder.md'), /MISSING blocked/)
    assert.match(read('agents/planner.md'), /MISSING blocked/)
  })

  it('未验证不得 PASS', () => {
    assert.match(read('rules/AGENTS.md'), /禁止在未读到实际结果前声称通过/)
  })

  it('reviewer ≠ coder 且不得自评', () => {
    assert.match(read('rules/AGENTS.md'), /reviewer ≠ coder/)
    assert.match(read('agents/code-reviewer.md'), /不得自评/)
  })

  it('一致性评审时序：编码后、测试验证前（图与文案一致）', () => {
    const rules = read('rules/AGENTS.md')
    assert.match(rules, /Consist -->\|符合\| Test/)
    assert.doesNotMatch(rules, /Test -->\|PASS\| Consist/)
    assert.match(read('agents/consistency-reviewer.md'), /编码后、测试验证前/)
    assert.match(read('skills/consistency-check/SKILL.md'), /编码后、测试验证前/)
  })

  it('回路熔断：Consist→Code 受 max_loop（不依赖 Test 兜底）', () => {
    const rules = read('rules/AGENTS.md')
    // 核心门禁第 9 条须显式纳入 Consist→Code 回路
    assert.match(rules, /Consist→Code/)
    // Mermaid 的"不符"回边须带回路计数标注，且有溢出到 Blocked 的边
    assert.match(rules, /Consist -->\|"不符 \(回路计数 < max_loop\)"\| Code/)
    assert.match(rules, /Consist -->\|"回路计数 ≥ max_loop"\| Blocked/)
  })

  it('requirement_mismatch 外层回路有独立熔断计数', () => {
    const rules = read('rules/AGENTS.md')
    assert.match(rules, /mismatch_loop/)
    // mismatch 分支回边须带计数标注
    assert.match(rules, /requirement_mismatch FAIL \(mismatch_loop < max\)/)
  })

  it('subagent fix→复审循环有界', () => {
    assert.match(read('skills/subagent-driven-development/SKILL.md'), /fix→复审循环上限/)
  })

  it('正式 memory 文件含 created_at 与 status frontmatter', () => {
    const memDir = path.join(repoRoot, '.airules', 'memory')
    if (!fs.existsSync(memDir)) {
      return
    }
    for (const entry of fs.readdirSync(memDir)) {
      if (!entry.endsWith('.md') || entry === 'MEMORY.md') {
        continue
      }
      const content = fs.readFileSync(path.join(memDir, entry), 'utf8')
      assert.match(content, /^\s*created_at:\s*\d{4}-\d{2}-\d{2}/m, `${entry} 缺 created_at`)
      assert.match(content, /^\s*status:\s*(active|superseded)/m, `${entry} 缺 status`)
    }
  })

  it('记忆进化闭环关键文本锚点存在', () => {
    const rules = read('rules/AGENTS.md')
    for (const anchor of ['boundary', 'superseded', '安全边界侵蚀', '库级健康复核']) {
      assert.ok(rules.includes(anchor), `rules/AGENTS.md 缺锚点：${anchor}`)
    }
  })

  it('test-design 测试用例必须落档到 .airules/tests/（不只停在对话里）', () => {
    const td = read('skills/test-design/SKILL.md')
    assert.match(td, /\.airules\/tests\//, 'test-design/SKILL.md 缺 .airules/tests/ 落档规则')
    assert.match(td, /coverage_status/, 'test-design/SKILL.md 缺 coverage_status 字段')
    assert.match(td, /task_id/, 'test-design/SKILL.md 缺 task_id 字段（用于任务反向引用）')
  })

  it('planner 同时产出任务文件与测试用例文件', () => {
    const planner = read('agents/planner.md')
    assert.match(planner, /\.airules\/tasks\//, 'agents/planner.md 缺任务落档规则')
    assert.match(planner, /\.airules\/tests\//, 'agents/planner.md 缺测试用例落档规则')
    assert.match(planner, /测试用例文件路径/, 'agents/planner.md 回传字段缺"测试用例文件路径"')
  })

  it('brainstorming 声明需求落档路径 .airules/requirements/', () => {
    assert.match(
      read('skills/brainstorming/SKILL.md'),
      /\.airules\/requirements\//,
      'skills/brainstorming/SKILL.md 未声明需求落档路径 .airules/requirements/（需求事实源必须落盘）',
    )
  })

  it('planner 接收需求文档路径（.airules/requirements/）', () => {
    assert.match(
      read('agents/planner.md'),
      /\.airules\/requirements\//,
      'agents/planner.md 输入上下文包未包含需求文档路径 .airules/requirements/（下游追溯链断裂）',
    )
  })

  it('writing-plans/SKILL.md 引用前后端计划参考文件', () => {
    const wp = read('skills/writing-plans/SKILL.md')
    assert.match(wp, /writing-plans\/references\/frontend-plan\.md/, 'skills/writing-plans/SKILL.md 未引用 frontend-plan.md')
    assert.match(wp, /writing-plans\/references\/backend-plan\.md/, 'skills/writing-plans/SKILL.md 未引用 backend-plan.md')
  })

  it('coder 输入包含测试用例文件（.airules/tests/）', () => {
    const coder = read('agents/coder.md')
    assert.match(coder, /\.airules\/tests\//, 'agents/coder.md 输入上下文包缺 .airules/tests/ 引用')
  })

  it('consistency-reviewer 输入包含 .airules/tests/ 测试用例文件引用', () => {
    const cr = read('agents/consistency-reviewer.md')
    assert.match(cr, /\.airules\/tests\//, 'agents/consistency-reviewer.md 缺 .airules/tests/ 引用')
  })

  it('subagent-driven-development 任务派发单位包含测试用例文件引用', () => {
    const sdd = read('skills/subagent-driven-development/SKILL.md')
    assert.match(sdd, /\.airules\/tests\//, 'subagent-driven-development/SKILL.md 任务派发缺 .airules/tests/ 引用')
    assert.match(sdd, /TC-id/, 'subagent-driven-development/SKILL.md 缺 TC-id 引用')
  })

  it('vendor/ 是 git-ignored 只读沙箱（不作为源资产纳入版本库）', () => {
    const r = spawnSync('git', ['check-ignore', 'vendor'], { cwd: repoRoot, encoding: 'utf8' })
    // git check-ignore 命中时 status 0 并回显路径；未命中 status 1。
    assert.equal(r.status, 0, 'vendor/ 应被 .gitignore 忽略')
    assert.match(r.stdout, /vendor/)
  })
})

// ── 4. 回路熔断承载 / blocked 消费 / 计数器契约 / 宿主目录 ──────

describe('回路熔断承载与 blocked 消费契约', () => {
  const agentFiles = ['planner', 'coder', 'debugger', 'consistency-reviewer', 'code-reviewer']

  it('第 9 条声明计数责任主体在主代理 + 账本承载（O-01）', () => {
    const rules = read('rules/AGENTS.md')
    assert.match(rules, /计数责任主体/)
    assert.match(rules, /派发 coder 前 MUST 先读账本计数/)
  })

  it('subagent-driven-development 账本有内层回路计数子节（O-01）', () => {
    const sdd = read('skills/subagent-driven-development/SKILL.md')
    assert.match(sdd, /内层回路计数账本/)
    assert.match(sdd, /LOOP-COUNTERS/)
  })

  it('rules blocked_id 定义含消费契约：产出方 + 消费方（O-02）', () => {
    assert.match(read('rules/AGENTS.md'), /消费契约/)
  })

  it('账本 blocked 条目结构化：affected_downstream + status（O-02）', () => {
    const sdd = read('skills/subagent-driven-development/SKILL.md')
    assert.match(sdd, /affected_downstream/)
    assert.match(sdd, /unblock_condition/)
    assert.match(sdd, /status:\s*open \| resolved/)
  })

  it('5 个 agent 输入上下文包均含"读账本→回执 BLOCKED"消费契约（O-02）', () => {
    for (const a of agentFiles) {
      assert.match(read(`agents/${a}.md`), /MUST 读进度账本/, `agents/${a}.md 缺读账本消费契约`)
      assert.match(read(`agents/${a}.md`), /affected_downstream/, `agents/${a}.md 缺 affected_downstream 判定`)
    }
  })

  it('三个出结论 agent 输出契约含 current_loop_id / current_iteration / recommended_next_action（O-03）', () => {
    for (const a of ['consistency-reviewer', 'code-reviewer', 'debugger']) {
      const content = read(`agents/${a}.md`)
      assert.match(content, /current_loop_id/, `agents/${a}.md 缺 current_loop_id`)
      assert.match(content, /current_iteration/, `agents/${a}.md 缺 current_iteration`)
      assert.match(content, /recommended_next_action/, `agents/${a}.md 缺 recommended_next_action`)
    }
  })

  it('code-reviewer 输出 should_increment_mismatch_loop 字段（O-03）', () => {
    assert.match(read('agents/code-reviewer.md'), /should_increment_mismatch_loop/)
  })

  it('项目级 skill 不得引用宿主全局目录：真实仓库经 check #9 验证（E-01）', () => {
    // 复用脚本作为唯一事实源，不在测试里重抄 walk/正则（避免与 check #9 漂移）。
    const hostDirErrors = checkRulesConsistency(repoRoot).errors.filter(e => /宿主全局目录/.test(e))
    assert.deepEqual(hostDirErrors, [], `这些项目级 skill 引用了宿主全局目录：\n${hostDirErrors.join('\n')}`)
  })

  it('check #9 能捕获种入宿主目录引用的 skill（E-01）', () => {
    withTempDir((root) => {
      const badSkill = path.join(root, 'skills', 'rogue-skill')
      fs.mkdirSync(badSkill, { recursive: true })
      fs.writeFileSync(path.join(badSkill, 'SKILL.md'), '---\nname: rogue-skill\n---\n安装到 ~/.qoder/skills 全局生效\n')
      const { errors } = checkRulesConsistency(root)
      assert.ok(errors.some(e => /宿主全局目录/.test(e)), `应捕获宿主目录引用，实际：\n${errors.join('\n')}`)
    })
  })

  it('rules scope 判定段含宿主目录文本锚点（E-01）', () => {
    assert.match(read('rules/AGENTS.md'), /项目级 skill 不得在安装脚本或 SKILL\.md 中引用宿主全局目录/)
  })

  it('会话自动记录 hook 脚本存在且容错（跨宿主分发能力）', () => {
    const script = read('hooks/session-log.mjs')
    // 永不阻断对话：异常吞掉、stdout 打合法 JSON 兼容 Codex/Cursor。
    assert.match(script, /process\.exit\(0\)/)
    assert.match(script, /process\.stdout\.write\('\{\}'\)/)
    // 跨宿主字段兜底：session_id（Claude/Codex/Qoder/Trae）与 conversation_id（Cursor）。
    assert.match(script, /conversation_id/)
    assert.match(script, /\.airules.+sessions.+auto|sessions', 'auto'/)
  })

  it('hook 投影覆盖 5 宿主（Claude/Codex/Qoder/Trae/Cursor）', () => {
    const hosts = read('constants/hosts.ts')
    // 五宿主各自声明 hooks 投影规格。
    for (const anchor of ['settings.json', 'config.toml', 'hooks.json']) {
      assert.ok(hosts.includes(anchor), `constants/hosts.ts 缺 hook 配置文件锚点：${anchor}`)
    }
    // Cursor 小写事件名 + 扁平嵌套；Codex TOML format。
    assert.match(hosts, /event: 'stop'/)
    assert.match(hosts, /nesting: 'flat'/)
  })
})
