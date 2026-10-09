import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { stringify } from 'yaml'
import { syncFirstPartySkillsToVendor } from '../install.js'

const roots: string[] = []

afterEach(() => {
  for (const root of roots.splice(0))
    fs.rmSync(root, { recursive: true, force: true })
})

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'airules-role-skill-projection-'))
  roots.push(root)
  return { repoRoot: path.join(root, 'repo'), homeDir: path.join(root, 'home') }
}

function writeFile(file: string, contents: string): void {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, contents)
}

function writeRole(repoRoot: string, role: string, parents: string[] = [], skills = 'skills'): void {
  writeFile(path.join(repoRoot, 'roles', role, 'role.yaml'), stringify({
    schema_version: 2,
    role_id: role,
    extends_roles: parents,
    provides: { capabilities: [] },
    installation: { assets: { skills } },
  }))
}

describe('v2 private role skill projection', () => {
  it('projects only the selected role asset root when inheriting multiple parents', async () => {
    const { repoRoot, homeDir } = fixture()
    for (const role of ['left', 'right']) {
      writeRole(repoRoot, role)
      writeFile(path.join(repoRoot, 'roles', role, 'skills', 'parent-private', 'SKILL.md'), `# ${role}\n`)
    }
    writeRole(repoRoot, 'child', ['left', 'right'], '.native/skills')
    const childSkill = path.join(repoRoot, 'roles', 'child', '.native', 'skills', 'child-only')
    writeFile(path.join(childSkill, 'SKILL.md'), '# child\n')
    writeFile(path.join(repoRoot, 'skills', 'legacy', 'SKILL.md'), '# legacy\n')

    await syncFirstPartySkillsToVendor(repoRoot, homeDir, 'child')
    expect(fs.readdirSync(path.join(homeDir, 'vendor', 'skills'))).toEqual(['child-only'])
    expect(fs.realpathSync(path.join(homeDir, 'vendor', 'skills', 'child-only'))).toBe(fs.realpathSync(childSkill))
  })

  it('does not fall back to parent or root legacy skills when the selected v2 role has none', async () => {
    const { repoRoot, homeDir } = fixture()
    writeRole(repoRoot, 'base')
    writeRole(repoRoot, 'child', ['base'])
    writeFile(path.join(repoRoot, 'roles', 'base', 'skills', 'private', 'SKILL.md'), '# private\n')
    writeFile(path.join(repoRoot, 'skills', 'legacy', 'SKILL.md'), '# legacy\n')

    await syncFirstPartySkillsToVendor(repoRoot, homeDir, 'child')
    expect(fs.existsSync(path.join(homeDir, 'vendor', 'skills'))).toBe(false)
  })

  it('preserves installed shared skills when the selected private skill has the same name', async () => {
    const { repoRoot, homeDir } = fixture()
    writeRole(repoRoot, 'child')
    writeFile(path.join(repoRoot, 'roles', 'child', 'skills', 'shared', 'SKILL.md'), '# private\n')
    const shared = path.join(homeDir, 'vendor', 'skills', 'shared', 'SKILL.md')
    writeFile(shared, '# shared\n')

    await expect(syncFirstPartySkillsToVendor(repoRoot, homeDir, 'child')).rejects.toThrow(/Role\/shared skill target conflict/u)
    expect(fs.readFileSync(shared, 'utf8')).toBe('# shared\n')
  })
})
