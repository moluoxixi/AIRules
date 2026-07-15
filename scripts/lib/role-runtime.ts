import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { parseDocument } from 'yaml'
import { requireRoleName } from './role-assets.js'

export const ROLE_RUNTIME_API_VERSION = 1 as const

export type AgentCardProjectionFormat = 'markdown' | 'toml'

export interface AgentCardProjection {
  content: string
  fileName: string
}

export type AgentCardProjectionRenderer = (
  sourceFile: string,
  format: AgentCardProjectionFormat,
) => AgentCardProjection

export interface RoleCliResult {
  exitCode: number
  stderr: string
  stdout: string
}

export interface RoleWorkflowEnvironment {
  cwd: string
  env: NodeJS.ProcessEnv
  roleRoot: string
}

export interface AirulesRoleRuntime {
  apiVersion: typeof ROLE_RUNTIME_API_VERSION
  roleId: string
  roleVersion: string
  renderAgentCardProjection: AgentCardProjectionRenderer
  runWorkflowCli: (args: string[], environment: RoleWorkflowEnvironment) => RoleCliResult
}

export interface LoadedRoleRuntime {
  roleRoot: string
  runtime: AirulesRoleRuntime
}

interface RoleRuntimeManifest {
  role_id: string
  role_version: string
  runtime: {
    api_version: number
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readRuntimeManifest(roleRoot: string): RoleRuntimeManifest {
  const manifestFile = path.join(roleRoot, 'role.yaml')
  const stats = fs.lstatSync(manifestFile, { throwIfNoEntry: false })
  if (!stats?.isFile() || stats.isSymbolicLink()) {
    throw new Error(`AIRules role runtime manifest must be a plain file: ${manifestFile}`)
  }

  const document = parseDocument(fs.readFileSync(manifestFile, 'utf8'), {
    merge: false,
    prettyErrors: true,
    strict: true,
    uniqueKeys: true,
  })
  if (document.errors.length > 0) {
    throw new Error(`Invalid AIRules role runtime manifest ${manifestFile}: ${document.errors.map(error => error.message).join('; ')}`)
  }

  const value = document.toJS({ maxAliasCount: 0 }) as unknown
  if (!isRecord(value) || typeof value.role_id !== 'string' || typeof value.role_version !== 'string' || !isRecord(value.runtime)) {
    throw new Error(`AIRules role runtime manifest is incomplete: ${manifestFile}`)
  }
  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/u.test(value.role_version)) {
    throw new TypeError(`AIRules role_version must be a semantic version: ${manifestFile}`)
  }
  const apiVersion = value.runtime.api_version
  if (!Number.isInteger(apiVersion)) {
    throw new TypeError(`AIRules role runtime api_version must be an integer: ${manifestFile}`)
  }
  return {
    role_id: value.role_id,
    role_version: value.role_version,
    runtime: { api_version: apiVersion as number },
  }
}

export function resolveRoleRoot(options: {
  configuredRoot?: string
  home: string
  repoRoot: string
  role: string
}): string {
  const role = requireRoleName(options.role)
  const candidates = options.configuredRoot === undefined
    ? [
        path.join(path.resolve(options.repoRoot), 'roles', role),
        path.join(path.resolve(options.home), 'roles', role),
      ]
    : [path.resolve(options.configuredRoot)]
  const selected = candidates.find(candidate => fs.lstatSync(candidate, { throwIfNoEntry: false })?.isDirectory())
  if (selected === undefined) {
    throw new Error(`AIRules role "${role}" is not installed; checked: ${candidates.join(', ')}`)
  }

  const roleRoot = fs.realpathSync(selected)
  const manifest = readRuntimeManifest(roleRoot)
  if (manifest.role_id !== role) {
    throw new Error(`AIRules role manifest id "${manifest.role_id}" does not match requested role "${role}"`)
  }
  return roleRoot
}

function runtimeCandidates(repoRoot: string, role: string, preferDist: boolean): string[] {
  const sourceRoot = path.join(repoRoot, 'roles', role, 'runtime')
  const distRoot = path.join(repoRoot, 'dist', 'roles', role, 'runtime')
  const source = [
    path.join(sourceRoot, 'index.ts'),
    path.join(sourceRoot, 'index.mjs'),
    path.join(sourceRoot, 'index.js'),
  ]
  const compiled = [path.join(distRoot, 'index.js')]
  return preferDist ? [...compiled, ...source.slice(1)] : [...source, ...compiled]
}

function requireRoleRuntime(value: unknown, source: string): AirulesRoleRuntime {
  if (!isRecord(value)
    || value.apiVersion !== ROLE_RUNTIME_API_VERSION
    || typeof value.roleId !== 'string'
    || typeof value.roleVersion !== 'string'
    || typeof value.renderAgentCardProjection !== 'function'
    || typeof value.runWorkflowCli !== 'function') {
    throw new Error(`Invalid AIRules role runtime export: ${source}`)
  }
  return value as unknown as AirulesRoleRuntime
}

export async function loadRoleRuntime(options: {
  configuredRoleRoot?: string
  home: string
  preferDist?: boolean
  repoRoot: string
  role: string
}): Promise<LoadedRoleRuntime> {
  const role = requireRoleName(options.role)
  const repoRoot = fs.realpathSync(path.resolve(options.repoRoot))
  const roleRoot = resolveRoleRoot({
    configuredRoot: options.configuredRoleRoot,
    home: options.home,
    repoRoot,
    role,
  })
  const manifest = readRuntimeManifest(roleRoot)
  if (manifest.runtime.api_version !== ROLE_RUNTIME_API_VERSION) {
    throw new Error(
      `AIRules role "${role}" requires runtime API ${manifest.runtime.api_version}; this CLI supports ${ROLE_RUNTIME_API_VERSION}`,
    )
  }

  const entry = runtimeCandidates(repoRoot, role, options.preferDist === true)
    .find(candidate => fs.lstatSync(candidate, { throwIfNoEntry: false })?.isFile())
  if (entry === undefined) {
    throw new Error(`AIRules role "${role}" has no packaged runtime implementation in ${repoRoot}`)
  }

  const resolvedEntry = fs.realpathSync(entry)
  const relativeEntry = path.relative(repoRoot, resolvedEntry)
  if (relativeEntry === '..' || relativeEntry.startsWith(`..${path.sep}`) || path.isAbsolute(relativeEntry)) {
    throw new Error(`AIRules role runtime entry resolves outside the package root: ${entry}`)
  }
  const module = await import(pathToFileURL(resolvedEntry).href)
  const runtime = requireRoleRuntime(module.roleRuntime ?? module.default, entry)
  if (runtime.roleId !== manifest.role_id || runtime.roleVersion !== manifest.role_version) {
    throw new Error(
      `AIRules role/runtime mismatch: assets=${manifest.role_id}@${manifest.role_version}, runtime=${runtime.roleId}@${runtime.roleVersion}`,
    )
  }
  return { roleRoot, runtime }
}
