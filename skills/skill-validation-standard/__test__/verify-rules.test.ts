import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { it } from 'vitest'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const skillRoot = path.resolve(__dirname, '..')
const projectRoot = path.resolve(skillRoot, '..', '..')
const scriptPath = path.join(skillRoot, 'scripts', 'verify-rules.mjs')

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

it('verify-rules 只校验 YAML、目录名和长度', () => {
  assert.match(runScript(), /PASS skill YAML frontmatter is valid/)

  const validSkillRoot = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'airules-valid-skill-')), 'minimal-skill')
  writeSkill(validSkillRoot, [
    '---',
    'name: minimal-skill',
    'description: 校验示例 skill 的 YAML。',
    '---',
  ])
  assert.match(runScript('--root', validSkillRoot), /PASS skill YAML frontmatter is valid/)

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

  const oversizedSkillRoot = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'airules-oversized-skill-')), 'oversized-skill')
  writeSkill(oversizedSkillRoot, [
    '---',
    'name: oversized-skill',
    'description: 超过 500 行。',
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
