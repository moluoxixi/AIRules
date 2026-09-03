#!/usr/bin/env node
import type { ResolvedRolePackage, RolePackageWorkspace } from './lib/role-packages.js'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import {
  affectedRolePackageWorkspaces,
  compareSemver,
  discoverRolePackageWorkspaces,
  loadRolePackageWorkspace,
  nextWorkspacePatchVersion,
  npmDistTag,
  writeWorkspaceVersion,
} from './lib/role-packages.js'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const registry = 'https://registry.npmjs.org'

function optionValue(args: string[], name: string): string {
  const index = args.indexOf(name)
  const value = index >= 0 ? args[index + 1] : undefined
  if (!value || value.startsWith('--'))
    throw new Error(`${name} requires a value`)
  return value
}

function executable(name: 'git' | 'npm' | 'pnpm'): string {
  return process.platform === 'win32' && name !== 'git' ? `${name}.cmd` : name
}

function run(command: 'git' | 'npm' | 'pnpm', args: string[], cwd = repoRoot): string {
  const result = spawnSync(executable(command), args, {
    cwd,
    encoding: 'utf8',
    env: process.env,
    shell: process.platform === 'win32' && command !== 'git',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  if (result.error)
    throw result.error
  if (result.status !== 0) {
    throw new Error(
      `${command} ${args.join(' ')} failed (${result.status ?? 'unknown'}):\n${result.stderr || result.stdout}`,
    )
  }
  return result.stdout.trim()
}

function npmViewVersion(specifier: string): string | undefined {
  const result = spawnSync(executable('npm'), ['view', specifier, 'version', '--json', '--registry', registry], {
    cwd: repoRoot,
    encoding: 'utf8',
    env: process.env,
    shell: process.platform === 'win32',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  if (result.status !== 0) {
    if (`${result.stdout}\n${result.stderr}`.includes('E404'))
      return undefined
    throw new Error(`npm view ${specifier} failed:\n${result.stderr || result.stdout}`)
  }
  const parsed = JSON.parse(result.stdout) as unknown
  return typeof parsed === 'string' ? parsed : undefined
}

function delay(milliseconds: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, milliseconds))
}

async function waitForRegistry(rolePackage: ResolvedRolePackage): Promise<void> {
  for (let attempt = 1; attempt <= 20; attempt += 1) {
    if (npmViewVersion(`${rolePackage.name}@${rolePackage.version}`) === rolePackage.version)
      return
    if (attempt < 20)
      await delay(15_000)
  }
  throw new Error(`${rolePackage.name}@${rolePackage.version} did not become visible on npm within 5 minutes`)
}

export interface RolePackagePublishOperations {
  npmViewVersion: (specifier: string) => string | undefined
  run: (command: 'npm' | 'pnpm', args: string[], cwd?: string) => string
  waitForRegistry: (rolePackage: ResolvedRolePackage) => Promise<void>
}

const defaultPublishOperations: RolePackagePublishOperations = {
  npmViewVersion,
  run,
  waitForRegistry,
}

function temporaryPublishTag(version: string): string {
  return `release-${version.toLowerCase().replace(/[^a-z0-9-]+/gu, '-')}`
}

export async function publishWorkspace(
  workspace: RolePackageWorkspace,
  operations: RolePackagePublishOperations = defaultPublishOperations,
): Promise<void> {
  const distTag = npmDistTag(workspace.version)
  const packagePlans = new Map<string, { advanceDistTag: boolean, temporaryTag?: string }>()
  for (const rolePackage of workspace.packages) {
    const currentTaggedVersion = operations.npmViewVersion(`${rolePackage.name}@${distTag}`)
    const advanceDistTag = currentTaggedVersion === undefined
      || compareSemver(currentTaggedVersion, rolePackage.version) <= 0
    const publishedVersion = operations.npmViewVersion(`${rolePackage.name}@${rolePackage.version}`)
    const publishTag = advanceDistTag ? distTag : temporaryPublishTag(rolePackage.version)
    packagePlans.set(rolePackage.name, {
      advanceDistTag,
      ...(!advanceDistTag ? { temporaryTag: publishTag } : {}),
    })
    if (publishedVersion === rolePackage.version) {
      console.log(`[publish] skip existing ${rolePackage.name}@${rolePackage.version}`)
    }
    else {
      console.log(`[publish] ${rolePackage.name}@${rolePackage.version}`)
      operations.run('pnpm', [
        '--dir',
        workspace.roleRoot,
        '--filter',
        rolePackage.name,
        'publish',
        '--no-git-checks',
        '--provenance',
        '--access',
        'public',
        '--tag',
        publishTag,
      ])
    }
    await operations.waitForRegistry(rolePackage)
  }

  for (const rolePackage of workspace.packages) {
    const plan = packagePlans.get(rolePackage.name)
    if (!plan)
      throw new Error(`Missing publish plan for ${rolePackage.name}`)

    if (plan.advanceDistTag) {
      const taggedVersion = operations.npmViewVersion(`${rolePackage.name}@${distTag}`)
      if (taggedVersion !== rolePackage.version) {
        operations.run('npm', [
          'dist-tag',
          'add',
          `${rolePackage.name}@${rolePackage.version}`,
          distTag,
          '--registry',
          registry,
        ])
      }
      if (operations.npmViewVersion(`${rolePackage.name}@${distTag}`) !== rolePackage.version)
        throw new Error(`${rolePackage.name}@${distTag} does not resolve to ${rolePackage.version}`)
      console.log(`[publish] verified ${rolePackage.name}@${rolePackage.version} (${distTag})`)
    }
    else {
      console.log(
        `[publish] preserved ${rolePackage.name}@${distTag} at newer ${operations.npmViewVersion(`${rolePackage.name}@${distTag}`)}`,
      )
    }

    if (
      plan.temporaryTag
      && operations.npmViewVersion(`${rolePackage.name}@${plan.temporaryTag}`) !== undefined
    ) {
      operations.run('npm', [
        'dist-tag',
        'rm',
        rolePackage.name,
        plan.temporaryTag,
        '--registry',
        registry,
      ])
    }
  }
}

function writeGithubOutput(values: Record<string, string>): void {
  const outputPath = process.env.GITHUB_OUTPUT
  if (!outputPath)
    throw new Error('GITHUB_OUTPUT is required with --github')
  fs.appendFileSync(outputPath, `${Object.entries(values).map(([key, value]) => `${key}=${value}`).join('\n')}\n`)
}

function changedPathsBetween(before: string, after: string): string[] {
  return run('git', ['diff', '--name-only', '--diff-filter=ACMRD', before, after])
    .split(/\r?\n/u)
    .filter(Boolean)
}

async function prepareLatest(role: string): Promise<RolePackageWorkspace> {
  const workspace = await loadRolePackageWorkspace(repoRoot, role)
  const version = nextWorkspacePatchVersion(workspace, npmViewVersion)
  writeWorkspaceVersion(workspace, version)
  return loadRolePackageWorkspace(repoRoot, role)
}

async function main(): Promise<void> {
  const [command, ...args] = process.argv.slice(2)
  if (command === 'matrix') {
    let workspaces = await discoverRolePackageWorkspaces(repoRoot)
    const before = args.includes('--before') ? optionValue(args, '--before') : undefined
    const after = args.includes('--after') ? optionValue(args, '--after') : undefined
    if ((before === undefined) !== (after === undefined))
      throw new Error('--before and --after must be provided together')
    if (before && after)
      workspaces = affectedRolePackageWorkspaces(workspaces, changedPathsBetween(before, after))
    const matrix = JSON.stringify({ include: workspaces.map(({ role }) => ({ role })) })
    if (args.includes('--github'))
      writeGithubOutput({ has_changes: String(workspaces.length > 0), matrix })
    else
      process.stdout.write(matrix)
    return
  }
  if (command === 'verify') {
    const workspace = await loadRolePackageWorkspace(repoRoot, optionValue(args, '--role'))
    console.log(`[role-packages] ${workspace.role}@${workspace.version}: ${workspace.packages.map(item => item.name).join(', ')}`)
    return
  }
  if (command === 'prepare-latest') {
    const workspace = await prepareLatest(optionValue(args, '--role'))
    const values = {
      dist_tag: npmDistTag(workspace.version),
      package_count: String(workspace.packages.length),
      role: workspace.role,
      version: workspace.version,
    }
    if (args.includes('--github'))
      writeGithubOutput(values)
    else
      process.stdout.write(`${JSON.stringify(values)}\n`)
    return
  }
  if (command === 'publish') {
    const workspace = await loadRolePackageWorkspace(repoRoot, optionValue(args, '--role'))
    await publishWorkspace(workspace)
    return
  }

  throw new Error('Usage: role-packages <matrix|verify|prepare-latest|publish> [--role <role>] [--before <sha> --after <sha>] [--github]')
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : undefined
if (invokedPath === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  })
}
