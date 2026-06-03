import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, it, vi } from 'vitest'
import { verifyHost } from '../scripts/lib/verify.js'

/**
 * 创建隔离的临时 home 目录，避免 verifyHost 读取真实用户目录。
 */
function withTempHome<T>(run: (userHome: string, moluoHome: string) => T): T {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'airules-verify-'))
  const userHome = path.join(tmpDir, 'user')
  const moluoHome = path.join(userHome, '.moluoxixi')

  try {
    fs.mkdirSync(userHome, { recursive: true })
    vi.spyOn(os, 'homedir').mockReturnValue(userHome)
    return run(userHome, moluoHome)
  }
  finally {
    vi.restoreAllMocks()
    fs.rmSync(tmpDir, { recursive: true, force: true })
  }
}

/**
 * 为指定 skill 创建 vendor 源目录。
 */
function createVendorSkill(moluoHome: string, skillName: string) {
  fs.mkdirSync(path.join(moluoHome, 'vendor', 'skills', skillName), { recursive: true })
}

/**
 * 创建目录软链接，统一 Windows junction 与 POSIX dir symlink。
 */
function linkDir(source: string, target: string) {
  fs.mkdirSync(path.dirname(target), { recursive: true })
  fs.symlinkSync(source, target, process.platform === 'win32' ? 'junction' : 'dir')
}

afterEach(() => {
  vi.restoreAllMocks()
})

it('verifyHost - 未知宿主返回 false', async () => {
  await withTempHome(async (_userHome, moluoHome) => {
    assert.equal(await verifyHost('unknown', moluoHome), false)
  })
})

it('verifyHost - 宿主目录不存在时跳过但不视为失败', async () => {
  await withTempHome(async (_userHome, moluoHome) => {
    assert.equal(await verifyHost('codex', moluoHome), true)
  })
})

it('verifyHost - 宿主 skills 目录缺失时返回失败', async () => {
  await withTempHome(async (userHome, moluoHome) => {
    fs.mkdirSync(path.join(userHome, '.codex'), { recursive: true })

    assert.equal(await verifyHost('codex', moluoHome), false)
  })
})

it('verifyHost - 校验有效链接、物理目录和缺失技能', async () => {
  await withTempHome(async (userHome, moluoHome) => {
    createVendorSkill(moluoHome, 'linked')
    createVendorSkill(moluoHome, 'copied')
    createVendorSkill(moluoHome, 'missing')
    fs.writeFileSync(path.join(moluoHome, 'vendor', 'skills', '.gitignore'), 'ignored\n')

    const hostSkillsDir = path.join(userHome, '.codex', 'skills')
    linkDir(
      path.join(moluoHome, 'vendor', 'skills', 'linked'),
      path.join(hostSkillsDir, 'linked'),
    )
    fs.mkdirSync(path.join(hostSkillsDir, 'copied'), { recursive: true })

    assert.equal(await verifyHost('codex', moluoHome), false)
  })
})

it('verifyHost - 外部链接可访问时警告但仍视为有效', async () => {
  await withTempHome(async (userHome, moluoHome) => {
    createVendorSkill(moluoHome, 'external')
    const externalSource = path.join(userHome, 'outside-skill')
    fs.mkdirSync(externalSource, { recursive: true })

    linkDir(externalSource, path.join(userHome, '.codex', 'skills', 'external'))

    assert.equal(await verifyHost('codex', moluoHome), true)
  })
})

it('verifyHost - 断开的技能软链接显式判定为失败', async () => {
  await withTempHome(async (userHome, moluoHome) => {
    createVendorSkill(moluoHome, 'broken')
    const missingSource = path.join(userHome, 'deleted-source')
    const brokenLink = path.join(userHome, '.codex', 'skills', 'broken')

    fs.mkdirSync(missingSource, { recursive: true })
    linkDir(missingSource, brokenLink)
    fs.rmSync(missingSource, { recursive: true, force: true })

    assert.equal(fs.lstatSync(brokenLink).isSymbolicLink(), true)
    assert.equal(await verifyHost('codex', moluoHome), false)
  })
})
