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

function writeSkill(root: string, lines: string[]) {
  fs.mkdirSync(root, { recursive: true })
  fs.writeFileSync(path.join(root, 'SKILL.md'), lines.join('\n'))
}

it('verify-skill-frontmatter 只校验 YAML、目录名和长度', () => {
  const validSkillRoot = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'airules-valid-skill-')), 'minimal-skill')
  writeSkill(validSkillRoot, [
    '---',
    'name: minimal-skill',
    '---',
  ])
  assert.match(runScript('--root', validSkillRoot), /PASS skill YAML frontmatter is valid/)

  const validDescribedSkillRoot = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'airules-valid-described-skill-')), 'described-skill')
  writeSkill(validDescribedSkillRoot, [
    '---',
    'name: described-skill',
    'description: 用于创建、修改或评审 skill 时校验 YAML。',
    '---',
  ])
  assert.match(runScript('--root', validDescribedSkillRoot), /PASS skill YAML frontmatter is valid/)

  const invalidSkillRoot = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'airules-invalid-skill-')), 'broken-skill')
  writeSkill(invalidSkillRoot, [
    '---',
    'name: broken-skill',
    'description: 缺少结束分隔符。',
    '',
    '# Broken Skill',
  ])
  const invalidResult = spawnSync(process.execPath, [
    scriptPath,
    '--root',
    invalidSkillRoot,
  ], { cwd: projectRoot, encoding: 'utf8' })
  assert.notEqual(invalidResult.status, 0)
  assert.match(invalidResult.stdout, /缺少 YAML frontmatter 结束标记/)

  const mismatchedNameRoot = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'airules-mismatched-skill-')), 'folder-name')
  writeSkill(mismatchedNameRoot, [
    '---',
    'name: frontmatter-name',
    'description: 名称与文件夹不一致。',
    '---',
  ])
  const mismatchedNameResult = spawnSync(process.execPath, [
    scriptPath,
    '--root',
    mismatchedNameRoot,
  ], { cwd: projectRoot, encoding: 'utf8' })
  assert.notEqual(mismatchedNameResult.status, 0)
  assert.match(mismatchedNameResult.stdout, /frontmatter name 必须等于目录名：folder-name/)

  const vagueDescriptionRoot = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'airules-vague-description-skill-')), 'vague-description-skill')
  writeSkill(vagueDescriptionRoot, [
    '---',
    'name: vague-description-skill',
    'description: 这是一个很有用的 skill。',
    '---',
  ])
  const vagueDescriptionResult = spawnSync(process.execPath, [
    scriptPath,
    '--root',
    vagueDescriptionRoot,
  ], { cwd: projectRoot, encoding: 'utf8' })
  assert.notEqual(vagueDescriptionResult.status, 0)
  assert.match(vagueDescriptionResult.stdout, /frontmatter description 必须说明触发时机或触发场景/)

  const oversizedSkillRoot = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'airules-oversized-skill-')), 'oversized-skill')
  writeSkill(oversizedSkillRoot, [
    '---',
    'name: oversized-skill',
    'description: 用于校验超过 500 行的 skill。',
    '---',
    ...Array.from({ length: 501 }, (_, index) => `line ${index + 1}`),
  ])
  const oversizedSkillResult = spawnSync(process.execPath, [
    scriptPath,
    '--root',
    oversizedSkillRoot,
  ], { cwd: projectRoot, encoding: 'utf8' })
  assert.notEqual(oversizedSkillResult.status, 0)
  assert.match(oversizedSkillResult.stdout, /SKILL\.md 超过 500 行/)
})
