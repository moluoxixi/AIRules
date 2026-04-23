import assert from 'node:assert'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { it } from 'vitest'
import {

  projectSkillsToHost,
} from '../scripts/lib/install.js'

function setupMockEnvironment() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'moluoxixi-test-'))
  const userHome = path.join(tmpDir, 'user')
  const moluoHome = path.join(userHome, '.moluoxixi')

  fs.mkdirSync(userHome, { recursive: true })
  fs.mkdirSync(moluoHome, { recursive: true })

  // Create some dummy skills in .moluoxixi/vendor/skills
  const skillsBase = path.join(moluoHome, 'vendor', 'skills')
  fs.mkdirSync(skillsBase, { recursive: true })
  fs.mkdirSync(path.join(skillsBase, 'skill-a'), { recursive: true })
  fs.mkdirSync(path.join(skillsBase, 'skill-b'), { recursive: true })

  const claudeHome = path.join(userHome, '.claude')
  fs.mkdirSync(claudeHome, { recursive: true })

  return { tmpDir, userHome, moluoHome, claudeHome }
}

function cleanup(tmpDir: string) {
  fs.rmSync(tmpDir, { recursive: true, force: true })
}

it('installation linking - .agents is always created as mandatory layer', () => {
  const { tmpDir, userHome, moluoHome, claudeHome } = setupMockEnvironment()

  try {
    const claudeSkillsDir = path.join(claudeHome, 'skills')
    projectSkillsToHost(userHome, moluoHome, claudeSkillsDir)

    // Verify ~/.agents/skills is always created (mandatory layer)
    const agentsSkillsDir = path.join(userHome, '.agents', 'skills')
    assert.ok(fs.existsSync(agentsSkillsDir), '.agents/skills directory should always exist')

    // Verify .agents links point to moluoxixi
    const agentSkillA = path.join(agentsSkillsDir, 'skill-a')
    assert.ok(fs.lstatSync(agentSkillA).isSymbolicLink(), 'agent skill-a should be a symlink')
    const agentTarget = path.resolve(path.dirname(agentSkillA), fs.readlinkSync(agentSkillA))
    assert.strictEqual(
      path.normalize(agentTarget),
      path.normalize(path.join(moluoHome, 'vendor', 'skills', 'skill-a')),
    )

    // Verify Claude links point to .agents
    const skillA = path.join(claudeSkillsDir, 'skill-a')
    assert.ok(fs.lstatSync(skillA).isSymbolicLink(), 'Claude skill-a should be a symlink')
    const claudeTarget = path.resolve(path.dirname(skillA), fs.readlinkSync(skillA))
    assert.strictEqual(
      path.normalize(claudeTarget),
      path.normalize(agentSkillA),
    )
  }
  finally {
    cleanup(tmpDir)
  }
})

it('installation linking - Pre-existing .agents directory is preserved', () => {
  const { tmpDir, userHome, moluoHome, claudeHome } = setupMockEnvironment()

  try {
    // Pre-create .agents directory with some content
    const agentsDir = path.join(userHome, '.agents')
    fs.mkdirSync(agentsDir, { recursive: true })
    fs.writeFileSync(path.join(agentsDir, 'existing-file.txt'), 'test')

    const claudeSkillsDir = path.join(claudeHome, 'skills')
    projectSkillsToHost(userHome, moluoHome, claudeSkillsDir)

    // Verify pre-existing content is preserved
    assert.ok(fs.existsSync(path.join(agentsDir, 'existing-file.txt')), 'Pre-existing files in .agents should be preserved')

    // Verify skills are properly linked
    const agentSkillA = path.join(agentsDir, 'skills', 'skill-a')
    assert.ok(fs.lstatSync(agentSkillA).isSymbolicLink(), 'agent skill-a should be a symlink')
  }
  finally {
    cleanup(tmpDir)
  }
})

it('installation linking - Pre-existing folder deletion', () => {
  const { tmpDir, userHome, moluoHome, claudeHome } = setupMockEnvironment()

  try {
    const claudeSkillsDir = path.join(claudeHome, 'skills')
    fs.mkdirSync(claudeSkillsDir, { recursive: true })

    // Create a real directory that conflicts with the skill name
    const preExistingFolder = path.join(claudeSkillsDir, 'skill-a')
    fs.mkdirSync(preExistingFolder, { recursive: true })
    fs.writeFileSync(path.join(preExistingFolder, 'dummy.txt'), 'hello')

    assert.ok(!fs.lstatSync(preExistingFolder).isSymbolicLink(), 'Pre-existing folder should not be a symlink initially')

    projectSkillsToHost(userHome, moluoHome, claudeSkillsDir)

    // Verify it was replaced by a symlink
    assert.ok(fs.lstatSync(preExistingFolder).isSymbolicLink(), 'skill-a should be replaced with a symlink')
  }
  finally {
    cleanup(tmpDir)
  }
})

it('self-healing - Orphan link cleanup', () => {
  const { tmpDir, userHome, moluoHome, claudeHome } = setupMockEnvironment()

  try {
    const claudeSkillsDir = path.join(claudeHome, 'skills')
    fs.mkdirSync(claudeSkillsDir, { recursive: true })

    // 1. 在 moluoxixi 中创建一些物理文件
    const currentSkillDir = path.join(moluoHome, 'vendor', 'skills', 'skill-present')
    fs.mkdirSync(currentSkillDir, { recursive: true })

    // 2. 在目标目录中手动创建一个"孤儿链接" (指向一个在清单中不存在的目录)
    const staleLink = path.join(claudeSkillsDir, 'stale-skill')
    // 注意：我们将它指向 moluoxixi 内部，这样它才会被"自愈"识别
    const staleTarget = path.join(moluoHome, 'vendor', 'skills', 'skill-old-deleted')
    fs.mkdirSync(staleTarget, { recursive: true }) // 先创建目标以便建立链接
    fs.symlinkSync(staleTarget, staleLink, 'junction')
    fs.rmSync(staleTarget, { recursive: true, force: true }) // 删除目标使其变成死链接/孤儿

    assert.ok(fs.existsSync(staleLink) || fs.lstatSync(staleLink).isSymbolicLink(), 'Stale link should exist initially')

    // 执行同步
    projectSkillsToHost(userHome, moluoHome, claudeSkillsDir)

    // 3. 验证
    assert.ok(fs.existsSync(path.join(claudeSkillsDir, 'skill-present')), 'New skill should be linked')
    assert.ok(!fs.existsSync(staleLink), 'Orphan link pointing to moluoxixi should be cleaned up')
  }
  finally {
    cleanup(tmpDir)
  }
})

it('self-healing - Safety boundary (External links)', () => {
  const { tmpDir, userHome, moluoHome, claudeHome } = setupMockEnvironment()

  try {
    const claudeSkillsDir = path.join(claudeHome, 'skills')
    fs.mkdirSync(claudeSkillsDir, { recursive: true })

    // 1. 创建一个普通文件（非链接）
    const userFile = path.join(claudeSkillsDir, 'my-config.json')
    fs.writeFileSync(userFile, '{}')

    // 2. 创建一个指向外部（非 moluoxixi）的链接
    const externalLink = path.join(claudeSkillsDir, 'external-ref')
    const externalTarget = path.join(tmpDir, 'some-external-app')
    fs.mkdirSync(externalTarget, { recursive: true })
    fs.symlinkSync(externalTarget, externalLink, 'junction')

    // 执行同步
    projectSkillsToHost(userHome, moluoHome, claudeSkillsDir)

    // 3. 验证：非 moluoxixi 管理的文件和外部链接不应被删除
    assert.ok(fs.existsSync(userFile), 'User files should be preserved')
    assert.ok(fs.existsSync(externalLink), 'External links (out of moluoxixi scope) should be preserved')
  }
  finally {
    cleanup(tmpDir)
  }
})

it('self-healing - Aggressive broken link removal', () => {
  const { tmpDir, userHome, moluoHome, claudeHome } = setupMockEnvironment()

  try {
    const claudeSkillsDir = path.join(claudeHome, 'skills')
    fs.mkdirSync(claudeSkillsDir, { recursive: true })

    // 创建一个完全无关的死链接（指向本测试环境之外或不存在的路径）
    const deadLink = path.join(claudeSkillsDir, 'garbage-link')
    const nonExistentPath = path.join(tmpDir, `void-directory-${Date.now()}`)

    // 手动创建链接后删除目标路径
    fs.mkdirSync(nonExistentPath, { recursive: true })
    fs.symlinkSync(nonExistentPath, deadLink, 'junction')
    fs.rmSync(nonExistentPath, { recursive: true, force: true })

    assert.ok(fs.lstatSync(deadLink).isSymbolicLink(), 'Dead link should exist initially')

    // 执行同步
    projectSkillsToHost(userHome, moluoHome, claudeSkillsDir)

    // 验证：即使不属于 moluoxixi，死链接也应该被清理
    assert.ok(!fs.existsSync(deadLink), 'Dead link should be aggressively removed')
    try {
      fs.lstatSync(deadLink)
      assert.fail('lstatSync should throw for removed dead link')
    }
    catch (e) {
      // Expected
    }
  }
  finally {
    cleanup(tmpDir)
  }
})
