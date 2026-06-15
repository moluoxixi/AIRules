#!/usr/bin/env node
/**
 * 批量 skill frontmatter 校验入口。
 *
 * verify-skill-frontmatter.mjs 仅接受单个 skill 根目录（--root skills/<name>），
 * 不接受 skills/ 总目录。该脚本遍历 skills/ 下所有携带 SKILL.md 的子目录，
 * 逐个调用底层校验器，任一失败即以非零退出码结束，供 CI 与 pre-push hook 复用。
 */
import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const repoRoot = process.cwd()
const skillsRoot = path.join(repoRoot, 'skills')
const verifierScript = path.join(repoRoot, 'scripts', 'verify-skill-frontmatter.mjs')

if (!existsSync(skillsRoot)) {
  console.log('PASS verify:skills n/a: 未发现 skills/ 目录')
  process.exit(0)
}

// 只校验真正的 skill：必须直接包含 SKILL.md，排除 references/scripts 等非 skill 子目录。
const skillDirs = readdirSync(skillsRoot, { withFileTypes: true })
  .filter(entry => entry.isDirectory())
  .filter(entry => existsSync(path.join(skillsRoot, entry.name, 'SKILL.md')))
  .map(entry => entry.name)

if (skillDirs.length === 0) {
  console.log('FAIL verify:skills: skills/ 下未发现任何携带 SKILL.md 的 skill 目录')
  process.exit(1)
}

const failed = []
for (const name of skillDirs) {
  const rootArg = path.join('skills', name)
  console.log(`\n=== verify skill: ${rootArg} ===`)
  const result = spawnSync(process.execPath, [verifierScript, '--root', rootArg], {
    cwd: repoRoot,
    stdio: 'inherit',
  })

  if (result.error) {
    throw result.error
  }

  if (result.status !== 0) {
    failed.push(name)
  }
}

if (failed.length > 0) {
  console.log(`\nFAIL verify:skills: 以下 skill 未通过 frontmatter 校验 -> ${failed.join(', ')}`)
  process.exit(1)
}

console.log(`\nPASS verify:skills: ${skillDirs.length} 个 skill 全部通过`)
