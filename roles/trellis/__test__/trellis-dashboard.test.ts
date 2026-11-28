import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
// @ts-expect-error Runtime asset intentionally ships as native JavaScript.
import { launchDashboard } from '../skills/init-project/assets/project-extension/runtime/airules-dashboard.mjs'
// @ts-expect-error Project extension is implemented in native JavaScript.
import { installExtension } from '../skills/init-project/scripts/install-extension.mjs'

const roots: string[] = []
const relative = '.trellis/scripts/airules-dashboard.mjs'

function project(initialized = true) {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'airules dashboard '))
  roots.push(cwd)
  if (initialized)
    fs.mkdirSync(path.join(cwd, '.trellis'))
  return cwd
}

afterEach(() => {
  for (const root of roots.splice(0))
    fs.rmSync(root, { force: true, recursive: true })
})

describe('local Trellis Dashboard', () => {
  it('runs the pinned package from the project with only supported options', () => {
    const cwd = project()
    const spawn = vi.fn(() => ({ status: 4 }))
    expect(launchDashboard(['--port', '3780', '--no-open'], { cwd, platform: 'linux', spawn })).toBe(4)
    expect(spawn).toHaveBeenCalledWith('npm', [
      'exec',
      '--yes',
      '--ignore-scripts',
      '--package=@terranc/trellis-dashboard@0.1.5',
      '--',
      'trellis-dashboard',
      '--no-open',
      '--port',
      '3780',
    ], { cwd, shell: false, stdio: 'inherit' })
  })

  it('keeps project paths out of the Windows shell command', () => {
    const cwd = project()
    const spawn = vi.fn(() => ({ status: 0 }))
    expect(launchDashboard(['--no-open'], { cwd, platform: 'win32', spawn })).toBe(0)
    expect(spawn).toHaveBeenCalledWith(
      'npm.cmd exec --yes --ignore-scripts --package=@terranc/trellis-dashboard@0.1.5 -- trellis-dashboard --no-open',
      [],
      { cwd, shell: true, stdio: 'inherit' },
    )
  })

  it('does not launch outside a project or on unchecked arguments', () => {
    const cwd = project()
    const spawn = vi.fn()
    expect(() => launchDashboard([], { cwd: project(false), spawn })).toThrow('initialized Trellis project')
    expect(() => launchDashboard(['--port', '65536'], { cwd, spawn })).toThrow('1 to 65535')
    expect(() => launchDashboard(['--port', '3780&bad'], { cwd, spawn })).toThrow('1 to 65535')
    expect(() => launchDashboard(['--host', '0.0.0.0'], { cwd, spawn })).toThrow('Unknown option')
    expect(spawn).not.toHaveBeenCalled()
  })

  it('preserves a project-owned launcher rather than silently replacing it', () => {
    const cwd = project()
    const destination = path.join(cwd, relative)
    fs.mkdirSync(path.dirname(destination))
    fs.writeFileSync(destination, '// project-owned\n')
    const result = installExtension({ project: cwd, platforms: ['codex'] })
    expect(result.conflicts).toContain(relative)
    expect(fs.readFileSync(destination, 'utf8')).toBe('// project-owned\n')
  })
})
