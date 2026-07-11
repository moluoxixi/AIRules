import type { HookHostAdapter, HookProjection } from '../../constants/hosts.js'
import fs from 'node:fs'
import path from 'node:path'
import { HOST_IDS } from '../../constants/hosts.js'

interface NeutralHookEntry {
  event: string
  script: string
  hosts?: string[]
  eventByHost?: Record<string, string>
}

interface NeutralHookManifest {
  version: 1
  hooks: NeutralHookEntry[]
}

const identifierPattern = /^[A-Za-z][\w-]{0,63}$/u
const scriptPattern = /^[^\W_][\w.-]*\.mjs$/u
const knownHosts = new Set(HOST_IDS)
const managedHookArgument = '--airules-managed-hook'

export function managedHookCommand(scriptTarget: string): string {
  return `node "${scriptTarget}" ${managedHookArgument}`
}

function requireRecord(value: unknown, context: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TypeError(`${context} must be an object`)
  }
  return value as Record<string, unknown>
}

function requireExactFields(value: Record<string, unknown>, allowed: string[], context: string): void {
  const unknown = Object.keys(value).filter(field => !allowed.includes(field))
  if (unknown.length > 0) {
    throw new Error(`${context} has unknown fields: ${unknown.join(', ')}`)
  }
}

function requireIdentifier(value: unknown, field: string): string {
  if (typeof value !== 'string' || !identifierPattern.test(value)) {
    throw new TypeError(`AIRules hook ${field} must be a safe identifier`)
  }
  return value
}

function parseHosts(value: unknown, context: string): string[] | undefined {
  if (value === undefined) {
    return undefined
  }
  if (!Array.isArray(value) || value.length === 0) {
    throw new TypeError(`${context} must be a non-empty array`)
  }
  const hosts = value.map(host => requireIdentifier(host, 'host'))
  const unknownHost = hosts.find(host => !knownHosts.has(host))
  if (unknownHost) {
    throw new Error(`${context} contains unknown host: ${unknownHost}`)
  }
  if (new Set(hosts).size !== hosts.length) {
    throw new Error(`${context} must not contain duplicate hosts`)
  }
  return hosts
}

function parseEventByHost(value: unknown, context: string): Record<string, string> | undefined {
  if (value === undefined) {
    return undefined
  }
  const record = requireRecord(value, context)
  const parsed: Record<string, string> = {}
  for (const [host, event] of Object.entries(record)) {
    const safeHost = requireIdentifier(host, 'host')
    if (!knownHosts.has(safeHost)) {
      throw new Error(`${context} contains unknown host: ${safeHost}`)
    }
    parsed[safeHost] = requireIdentifier(event, 'event')
  }
  return parsed
}

function parseManifest(value: unknown, source: string): NeutralHookManifest {
  const root = requireRecord(value, source)
  requireExactFields(root, ['version', 'hooks'], source)
  if (root.version !== 1) {
    throw new Error(`AIRules hook manifest version must be 1: ${source}`)
  }
  if (!Array.isArray(root.hooks)) {
    throw new TypeError(`AIRules hook manifest hooks must be an array: ${source}`)
  }

  const hooks = root.hooks.map((value, index) => {
    const context = `${source} hooks[${index}]`
    const entry = requireRecord(value, context)
    requireExactFields(entry, ['event', 'script', 'hosts', 'event_by_host'], context)
    const script = entry.script
    if (typeof script !== 'string' || !scriptPattern.test(script) || path.basename(script) !== script) {
      throw new TypeError(`${context} script must be a safe .mjs file name`)
    }
    const hosts = parseHosts(entry.hosts, `${context} hosts`)
    const eventByHost = parseEventByHost(entry.event_by_host, `${context} event_by_host`)
    if (hosts && eventByHost) {
      const unrelatedHost = Object.keys(eventByHost).find(host => !hosts.includes(host))
      if (unrelatedHost) {
        throw new Error(`${context} event_by_host contains host outside hosts: ${unrelatedHost}`)
      }
    }
    return {
      event: requireIdentifier(entry.event, 'event'),
      script,
      hosts,
      eventByHost,
    }
  })

  const unique = new Set<string>()
  for (const hook of hooks) {
    for (const host of hook.hosts ?? ['*']) {
      const key = `${host}\u0000${hook.eventByHost?.[host] ?? hook.event}\u0000${hook.script}`
      if (unique.has(key)) {
        throw new Error(`AIRules hook manifest contains a duplicate dispatch: ${hook.script}`)
      }
      unique.add(key)
    }
  }

  return { version: 1, hooks }
}

export function readNeutralHookManifest(hooksRoot: string): NeutralHookManifest | undefined {
  const source = path.join(hooksRoot, 'hooks.json')
  if (!fs.existsSync(source)) {
    return undefined
  }

  let value: unknown
  try {
    value = JSON.parse(fs.readFileSync(source, 'utf8').replace(/^\uFEFF/u, ''))
  }
  catch (error) {
    throw new Error(`Invalid AIRules hook manifest JSON: ${source}`, { cause: error })
  }
  const manifest = parseManifest(value, source)
  for (const hook of manifest.hooks) {
    const script = path.join(hooksRoot, hook.script)
    const stats = fs.lstatSync(script, { throwIfNoEntry: false })
    if (!stats?.isFile() || stats.isSymbolicLink()) {
      throw new Error(`AIRules hook manifest script does not exist: ${script}`)
    }
  }
  return manifest
}

export function resolveHookDispatches(
  hooksRoot: string,
  host: string,
  adapter: HookHostAdapter | undefined,
): HookProjection[] {
  const manifest = readNeutralHookManifest(hooksRoot)
  if (!manifest) {
    return []
  }
  if (!adapter) {
    if (manifest.hooks.some(hook => hook.hosts?.includes(host))) {
      throw new Error(`AIRules hook manifest targets host without hook support: ${host}`)
    }
    return []
  }

  const resolved = manifest.hooks
    .filter(hook => !hook.hosts || hook.hosts.includes(host))
    .map(hook => ({
      ...adapter,
      event: hook.eventByHost?.[host] ?? hook.event,
      scriptName: hook.script,
    }))

  const unique = new Set<string>()
  for (const hook of resolved) {
    const key = `${hook.event}\u0000${hook.scriptName}`
    if (unique.has(key)) {
      throw new Error(`AIRules hook manifest resolves duplicate ${hook.event} dispatches for host ${host}: ${hook.scriptName}`)
    }
    unique.add(key)
  }
  return resolved
}
