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
const scriptPath = path.join(projectRoot, 'scripts', 'verify-skill-frontmatter.mjs')

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

function writeSkill(root: string, lines: string[]) {
  fs.mkdirSync(root, { recursive: true })
  fs.writeFileSync(path.join(root, 'SKILL.md'), lines.join('\n'))
}

function validSkillLines(name: string, description = '用于创建、修改或评审 skill 时校验内容标准。') {
  return [
    '---',
    `name: ${name}`,
    `description: ${description}`,
    '---',
    '',
    '# Skill 内容标准示例',
    '',
    '## 触发条件',
    '',
    '- 用户新增、修改或评审 first-party skill 时使用。',
    '',
    '## 不适合场景',
    '',
    '- 普通业务任务不使用。',
    '',
    '## 输出边界',
    '',
    '- 只检查当前 skill，不自动修改其它文件。',
    '',
    '## 示例',
    '',
    '以下内容是示例模板，仅供参考，不得作为真实业务事实自动应用。',
  ]
}

it('verify-skill-frontmatter 校验 YAML、目录名、description 和正文边界', () => {
  const validSkillRoot = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'airules-valid-skill-')), 'minimal-skill')
  writeSkill(validSkillRoot, validSkillLines('minimal-skill'))
  assert.match(runScript('--root', validSkillRoot), /PASS skill content contract is valid/)

  const invalidSkillRoot = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'airules-invalid-skill-')), 'broken-skill')
  writeSkill(invalidSkillRoot, [
    '---',
    'name: broken-skill',
    'description: 缺少结束分隔符。',
    '',
    '# Broken Skill',
  ])
  const invalidResult = runScriptResult('--root', invalidSkillRoot)
  assert.notEqual(invalidResult.status, 0)
  assert.match(invalidResult.stdout, /缺少 YAML frontmatter 结束标记/)

  const mismatchedNameRoot = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'airules-mismatched-skill-')), 'folder-name')
  writeSkill(mismatchedNameRoot, validSkillLines('frontmatter-name'))
  const mismatchedNameResult = runScriptResult('--root', mismatchedNameRoot)
  assert.notEqual(mismatchedNameResult.status, 0)
  assert.match(mismatchedNameResult.stdout, /frontmatter name 必须等于目录名：folder-name/)

  const missingDescriptionRoot = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'airules-missing-description-skill-')), 'missing-description-skill')
  writeSkill(missingDescriptionRoot, [
    '---',
    'name: missing-description-skill',
    '---',
    ...validSkillLines('missing-description-skill').slice(4),
  ])
  const missingDescriptionResult = runScriptResult('--root', missingDescriptionRoot)
  assert.notEqual(missingDescriptionResult.status, 0)
  assert.match(missingDescriptionResult.stdout, /frontmatter 缺少 description/)

  const vagueDescriptionRoot = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'airules-vague-description-skill-')), 'vague-description-skill')
  writeSkill(vagueDescriptionRoot, validSkillLines('vague-description-skill', '这是一个很有用的 skill。'))
  const vagueDescriptionResult = runScriptResult('--root', vagueDescriptionRoot)
  assert.notEqual(vagueDescriptionResult.status, 0)
  assert.match(vagueDescriptionResult.stdout, /frontmatter description 必须说明 AI 触发时机或触发场景/)

  const missingBodyBoundaryRoot = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'airules-missing-boundary-skill-')), 'missing-boundary-skill')
  writeSkill(missingBodyBoundaryRoot, [
    '---',
    'name: missing-boundary-skill',
    'description: 用于测试缺少正文边界时触发。',
    '---',
    '# Missing Boundary',
    '## 触发条件',
    '- 修改 skill 时使用。',
  ])
  const missingBodyBoundaryResult = runScriptResult('--root', missingBodyBoundaryRoot)
  assert.notEqual(missingBodyBoundaryResult.status, 0)
  assert.match(missingBodyBoundaryResult.stdout, /正文必须包含不适合场景或拒绝使用边界/)
  assert.match(missingBodyBoundaryResult.stdout, /正文必须包含输出\/应用\/写入边界或禁止事项/)

  const unsafeExampleRoot = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'airules-unsafe-example-skill-')), 'unsafe-example-skill')
  writeSkill(unsafeExampleRoot, [
    ...validSkillLines('unsafe-example-skill').slice(0, 18),
    '## 示例',
    '采购订单状态固定为 approved。',
  ])
  const unsafeExampleResult = runScriptResult('--root', unsafeExampleRoot)
  assert.notEqual(unsafeExampleResult.status, 0)
  assert.match(unsafeExampleResult.stdout, /示例\/模板\/候选内容必须说明边界或占位性质/)

  const placeholderRoot = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'airules-placeholder-skill-')), 'placeholder-skill')
  writeSkill(placeholderRoot, [
    ...validSkillLines('placeholder-skill'),
    'TODO 后续补充更多规则。',
  ])
  const placeholderResult = runScriptResult('--root', placeholderRoot)
  assert.notEqual(placeholderResult.status, 0)
  assert.match(placeholderResult.stdout, /正文包含未解决占位内容或 TODO/)

  const oversizedSkillRoot = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'airules-oversized-skill-')), 'oversized-skill')
  writeSkill(oversizedSkillRoot, [
    '---',
    'name: oversized-skill',
    'description: 用于校验超过 500 行的 skill。',
    '---',
    ...Array.from({ length: 501 }, (_, index) => `line ${index + 1}`),
  ])
  const oversizedSkillResult = runScriptResult('--root', oversizedSkillRoot)
  assert.notEqual(oversizedSkillResult.status, 0)
  assert.match(oversizedSkillResult.stdout, /SKILL\.md 超过 500 行/)
})
