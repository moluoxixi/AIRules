import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, expect, it } from 'vitest'
import { areSamePaths, canonicalPath, isPathInside } from '../canonical-path.js'

const temporaryRoots: string[] = []

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true })
  }
})

function createAliasedRoot(): { actualRoot: string, aliasRoot: string } {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'airules-canonical-path-'))
  temporaryRoots.push(root)
  const actualRoot = path.join(root, 'private', 'var')
  const aliasRoot = path.join(root, 'var')
  fs.mkdirSync(actualRoot, { recursive: true })
  fs.symlinkSync(actualRoot, aliasRoot, process.platform === 'win32' ? 'junction' : 'dir')
  return { actualRoot, aliasRoot }
}

it('canonicalizes symlinked ancestors for existing and future paths', () => {
  const { actualRoot, aliasRoot } = createAliasedRoot()
  const actualExisting = path.join(actualRoot, 'home', 'skills')
  const aliasExisting = path.join(aliasRoot, 'home', 'skills')
  fs.mkdirSync(actualExisting, { recursive: true })

  expect(canonicalPath(aliasExisting)).toBe(canonicalPath(actualExisting))
  expect(areSamePaths(aliasExisting, actualExisting)).toBe(true)
  expect(areSamePaths(path.join(aliasExisting, 'future'), path.join(actualExisting, 'future'))).toBe(true)
  expect(isPathInside(aliasRoot, actualExisting)).toBe(true)
  expect(isPathInside(actualRoot, path.join(aliasExisting, 'future'))).toBe(true)
})

it('uses path segments rather than sibling string prefixes for containment', () => {
  const { actualRoot, aliasRoot } = createAliasedRoot()
  const sibling = `${actualRoot}2`
  fs.mkdirSync(sibling, { recursive: true })

  expect(isPathInside(aliasRoot, sibling)).toBe(false)
})

it('falls back only for equality when symbolic links form a cycle', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'airules-canonical-loop-'))
  temporaryRoots.push(root)
  const first = path.join(root, 'first')
  const second = path.join(root, 'second')
  const linkType = process.platform === 'win32' ? 'junction' : 'dir'
  fs.symlinkSync(second, first, linkType)
  fs.symlinkSync(first, second, linkType)

  expect(areSamePaths(first, first)).toBe(true)
  expect(areSamePaths(first, second)).toBe(false)
  expect(() => isPathInside(root, first)).toThrow(/ELOOP|too many symbolic links/i)
})

it.skipIf(process.platform !== 'darwin')('recognizes the macOS var filesystem alias', () => {
  expect(areSamePaths('/var', '/private/var')).toBe(true)
  expect(isPathInside('/var', '/private/var/folders')).toBe(true)
})
