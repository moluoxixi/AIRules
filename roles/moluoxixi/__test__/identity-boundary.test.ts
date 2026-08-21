import { execFileSync, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'

const roleRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const scanner = path.resolve(roleRoot, '..', '..', 'scripts', 'verify-moluoxixi-identity.mjs')
const temporaryRoots: string[] = []
const blockedProduct = String.fromCharCode(116, 114, 101, 108, 108, 105, 115)
const blockedProductMisspelling = String.fromCharCode(116, 114, 101, 105, 108, 108, 115)
const blockedOrganization = String.fromCharCode(109, 105, 110, 100, 102, 111, 108, 100)

function git(root: string, ...args: string[]): string {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' })
}

function createFixture(): { repositoryRoot: string, fixtureRoleRoot: string } {
  const repositoryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'identity-boundary-'))
  temporaryRoots.push(repositoryRoot)
  const fixtureRoleRoot = path.join(repositoryRoot, 'roles', 'moluoxixi')
  fs.mkdirSync(path.join(fixtureRoleRoot, '.sync'), { recursive: true })
  fs.mkdirSync(path.join(fixtureRoleRoot, 'src'), { recursive: true })
  fs.writeFileSync(path.join(fixtureRoleRoot, '.gitignore'), '.sync/\n', 'utf8')
  fs.writeFileSync(path.join(fixtureRoleRoot, 'src', 'clean.ts'), 'export const roleName = "Moluoxixi"\n', 'utf8')
  fs.writeFileSync(path.join(fixtureRoleRoot, '.sync', 'ignored.txt'), `${blockedProduct}\n`, 'utf8')
  git(repositoryRoot, 'init')
  git(repositoryRoot, 'config', 'user.email', 'identity-boundary@example.test')
  git(repositoryRoot, 'config', 'user.name', 'Identity Boundary Test')
  git(repositoryRoot, 'add', '.')
  git(repositoryRoot, 'commit', '-m', 'fixture')
  return { repositoryRoot, fixtureRoleRoot }
}

function runSourceScan(fixtureRoleRoot: string, extraArgs: string[] = []) {
  const result = spawnSync(process.execPath, [
    scanner,
    '--source-only',
    '--json',
    '--role-root',
    fixtureRoleRoot,
    ...extraArgs,
  ], {
    cwd: fixtureRoleRoot,
    encoding: 'utf8',
  })
  return {
    ...result,
    report: JSON.parse(result.stdout),
  }
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true })
  }
})

describe('moluoxixi identity boundary scanner', () => {
  it('ignores the local maintenance workspace and passes clean role files', () => {
    const { fixtureRoleRoot } = createFixture()
    const result = runSourceScan(fixtureRoleRoot)

    expect(result.status).toBe(0)
    expect(result.stderr).toBe('')
    expect(result.report).toMatchObject({
      status: 'pass',
      scanned: { source: { files: 2 } },
      findings: [],
    })
    expect(fs.existsSync(path.join(fixtureRoleRoot, '.sync', 'reports'))).toBe(false)
  }, 15_000)

  it('detects case, camel, path, and separator variants before commit', () => {
    const { fixtureRoleRoot } = createFixture()
    const pascalCase = `${blockedProduct[0].toUpperCase()}${blockedProduct.slice(1)}`
    fs.writeFileSync(
      path.join(fixtureRoleRoot, 'src', `${blockedProduct.toUpperCase()}_adapter.ts`),
      [
        `export class ${pascalCase}Client {}`,
        `export const split = "${[...blockedProduct].join('_')}"`,
        `export const misspelling = "${blockedProductMisspelling.toUpperCase()}"`,
        `export const organization = "${[...blockedOrganization].join('-')}"`,
        '',
      ].join('\n'),
      'utf8',
    )

    const result = runSourceScan(fixtureRoleRoot)

    expect(result.status).toBe(1)
    expect(result.report.status).toBe('fail')
    expect(result.report.findings).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'path', signature: 'legacy-product' }),
      expect.objectContaining({ kind: 'content', signature: 'legacy-product', line: 1 }),
      expect.objectContaining({ kind: 'content', signature: 'legacy-product', line: 2 }),
      expect.objectContaining({ kind: 'content', signature: 'legacy-product-common-misspelling', line: 3 }),
      expect.objectContaining({ kind: 'content', signature: 'legacy-organization', line: 4 }),
    ]))
  })

  it('passes the current tracked and untracked role source boundary', () => {
    const result = spawnSync(process.execPath, [scanner, '--source-only'], {
      cwd: roleRoot,
      encoding: 'utf8',
    })

    expect(result.status, result.stderr).toBe(0)
    expect(result.stdout).toContain('Identity boundary scan passed.')
  })
})
