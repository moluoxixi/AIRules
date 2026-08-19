import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, expect, it } from 'vitest'
import {
  DEFAULT_ROLE,
  requireRolePaths,
  resolveRoleManifestPath,
  roleOverlayOrder,
} from '../roles.js'

const temporaryRoots: string[] = []

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true })
  }
})

function createRepo(): string {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'airules-role-paths-'))
  temporaryRoots.push(repoRoot)
  for (const role of ['alpha', 'example-development']) {
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

function writeRoleManifest(repoRoot: string, role: string, content = 'export const vendors = []\n'): void {
  const manifestFile = path.join(repoRoot, 'roles', role, 'constants', 'skills.ts')
  fs.mkdirSync(path.dirname(manifestFile), { recursive: true })
  fs.writeFileSync(manifestFile, content, 'utf8')
}

it('uses an empty string as the default role', () => {
  expect(DEFAULT_ROLE).toBe('')
})

it('requires a valid role when resolving explicit role paths', () => {
  const repoRoot = createRepo()

  expect(() => requireRolePaths(repoRoot, undefined)).toThrow(/role name/i)
})

it('fails closed when an explicit role is missing required directories or constants', () => {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'airules-role-structure-'))
  temporaryRoots.push(repoRoot)

  expect(() => requireRolePaths(repoRoot, 'alpha')).toThrow(/unknown AIRules role/i)

  fs.mkdirSync(path.join(repoRoot, 'roles', 'alpha'), { recursive: true })
  expect(() => requireRolePaths(repoRoot, 'alpha')).toThrow(/constants directory/i)

  fs.mkdirSync(path.join(repoRoot, 'roles', 'alpha', 'constants'))
  expect(() => requireRolePaths(repoRoot, 'alpha')).toThrow(/role constants/i)
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

it('resolves a repository reached through a filesystem alias', () => {
  const repoRoot = createRepo()
  const aliasRoot = `${repoRoot}-alias`
  temporaryRoots.push(aliasRoot)
  fs.symlinkSync(repoRoot, aliasRoot, platformDirectoryLinkType())

  expect(requireRolePaths(aliasRoot, 'alpha')).toMatchObject({
    role: 'alpha',
    roleRoot: fs.realpathSync(path.join(repoRoot, 'roles', 'alpha')),
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

it('resolves the source or compiled empty-role manifest without requiring a roles tree', () => {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'airules-empty-role-manifest-'))
  temporaryRoots.push(repoRoot)
  const sourceManifest = path.join(repoRoot, 'scripts', 'lib', 'empty-role-manifest.ts')
  const distManifest = path.join(repoRoot, 'dist', 'scripts', 'lib', 'empty-role-manifest.js')
  fs.mkdirSync(path.dirname(sourceManifest), { recursive: true })
  fs.writeFileSync(sourceManifest, 'export const vendors = []\n', 'utf8')

  expect(resolveRoleManifestPath(repoRoot, '')).toBe(sourceManifest)
  expect(resolveRoleManifestPath(repoRoot, '', { preferDist: true })).toBe(sourceManifest)

  fs.mkdirSync(path.dirname(distManifest), { recursive: true })
  fs.writeFileSync(distManifest, 'export const vendors = []\n', 'utf8')
  expect(resolveRoleManifestPath(repoRoot, '', { preferDist: true })).toBe(distManifest)
})

it('rejects missing and non-file role manifest candidates', () => {
  const missingRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'airules-missing-role-manifest-'))
  const directoryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'airules-directory-role-manifest-'))
  temporaryRoots.push(missingRoot, directoryRoot)

  expect(() => resolveRoleManifestPath(missingRoot, 'alpha')).toThrow(/missing AIRules role skill manifest/i)

  fs.mkdirSync(path.join(directoryRoot, 'roles', 'alpha', 'constants', 'skills.ts'), { recursive: true })
  expect(() => resolveRoleManifestPath(directoryRoot, 'alpha')).toThrow(/manifest is not a file/i)
})

it('returns no overlays for the empty role and deduplicates shared ancestors', async () => {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'airules-role-diamond-'))
  temporaryRoots.push(repoRoot)
  writeRoleManifest(repoRoot, 'base')
  writeRoleManifest(repoRoot, 'left', `export const extendsRoles = ['base']\nexport const vendors = []\n`)
  writeRoleManifest(repoRoot, 'right', `export const extendsRoles = ['base']\nexport const vendors = []\n`)
  writeRoleManifest(repoRoot, 'root', `export const extendsRoles = ['left', 'right']\nexport const vendors = []\n`)

  await expect(roleOverlayOrder(repoRoot, '')).resolves.toEqual([])
  await expect(roleOverlayOrder(repoRoot, 'root')).resolves.toEqual(['base', 'left', 'right', 'root'])
})

it('rejects cyclic inheritance and malformed extendsRoles exports', async () => {
  const cycleRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'airules-role-cycle-'))
  const malformedRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'airules-role-extends-invalid-'))
  temporaryRoots.push(cycleRoot, malformedRoot)
  writeRoleManifest(cycleRoot, 'alpha', `export const extendsRoles = ['beta']\nexport const vendors = []\n`)
  writeRoleManifest(cycleRoot, 'beta', `export const extendsRoles = ['alpha']\nexport const vendors = []\n`)
  writeRoleManifest(malformedRoot, 'alpha', 'export const extendsRoles = [1]\nexport const vendors = []\n')

  await expect(roleOverlayOrder(cycleRoot, 'alpha')).rejects.toThrow(/inheritance cycle/i)
  await expect(roleOverlayOrder(malformedRoot, 'alpha')).rejects.toThrow(/must be a string array/i)
})
