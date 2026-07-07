import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'vitest'
import { vendors as openspecDevelopmentVendors } from '../roles/openspec-development/constants/skills.js'
import { vendors as productVendors } from '../roles/product/constants/skills.js'
import { vendors as speckitDevelopmentVendors } from '../roles/speckit-development/constants/skills.js'
import { checkRulesConsistency, firstPartySkillNames } from '../scripts/check-rules-consistency.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')
const OPENSPEC_DEVELOPMENT_SKILLS = ['frontend-testing', 'handoff', 'init-project']
const SPECKIT_DEVELOPMENT_SKILLS = ['init-project']
const PRODUCT_SKILLS = ['init-project']
const ECC_DEVELOPMENT_ROLE = 'ecc-development'
const OPENSPEC_DEVELOPMENT_ROLE = 'openspec-development'
const SPECKIT_DEVELOPMENT_ROLE = 'speckit-development'

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
    fs.mkdirSync(path.join(root, 'roles', SPECKIT_DEVELOPMENT_ROLE, 'constants'), { recursive: true })
    fs.mkdirSync(path.join(root, 'knowledge', '架构'), { recursive: true })
    fs.mkdirSync(path.join(root, 'roles', SPECKIT_DEVELOPMENT_ROLE, 'rules'), { recursive: true })
    fs.writeFileSync(
      path.join(root, 'roles', SPECKIT_DEVELOPMENT_ROLE, 'constants', 'skills.ts'),
      'export const vendors = []\n',
    )
    fs.mkdirSync(path.join(root, 'roles', SPECKIT_DEVELOPMENT_ROLE, 'skills', 'init-project'), { recursive: true })
    fs.writeFileSync(path.join(root, 'roles', SPECKIT_DEVELOPMENT_ROLE, 'skills', 'init-project', 'SKILL.md'), '---\nname: init-project\ndescription: fixture\n---\n')
    fs.writeFileSync(path.join(root, 'knowledge', '架构', 'overview.md'), '质量门禁：lint:check / typecheck。\n')
    fs.mkdirSync(path.join(root, 'knowledge', '架构', 'decisions'), { recursive: true })
    fs.writeFileSync(path.join(root, 'knowledge', '架构', 'decisions', 'index.md'), '| ADR | 决策 |\n|---|---|\n')
    fs.writeFileSync(path.join(root, 'roles', SPECKIT_DEVELOPMENT_ROLE, 'rules', 'AGENTS.md'), '')
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
      fs.writeFileSync(path.join(root, 'knowledge', '架构', 'agent-layer.md'), '本文档描述 frontend-planner 与 backend-coder。\n')
      const { errors } = checkRulesConsistency(root)
      assert.ok(errors.some(e => e.includes('frontend-planner')), errors.join('\n'))
    })
  })

  it('捕获：agent 引用不存在的 skill', () => {
    withTempDir((root) => {
      seedCleanRepo(root)
      fs.mkdirSync(path.join(root, 'roles', SPECKIT_DEVELOPMENT_ROLE, 'agents'), { recursive: true })
      fs.writeFileSync(path.join(root, 'roles', SPECKIT_DEVELOPMENT_ROLE, 'agents', 'coder.md'), '---\nname: coder\n---\n\n## 加载 skill\n\n- \`nonexistent-skill\`：x\n')
      const { errors } = checkRulesConsistency(root)
      assert.ok(errors.some(e => e.includes('nonexistent-skill')), errors.join('\n'))
    })
  })

  it('捕获：overview 引用不存在的 npm script', () => {
    withTempDir((root) => {
      seedCleanRepo(root)
      fs.writeFileSync(path.join(root, 'knowledge', '架构', 'overview.md'), '质量门禁跑 verify:knowledge-sources。\n')
      const { errors } = checkRulesConsistency(root)
      assert.ok(errors.some(e => e.includes('verify:knowledge-sources')), errors.join('\n'))
    })
  })

  it('捕获：skills 目录有 SKILL.md 但未登记 role constants/skills.ts', () => {
    withTempDir((root) => {
      seedCleanRepo(root)
      const orphan = path.join(root, 'roles', SPECKIT_DEVELOPMENT_ROLE, 'skills', 'unregistered-orphan-skill')
      fs.mkdirSync(orphan, { recursive: true })
      fs.writeFileSync(path.join(orphan, 'SKILL.md'), '---\nname: unregistered-orphan-skill\n---\n')
      const { errors } = checkRulesConsistency(root)
      assert.ok(errors.some(e => e.includes('unregistered-orphan-skill') && e.includes('未登记')), errors.join('\n'))
    })
  })

  it('捕获：ecc-development 角色下有 SKILL.md 但未登记 role constants/skills.ts', () => {
    withTempDir((root) => {
      seedCleanRepo(root)
      const orphan = path.join(root, 'roles', ECC_DEVELOPMENT_ROLE, 'skills', 'unregistered-ecc-skill')
      fs.mkdirSync(path.join(root, 'roles', ECC_DEVELOPMENT_ROLE, 'constants'), { recursive: true })
      fs.writeFileSync(
        path.join(root, 'roles', ECC_DEVELOPMENT_ROLE, 'constants', 'skills.ts'),
        'export const vendors = []\n',
      )
      fs.mkdirSync(orphan, { recursive: true })
      fs.writeFileSync(path.join(orphan, 'SKILL.md'), '---\nname: unregistered-ecc-skill\n---\n')
      const { errors } = checkRulesConsistency(root)
      assert.ok(errors.some(e => e.includes('unregistered-ecc-skill') && e.includes(ECC_DEVELOPMENT_ROLE)), errors.join('\n'))
    })
  })

  it('捕获：ADR 文件未登记 decisions/index.md', () => {
    withTempDir((root) => {
      seedCleanRepo(root)
      fs.writeFileSync(
        path.join(root, 'knowledge', '架构', 'decisions', 'ADR-0099-orphan.md'),
        '# ADR-0099 孤儿\n\n## 状态\n\naccepted\n',
      )
      const { errors } = checkRulesConsistency(root)
      assert.ok(errors.some(e => e.includes('ADR-0099-orphan.md') && e.includes('未登记')), errors.join('\n'))
    })
  })
})
// ── 2. 红线文本断言 ──────────────────────────────────────────

describe('编排红线文本', () => {
  it('speckit-development agents 目录允许清空', () => {
    const agentsDir = path.join(repoRoot, 'roles', SPECKIT_DEVELOPMENT_ROLE, 'agents')
    const entries = fs.existsSync(agentsDir) ? fs.readdirSync(agentsDir) : []
    assert.deepEqual(entries, [])
  })

  it('speckit-development role 只登记轻量 init-project 一方 skill', () => {
    assert.deepEqual(firstPartySkillNames(speckitDevelopmentVendors).sort(), SPECKIT_DEVELOPMENT_SKILLS)
  })

  it('speckit-development role 使用社区 bridge 作为默认实现入口', () => {
    const roleReadme = fs.readFileSync(path.join(repoRoot, 'roles', SPECKIT_DEVELOPMENT_ROLE, 'README.md'), 'utf8')
    const initSkill = fs.readFileSync(path.join(repoRoot, 'roles', SPECKIT_DEVELOPMENT_ROLE, 'skills', 'init-project', 'SKILL.md'), 'utf8')
    const rootReadme = read('README.md')
    const rootReadmeZh = read('README-zh.md')

    assert.match(roleReadme, /https:\/\/github\.com\/lihan3238\/speckit-superpowers-bridge/)
    assert.match(roleReadme, /specify extension add speckit-superpowers-bridge/)
    assert.match(roleReadme, /\$speckit-superpowers-bridge/)
    assert.doesNotMatch(roleReadme, /社区检索未发现/)
    assert.match(initSkill, /specify init <project> --integration <integration>/)
    assert.match(initSkill, /specify extension add speckit-superpowers-bridge/)
    assert.match(initSkill, /不写 `openspec\/schemas\/\*\*`/)
    assert.match(initSkill, /不设置 `schema: superpowers-bridge`/)
    assert.doesNotMatch(initSkill, /spec-init\.mjs/)
    assert.doesNotMatch(initSkill, /openspec schema validate/)
    assert.match(rootReadme, /lihan3238\/speckit-superpowers-bridge/)
    assert.match(rootReadmeZh, /lihan3238\/speckit-superpowers-bridge/)
  })

  it('openspec-development role 只登记保留的一方 skills', () => {
    assert.deepEqual(firstPartySkillNames(openspecDevelopmentVendors).sort(), OPENSPEC_DEVELOPMENT_SKILLS)
  })

  it('product role 一方只登记 init-project', () => {
    assert.deepEqual(firstPartySkillNames(productVendors).sort(), PRODUCT_SKILLS)
  })

  it('ecc-development role 接入 ECC 并保留为空第一方 role', async () => {
    const roleReadmePath = path.join(repoRoot, 'roles', ECC_DEVELOPMENT_ROLE, 'README.md')
    const roleManifestPath = path.join(repoRoot, 'roles', ECC_DEVELOPMENT_ROLE, 'constants', 'skills.ts')
    const pkg = JSON.parse(read('package.json')) as { scripts: Record<string, string> }

    assert.equal(fs.existsSync(roleReadmePath), true)
    assert.equal(fs.existsSync(roleManifestPath), true)
    assert.equal(pkg.scripts['sync:ecc-development'], `tsx scripts/cli.ts sync --host all --role ${ECC_DEVELOPMENT_ROLE}`)

    const roleReadme = fs.readFileSync(roleReadmePath, 'utf8')
    assert.match(roleReadme, /https:\/\/github\.com\/affaan-m\/ECC\/issues\/2283/)
    assert.match(roleReadme, /https:\/\/github\.com\/affaan-m\/ECC\/pull\/2318/)
    assert.match(roleReadme, /npx -y --package ecc-universal ecc install/)
    assert.match(roleReadme, /Qoder.*AIRules/s)
    for (const host of ['Codex', 'Claude', 'Qoder', 'OpenCode']) {
      assert.match(roleReadme, new RegExp(host, 'i'))
    }

    const { vendors } = await import('../roles/ecc-development/constants/skills.js')
    assert.deepEqual(firstPartySkillNames(vendors).sort(), [])
  })

  it('skill 分发清单只存在于 role constants/skills.ts', () => {
    assert.equal(fs.existsSync(path.join(repoRoot, 'constants', 'skills.ts')), false)
    assert.equal(fs.existsSync(path.join(repoRoot, 'roles', SPECKIT_DEVELOPMENT_ROLE, 'constants', 'skills.ts')), true)
    assert.equal(fs.existsSync(path.join(repoRoot, 'roles', OPENSPEC_DEVELOPMENT_ROLE, 'constants', 'skills.ts')), true)
    assert.equal(fs.existsSync(path.join(repoRoot, 'roles', 'product', 'constants', 'skills.ts')), true)
    assert.equal(fs.existsSync(path.join(repoRoot, 'roles', ECC_DEVELOPMENT_ROLE, 'constants', 'skills.ts')), true)
    assert.equal(fs.existsSync(path.join(repoRoot, 'roles', SPECKIT_DEVELOPMENT_ROLE, 'constants', 'skills.md')), false)
    assert.equal(fs.existsSync(path.join(repoRoot, 'roles', OPENSPEC_DEVELOPMENT_ROLE, 'constants', 'skills.md')), false)
    assert.equal(fs.existsSync(path.join(repoRoot, 'roles', 'product', 'constants', 'skills.md')), false)
    assert.equal(fs.existsSync(path.join(repoRoot, 'roles', ECC_DEVELOPMENT_ROLE, 'constants', 'skills.md')), false)
  })

  it('speckit-development role 仅保留空 rules baseline 占位', () => {
    const rulesPath = path.join(repoRoot, 'roles', SPECKIT_DEVELOPMENT_ROLE, 'rules', 'AGENTS.md')
    assert.equal(fs.existsSync(rulesPath), true)
    assert.equal(fs.readFileSync(rulesPath, 'utf8'), '')
  })

  it('repo-maintenance 测试用例 ID 纪律指向 knowledge/测试', () => {
    const rootRules = read('AGENTS.md')

    assert.match(rootRules, /TC-<模块>-<序号>/)
    assert.match(rootRules, /knowledge\/测试\/<模块>\.md/)
    assert.doesNotMatch(rootRules, /docs\/test\/<模块>\.md/)
  })

  it('init-project 只保留规则注入、Claude 链接与 OpenSpec schema 初始化脚本', () => {
    const scriptsDir = path.join(repoRoot, 'roles', OPENSPEC_DEVELOPMENT_ROLE, 'skills', 'init-project', 'scripts')
    assert.deepEqual(fs.readdirSync(scriptsDir).sort(), [
      'inject-rules.mjs',
      'link-claude.mjs',
      'spec-init.mjs',
    ])
  })

  it('init-project references 注入下游测试用例 ID 纪律', () => {
    const referencesDir = path.join(repoRoot, 'roles', OPENSPEC_DEVELOPMENT_ROLE, 'skills', 'init-project', 'references')
    const baseRules = fs.readFileSync(path.join(referencesDir, 'airules-base.md'), 'utf8')

    assert.deepEqual(fs.readdirSync(referencesDir).sort(), ['airules-base.md'])
    assert.match(baseRules, /TC-<模块>-<序号>/)
    assert.match(baseRules, /knowledge\/测试\/<模块>\.md/)
    assert.match(baseRules, /covers: SCN-<capability>-<NNN>/)
    assert.doesNotMatch(baseRules, /docs\/test\/<模块>\.md/)
  })

  it('正式 memory 文件含 created_at 与 status frontmatter', () => {
    const memDir = path.join(repoRoot, 'knowledge', 'memory')
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

  it('vendor/ 是 git-ignored 只读沙箱（不作为源资产纳入版本库）', () => {
    const r = spawnSync('git', ['check-ignore', 'vendor'], { cwd: repoRoot, encoding: 'utf8' })
    // git check-ignore 命中时 status 0 并回显路径；未命中 status 1。
    assert.equal(r.status, 0, 'vendor/ 应被 .gitignore 忽略')
    assert.match(r.stdout, /vendor/)
  })
})

// ── 4. 宿主目录与 hook 契约 ─────────────────────────────────

describe('宿主目录与 hook 契约', () => {
  it('项目级 skill 不得引用宿主全局目录：真实仓库经 check #9 验证（E-01）', () => {
    // 复用脚本作为唯一事实源，不在测试里重抄 walk/正则（避免与 check #9 漂移）。
    const hostDirErrors = checkRulesConsistency(repoRoot).errors.filter(e => /宿主全局目录/.test(e))
    assert.deepEqual(hostDirErrors, [], `这些项目级 skill 引用了宿主全局目录：\n${hostDirErrors.join('\n')}`)
  })

  it('check #9 能捕获种入宿主目录引用的 skill（E-01）', () => {
    withTempDir((root) => {
      fs.mkdirSync(path.join(root, 'roles', SPECKIT_DEVELOPMENT_ROLE, 'rules'), { recursive: true })
      fs.writeFileSync(path.join(root, 'roles', SPECKIT_DEVELOPMENT_ROLE, 'rules', 'AGENTS.md'), '')
      const badSkill = path.join(root, 'roles', SPECKIT_DEVELOPMENT_ROLE, 'skills', 'rogue-skill')
      fs.mkdirSync(badSkill, { recursive: true })
      fs.writeFileSync(path.join(badSkill, 'SKILL.md'), '---\nname: rogue-skill\n---\n安装到 ~/.qoder/skills 全局生效\n')
      const { errors } = checkRulesConsistency(root)
      assert.ok(errors.some(e => /宿主全局目录/.test(e)), `应捕获宿主目录引用，实际：\n${errors.join('\n')}`)
    })
  })

  it('会话自动记录 hook 脚本存在且容错（跨宿主分发能力）', () => {
    const script = read('roles/common/hooks/session-log.mjs')
    // 永不阻断对话：异常吞掉、stdout 打合法 JSON 兼容 Codex/Cursor。
    assert.match(script, /process\.exit\(0\)/)
    assert.match(script, /process\.stdout\.write\('\{\}'\)/)
    // 跨宿主字段兜底：session_id（Claude/Codex/Qoder/Trae）与 conversation_id（Cursor）。
    assert.match(script, /conversation_id/)
    assert.match(script, /knowledge.+sessions.+auto|sessions', 'auto'/)
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
