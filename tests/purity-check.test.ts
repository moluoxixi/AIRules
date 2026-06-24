import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { it } from 'vitest'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '..')
const scriptPath = path.join(projectRoot, 'scripts', 'purity', 'purity-check.mjs')

function withTempRepo<T>(run: (repoRoot: string) => T): T {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'airules-purity-repo-'))

  try {
    fs.mkdirSync(path.join(repoRoot, 'skills', 'init-project', 'references', 'common'), { recursive: true })
    fs.mkdirSync(path.join(repoRoot, 'skills', 'demo-skill'), { recursive: true })
    fs.mkdirSync(path.join(repoRoot, 'scripts', 'purity'), { recursive: true })

    fs.writeFileSync(
      path.join(repoRoot, 'skills', 'init-project', 'references', 'common', 'control.md'),
      '# 控制规则\n\n- 纯净上下文只读取显式注入的规则。\n',
    )
    fs.writeFileSync(
      path.join(repoRoot, 'skills', 'demo-skill', 'SKILL.md'),
      [
        '---',
        'name: demo-skill',
        '---',
        '',
        '# Demo Skill',
        '',
        '## 触发条件',
        '- 被纯净校验点名时使用。',
        '',
        '## 不适合场景',
        '- 不作为自动触发 skill。',
        '',
        '## 输出边界',
        '- 只输出示例产物。',
        '',
      ].join('\n'),
    )
    fs.writeFileSync(
      path.join(repoRoot, 'scripts', 'purity', 'rubric.json'),
      `${JSON.stringify({
        skills: {
          'demo-skill': {
            minimalTask: '请输出 DEMO_RESULT。',
            assertions: [
              { id: 'demo-result', desc: '包含 DEMO_RESULT', anyOf: ['DEMO_RESULT'] },
            ],
          },
        },
      }, null, 2)}\n`,
    )

    return run(repoRoot)
  }
  finally {
    fs.rmSync(repoRoot, { recursive: true, force: true })
  }
}

it('purity-check assemble - 支持显式 --out 输出目录且不写默认 .purity-runs', () => withTempRepo((repoRoot) => {
  const outRoot = path.join(os.tmpdir(), `airules-purity-out-${Date.now()}`)

  try {
    const output = execFileSync(process.execPath, [scriptPath, 'demo-skill', '--out', outRoot], {
      cwd: repoRoot,
      encoding: 'utf8',
    })

    assert.match(output, /PASS 纯净包已组装/)
    assert.ok(fs.existsSync(path.join(outRoot, 'demo-skill', 'context.md')))
    assert.ok(fs.existsSync(path.join(outRoot, 'demo-skill', 'rubric.md')))
    assert.equal(fs.existsSync(path.join(repoRoot, '.purity-runs')), false)
  }
  finally {
    fs.rmSync(outRoot, { recursive: true, force: true })
  }
}))

it('purity-check assemble - 默认输出到系统临时目录且不写仓库 .purity-runs', () => withTempRepo((repoRoot) => {
  const defaultRunDir = path.join(os.tmpdir(), 'airules-purity-runs', 'demo-skill')

  try {
    fs.rmSync(defaultRunDir, { recursive: true, force: true })

    const output = execFileSync(process.execPath, [scriptPath, 'demo-skill'], {
      cwd: repoRoot,
      encoding: 'utf8',
    })

    assert.match(output, /PASS 纯净包已组装/)
    assert.ok(fs.existsSync(path.join(defaultRunDir, 'context.md')))
    assert.ok(fs.existsSync(path.join(defaultRunDir, 'rubric.md')))
    assert.equal(fs.existsSync(path.join(repoRoot, '.purity-runs')), false)
  }
  finally {
    fs.rmSync(defaultRunDir, { recursive: true, force: true })
  }
}))
