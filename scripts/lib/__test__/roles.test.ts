import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, expect, it } from 'vitest'
import { requireRolePaths } from '../roles.js'

const temporaryRoots: string[] = []

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true })
  }
})

function createRepo(): string {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'airules-role-paths-'))
  temporaryRoots.push(repoRoot)
  for (const role of ['alpha', 'openspec-development']) {
    const constantsDir = path.join(repoRoot, 'roles', role, 'constants')
    fs.mkdirSync(constantsDir, { recursive: true })
    fs.writeFileSync(path.join(constantsDir, 'skills.ts'), 'export const vendors = []\n', 'utf8')
  }
  return repoRoot
}

it('requires an explicit role even when the former default role exists', () => {
  const repoRoot = createRepo()

  expect(() => requireRolePaths(repoRoot, undefined)).toThrow(/role name/i)
})

it('resolves only the selected role path and constants file', () => {
  const repoRoot = createRepo()
  const roleRoot = fs.realpathSync(path.join(repoRoot, 'roles', 'alpha'))

  expect(requireRolePaths(repoRoot, 'alpha')).toMatchObject({
    role: 'alpha',
    roleRoot,
    constantsFile: path.join(roleRoot, 'constants', 'skills.ts'),
  })
})

it('rejects a role path escape', () => {
  const repoRoot = createRepo()

  expect(() => requireRolePaths(repoRoot, '../alpha')).toThrow(/role name/i)
})
