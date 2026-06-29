import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'vitest'
import { formatList, scanCandidates, validateCandidates } from '../scripts/review-candidates.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')
const cliScript = path.join(repoRoot, 'scripts', 'review-candidates.ts')

function withTempDir<T>(run: (tmpDir: string) => T): T {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'airules-cand-'))
  try {
    return run(tmpDir)
  }
  finally {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  }
}

/** 写一个 skill 候选 SKILL.md（kind=skill）。 */
function seedSkillCandidate(root: string, name: string, reviewStatus: string | null) {
  const dir = path.join(root, '.airules', 'skills-candidates', name)
  fs.mkdirSync(dir, { recursive: true })
  const fm = reviewStatus === null
    ? `---\nname: ${name}\ndescription: x\n---\n`
    : `---\nname: ${name}\ndescription: x\nreview_status: ${reviewStatus}\n---\n`
  fs.writeFileSync(path.join(dir, 'SKILL.md'), `${fm}\nPENDING_REVIEW 候选正文\n`)
}

/** 写一条记忆候选 <slug>.md（kind=memory）。 */
function seedMemoryCandidate(root: string, slug: string, reviewStatus: string | null) {
  const dir = path.join(root, '.airules', 'memory-candidates')
  fs.mkdirSync(dir, { recursive: true })
  const statusLine = reviewStatus === null ? '' : `review_status: ${reviewStatus}\n`
  const fm = `---\nname: ${slug}\ndescription: x\nmetadata:\n  type: decision\n  created_at: 2026-06-29\n  status: active\n${statusLine}---\n`
  fs.writeFileSync(path.join(dir, `${slug}.md`), `${fm}\nPENDING_REVIEW 事实正文\n`)
}

/** 写一个 frontmatter 未闭合的坏候选。 */
function seedBrokenFrontmatter(root: string, slug: string) {
  const dir = path.join(root, '.airules', 'memory-candidates')
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, `${slug}.md`), `---\nname: ${slug}\ndescription: 没有闭合分隔符\n`)
}

function runCli(subcommand: string, root: string) {
  return spawnSync(process.execPath, ['--import', 'tsx', cliScript, subcommand, root], { encoding: 'utf8' })
}

// ── A1：空 / 缺失候选目录 ───────────────────────────────────

describe('review-candidates · 空与缺失', () => {
  it('a1 缺失候选目录：scan 返回空、validate 通过', () => {
    withTempDir((root) => {
      const result = scanCandidates(root)
      assert.deepEqual(result, [])
      assert.deepEqual(validateCandidates(root).errors, [])
    })
  })

  it('a1 CLI list 缺目录：exit 0（pending 非错误）', () => {
    withTempDir((root) => {
      const r = runCli('list', root)
      assert.equal(r.status, 0, r.stderr)
    })
  })
})

// ── A2：list 分组 ──────────────────────────────────────────

describe('review-candidates · scan 分组', () => {
  it('a2 同时识别 skill 与 memory 候选及其状态', () => {
    withTempDir((root) => {
      seedSkillCandidate(root, 'do-thing', 'pending')
      seedMemoryCandidate(root, 'a-fact', 'approved')
      const result = scanCandidates(root)
      assert.equal(result.length, 2)
      const skill = result.find(c => c.kind === 'skill')
      const memory = result.find(c => c.kind === 'memory')
      assert.ok(skill, '应识别 skill 候选')
      assert.ok(memory, '应识别 memory 候选')
      assert.equal(skill!.name, 'do-thing')
      assert.equal(skill!.reviewStatus, 'pending')
      assert.equal(memory!.name, 'a-fact')
      assert.equal(memory!.reviewStatus, 'approved')
    })
  })
})

// ── A3–A6：validate 门禁 ───────────────────────────────────

describe('review-candidates · validate 门禁', () => {
  it('a3 候选缺 review_status → 报错且指明文件', () => {
    withTempDir((root) => {
      seedMemoryCandidate(root, 'no-status', null)
      const { errors } = validateCandidates(root)
      assert.equal(errors.length, 1)
      assert.match(errors[0], /no-status\.md/)
      assert.match(errors[0], /review_status/)
    })
  })

  it('a4 frontmatter 未闭合 → 报错', () => {
    withTempDir((root) => {
      seedBrokenFrontmatter(root, 'broken')
      const { errors } = validateCandidates(root)
      assert.equal(errors.length, 1)
      assert.match(errors[0], /broken\.md/)
    })
  })

  it('a5 全部合法 → 无错误', () => {
    withTempDir((root) => {
      seedSkillCandidate(root, 'ok-skill', 'pending')
      seedMemoryCandidate(root, 'ok-memory', 'rejected')
      assert.deepEqual(validateCandidates(root).errors, [])
    })
  })

  it('a6 review_status 非法枚举 → 报错', () => {
    withTempDir((root) => {
      seedMemoryCandidate(root, 'bad-enum', 'maybe')
      const { errors } = validateCandidates(root)
      assert.equal(errors.length, 1)
      assert.match(errors[0], /bad-enum\.md/)
      assert.match(errors[0], /maybe/)
    })
  })

  it('a6 CLI validate 命中非法 → exit 1', () => {
    withTempDir((root) => {
      seedMemoryCandidate(root, 'bad-enum', 'maybe')
      const r = runCli('validate', root)
      assert.equal(r.status, 1)
    })
  })

  it('a5 CLI validate 全合法 → exit 0', () => {
    withTempDir((root) => {
      seedSkillCandidate(root, 'ok-skill', 'approved')
      const r = runCli('validate', root)
      assert.equal(r.status, 0, r.stderr)
    })
  })
})

// ── formatList 分组（含 malformed catch-all，防止畸形候选从主视图消失）──────

describe('review-candidates · formatList 分组', () => {
  it('空候选 → 明确空提示', () => {
    assert.match(formatList([]), /候选区为空/)
  })

  it('pending 在前、按状态分组', () => {
    withTempDir((root) => {
      seedSkillCandidate(root, 'a-approved', 'approved')
      seedMemoryCandidate(root, 'b-pending', 'pending')
      const out = formatList(scanCandidates(root))
      assert.ok(out.indexOf('[pending]') < out.indexOf('[approved]'), 'pending 段应在 approved 段之前')
      assert.match(out, /a-approved/)
      assert.match(out, /b-pending/)
    })
  })

  it('非法枚举候选不被丢弃，归入 malformed 桶并附实际值', () => {
    withTempDir((root) => {
      seedMemoryCandidate(root, 'p1', 'pending')
      seedMemoryCandidate(root, 'bad', 'maybe')
      seedMemoryCandidate(root, 'no-status', null)
      const out = formatList(scanCandidates(root))
      // 三条都必须出现——bug 复现点：bad(maybe) 曾因既非已知状态也非 unknown 被 filter 丢弃。
      assert.match(out, /p1/)
      assert.match(out, /no-status/)
      assert.match(out, /\[malformed\]/)
      assert.match(out, /bad.*review_status=maybe/)
    })
  })
})

// ── CLI 其余分支 ──────────────────────────────────────────

describe('review-candidates · CLI 其余分支', () => {
  it('未知子命令 → exit 1', () => {
    withTempDir((root) => {
      const r = runCli('frobnicate', root)
      assert.equal(r.status, 1)
    })
  })

  it('help 子命令 → exit 0 且打印枚举', () => {
    withTempDir((root) => {
      const r = runCli('help', root)
      assert.equal(r.status, 0, r.stderr)
      assert.match(r.stdout, /review_status/)
    })
  })

  it('rEADME.md 不被当作候选（memory 排除 + skill 仅扫子目录）', () => {
    withTempDir((root) => {
      // 模拟脚手架：候选目录里只有 README，无真实候选。
      const memDir = path.join(root, '.airules', 'memory-candidates')
      const skDir = path.join(root, '.airules', 'skills-candidates')
      fs.mkdirSync(memDir, { recursive: true })
      fs.mkdirSync(skDir, { recursive: true })
      fs.writeFileSync(path.join(memDir, 'README.md'), '# 说明\n无 frontmatter\n')
      fs.writeFileSync(path.join(skDir, 'README.md'), '# 说明\n无 frontmatter\n')
      assert.deepEqual(scanCandidates(root), [], 'README 不应被识别为候选')
      assert.deepEqual(validateCandidates(root).errors, [], 'README 不应触发门禁')
    })
  })

  it('skill 候选目录缺 SKILL.md → 跳过', () => {
    withTempDir((root) => {
      fs.mkdirSync(path.join(root, '.airules', 'skills-candidates', 'empty-dir'), { recursive: true })
      assert.deepEqual(scanCandidates(root), [])
    })
  })
})
