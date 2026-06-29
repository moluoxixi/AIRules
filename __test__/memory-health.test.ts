import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'vitest'
import { auditMemory, formatAudit, formatList, scanMemory, validateMemory } from '../scripts/memory-health.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')
const cliScript = path.join(repoRoot, 'scripts', 'memory-health.ts')

function withTempDir<T>(run: (tmpDir: string) => T): T {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'airules-mem-'))
  try {
    return run(tmpDir)
  }
  finally {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  }
}

/** 写一条记忆 <slug>.md。opts 控制 frontmatter 与正文引用路径。 */
function seedMemory(root: string, slug: string, opts: {
  type?: string | null
  createdAt?: string | null
  status?: string | null
  body?: string
} = {}) {
  const dir = path.join(root, '.airules', 'memory')
  fs.mkdirSync(dir, { recursive: true })
  const lines = ['---', `name: ${slug}`, 'description: x', 'metadata:']
  if (opts.type !== null) {
    lines.push(`  type: ${opts.type ?? 'decision'}`)
  }
  if (opts.createdAt !== null) {
    lines.push(`  created_at: ${opts.createdAt ?? '2026-06-01'}`)
  }
  if (opts.status !== null) {
    lines.push(`  status: ${opts.status ?? 'active'}`)
  }
  lines.push('---', '', opts.body ?? '事实正文。')
  fs.writeFileSync(path.join(dir, `${slug}.md`), `${lines.join('\n')}\n`)
}

function runCli(subcommand: string, root: string, ...extra: string[]) {
  return spawnSync(process.execPath, ['--import', 'tsx', cliScript, subcommand, root, ...extra], { encoding: 'utf8' })
}

// ── B1：空 / 缺失 ──────────────────────────────────────────

describe('memory-health · 空与缺失', () => {
  it('b1 缺 memory 目录：scan 空、validate/audit 通过', () => {
    withTempDir((root) => {
      assert.deepEqual(scanMemory(root), [])
      assert.deepEqual(validateMemory(root).errors, [])
      assert.deepEqual(auditMemory(root, { ageDays: 180, now: new Date() }).findings, [])
    })
  })

  it('b1 CLI audit 缺目录 → exit 0', () => {
    withTempDir((root) => {
      assert.equal(runCli('audit', root).status, 0)
    })
  })
})

// ── B2–B5：validate schema 门禁 ───────────────────────────

describe('memory-health · validate schema 门禁', () => {
  it('b2 created_at 缺失 → 报错指明文件', () => {
    withTempDir((root) => {
      seedMemory(root, 'no-date', { createdAt: null })
      const { errors } = validateMemory(root)
      assert.equal(errors.length, 1)
      assert.match(errors[0], /no-date\.md/)
      assert.match(errors[0], /created_at/)
    })
  })

  it('b2 created_at 非法日期 → 报错', () => {
    withTempDir((root) => {
      seedMemory(root, 'bad-date', { createdAt: 'not-a-date' })
      const { errors } = validateMemory(root)
      assert.equal(errors.length, 1)
      assert.match(errors[0], /bad-date\.md/)
    })
  })

  it('b3 status 非法枚举 → 报错', () => {
    withTempDir((root) => {
      seedMemory(root, 'bad-status', { status: 'archived' })
      const { errors } = validateMemory(root)
      assert.equal(errors.length, 1)
      assert.match(errors[0], /bad-status\.md/)
      assert.match(errors[0], /archived/)
    })
  })

  it('b4 type 非法枚举 → 报错', () => {
    withTempDir((root) => {
      seedMemory(root, 'bad-type', { type: 'note' })
      const { errors } = validateMemory(root)
      assert.equal(errors.length, 1)
      assert.match(errors[0], /bad-type\.md/)
      assert.match(errors[0], /note/)
    })
  })

  it('b5 全合法 → 无错误', () => {
    withTempDir((root) => {
      seedMemory(root, 'ok1', { type: 'constraint', status: 'active', createdAt: '2026-06-01' })
      seedMemory(root, 'ok2', { type: 'boundary', status: 'superseded', createdAt: '2026-01-01' })
      assert.deepEqual(validateMemory(root).errors, [])
    })
  })
})

// ── B6–B9：audit staleness 信号 ───────────────────────────

describe('memory-health · audit staleness', () => {
  const now = new Date('2026-06-29')

  it('b6 active 记忆超龄 → 报告含该条（stale）', () => {
    withTempDir((root) => {
      seedMemory(root, 'old-fact', { createdAt: '2025-01-01', status: 'active' })
      const { findings } = auditMemory(root, { ageDays: 180, now })
      const f = findings.find(x => x.slug === 'old-fact')
      assert.ok(f, '应命中超龄记忆')
      assert.ok(f!.reasons.some(r => r.includes('stale')), `应标 stale，实际 ${f!.reasons}`)
    })
  })

  it('b7 正文反引号路径不存在 → 标 dangling', () => {
    withTempDir((root) => {
      seedMemory(root, 'dangling-ref', { createdAt: '2026-06-20', body: '见 `scripts/does-not-exist.ts` 的实现。' })
      const { findings } = auditMemory(root, { ageDays: 180, now })
      const f = findings.find(x => x.slug === 'dangling-ref')
      assert.ok(f, '应命中悬空引用')
      assert.ok(f!.reasons.some(r => r.includes('dangling')), `应标 dangling，实际 ${f!.reasons}`)
    })
  })

  it('b8 路径存在的新记忆 → 不误报', () => {
    withTempDir((root) => {
      // 引用真实存在的相对路径
      fs.mkdirSync(path.join(root, 'src'), { recursive: true })
      fs.writeFileSync(path.join(root, 'src', 'real.ts'), 'export const x = 1\n')
      seedMemory(root, 'fresh', { createdAt: '2026-06-20', body: '见 `src/real.ts`。' })
      const { findings } = auditMemory(root, { ageDays: 180, now })
      assert.equal(findings.find(x => x.slug === 'fresh'), undefined, '新且引用存在不应被标记')
    })
  })

  it('b9 superseded 默认不审', () => {
    withTempDir((root) => {
      seedMemory(root, 'old-superseded', { createdAt: '2024-01-01', status: 'superseded' })
      const { findings } = auditMemory(root, { ageDays: 180, now })
      assert.equal(findings.find(x => x.slug === 'old-superseded'), undefined, 'superseded 不进 audit')
    })
  })
})

// ── 边界保护哨兵：缺 active boundary/constraint → 软告警 ──────

describe('memory-health · 边界保护哨兵', () => {
  const now = new Date('2026-06-29')

  it('库中无 boundary/constraint → warnings 含「安全边界侵蚀保护未激活」', () => {
    withTempDir((root) => {
      seedMemory(root, 'just-a-fact', { type: 'reference', status: 'active', createdAt: '2026-06-20' })
      const { warnings } = auditMemory(root, { ageDays: 180, now })
      assert.ok(warnings.some(w => w.includes('安全边界侵蚀保护未激活')), `应告警，实际 ${JSON.stringify(warnings)}`)
    })
  })

  it('有 active boundary → 不告警', () => {
    withTempDir((root) => {
      seedMemory(root, 'a-boundary', { type: 'boundary', status: 'active', createdAt: '2026-06-20' })
      const { warnings } = auditMemory(root, { ageDays: 180, now })
      assert.equal(warnings.length, 0, `不应告警，实际 ${JSON.stringify(warnings)}`)
    })
  })

  it('有 active constraint → 不告警', () => {
    withTempDir((root) => {
      seedMemory(root, 'a-constraint', { type: 'constraint', status: 'active', createdAt: '2026-06-20' })
      assert.equal(auditMemory(root, { ageDays: 180, now }).warnings.length, 0)
    })
  })

  it('boundary 存在但被标 superseded → 仍告警（保护实际未激活）', () => {
    withTempDir((root) => {
      seedMemory(root, 'dead-boundary', { type: 'boundary', status: 'superseded', createdAt: '2026-06-20' })
      const { warnings } = auditMemory(root, { ageDays: 180, now })
      assert.ok(warnings.some(w => w.includes('未激活')), 'superseded boundary 不算激活')
    })
  })

  it('audit 命中哨兵不改 exit code（恒 0）', () => {
    withTempDir((root) => {
      seedMemory(root, 'just-a-fact', { type: 'reference', status: 'active', createdAt: '2026-06-20' })
      const r = runCli('audit', root)
      assert.equal(r.status, 0, 'audit 恒 exit 0，哨兵只是软告警')
      assert.match(r.stdout, /\[warn\].*未激活/)
    })
  })
})

// ── B10：CLI exit 语义 ─────────────────────────────────────

describe('memory-health · CLI', () => {
  it('b10 validate 命中违规 → exit 1', () => {
    withTempDir((root) => {
      seedMemory(root, 'bad', { status: 'archived' })
      assert.equal(runCli('validate', root).status, 1)
    })
  })

  it('b10 validate 全合法 → exit 0', () => {
    withTempDir((root) => {
      seedMemory(root, 'ok', {})
      assert.equal(runCli('validate', root).status, 0)
    })
  })

  it('b10 audit 恒 exit 0（软提示非门禁）', () => {
    withTempDir((root) => {
      seedMemory(root, 'old', { createdAt: '2024-01-01' })
      const r = runCli('audit', root)
      assert.equal(r.status, 0)
    })
  })

  it('audit --age-days 调阈值时仍正确解析 repo-root（flag 值不被误当路径）', () => {
    withTempDir((root) => {
      // 种一条 2 天龄记忆；--age-days 1 应命中。回归：曾把 "1" 误当 repo-root 扫不到记忆。
      const twoDaysAgo = new Date(Date.now() - 2 * 86_400_000).toISOString().slice(0, 10)
      seedMemory(root, 'recent', { createdAt: twoDaysAgo })
      const r = runCli('audit', root, '--age-days', '1')
      assert.equal(r.status, 0)
      assert.match(r.stdout, /recent/, 'flag 值后 repo-root 仍须被扫描到')
      assert.match(r.stdout, /stale/)
    })
  })

  it('未知子命令 → exit 1', () => {
    withTempDir((root) => {
      assert.equal(runCli('frobnicate', root).status, 1)
    })
  })

  it('help → exit 0', () => {
    withTempDir((root) => {
      const r = runCli('help', root)
      assert.equal(r.status, 0)
      assert.match(r.stdout, /memory:health/)
    })
  })
})

// ── formatAudit ───────────────────────────────────────────

describe('memory-health · formatAudit', () => {
  it('无 findings → 明确健康提示', () => {
    assert.match(formatAudit({ findings: [], warnings: [] }), /未发现/)
  })

  it('有 findings → 逐条列 slug 与原因', () => {
    const out = formatAudit({ findings: [{ slug: 'x', relPath: '.airules/memory/x.md', reasons: ['stale(400d>180d)'] }], warnings: [] })
    assert.match(out, /x\.md/)
    assert.match(out, /stale/)
  })

  it('有 warnings → 以 [warn] 前缀单独成段', () => {
    const out = formatAudit({ findings: [], warnings: ['当前项目未定义 active 的 boundary/constraint 记忆，安全边界侵蚀保护未激活'] })
    assert.match(out, /\[warn\]/)
    assert.match(out, /安全边界侵蚀保护未激活/)
  })
})

// ── parseFrontmatter 嵌套状态机（经 scanMemory 间接验证）──────

describe('memory-health · frontmatter 嵌套解析', () => {
  /** 直接写原始文件内容，绕过 seedMemory 的规整结构，探边界。 */
  function writeRaw(root: string, name: string, content: string) {
    const dir = path.join(root, '.airules', 'memory')
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(path.join(dir, name), content)
  }

  it('metadata 块后再现顶层键 → inMetadata 复位，块后缩进行被丢弃', () => {
    withTempDir((root) => {
      // description 在 metadata 块之后；其后一行孤立缩进不应污染 metadata。
      writeRaw(root, 'mixed.md', '---\nname: mixed\nmetadata:\n  type: gotcha\n  created_at: 2026-06-01\n  status: active\ndescription: 顶层键复位\n  orphan: 应被丢弃\n---\n\n正文\n')
      const m = scanMemory(root).find(x => x.slug === 'mixed')
      assert.ok(m)
      assert.equal(m!.type, 'gotcha', 'metadata.type 应正确解析')
      assert.equal(m!.status, 'active', 'description 顶层键应复位 inMetadata，不吞后续')
      assert.deepEqual(validateMemory(root).errors, [], '合法 frontmatter 不应报错')
    })
  })

  it('frontmatter 缺闭合 --- → validate 报无法解析', () => {
    withTempDir((root) => {
      writeRaw(root, 'unclosed.md', '---\nname: unclosed\nmetadata:\n  type: decision\n')
      const { errors } = validateMemory(root)
      assert.equal(errors.length, 1)
      assert.match(errors[0], /unclosed\.md/)
      assert.match(errors[0], /无法解析/)
    })
  })

  it('created_at 日历溢出（2026-02-30）→ validate 拒绝', () => {
    withTempDir((root) => {
      seedMemory(root, 'overflow', { createdAt: '2026-02-30' })
      const { errors } = validateMemory(root)
      assert.ok(errors.some(e => e.includes('overflow.md') && e.includes('created_at')), `日历溢出应被拒，实际 ${errors}`)
    })
  })
})

// ── formatList 分组（含 malformed catch-all）────────────────

describe('memory-health · formatList', () => {
  it('空库 → 明确空提示', () => {
    assert.match(formatList([]), /记忆库为空/)
  })

  it('active 在前、按 status 分组', () => {
    withTempDir((root) => {
      seedMemory(root, 'a-act', { status: 'active' })
      seedMemory(root, 'b-sup', { status: 'superseded' })
      const out = formatList(scanMemory(root))
      assert.ok(out.indexOf('[active]') < out.indexOf('[superseded]'), 'active 段应在 superseded 之前')
      assert.match(out, /a-act/)
      assert.match(out, /b-sup/)
    })
  })

  it('非法 status 不被丢弃，归入 malformed 桶并附实际值', () => {
    withTempDir((root) => {
      seedMemory(root, 'ok', { status: 'active' })
      seedMemory(root, 'weird', { status: 'archived' })
      const out = formatList(scanMemory(root))
      assert.match(out, /ok/)
      assert.match(out, /\[malformed\]/)
      assert.match(out, /weird.*!status=archived/)
    })
  })
})

// ── referencedPaths 误报规避（经 audit 间接验证）─────────────

describe('memory-health · 引用提取不误报', () => {
  const now = new Date('2026-06-29')

  it('反引号包裹的非路径 token（无斜杠/无扩展名）不触发 dangling', () => {
    withTempDir((root) => {
      seedMemory(root, 'prose', { createdAt: '2026-06-20', body: '用 `npm run build` 跑构建，调用 `someFunction`，环境变量 `DB_PASSWORD`。' })
      const f = auditMemory(root, { ageDays: 180, now }).findings.find(x => x.slug === 'prose')
      assert.equal(f, undefined, '命令/函数名/标志不应被当路径误报')
    })
  })
})
