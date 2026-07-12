import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { it } from 'vitest'
import { resolveHostTargets, resolveToolPaths, syncToHosts } from '../tool.js'

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

it('tool - resolveHostTargets all does not include the agentsmd shared layer', () => {
  assert.equal(resolveHostTargets('all').includes('agentsmd'), false)
  assert.deepEqual(resolveHostTargets('agentsmd'), ['agentsmd'])
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

  assert.equal(paths.manifestPath, path.resolve(repoRoot, 'roles', 'demo', 'constants', 'skills.ts'))
}))

it('tool - sync ignores repository and user-local role assets', async () => {
  await withTempDirAsync('airules-tool-remote-only-', async (tmpDir) => {
    const repoRoot = path.join(tmpDir, 'repo')
    const userHome = path.join(tmpDir, 'user')
    const moluoHome = path.join(userHome, '.moluoxixi')
    const codexHome = path.join(userHome, '.codex')
    const role = 'demo'

    writeFile(path.join(repoRoot, 'package.json'), '{"type":"module"}\n')
    writeFile(path.join(repoRoot, 'roles', role, 'constants', 'skills.ts'), 'export const vendors = []\n')
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
