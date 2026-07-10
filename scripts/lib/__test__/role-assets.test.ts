import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { requireRoleName, resolveRoleAssets } from '../role-assets.js'

const temporaryRoots: string[] = []

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true })
  }
})

function createHome() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'airules-role-assets-'))
  temporaryRoots.push(root)
  const home = path.join(root, 'home')
  fs.mkdirSync(path.join(home, 'roles'), { recursive: true })
  return { root, home }
}

function createRole(home: string, role: string, assets: string[] = []) {
  const roleRoot = path.join(home, 'roles', role)
  fs.mkdirSync(roleRoot, { recursive: true })

  for (const asset of assets) {
    if (asset === 'rules') {
      fs.mkdirSync(path.join(roleRoot, 'rules'))
      fs.writeFileSync(path.join(roleRoot, 'rules', 'AGENTS.md'), '# role rules\n')
      continue
    }

    fs.mkdirSync(path.join(roleRoot, asset))
    if (asset === 'mcp') {
      fs.writeFileSync(path.join(roleRoot, 'mcp', 'mcp.json'), '{}\n')
    }
  }

  return roleRoot
}

function platformDirectoryLinkType() {
  return process.platform === 'win32' ? 'junction' : 'dir'
}

describe('resolveRoleAssets', () => {
  it('accepts only safe role names', () => {
    expect(requireRoleName('alpha-2')).toBe('alpha-2')
    expect(() => requireRoleName('Alpha')).toThrow(/role name/i)
    expect(() => requireRoleName('alpha_role')).toThrow(/role name/i)
    expect(() => requireRoleName('a'.repeat(64))).toThrow(/role name/i)
  })

  it('requires an existing safe role name', () => {
    const { home } = createHome()

    expect(() => resolveRoleAssets(home, '../common')).toThrow(/role name/i)
    expect(() => resolveRoleAssets(home, 'missing')).toThrow(/role directory/i)
  })

  it('returns only the selected role assets', () => {
    const { home } = createHome()
    createRole(home, 'alpha', ['skills', 'agents', 'rules', 'hooks', 'mcp'])
    createRole(home, 'beta', ['skills'])

    const assets = resolveRoleAssets(home, 'alpha')

    expect(assets).toMatchObject({ role: 'alpha' })
    expect(assets.skillsDir).toContain('alpha')
    expect(assets.skillsDir).not.toContain('beta')
    expect(assets.agentsDir).toContain(path.join('alpha', 'agents'))
    expect(assets.rulesFile).toContain(path.join('alpha', 'rules', 'AGENTS.md'))
    expect(assets.hooksDir).toContain(path.join('alpha', 'hooks'))
    expect(assets.mcpFile).toContain(path.join('alpha', 'mcp', 'mcp.json'))
  })

  it('rejects an asset symlink that resolves outside its role', () => {
    const { root, home } = createHome()
    const roleRoot = createRole(home, 'alpha')
    const outside = path.join(root, 'outside-skills')
    fs.mkdirSync(outside)
    fs.symlinkSync(outside, path.join(roleRoot, 'skills'), platformDirectoryLinkType())

    expect(() => resolveRoleAssets(home, 'alpha')).toThrow(/outside.*role/i)
  })

  it('rejects a role directory symlink that resolves outside roles', () => {
    const { root, home } = createHome()
    const outside = path.join(root, 'outside-role')
    fs.mkdirSync(outside)
    fs.symlinkSync(outside, path.join(home, 'roles', 'alpha'), platformDirectoryLinkType())

    expect(() => resolveRoleAssets(home, 'alpha')).toThrow(/outside.*role/i)
  })

  it('rejects optional assets with an invalid type', () => {
    const { home } = createHome()
    const roleRoot = createRole(home, 'alpha')
    fs.writeFileSync(path.join(roleRoot, 'skills'), 'not a directory\n')

    expect(() => resolveRoleAssets(home, 'alpha')).toThrow(/asset.*invalid type/i)
  })

  it('allows a role with no asset directories', () => {
    const { home } = createHome()
    const roleRoot = createRole(home, 'empty')

    expect(resolveRoleAssets(home, 'empty')).toEqual({
      role: 'empty',
      roleRoot: fs.realpathSync(roleRoot),
    })
  })
})
