import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, expect, it } from 'vitest'
import { updateRepository } from '../../../bin/repository-update.js'

const temporaryRoots = []
const GIT_TEST_TIMEOUT = 30_000

afterEach(() => {
  for (const root of temporaryRoots.splice(0))
    fs.rmSync(root, { force: true, recursive: true })
})

function git(cwd, ...args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim()
}

function write(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, content, 'utf8')
}

function commit(repo, message) {
  git(repo, 'add', '-A')
  git(repo, 'commit', '-m', message)
}

function createRemoteFixture(initialFiles = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'airules-repository-update-'))
  temporaryRoots.push(root)
  const remote = path.join(root, 'remote.git')
  const seed = path.join(root, 'seed')
  const checkout = path.join(root, 'checkout')

  fs.mkdirSync(remote)
  fs.mkdirSync(seed)
  git(remote, 'init', '--bare')
  git(seed, 'init')
  git(seed, 'config', 'user.email', 'airules@example.invalid')
  git(seed, 'config', 'user.name', 'AIRules Test')
  write(path.join(seed, 'README.md'), 'initial\n')
  for (const [relativePath, content] of Object.entries(initialFiles))
    write(path.join(seed, relativePath), content)
  commit(seed, 'initial')
  git(seed, 'branch', '-M', 'main')
  git(seed, 'remote', 'add', 'origin', remote)
  git(seed, 'push', '-u', 'origin', 'main')
  git(remote, 'symbolic-ref', 'HEAD', 'refs/heads/main')
  git(root, 'clone', remote, checkout)
  git(checkout, 'config', 'user.email', 'airules@example.invalid')
  git(checkout, 'config', 'user.name', 'AIRules Test')
  return { checkout, remote, root, seed }
}

it('fast-forwards a clean AIRules checkout before installation', () => {
  const { checkout, seed } = createRemoteFixture()
  write(path.join(seed, 'roles', 'demo', 'role.yaml'), 'role_id: demo\n')
  commit(seed, 'add role')
  git(seed, 'push')

  const result = updateRepository(checkout, { rebuild: false })

  expect(result.changed).toBe(true)
  expect(result.branch).toBe('main')
  expect(result.upstream).toBe('origin/main')
  expect(fs.readFileSync(path.join(checkout, 'roles', 'demo', 'role.yaml'), 'utf8').replace(/\r\n/gu, '\n')).toBe('role_id: demo\n')
}, GIT_TEST_TIMEOUT)

it('installs dependencies and rebuilds when only the npm lockfile changes', () => {
  const packageJson = `${JSON.stringify({
    name: 'airules-update-fixture',
    version: '1.0.0',
    scripts: {
      build: 'node -e "require(\'node:fs\').writeFileSync(\'build-marker\', \'built\')"',
    },
  }, null, 2)}\n`
  const packageLock = version => `${JSON.stringify({
    name: 'airules-update-fixture',
    version: '1.0.0',
    lockfileVersion: 3,
    requires: true,
    packages: {
      '': {
        name: 'airules-update-fixture',
        version: '1.0.0',
        airulesFixtureRevision: version,
      },
    },
  }, null, 2)}\n`
  const { checkout, seed } = createRemoteFixture({
    'package.json': packageJson,
    'package-lock.json': packageLock(1),
  })
  write(path.join(seed, 'package-lock.json'), packageLock(2))
  commit(seed, 'update lockfile')
  git(seed, 'push')

  const result = updateRepository(checkout)

  expect(result.changed).toBe(true)
  expect(fs.readFileSync(path.join(checkout, 'build-marker'), 'utf8')).toBe('built')
}, GIT_TEST_TIMEOUT)

it('refuses a dirty checkout before pulling', () => {
  const { checkout, seed } = createRemoteFixture()
  write(path.join(checkout, 'local.txt'), 'keep me\n')
  write(path.join(seed, 'remote.txt'), 'remote\n')
  commit(seed, 'remote change')
  git(seed, 'push')

  expect(() => updateRepository(checkout, { rebuild: false })).toThrow(/checkout is dirty/i)
  expect(fs.existsSync(path.join(checkout, 'remote.txt'))).toBe(false)
  expect(fs.readFileSync(path.join(checkout, 'local.txt'), 'utf8')).toBe('keep me\n')
}, GIT_TEST_TIMEOUT)

it('refuses detached and no-upstream checkouts', () => {
  const detached = createRemoteFixture().checkout
  git(detached, 'checkout', '--detach')
  expect(() => updateRepository(detached, { rebuild: false })).toThrow(/must be on a branch/i)

  const noUpstream = createRemoteFixture().checkout
  git(noUpstream, 'branch', '--unset-upstream')
  expect(() => updateRepository(noUpstream, { rebuild: false })).toThrow(/has no upstream/i)
}, GIT_TEST_TIMEOUT)

it('fails closed when a pull cannot fast-forward', () => {
  const { checkout, seed } = createRemoteFixture()
  write(path.join(checkout, 'local.txt'), 'local\n')
  commit(checkout, 'local change')
  write(path.join(seed, 'remote.txt'), 'remote\n')
  commit(seed, 'remote change')
  git(seed, 'push')

  expect(() => updateRepository(checkout, { rebuild: false })).toThrow(/pull --ff-only failed/i)
}, GIT_TEST_TIMEOUT)

it('uses the immutable package when no Git checkout exists', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'airules-package-update-'))
  temporaryRoots.push(root)

  expect(updateRepository(root, { rebuild: false })).toMatchObject({
    changed: false,
    kind: 'package',
    repoRoot: fs.realpathSync(root),
  })
}, GIT_TEST_TIMEOUT)
