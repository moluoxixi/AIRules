import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'

const roots: string[] = []
const sourceScript = fileURLToPath(new URL('../../clean-dist.mjs', import.meta.url))

afterEach(() => {
  for (const root of roots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true })
  }
})

function createFixture(): { packageRoot: string, root: string, script: string } {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'airules-clean-dist-'))
  const packageRoot = path.join(root, 'package')
  const script = path.join(packageRoot, 'scripts', 'clean-dist.mjs')
  roots.push(root)
  fs.mkdirSync(path.dirname(script), { recursive: true })
  fs.copyFileSync(sourceScript, script)
  return { packageRoot, root, script }
}

function runCleaner(script: string) {
  return spawnSync(process.execPath, [script], {
    cwd: path.dirname(path.dirname(script)),
    encoding: 'utf8',
  })
}

describe('clean build output', () => {
  it('wires the guarded cleaner into every npm build', () => {
    const packageRoot = path.resolve(path.dirname(sourceScript), '..')
    const manifest = JSON.parse(fs.readFileSync(path.join(packageRoot, 'package.json'), 'utf8')) as {
      scripts?: Record<string, unknown>
    }

    expect(manifest.scripts?.prebuild).toBe('node scripts/clean-dist.mjs')
  })

  it('removes stale dist content without touching package-external files', () => {
    const { packageRoot, root, script } = createFixture()
    const staleRole = path.join(packageRoot, 'dist', 'roles', 'stale-role', 'runtime', 'index.js')
    const outsideSentinel = path.join(root, 'outside', 'sentinel.txt')
    fs.mkdirSync(path.dirname(staleRole), { recursive: true })
    fs.mkdirSync(path.dirname(outsideSentinel), { recursive: true })
    fs.writeFileSync(staleRole, 'stale\n', 'utf8')
    fs.writeFileSync(outsideSentinel, 'keep\n', 'utf8')

    const result = runCleaner(script)

    expect(result.status, result.stderr).toBe(0)
    expect(fs.existsSync(path.join(packageRoot, 'dist'))).toBe(false)
    expect(fs.readFileSync(outsideSentinel, 'utf8')).toBe('keep\n')
  })

  it('rejects a dist directory link instead of deleting its target', () => {
    const { packageRoot, root, script } = createFixture()
    const outsideDist = path.join(root, 'outside-dist')
    const outsideSentinel = path.join(outsideDist, 'sentinel.txt')
    fs.mkdirSync(outsideDist, { recursive: true })
    fs.writeFileSync(outsideSentinel, 'keep\n', 'utf8')
    fs.symlinkSync(outsideDist, path.join(packageRoot, 'dist'), process.platform === 'win32' ? 'junction' : 'dir')

    const result = runCleaner(script)

    expect(result.status).not.toBe(0)
    expect(result.stderr).toMatch(/refusing to clean a symbolic-link build output/i)
    expect(fs.readFileSync(outsideSentinel, 'utf8')).toBe('keep\n')
  })
})
