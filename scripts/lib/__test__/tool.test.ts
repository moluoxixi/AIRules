import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { it } from 'vitest'
import { resolveHostTargets, resolveToolPaths, syncToHosts, verifyHosts } from '../tool.js'

function withTempDir<T>(prefix: string, run: (tmpDir: string) => T): T {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), prefix))
  try {
    return run(tmpDir)
  }
  finally {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  }
}

async function withTempDirAsync<T>(prefix: string, run: (tmpDir: string) => Promise<T>): Promise<T> {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), prefix))
  try {
    return await run(tmpDir)
  }
  finally {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  }
}

function writeFile(filePath: string, content: string) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, content)
}

it('tool - resolves only selectable hosts and canonicalizes aliases', () => {
  assert.equal(resolveHostTargets('all').includes('agentsmd'), false)
  assert.deepEqual(resolveHostTargets('hermes desktop'), ['hermes'])
  assert.deepEqual(resolveHostTargets('all', ['codex', 'claude']), ['claude', 'codex'])
  assert.throws(() => resolveHostTargets('cursor', ['codex']), /role does not support host "cursor"/i)
  assert.throws(() => resolveHostTargets('agentsmd'), /unknown AIRules host/i)
  assert.throws(() => resolveHostTargets('cc-switch'), /unknown AIRules host/i)
  assert.throws(() => resolveHostTargets('unknown'), /unknown AIRules host/i)
})

it('tool - resolveToolPaths separates the AIRules home from the user home', () => withTempDir('airules-tool-paths-', (tmpDir) => {
  const repoRoot = path.join(tmpDir, 'repo')
  const moluoHome = path.join(tmpDir, 'config', 'airules-home')
  const userHome = path.join(tmpDir, 'user')
  writeFile(path.join(repoRoot, 'roles', 'demo', 'constants', 'skills.ts'), 'export const vendors = []\n')

  const paths = resolveToolPaths(repoRoot, moluoHome, userHome, 'demo')

  assert.equal(paths.repoRoot, path.resolve(repoRoot))
  assert.equal(paths.moluoHome, path.resolve(moluoHome))
  assert.equal(paths.userHome, path.resolve(userHome))
  assert.equal(paths.role, 'demo')
}))

it('tool - source execution prefers the TypeScript role manifest', () => withTempDir('airules-tool-source-manifest-', (tmpDir) => {
  const repoRoot = path.join(tmpDir, 'repo')
  const moluoHome = path.join(tmpDir, 'home')
  writeFile(path.join(repoRoot, 'roles', 'demo', 'constants', 'skills.ts'), 'export const vendors = []\n')
  writeFile(path.join(repoRoot, 'dist', 'roles', 'demo', 'constants', 'skills.js'), 'export const vendors = []\n')

  const paths = resolveToolPaths(repoRoot, moluoHome, os.homedir(), 'demo')

  assert.equal(paths.manifestPath, fs.realpathSync(path.resolve(repoRoot, 'roles', 'demo', 'constants', 'skills.ts')))
}))

it('tool - requires an explicit role', () => withTempDir('airules-tool-required-role-', (tmpDir) => {
  const repoRoot = path.join(tmpDir, 'repo')

  assert.throws(
    () => resolveToolPaths(repoRoot, path.join(tmpDir, 'home'), path.join(tmpDir, 'user'), undefined as unknown as string),
    /role name/i,
  )
}))

it('tool - sync ignores repository and user-local role assets', async () => {
  await withTempDirAsync('airules-tool-remote-only-', async (tmpDir) => {
    const repoRoot = path.join(tmpDir, 'repo')
    const userHome = path.join(tmpDir, 'user')
    const moluoHome = path.join(userHome, '.moluoxixi')
    const codexHome = path.join(userHome, '.codex')
    const role = 'demo'

    writeFile(path.join(repoRoot, 'package.json'), '{"type":"module"}\n')
    writeFile(path.join(repoRoot, 'roles', role, 'constants', 'skills.ts'), `export const hosts = ['codex']
export const vendors = []
`)
    writeFile(path.join(repoRoot, 'roles', role, 'skills', 'repository-only', 'SKILL.md'), 'must not project\n')
    writeFile(path.join(repoRoot, 'roles', role, 'agents', 'repository-only.md'), 'must not project\n')
    writeFile(path.join(moluoHome, 'local', 'skills', 'user-local', 'SKILL.md'), 'must not project\n')
    fs.mkdirSync(codexHome, { recursive: true })

    const result = await syncToHosts({
      repoRoot,
      home: moluoHome,
      userHome,
      host: 'codex',
      role,
      skipVendors: true,
      verify: false,
    })

    assert.deepEqual(result.projectedHosts, ['codex'])
    assert.equal(fs.existsSync(path.join(moluoHome, 'vendor', 'skills', 'repository-only')), false)
    assert.equal(fs.existsSync(path.join(moluoHome, 'vendor', 'skills', 'user-local')), false)
    assert.equal(fs.existsSync(path.join(codexHome, 'skills', 'repository-only')), false)
    assert.equal(fs.existsSync(path.join(codexHome, 'skills', 'user-local')), false)
    assert.equal(fs.existsSync(path.join(codexHome, 'agents', 'repository-only.toml')), false)
  })
})

it('tool - verify fails closed for an unknown host', async () => {
  await withTempDirAsync('airules-tool-verify-unknown-', async (tmpDir) => {
    const repoRoot = path.join(tmpDir, 'repo')
    const userHome = path.join(tmpDir, 'user')
    const moluoHome = path.join(userHome, '.moluoxixi')
    const role = 'demo'
    writeFile(path.join(repoRoot, 'package.json'), '{"type":"module"}\n')
    writeFile(path.join(repoRoot, 'roles', role, 'constants', 'skills.ts'), `export const hosts = ['codex']
export const vendors = []
`)

    await assert.rejects(
      verifyHosts({ repoRoot, home: moluoHome, userHome, host: 'unknown', role }),
      /unknown AIRules host/i,
    )
  })
})

it('tool - rejects a role-unsupported host before staging', async () => {
  await withTempDirAsync('airules-tool-role-hosts-', async (tmpDir) => {
    const repoRoot = path.join(tmpDir, 'repo')
    const userHome = path.join(tmpDir, 'user')
    const moluoHome = path.join(userHome, '.moluoxixi')
    const role = 'demo'
    writeFile(path.join(repoRoot, 'package.json'), '{"type":"module"}\n')
    writeFile(path.join(repoRoot, 'roles', role, 'constants', 'skills.ts'), `export const hosts = ['claude']
export const vendors = []
`)

    await assert.rejects(
      syncToHosts({ repoRoot, home: moluoHome, userHome, host: 'codex', role, skipVendors: true, verify: false }),
      /role does not support host "codex"/i,
    )
    assert.equal(fs.existsSync(moluoHome), false)
    await assert.rejects(
      verifyHosts({ repoRoot, home: moluoHome, userHome, host: 'codex', role }),
      /role does not support host "codex"/i,
    )
  })
})

it('tool - requires named roles to declare hosts and scopes all end to end', async () => {
  await withTempDirAsync('airules-tool-role-all-', async (tmpDir) => {
    const repoRoot = path.join(tmpDir, 'repo')
    const userHome = path.join(tmpDir, 'user')
    const moluoHome = path.join(userHome, '.moluoxixi')
    const role = 'demo'
    const manifestPath = path.join(repoRoot, 'roles', role, 'constants', 'skills.ts')
    writeFile(path.join(repoRoot, 'package.json'), '{"type":"module"}\n')
    writeFile(manifestPath, 'export const vendors = []\n')

    await assert.rejects(
      syncToHosts({ repoRoot, home: moluoHome, userHome, host: 'all', role, skipVendors: true, verify: false }),
      /must export a "hosts" allowlist/i,
    )
    assert.equal(fs.existsSync(moluoHome), false)

    const supportedRole = 'supported'
    writeFile(path.join(repoRoot, 'roles', supportedRole, 'constants', 'skills.ts'), `export const hosts = ['claude', 'codex']
export const vendors = []
`)
    fs.mkdirSync(path.join(userHome, '.claude'), { recursive: true })
    fs.mkdirSync(path.join(userHome, '.codex'), { recursive: true })
    fs.mkdirSync(path.join(userHome, '.cursor'), { recursive: true })

    const result = await syncToHosts({ repoRoot, home: moluoHome, userHome, host: 'all', role: supportedRole, skipVendors: true, verify: false })
    assert.deepEqual(result.projectedHosts, ['claude', 'codex'])
    assert.equal(result.skippedHosts.includes('cursor'), false)
    assert.equal(fs.existsSync(path.join(userHome, '.agents', 'skills')), true)

    const emptyRole = 'empty'
    writeFile(path.join(repoRoot, 'roles', emptyRole, 'constants', 'skills.ts'), `export const hosts = []
export const vendors = []
`)
    const emptyResult = await syncToHosts({ repoRoot, home: moluoHome, userHome, host: 'all', role: emptyRole, skipVendors: true, verify: true })
    assert.deepEqual(emptyResult.projectedHosts, [])
    assert.deepEqual(emptyResult.skippedHosts, [])
    assert.deepEqual(await verifyHosts({ repoRoot, home: moluoHome, userHome, host: 'all', role: emptyRole }), [])
  })
})
