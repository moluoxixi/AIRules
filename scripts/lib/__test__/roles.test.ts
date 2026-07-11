import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, expect, it } from 'vitest'
import { DEFAULT_ROLE, requireRolePaths, resolveRoleManifestPath } from '../roles.js'

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

function createOutsideConstants(extension: 'ts' | 'js'): string {
  const constantsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'airules-outside-constants-'))
  temporaryRoots.push(constantsDir)
  fs.writeFileSync(path.join(constantsDir, `skills.${extension}`), 'export const vendors = []\n', 'utf8')
  return constantsDir
}

function platformDirectoryLinkType(): 'dir' | 'junction' {
  return process.platform === 'win32' ? 'junction' : 'dir'
}

it('uses an empty string as the default role', () => {
  expect(DEFAULT_ROLE).toBe('')
})

it('requires a valid role when resolving explicit role paths', () => {
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

it('rejects a constants directory symlink outside the selected role', () => {
  const repoRoot = createRepo()
  const constantsDir = path.join(repoRoot, 'roles', 'alpha', 'constants')
  fs.rmSync(constantsDir, { recursive: true })
  fs.symlinkSync(createOutsideConstants('ts'), constantsDir, platformDirectoryLinkType())

  expect(() => requireRolePaths(repoRoot, 'alpha')).toThrow(/constants.*outside|outside.*role/i)
})

it('rejects a source manifest symlink outside the selected role', () => {
  const repoRoot = createRepo()
  const constantsDir = path.join(repoRoot, 'roles', 'alpha', 'constants')
  const outsideConstants = createOutsideConstants('ts')
  if (process.platform === 'win32') {
    fs.rmSync(constantsDir, { recursive: true })
    fs.symlinkSync(outsideConstants, constantsDir, platformDirectoryLinkType())
  }
  else {
    const manifestFile = path.join(constantsDir, 'skills.ts')
    fs.rmSync(manifestFile)
    fs.symlinkSync(path.join(outsideConstants, 'skills.ts'), manifestFile, 'file')
  }

  expect(() => resolveRoleManifestPath(repoRoot, 'alpha')).toThrow(/manifest.*outside|outside.*role/i)
})

it('rejects a dist constants symlink outside the repository', () => {
  const repoRoot = createRepo()
  const distRoleRoot = path.join(repoRoot, 'dist', 'roles', 'alpha')
  fs.mkdirSync(distRoleRoot, { recursive: true })
  fs.symlinkSync(
    createOutsideConstants('js'),
    path.join(distRoleRoot, 'constants'),
    platformDirectoryLinkType(),
  )

  expect(() => resolveRoleManifestPath(repoRoot, 'alpha', { preferDist: true })).toThrow(/manifest.*outside|outside.*repo/i)
})
