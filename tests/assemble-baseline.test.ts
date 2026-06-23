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
const scriptPath = path.join(projectRoot, 'scripts', 'assemble-baseline.mjs')

/** 在临时目录构造最小 rules/sources 与 skills 结构，脚本以 cwd 为 repoRoot 运行。 */
function withTempRepo(run: (root: string) => void) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'airules-assemble-'))
  try {
    fs.mkdirSync(path.join(root, 'rules', 'sources'), { recursive: true })
    fs.writeFileSync(
      path.join(root, 'rules', 'sources', '10-core.md'),
      ['---', 'description: core', '---', '## 核心', '- 一条规则。'].join('\n'),
    )
    return run(root)
  }
  finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
}

function writeSkill(root: string, name: string, description: string | null) {
  const dir = path.join(root, 'skills', name)
  fs.mkdirSync(dir, { recursive: true })
  const fm = description === null
    ? ['---', `name: ${name}`, '---']
    : ['---', `name: ${name}`, `description: ${description}`, '---']
  fs.writeFileSync(path.join(dir, 'SKILL.md'), [...fm, `# ${name}`, '正文。'].join('\n'))
}

function runBuild(root: string) {
  return execFileSync(process.execPath, [scriptPath], { cwd: root, encoding: 'utf8' })
}

function runBuildResult(root: string) {
  return spawnSync(process.execPath, [scriptPath], { cwd: root, encoding: 'utf8' })
}

it('assemble-baseline - 生成 Skill 触发索引并列出所有带 description 的 skill', () => withTempRepo((root) => {
  writeSkill(root, 'alpha-skill', '当用户要做 alpha 时使用。')
  writeSkill(root, 'beta-skill', '当用户要做 beta 时使用。')

  runBuild(root)
  const baseline = fs.readFileSync(path.join(root, 'rules', 'AGENTS.md'), 'utf8')

  assert.match(baseline, /## Skill 触发索引/)
  assert.match(baseline, /\| `alpha-skill` \| 当用户要做 alpha 时使用。 \|/)
  assert.match(baseline, /\| `beta-skill` \| 当用户要做 beta 时使用。 \|/)
  // 核心规则段仍在，索引追加在末尾。
  assert.match(baseline, /## 核心/)
  assert.ok(
    baseline.indexOf('## 核心') < baseline.indexOf('## Skill 触发索引'),
    '索引应追加在规则段之后',
  )
}))

it('assemble-baseline - 缺 description 的 skill 被过滤，不报错且不进索引', () => withTempRepo((root) => {
  writeSkill(root, 'good-skill', '当用户要做 good 时使用。')
  writeSkill(root, 'no-desc-skill', null)

  const result = runBuildResult(root)

  assert.equal(result.status, 0, '缺 description 不应导致构建失败')
  const baseline = fs.readFileSync(path.join(root, 'rules', 'AGENTS.md'), 'utf8')
  assert.match(baseline, /\| `good-skill` \|/)
  assert.doesNotMatch(baseline, /no-desc-skill/, '缺 description 的 skill 应被过滤')
}))

it('assemble-baseline - 无 skills 目录时只生成规则段，不报错', () => withTempRepo((root) => {
  runBuild(root)
  const baseline = fs.readFileSync(path.join(root, 'rules', 'AGENTS.md'), 'utf8')

  assert.match(baseline, /## 核心/)
  assert.doesNotMatch(baseline, /## Skill 触发索引/)
}))

it('assemble-baseline - 当前仓库 baseline 与源一致（含 skill 索引防漂移）', () => {
  const output = execFileSync(process.execPath, [scriptPath, '--check'], {
    cwd: projectRoot,
    encoding: 'utf8',
  })
  assert.match(output, /PASS assemble-baseline/)
})
