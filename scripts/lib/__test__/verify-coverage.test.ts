import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, it } from 'vitest'
import { projectHostById } from '../install.js'
import { verifyHost } from '../verify.js'

const temporaryRoots: string[] = []

afterEach(() => {
  for (const root of temporaryRoots.splice(0))
    fs.rmSync(root, { recursive: true, force: true })
})

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'airules-verify-skills-'))
  temporaryRoots.push(root)
  const userHome = path.join(root, 'user')
  const moluoHome = path.join(root, 'home')
  const codexHome = path.join(userHome, '.codex')
  fs.mkdirSync(path.join(moluoHome, 'vendor', 'skills', 'demo'), { recursive: true })
  fs.writeFileSync(path.join(moluoHome, 'vendor', 'skills', 'demo', 'SKILL.md'), '---\nname: demo\ndescription: demo\n---\n')
  fs.mkdirSync(codexHome, { recursive: true })
  return { codexHome, moluoHome, root, userHome }
}

it('verifyHost rejects unknown hosts and skips missing host homes', async () => {
  const { moluoHome, root } = fixture()
  assert.equal(await verifyHost('unknown', moluoHome), false)
  assert.equal(await verifyHost('claude', moluoHome, path.join(root, 'missing-user')), true)
})

it('verifyHost validates only the projected skill set', async () => {
  const { moluoHome, userHome } = fixture()
  assert.equal(projectHostById('codex', userHome, moluoHome).success, true)
  assert.equal(await verifyHost('codex', moluoHome, userHome), true)

  fs.rmSync(path.join(userHome, '.codex', 'skills', 'demo'), { recursive: true, force: true })
  assert.equal(await verifyHost('codex', moluoHome, userHome), false)
})

it('skills-only projection preserves host-native assets byte-for-byte', async () => {
  const { codexHome, moluoHome, userHome } = fixture()
  const sentinels = {
    'AGENTS.md': '# user rules\n',
    'agents/reviewer.toml': 'name = "reviewer"\n',
    'config.toml': '[mcp_servers.user]\ncommand = "user"\n',
    'hooks/user.mjs': 'export const user = true\n',
  }
  for (const [relativePath, content] of Object.entries(sentinels)) {
    const target = path.join(codexHome, ...relativePath.split('/'))
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.writeFileSync(target, content)
  }

  assert.equal(projectHostById('codex', userHome, moluoHome).success, true)
  assert.equal(await verifyHost('codex', moluoHome, userHome), true)
  for (const [relativePath, content] of Object.entries(sentinels))
    assert.equal(fs.readFileSync(path.join(codexHome, ...relativePath.split('/')), 'utf8'), content)
})
