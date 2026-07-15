import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { loadRoleRuntime, resolveRoleRoot } from '../role-runtime.js'

const roots: string[] = []

afterEach(() => {
  for (const root of roots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true })
  }
})

function temporaryRepository(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'airules-role-runtime-'))
  roots.push(root)
  return root
}

function writeSyntheticRole(
  repoRoot: string,
  role: string,
  options: {
    apiVersion?: number
    assetVersion?: string
    invalidRuntime?: boolean
    manifestRole?: string
    runtimeVersion?: string
    withRuntime?: boolean
  } = {},
): string {
  const roleRoot = path.join(repoRoot, 'roles', role)
  const runtimeRoot = path.join(roleRoot, 'runtime')
  fs.mkdirSync(runtimeRoot, { recursive: true })
  fs.writeFileSync(path.join(roleRoot, 'role.yaml'), [
    `role_id: ${options.manifestRole ?? role}`,
    `role_version: ${options.assetVersion ?? '1.2.3'}`,
    'runtime:',
    `  api_version: ${options.apiVersion ?? 1}`,
    '',
  ].join('\n'))
  if (options.withRuntime !== false) {
    const runtimeSource = options.invalidRuntime
      ? `
export const roleRuntime = { apiVersion: 1 }
`
      : `
export const roleRuntime = {
  apiVersion: 1,
  roleId: ${JSON.stringify(role)},
  roleVersion: ${JSON.stringify(options.runtimeVersion ?? '1.2.3')},
  renderAgentCardProjection(sourceFile, format) {
    return { fileName: format === 'toml' ? 'agent.toml' : 'agent.md', content: sourceFile }
  },
  runWorkflowCli(args, environment) {
    return { exitCode: 0, stdout: JSON.stringify({ args, roleRoot: environment.roleRoot }), stderr: '' }
  },
}
`
    fs.writeFileSync(path.join(runtimeRoot, 'index.mjs'), runtimeSource)
  }
  return roleRoot
}

function directoryLinkType(): 'dir' | 'junction' {
  return process.platform === 'win32' ? 'junction' : 'dir'
}

describe('generic role runtime loading', () => {
  it('loads an arbitrary compatible role without interpreting its workflow vocabulary', async () => {
    const repoRoot = temporaryRepository()
    const roleRoot = writeSyntheticRole(repoRoot, 'alpha')

    expect(resolveRoleRoot({ repoRoot, home: path.join(repoRoot, 'home'), role: 'alpha' })).toBe(fs.realpathSync(roleRoot))
    const loaded = await loadRoleRuntime({ repoRoot, home: path.join(repoRoot, 'home'), role: 'alpha' })
    expect(loaded.runtime.roleId).toBe('alpha')
    expect(loaded.runtime.renderAgentCardProjection('opaque-card', 'markdown')).toEqual({
      fileName: 'agent.md',
      content: 'opaque-card',
    })
    expect(JSON.parse(loaded.runtime.runWorkflowCli(['custom-stage'], {
      cwd: repoRoot,
      env: {},
      roleRoot: loaded.roleRoot,
    }).stdout)).toEqual({ args: ['custom-stage'], roleRoot: fs.realpathSync(roleRoot) })
  })

  it('fails closed for a missing implementation or asset/runtime version drift', async () => {
    const missingRoot = temporaryRepository()
    writeSyntheticRole(missingRoot, 'alpha', { withRuntime: false })
    await expect(loadRoleRuntime({ repoRoot: missingRoot, home: missingRoot, role: 'alpha' }))
      .rejects
      .toThrow(/no packaged runtime implementation/i)

    const driftRoot = temporaryRepository()
    writeSyntheticRole(driftRoot, 'beta', { runtimeVersion: '1.2.4' })
    await expect(loadRoleRuntime({ repoRoot: driftRoot, home: driftRoot, role: 'beta' }))
      .rejects
      .toThrow(/role\/runtime mismatch/i)
  })

  it('fails closed for missing assets, manifest identity drift, and runtime API drift', async () => {
    const missingAssets = temporaryRepository()
    expect(() => resolveRoleRoot({ repoRoot: missingAssets, home: missingAssets, role: 'alpha' }))
      .toThrow(/not installed/i)

    const identityDrift = temporaryRepository()
    writeSyntheticRole(identityDrift, 'alpha', { manifestRole: 'beta' })
    expect(() => resolveRoleRoot({ repoRoot: identityDrift, home: identityDrift, role: 'alpha' }))
      .toThrow(/does not match requested role/i)

    const apiDrift = temporaryRepository()
    writeSyntheticRole(apiDrift, 'alpha', { apiVersion: 2 })
    await expect(loadRoleRuntime({ repoRoot: apiDrift, home: apiDrift, role: 'alpha' }))
      .rejects
      .toThrow(/requires runtime API 2/i)
  })

  it('rejects a module that does not implement the generic runtime interface', async () => {
    const repoRoot = temporaryRepository()
    writeSyntheticRole(repoRoot, 'alpha', { invalidRuntime: true })

    await expect(loadRoleRuntime({ repoRoot, home: repoRoot, role: 'alpha' }))
      .rejects
      .toThrow(/invalid AIRules role runtime export/i)
  })

  it('accepts an explicit role root and a default-exported source runtime', async () => {
    const repoRoot = temporaryRepository()
    const roleRoot = writeSyntheticRole(repoRoot, 'alpha')
    const runtimeEntry = path.join(roleRoot, 'runtime', 'index.mjs')
    fs.writeFileSync(
      runtimeEntry,
      fs.readFileSync(runtimeEntry, 'utf8').replace('export const roleRuntime =', 'export default'),
      'utf8',
    )

    expect(resolveRoleRoot({
      configuredRoot: roleRoot,
      repoRoot,
      home: path.join(repoRoot, 'home'),
      role: 'alpha',
    })).toBe(fs.realpathSync(roleRoot))

    const loaded = await loadRoleRuntime({
      repoRoot,
      home: path.join(repoRoot, 'home'),
      preferDist: true,
      role: 'alpha',
    })
    expect(loaded.runtime.roleId).toBe('alpha')
  })

  it('rejects missing, malformed, incomplete, and invalid runtime manifests', () => {
    const cases: Array<{ manifest?: string, pattern: RegExp }> = [
      { pattern: /must be a plain file/i },
      {
        manifest: 'role_id: alpha\nrole_id: beta\nrole_version: 1.2.3\nruntime:\n  api_version: 1\n',
        pattern: /invalid AIRules role runtime manifest/i,
      },
      { manifest: 'role_id: alpha\nrole_version: 1.2.3\n', pattern: /manifest is incomplete/i },
      {
        manifest: 'role_id: alpha\nrole_version: latest\nruntime:\n  api_version: 1\n',
        pattern: /semantic version/i,
      },
      {
        manifest: 'role_id: alpha\nrole_version: 1.2.3\nruntime:\n  api_version: one\n',
        pattern: /api_version must be an integer/i,
      },
    ]

    for (const [index, testCase] of cases.entries()) {
      const repoRoot = temporaryRepository()
      const roleRoot = writeSyntheticRole(repoRoot, 'alpha')
      const manifestFile = path.join(roleRoot, 'role.yaml')
      if (testCase.manifest === undefined) {
        fs.rmSync(manifestFile)
      }
      else {
        fs.writeFileSync(manifestFile, testCase.manifest, 'utf8')
      }

      expect(
        () => resolveRoleRoot({ repoRoot, home: path.join(repoRoot, `home-${index}`), role: 'alpha' }),
      ).toThrow(testCase.pattern)
    }
  })

  it('rejects a non-object runtime export and a runtime entry outside the package root', async () => {
    const invalidRoot = temporaryRepository()
    const invalidRoleRoot = writeSyntheticRole(invalidRoot, 'alpha')
    fs.writeFileSync(path.join(invalidRoleRoot, 'runtime', 'index.mjs'), 'export const roleRuntime = null\n', 'utf8')
    await expect(loadRoleRuntime({ repoRoot: invalidRoot, home: invalidRoot, role: 'alpha' }))
      .rejects
      .toThrow(/invalid AIRules role runtime export/i)

    const escapedRoot = temporaryRepository()
    const escapedRoleRoot = writeSyntheticRole(escapedRoot, 'alpha')
    const runtimeRoot = path.join(escapedRoleRoot, 'runtime')
    const outsideRoot = temporaryRepository()
    const outsideRuntime = path.join(outsideRoot, 'runtime')
    fs.mkdirSync(outsideRuntime, { recursive: true })
    fs.copyFileSync(path.join(runtimeRoot, 'index.mjs'), path.join(outsideRuntime, 'index.mjs'))
    fs.rmSync(runtimeRoot, { recursive: true })
    fs.symlinkSync(outsideRuntime, runtimeRoot, directoryLinkType())

    await expect(loadRoleRuntime({ repoRoot: escapedRoot, home: escapedRoot, role: 'alpha' }))
      .rejects
      .toThrow(/runtime entry resolves outside the package root/i)
  })
})
