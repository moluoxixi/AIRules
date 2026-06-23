import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { it } from 'vitest'
import {
  renderSkillIndex,
  SKILL_INDEX_END,
  SKILL_INDEX_START,
  upsertSkillIndex,
} from '../scripts/lib/skill-index.mjs'

function withTempSkills(run: (skillsDir: string) => void) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'airules-skill-index-'))
  try {
    return run(path.join(root, 'skills'))
  }
  finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
}

function writeSkill(skillsDir: string, name: string, description: string | null) {
  const dir = path.join(skillsDir, name)
  fs.mkdirSync(dir, { recursive: true })
  const fm = description === null
    ? ['---', `name: ${name}`, '---']
    : ['---', `name: ${name}`, `description: ${description}`, '---']
  fs.writeFileSync(path.join(dir, 'SKILL.md'), [...fm, `# ${name}`].join('\n'))
}

it('renderSkillIndex - 渲染带标记的索引并按名排序', () => withTempSkills((skillsDir) => {
  writeSkill(skillsDir, 'zeta', '当做 zeta 时使用。')
  writeSkill(skillsDir, 'alpha', '当做 alpha 时使用。')

  const block = renderSkillIndex(skillsDir)

  assert.ok(block.startsWith(SKILL_INDEX_START), '应以 START 标记开头')
  assert.ok(block.trimEnd().endsWith(SKILL_INDEX_END), '应以 END 标记结尾')
  assert.match(block, /\| `alpha` \| 当做 alpha 时使用。 \|/)
  assert.match(block, /\| `zeta` \| 当做 zeta 时使用。 \|/)
  assert.ok(block.indexOf('alpha') < block.indexOf('zeta'), '应按 skill 名排序')
}))

it('renderSkillIndex - 缺 description 的 skill 统一过滤、不注入（不报错）', () => withTempSkills((skillsDir) => {
  writeSkill(skillsDir, 'good', '当做 good 时使用。')
  writeSkill(skillsDir, 'no-desc', null)

  const block = renderSkillIndex(skillsDir)

  assert.match(block, /\| `good` \|/)
  assert.doesNotMatch(block, /no-desc/, '缺 description 的 skill 应被过滤掉')
}))

it('renderSkillIndex - 全部缺 description 时返回空串（无可注入条目）', () => withTempSkills((skillsDir) => {
  writeSkill(skillsDir, 'a', null)
  writeSkill(skillsDir, 'b', null)

  assert.equal(renderSkillIndex(skillsDir), '', '无带 description 的 skill 应返回空串')
}))

it('renderSkillIndex - 目录不存在或无 skill 返回空串', () => withTempSkills((skillsDir) => {
  assert.equal(renderSkillIndex(skillsDir), '', '目录不存在返回空串')
  fs.mkdirSync(skillsDir, { recursive: true })
  assert.equal(renderSkillIndex(skillsDir), '', '无 skill 返回空串')
}))

it('upsertSkillIndex - 无标记区块时追加到末尾', () => {
  const baseline = '# AIRules\n\n## 规则\n- 一条。\n'
  const block = `${SKILL_INDEX_START}\n## Skill 触发索引\n内容\n${SKILL_INDEX_END}`

  const result = upsertSkillIndex(baseline, block)

  assert.match(result, /## 规则/)
  assert.ok(result.indexOf('## 规则') < result.indexOf(SKILL_INDEX_START), '索引应在规则之后')
  assert.equal((result.match(/AIRULES:SKILL-INDEX:START/g) ?? []).length, 1)
})

it('upsertSkillIndex - 已有标记区块时幂等整段替换', () => {
  const block1 = `${SKILL_INDEX_START}\n旧索引\n${SKILL_INDEX_END}`
  const block2 = `${SKILL_INDEX_START}\n新索引\n${SKILL_INDEX_END}`
  const baseline = `# AIRules\n\n## 规则\n- 一条。\n\n${block1}\n`

  const once = upsertSkillIndex(baseline, block2)
  const twice = upsertSkillIndex(once, block2)

  assert.match(once, /新索引/)
  assert.doesNotMatch(once, /旧索引/, '旧索引应被替换')
  assert.equal((once.match(/AIRULES:SKILL-INDEX:START/g) ?? []).length, 1, '只保留一份标记')
  assert.equal(once, twice, '重复 upsert 应幂等')
})

it('upsertSkillIndex - 空 indexBlock 移除已有区块', () => {
  const block = `${SKILL_INDEX_START}\n索引\n${SKILL_INDEX_END}`
  const baseline = `# AIRules\n\n## 规则\n- 一条。\n\n${block}\n`

  const result = upsertSkillIndex(baseline, '')

  assert.doesNotMatch(result, /AIRULES:SKILL-INDEX/, '空索引应移除标记区块')
  assert.match(result, /## 规则/, '规则段应保留')
})
