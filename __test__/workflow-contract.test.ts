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
    fs.mkdirSync(path.join(root, 'docs', 'architecture'), { recursive: true })
    fs.mkdirSync(path.join(root, 'rules'), { recursive: true })
    for (const name of ['planner', 'coder', 'debugger', 'consistency-reviewer', 'code-reviewer']) {
      fs.writeFileSync(path.join(root, 'agents', `${name}.md`), `---\nname: ${name}\n---\n\n## 加载 skill\n\n- \`writing-plans\`：x\n`)
    }
    // check #3 读 bundled constants/skills.ts 分发清单 → fixture 须备齐这些 skill 目录。
    for (const skill of firstPartySkillNames()) {
      fs.mkdirSync(path.join(root, 'skills', skill), { recursive: true })
    }
    fs.writeFileSync(path.join(root, 'skills', 'writing-plans', 'SKILL.md'), '---\nname: writing-plans\n---\n')
    fs.writeFileSync(path.join(root, 'docs', 'architecture', 'overview.md'), '质量门禁：lint:check / typecheck。\n')
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
      fs.writeFileSync(path.join(root, 'docs', 'architecture', 'agent-layer.md'), '本文档描述 frontend-planner 与 backend-coder。\n')
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
      fs.writeFileSync(path.join(root, 'docs', 'architecture', 'overview.md'), '质量门禁跑 verify:knowledge-sources。\n')
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
})

// ── 2. spec 门禁行为：≥4 类负例 ──────────────────────────────

describe('spec 门禁行为', () => {
  function runSpec(script: string, ...args: string[]) {
    return spawnSync(process.execPath, [path.join(specScriptsDir, script), ...args], { encoding: 'utf8' })
  }

  function newChange(root: string, id: string) {
    runSpec('spec-init.mjs', root)
    runSpec('spec-new-change.mjs', root, id)
  }

  function writeProposal(root: string, id: string, why: string, what: string) {
    fs.writeFileSync(
      path.join(root, '.airules', 'changes', id, 'proposal.md'),
      `## Why\n\n${why}\n\n## What Changes\n\n${what}\n\n## Impact\n\n无。\n`,
    )
  }

  function writeTasks(root: string, id: string, body: string) {
    fs.writeFileSync(path.join(root, '.airules', 'changes', id, 'tasks.md'), body)
  }

  function writeDelta(root: string, id: string, cap: string) {
    const dir = path.join(root, '.airules', 'changes', id, 'specs', cap)
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(path.join(dir, 'spec.md'), `## ADDED Requirements\n\n### Requirement: R\nThe system SHALL do x.\n\n#### Scenario: s\n- WHEN x\n- THEN y\n`)
  }

  it('空 delta archive 默认 FAIL，--allow-empty 放行', () => {
    withTempDir((root) => {
      newChange(root, 'empty')
      writeProposal(root, 'empty', '动机。', '- 变更点')
      writeTasks(root, 'empty', '## 1. 组\n\n- [x] 1.1 完成\n')
      // 无 delta
      const fail = runSpec('spec-archive.mjs', root, 'empty')
      assert.notEqual(fail.status, 0)
      assert.match(fail.stdout, /无 delta spec/)

      const ok = runSpec('spec-archive.mjs', root, 'empty', '--allow-empty')
      assert.equal(ok.status, 0, ok.stdout)
    })
  })

  it('proposal 空 Why → validate FAIL', () => {
    withTempDir((root) => {
      newChange(root, 'emptywhy')
      // proposal 用 spec-new-change 模板（Why 仅注释，空），但写有效 tasks + delta
      writeTasks(root, 'emptywhy', '## 1. 组\n\n- [x] 1.1 完成\n')
      writeDelta(root, 'emptywhy', 'auth')
      const r = runSpec('spec-validate.mjs', root, 'emptywhy')
      assert.notEqual(r.status, 0)
      assert.match(r.stdout, /## Why 为空/)
    })
  })

  it('tasks 未全部完成 → archive FAIL，--allow-incomplete 放行', () => {
    withTempDir((root) => {
      newChange(root, 'incomplete')
      writeProposal(root, 'incomplete', '动机。', '- 变更点')
      writeTasks(root, 'incomplete', '## 1. 组\n\n- [x] 1.1 完成\n- [ ] 1.2 未完成\n')
      writeDelta(root, 'incomplete', 'auth')
      const fail = runSpec('spec-archive.mjs', root, 'incomplete')
      assert.notEqual(fail.status, 0)
      assert.match(fail.stdout, /tasks 未全部完成/)

      const ok = runSpec('spec-archive.mjs', root, 'incomplete', '--allow-incomplete')
      assert.equal(ok.status, 0, ok.stdout)
    })
  })

  it('合法完整 change → archive PASS', () => {
    withTempDir((root) => {
      newChange(root, 'good')
      writeProposal(root, 'good', '动机。', '- 变更点')
      writeTasks(root, 'good', '## 1. 组\n\n- [x] 1.1 完成\n')
      writeDelta(root, 'good', 'auth')
      const r = runSpec('spec-archive.mjs', root, 'good')
      assert.equal(r.status, 0, r.stdout)
      assert.equal(fs.existsSync(path.join(root, '.airules', 'specs', 'auth', 'spec.md')), true)
    })
  })

  // ── flag 语义隔离：例外参数只跳过自身门禁，不绕过其它门禁 ──

  it('archive --allow-empty 跳过 delta，但 proposal 空仍 FAIL', () => {
    withTempDir((root) => {
      newChange(root, 'ae-emptywhy')
      // proposal 用模板（Why 空），有效 tasks，无 delta
      writeTasks(root, 'ae-emptywhy', '## 1. 组\n\n- [x] 1.1 完成\n')
      const r = runSpec('spec-archive.mjs', root, 'ae-emptywhy', '--allow-empty')
      assert.notEqual(r.status, 0, r.stdout)
      assert.match(r.stdout, /Why/)
      assert.doesNotMatch(r.stdout, /无 delta spec/)
    })
  })

  it('archive --allow-empty 跳过 delta，但 tasks 缺失仍 FAIL', () => {
    withTempDir((root) => {
      newChange(root, 'ae-notasks')
      writeProposal(root, 'ae-notasks', '动机。', '- 变更点')
      // tasks 用模板（无任务项），无 delta
      const r = runSpec('spec-archive.mjs', root, 'ae-notasks', '--allow-empty')
      assert.notEqual(r.status, 0, r.stdout)
      assert.doesNotMatch(r.stdout, /无 delta spec/)
    })
  })

  it('archive --allow-incomplete 跳过 tasks，但 delta 缺失仍 FAIL', () => {
    withTempDir((root) => {
      newChange(root, 'ai-nodelta')
      writeProposal(root, 'ai-nodelta', '动机。', '- 变更点')
      writeTasks(root, 'ai-nodelta', '## 1. 组\n\n- [x] 1.1 完成\n- [ ] 1.2 未完成\n')
      // 无 delta
      const r = runSpec('spec-archive.mjs', root, 'ai-nodelta', '--allow-incomplete')
      assert.notEqual(r.status, 0, r.stdout)
      assert.match(r.stdout, /无 delta spec/)
    })
  })

  it('validate --allow-empty 跳过 delta 数量，但 proposal 空仍 FAIL', () => {
    withTempDir((root) => {
      newChange(root, 've-emptywhy')
      // proposal 用模板（Why 空），有效 tasks，无 delta
      writeTasks(root, 've-emptywhy', '## 1. 组\n\n- [x] 1.1 完成\n')
      const r = runSpec('spec-validate.mjs', root, 've-emptywhy', '--allow-empty')
      assert.notEqual(r.status, 0, r.stdout)
      assert.match(r.stdout, /## Why 为空/)
      assert.doesNotMatch(r.stdout, /无 delta spec/)
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
})
