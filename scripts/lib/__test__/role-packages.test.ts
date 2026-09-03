import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { publishWorkspace } from '../../role-packages.js'
import {
  affectedRolePackageWorkspaces,
  compareSemver,
  discoverRolePackageWorkspaces,
  loadRolePackageWorkspace,
  nextPatchVersion,
  nextWorkspacePatchVersion,
  npmDistTag,
  writeWorkspaceVersion,
} from '../role-packages.js'

const temporaryRoots: string[] = []

afterEach(() => {
  for (const root of temporaryRoots.splice(0))
    fs.rmSync(root, { recursive: true, force: true })
})

function createRepository(options: { reverseOrder?: boolean, wrongName?: boolean } = {}): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'airules-role-release-'))
  temporaryRoots.push(root)
  fs.writeFileSync(path.join(root, 'package.json'), '{"type":"module"}\n')
  const roleRoot = path.join(root, 'roles', 'demo')
  const core = { name: '@demo/core', version: '1.2.3', publishConfig: { access: 'public' } }
  const cli = {
    name: options.wrongName ? '@demo/wrong' : '@demo/cli',
    version: '1.2.3',
    dependencies: { '@demo/core': 'workspace:*' },
    publishConfig: { access: 'public' },
  }
  for (const [relativePath, manifest] of [['packages/core', core], ['packages/cli', cli]] as const) {
    const directory = path.join(roleRoot, relativePath)
    fs.mkdirSync(directory, { recursive: true })
    fs.writeFileSync(path.join(directory, 'package.json'), `${JSON.stringify(manifest)}\n`)
  }
  const packages = options.reverseOrder
    ? [
        { name: '@demo/cli', path: 'packages/cli' },
        { name: '@demo/core', path: 'packages/core' },
      ]
    : [
        { name: '@demo/core', path: 'packages/core' },
        { name: '@demo/cli', path: 'packages/cli', install: { kind: 'npm-global', version: 'latest' } },
      ]
  const constantsDir = path.join(roleRoot, 'constants')
  fs.mkdirSync(constantsDir, { recursive: true })
  fs.writeFileSync(path.join(constantsDir, 'skills.js'), [
    'export const hosts = []',
    'export const vendors = []',
    `export const packages = ${JSON.stringify(packages)}`,
  ].join('\n'))
  return root
}

describe('role package publication contract', () => {
  it('discovers, validates, and preserves configured publication order', async () => {
    const root = createRepository()
    const workspace = await loadRolePackageWorkspace(root, 'demo')
    expect(workspace.version).toBe('1.2.3')
    expect(workspace.packages.map(rolePackage => rolePackage.name)).toEqual(['@demo/core', '@demo/cli'])
    expect((await discoverRolePackageWorkspaces(root)).map(item => item.role)).toEqual(['demo'])
  })

  it('increments patch versions and selects stable or prerelease npm dist-tags', () => {
    expect(nextPatchVersion('0.6.20')).toBe('0.6.21')
    expect(nextPatchVersion('0.6.20-beta.2')).toBe('0.6.21')
    expect(npmDistTag('0.6.20')).toBe('latest')
    expect(npmDistTag('0.7.0-beta.2')).toBe('beta')
    expect(npmDistTag('0.7.0-1')).toBe('next')
    expect(compareSemver('1.2.3', '1.2.2')).toBeGreaterThan(0)
    expect(compareSemver('1.2.3', '1.2.3-beta.2')).toBeGreaterThan(0)
    expect(compareSemver('1.2.3-beta.10', '1.2.3-beta.2')).toBeGreaterThan(0)
    expect(() => nextPatchVersion('latest')).toThrow(/invalid semver/)
  })

  it('selects changed role workspaces from package and publication config paths', async () => {
    const workspaces = await discoverRolePackageWorkspaces(createRepository())
    expect(affectedRolePackageWorkspaces(workspaces, ['roles/demo/packages/core/src/index.ts']))
      .toEqual(workspaces)
    expect(affectedRolePackageWorkspaces(workspaces, ['.\\roles\\demo\\constants\\skills.js']))
      .toEqual(workspaces)
    expect(affectedRolePackageWorkspaces(workspaces, ['roles/demo/skills/demo/SKILL.md']))
      .toEqual([])
    expect(affectedRolePackageWorkspaces(workspaces, ['roles/other/packages/core/src/index.ts']))
      .toEqual([])
  })

  it('chooses the next unpublished shared patch and rewrites role manifests', async () => {
    const root = createRepository()
    const workspace = await loadRolePackageWorkspace(root, 'demo')
    const versions = new Map<string, string>([
      ['@demo/core@latest', '1.2.3'],
      ['@demo/cli@latest', '1.2.4'],
      ['@demo/core@1.2.5', '1.2.5'],
    ])

    const version = nextWorkspacePatchVersion(workspace, specifier => versions.get(specifier))
    expect(version).toBe('1.2.6')
    writeWorkspaceVersion(workspace, version)

    const rewritten = await loadRolePackageWorkspace(root, 'demo')
    expect(rewritten.version).toBe('1.2.6')
    expect(rewritten.packages.map(rolePackage => rolePackage.version)).toEqual(['1.2.6', '1.2.6'])
    expect(rewritten.packages[1].packageJson.dependencies?.['@demo/core']).toBe('workspace:*')
  })

  it('publishes in configured order without rolling a newer dist-tag backward', async () => {
    const workspace = await loadRolePackageWorkspace(createRepository(), 'demo')
    const versions = new Map<string, string>([
      ['@demo/core@latest', '1.3.0'],
      ['@demo/cli@latest', '1.3.0'],
    ])
    const calls: Array<{ args: string[], command: string }> = []
    await publishWorkspace(workspace, {
      npmViewVersion: specifier => versions.get(specifier),
      run: (command, args) => {
        calls.push({ args, command })
        if (command === 'pnpm') {
          const packageName = args[args.indexOf('--filter') + 1]
          const tag = args[args.indexOf('--tag') + 1]
          versions.set(`${packageName}@1.2.3`, '1.2.3')
          versions.set(`${packageName}@${tag}`, '1.2.3')
        }
        if (command === 'npm' && args[0] === 'dist-tag' && args[1] === 'rm')
          versions.delete(`${args[2]}@${args[3]}`)
        return ''
      },
      waitForRegistry: async rolePackage => expect(versions.get(`${rolePackage.name}@1.2.3`)).toBe('1.2.3'),
    })

    const publishCalls = calls.filter(call => call.command === 'pnpm')
    expect(publishCalls.map(call => call.args[call.args.indexOf('--filter') + 1])).toEqual(['@demo/core', '@demo/cli'])
    expect(publishCalls.every(call => call.args[call.args.indexOf('--tag') + 1] === 'release-1-2-3')).toBe(true)
    expect(calls.filter(call => call.command === 'npm' && call.args[1] === 'rm')).toHaveLength(2)
    expect(calls.some(call => call.command === 'npm' && call.args[1] === 'add')).toBe(false)
    expect(versions.get('@demo/core@latest')).toBe('1.3.0')
    expect(versions.get('@demo/cli@latest')).toBe('1.3.0')
  })

  it('cleans deterministic temporary tags when replaying an interrupted old release', async () => {
    const workspace = await loadRolePackageWorkspace(createRepository(), 'demo')
    const versions = new Map<string, string>([
      ['@demo/core@1.2.3', '1.2.3'],
      ['@demo/core@latest', '1.3.0'],
      ['@demo/core@release-1-2-3', '1.2.3'],
      ['@demo/cli@1.2.3', '1.2.3'],
      ['@demo/cli@latest', '1.3.0'],
      ['@demo/cli@release-1-2-3', '1.2.3'],
    ])
    const calls: Array<{ args: string[], command: string }> = []
    await publishWorkspace(workspace, {
      npmViewVersion: specifier => versions.get(specifier),
      run: (command, args) => {
        calls.push({ args, command })
        if (command === 'npm' && args[0] === 'dist-tag' && args[1] === 'rm')
          versions.delete(`${args[2]}@${args[3]}`)
        return ''
      },
      waitForRegistry: async () => {},
    })

    expect(calls.some(call => call.command === 'pnpm')).toBe(false)
    expect(calls.filter(call => call.command === 'npm' && call.args[1] === 'rm')).toHaveLength(2)
    expect(versions.has('@demo/core@release-1-2-3')).toBe(false)
    expect(versions.has('@demo/cli@release-1-2-3')).toBe(false)
    expect(versions.get('@demo/core@latest')).toBe('1.3.0')
    expect(versions.get('@demo/cli@latest')).toBe('1.3.0')
  })

  it('rejects manifest identity drift and invalid dependency order', async () => {
    await expect(loadRolePackageWorkspace(createRepository({ wrongName: true }), 'demo')).rejects.toThrow(/name mismatch/)
    await expect(loadRolePackageWorkspace(createRepository({ reverseOrder: true }), 'demo')).rejects.toThrow(/must appear before/)
  })

  it('rejects package names owned by more than one role', async () => {
    const root = createRepository()
    const otherRoot = path.join(root, 'roles', 'other')
    fs.mkdirSync(path.join(otherRoot, 'constants'), { recursive: true })
    fs.mkdirSync(path.join(otherRoot, 'packages', 'core'), { recursive: true })
    fs.writeFileSync(path.join(otherRoot, 'constants', 'skills.js'), [
      'export const vendors = []',
      'export const packages = [{ name: \'@demo/core\', path: \'packages/core\' }]',
    ].join('\n'))
    fs.writeFileSync(path.join(otherRoot, 'packages', 'core', 'package.json'), JSON.stringify({
      name: '@demo/core',
      publishConfig: { access: 'public' },
      version: '1.2.3',
    }))
    await expect(discoverRolePackageWorkspaces(root)).rejects.toThrow(/declared by both/)
  })
})
