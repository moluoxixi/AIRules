import { createHash, randomUUID } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import * as smolToml from 'smol-toml'
import { requireRoleName } from './role-assets.js'

export interface ProjectionState {
  version: 1
  host: string
  role: string
  skills: Array<{ source: string, target: string }>
  rules?:
    | { source: string, target: string, mode: 'symlink' }
    | { source: string, target: string, mode: 'append', contentHash: string }
  mcp?: {
    target: string
    format: 'json' | 'toml'
    serversKey: string
    servers: Record<string, string>
  }
  hooks: Array<{
    source: string
    scriptTarget: string
    scriptHash: string
    target: string
    format: 'json' | 'toml'
    nesting: 'flat' | 'group'
    event: string
    scriptName: string
    command: string
  }>
}

const identifierPattern = /^[a-z0-9][a-z0-9-]{0,62}$/u
const sha256Pattern = /^[a-f0-9]{64}$/u
const baselineBlockPattern = /\n*<!-- AIRULES:BASELINE:START -->\n([\s\S]*?)\n<!-- AIRULES:BASELINE:END -->\n*/u

export function readProjectionState(home: string, host: string): ProjectionState | undefined {
  const target = projectionStatePath(home, host)
  if (!fs.existsSync(target)) {
    return undefined
  }

  let value: unknown
  try {
    value = JSON.parse(fs.readFileSync(target, 'utf8'))
  }
  catch (error) {
    throw new Error(`Failed to read AIRules projection state: ${target}`, { cause: error })
  }

  return parseProjectionState(value, host, target)
}

export function writeProjectionState(home: string, state: ProjectionState): void {
  const target = projectionStatePath(home, state.host)
  fs.mkdirSync(path.dirname(target), { recursive: true })
  const temporary = `${target}.tmp-${process.pid}-${randomUUID()}`

  try {
    fs.writeFileSync(temporary, `${JSON.stringify(state, null, 2)}\n`, 'utf8')
    fs.renameSync(temporary, target)
  }
  catch (error) {
    fs.rmSync(temporary, { force: true })
    throw new Error(`Failed to write AIRules projection state: ${target}`, { cause: error })
  }
}

export function hashProjectionValue(value: unknown): string {
  return createHash('sha256').update(canonicalJson(value)).digest('hex')
}

export function removeManagedProjection(state: ProjectionState): void {
  for (const skill of state.skills) {
    removeMatchingLink(skill.source, skill.target)
  }

  if (state.rules) {
    removeManagedRules(state.rules)
  }

  if (state.mcp) {
    removeManagedMcpServers(state.mcp)
  }

  for (const hook of state.hooks) {
    if (removeManagedHookEntry(hook)) {
      removeManagedHookScript(hook)
    }
  }
}

function projectionStatePath(home: string, host: string): string {
  if (!identifierPattern.test(host)) {
    throw new TypeError('Invalid AIRules projection host name')
  }
  return path.join(path.resolve(home), 'state', 'projections', `${host}.json`)
}

function parseProjectionState(value: unknown, requestedHost: string, source: string): ProjectionState {
  const root = requireRecord(value, source)
  requireExactFields(root, ['version', 'host', 'role', 'skills', 'rules', 'mcp', 'hooks'], source)

  if (root.version !== 1) {
    throw new Error(`AIRules projection state has unsupported version: ${source}`)
  }

  const host = requireString(root.host, 'host', source)
  if (host !== requestedHost) {
    throw new Error(`AIRules projection state host must be ${requestedHost}: ${source}`)
  }

  const role = requireRoleName(root.role)
  const skills = requireArray(root.skills, 'skills', source).map((item, index) => {
    const entry = requireRecord(item, `${source} skills[${index}]`)
    requireExactFields(entry, ['source', 'target'], `${source} skills[${index}]`)
    return {
      source: requireString(entry.source, 'source', source),
      target: requireString(entry.target, 'target', source),
    }
  })

  const hooks = requireArray(root.hooks, 'hooks', source).map((item, index) => {
    const entry = requireRecord(item, `${source} hooks[${index}]`)
    requireExactFields(
      entry,
      ['source', 'scriptTarget', 'scriptHash', 'target', 'format', 'nesting', 'event', 'scriptName', 'command'],
      `${source} hooks[${index}]`,
    )
    return {
      source: requireString(entry.source, 'source', source),
      scriptTarget: requireString(entry.scriptTarget, 'scriptTarget', source),
      scriptHash: requireHash(entry.scriptHash, 'scriptHash', source),
      target: requireString(entry.target, 'target', source),
      format: requireEnum(entry.format, ['json', 'toml'], 'format', source),
      nesting: requireEnum(entry.nesting, ['flat', 'group'], 'nesting', source),
      event: requireString(entry.event, 'event', source),
      scriptName: requireString(entry.scriptName, 'scriptName', source),
      command: requireString(entry.command, 'command', source),
    }
  })

  const state: ProjectionState = { version: 1, host, role, skills, hooks }
  if (root.rules !== undefined) {
    const rules = requireRecord(root.rules, `${source} rules`)
    const mode = rules.mode
    if (mode === 'symlink') {
      requireExactFields(rules, ['source', 'target', 'mode'], `${source} rules`)
      state.rules = {
        source: requireString(rules.source, 'source', source),
        target: requireString(rules.target, 'target', source),
        mode,
      }
    }
    else if (mode === 'append') {
      requireExactFields(rules, ['source', 'target', 'mode', 'contentHash'], `${source} rules`)
      state.rules = {
        source: requireString(rules.source, 'source', source),
        target: requireString(rules.target, 'target', source),
        mode,
        contentHash: requireHash(rules.contentHash, 'contentHash', source),
      }
    }
    else {
      throw new Error(`AIRules projection state has invalid rules mode: ${source}`)
    }
  }

  if (root.mcp !== undefined) {
    const mcp = requireRecord(root.mcp, `${source} mcp`)
    requireExactFields(mcp, ['target', 'format', 'serversKey', 'servers'], `${source} mcp`)
    const serverHashes = requireRecord(mcp.servers, `${source} mcp.servers`)
    const servers: Record<string, string> = {}
    for (const [name, hash] of Object.entries(serverHashes)) {
      servers[name] = requireHash(hash, `mcp.servers.${name}`, source)
    }
    state.mcp = {
      target: requireString(mcp.target, 'target', source),
      format: requireEnum(mcp.format, ['json', 'toml'], 'format', source),
      serversKey: requireString(mcp.serversKey, 'serversKey', source),
      servers,
    }
  }

  return state
}

function requireRecord(value: unknown, context: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`AIRules projection state must contain an object: ${context}`)
  }
  return value as Record<string, unknown>
}

function requireArray(value: unknown, field: string, source: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new TypeError(`AIRules projection state field ${field} must be an array: ${source}`)
  }
  return value
}

function requireString(value: unknown, field: string, source: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`AIRules projection state field ${field} must be a non-empty string: ${source}`)
  }
  return value
}

function requireHash(value: unknown, field: string, source: string): string {
  const hash = requireString(value, field, source)
  if (!sha256Pattern.test(hash)) {
    throw new Error(`AIRules projection state field ${field} must be a SHA-256 hash: ${source}`)
  }
  return hash
}

function requireEnum<const T extends string>(
  value: unknown,
  allowed: readonly T[],
  field: string,
  source: string,
): T {
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    throw new Error(`AIRules projection state field ${field} has an invalid value: ${source}`)
  }
  return value as T
}

function requireExactFields(value: Record<string, unknown>, fields: string[], context: string): void {
  const allowed = new Set(fields)
  const unknown = Object.keys(value).filter(field => !allowed.has(field))
  if (unknown.length > 0) {
    throw new Error(`AIRules projection state has unknown fields at ${context}: ${unknown.join(', ')}`)
  }
}

function removeMatchingLink(source: string, target: string): void {
  const targetStats = fs.lstatSync(target, { throwIfNoEntry: false })
  if (!targetStats?.isSymbolicLink()) {
    return
  }

  const actualSource = fs.realpathSync(target)
  const expectedSource = fs.realpathSync(source)
  if (samePath(actualSource, expectedSource)) {
    fs.unlinkSync(target)
  }
}

function removeManagedRules(rules: NonNullable<ProjectionState['rules']>): void {
  if (rules.mode === 'symlink') {
    removeMatchingLink(rules.source, rules.target)
    return
  }

  const targetStats = fs.lstatSync(rules.target, { throwIfNoEntry: false })
  if (!targetStats || targetStats.isSymbolicLink() || !targetStats.isFile()) {
    return
  }

  const current = fs.readFileSync(rules.target, 'utf8')
  const match = current.match(baselineBlockPattern)
  if (!match || hashProjectionValue(match[1].trim()) !== rules.contentHash) {
    return
  }

  const cleaned = current.replace(baselineBlockPattern, '\n').trimEnd()
  fs.writeFileSync(rules.target, cleaned.length > 0 ? `${cleaned}\n` : '', 'utf8')
}

function removeManagedMcpServers(mcp: NonNullable<ProjectionState['mcp']>): void {
  if (mcp.format === 'json') {
    removeManagedJsonMcpServers(mcp)
    return
  }
  removeManagedTomlMcpServers(mcp)
}

function removeManagedJsonMcpServers(mcp: NonNullable<ProjectionState['mcp']>): void {
  const targetStats = fs.lstatSync(mcp.target, { throwIfNoEntry: false })
  if (!targetStats || targetStats.isSymbolicLink()) {
    return
  }

  let root: Record<string, unknown>
  try {
    root = requireRecord(JSON.parse(fs.readFileSync(mcp.target, 'utf8').replace(/^\uFEFF/u, '')), mcp.target)
  }
  catch (error) {
    throw new Error(`Failed to clean AIRules MCP projection: ${mcp.target}`, { cause: error })
  }

  let changed = false
  const serversValue = root[mcp.serversKey]
  if (typeof serversValue === 'object' && serversValue !== null && !Array.isArray(serversValue)) {
    const servers = serversValue as Record<string, unknown>
    for (const [name, expectedHash] of Object.entries(mcp.servers)) {
      if (Object.hasOwn(servers, name) && hashProjectionValue(servers[name]) === expectedHash) {
        delete servers[name]
        changed = true
      }
    }
  }

  if (changed) {
    fs.writeFileSync(mcp.target, `${JSON.stringify(root, null, 2)}\n`, 'utf8')
  }
}

function removeManagedTomlMcpServers(mcp: NonNullable<ProjectionState['mcp']>): void {
  const targetStats = fs.lstatSync(mcp.target, { throwIfNoEntry: false })
  if (!targetStats || targetStats.isSymbolicLink()) {
    return
  }

  const current = fs.readFileSync(mcp.target, 'utf8')
  const blockPattern = /\n*# >>> AIRULES MCP >>>\n([\s\S]*?)(?:# <<< AIRULES MCP <<<\n*|$)/u
  const block = current.match(blockPattern)
  if (!block) {
    return
  }

  const serversKey = escapeRegExp(mcp.serversKey)
  const headerPattern = new RegExp(
    `^\\s*\\[${serversKey}\\.(?:"(?:\\\\.|[^"])*"|[\\w-]+)\\]\\s*$`,
    'gmu',
  )
  const headers = [...block[1].matchAll(headerPattern)]
  if (headers.length === 0) {
    return
  }

  const keptSections: string[] = []
  for (let index = 0; index < headers.length; index += 1) {
    const start = headers[index].index
    const end = headers[index + 1]?.index ?? block[1].length
    const section = block[1].slice(start, end)
    const entry = parseSingleTomlServer(section, mcp.serversKey, mcp.target)
    const expectedHash = mcp.servers[entry.name]
    if (expectedHash === undefined || hashProjectionValue(entry.value) !== expectedHash) {
      keptSections.push(section.trim())
    }
  }

  const replacement = keptSections.length > 0
    ? `\n# >>> AIRULES MCP >>>\n${keptSections.join('\n\n')}\n\n# <<< AIRULES MCP <<<\n`
    : '\n'
  const next = current.replace(blockPattern, replacement).trimEnd()
  fs.writeFileSync(mcp.target, next.length > 0 ? `${next}\n` : '', 'utf8')
}

function parseSingleTomlServer(
  section: string,
  serversKey: string,
  target: string,
): { name: string, value: unknown } {
  let parsed: unknown
  try {
    parsed = smolToml.parse(section)
  }
  catch (error) {
    throw new Error(`Failed to clean AIRules MCP projection: ${target}`, { cause: error })
  }

  const root = parsed as Record<string, unknown>
  const table = root[serversKey]
  if (typeof table !== 'object' || table === null || Array.isArray(table)) {
    throw new Error(`Failed to clean AIRules MCP projection: missing ${serversKey} table in ${target}`)
  }
  const entries = Object.entries(table)
  if (entries.length !== 1) {
    throw new Error(`Failed to clean AIRules MCP projection: invalid managed server section in ${target}`)
  }
  return { name: entries[0][0], value: entries[0][1] }
}

function removeManagedHookEntry(hook: ProjectionState['hooks'][number]): boolean {
  const targetStats = fs.lstatSync(hook.target, { throwIfNoEntry: false })
  if (!targetStats) {
    return true
  }
  if (targetStats.isSymbolicLink()) {
    return false
  }
  if (hook.format === 'toml') {
    return removeManagedTomlHookEntry(hook)
  }

  let root: Record<string, unknown>
  try {
    root = requireRecord(JSON.parse(fs.readFileSync(hook.target, 'utf8').replace(/^\uFEFF/u, '')), hook.target)
  }
  catch (error) {
    throw new Error(`Failed to clean AIRules hook projection: ${hook.target}`, { cause: error })
  }

  const hooksValue = root.hooks
  if (hooksValue === undefined) {
    return true
  }
  if (typeof hooksValue !== 'object' || hooksValue === null || Array.isArray(hooksValue)) {
    throw new Error(`Failed to clean AIRules hook projection: hooks must be an object in ${hook.target}`)
  }

  const hooks = hooksValue as Record<string, unknown>
  const eventValue = hooks[hook.event]
  if (eventValue === undefined) {
    return true
  }
  if (!Array.isArray(eventValue)) {
    throw new TypeError(`Failed to clean AIRules hook projection: hooks.${hook.event} must be an array in ${hook.target}`)
  }

  let removed = false
  const nextEntries: unknown[] = []
  for (const entry of eventValue) {
    const result = removeCommandFromHookEntry(entry, hook.nesting, hook.command)
    removed ||= result.removed
    if (result.value !== undefined) {
      nextEntries.push(result.value)
    }
  }

  if (removed) {
    if (nextEntries.length > 0) {
      hooks[hook.event] = nextEntries
    }
    else {
      delete hooks[hook.event]
    }
    root.hooks = hooks
    fs.writeFileSync(hook.target, `${JSON.stringify(root, null, 2)}\n`, 'utf8')
    return true
  }

  return !containsPathReference(eventValue, hook.scriptTarget)
}

function removeManagedTomlHookEntry(hook: ProjectionState['hooks'][number]): boolean {
  const current = fs.readFileSync(hook.target, 'utf8')
  const marker = `AIRULES HOOK ${hook.scriptName}`
  const escapedMarker = escapeRegExp(marker)
  const blockPattern = new RegExp(
    `\\n*# >>> ${escapedMarker} >>>\\n([\\s\\S]*?)(?:# <<< ${escapedMarker} <<<\\n*|$)`,
    'u',
  )
  const block = current.match(blockPattern)
  if (!block) {
    return !current.includes(hook.scriptTarget)
  }

  let parsed: unknown
  try {
    parsed = smolToml.parse(block[1])
  }
  catch (error) {
    throw new Error(`Failed to clean AIRules hook projection: ${hook.target}`, { cause: error })
  }

  const eventHooks = findTomlHookEvent(parsed, hook.event)
  if (!containsExactCommand(eventHooks, hook.command)) {
    return !containsPathReference(eventHooks, hook.scriptTarget)
  }

  const next = current.replace(blockPattern, '\n').trimEnd()
  fs.writeFileSync(hook.target, next.length > 0 ? `${next}\n` : '', 'utf8')
  return true
}

function findTomlHookEvent(value: unknown, event: string): unknown {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return undefined
  }
  const hooks = (value as Record<string, unknown>).hooks
  if (typeof hooks !== 'object' || hooks === null || Array.isArray(hooks)) {
    return undefined
  }
  return (hooks as Record<string, unknown>)[event]
}

function containsExactCommand(value: unknown, command: string): boolean {
  if (Array.isArray(value)) {
    return value.some(item => containsExactCommand(item, command))
  }
  if (typeof value === 'object' && value !== null) {
    const record = value as Record<string, unknown>
    return record.command === command || Object.values(record).some(item => containsExactCommand(item, command))
  }
  return false
}

function removeCommandFromHookEntry(
  value: unknown,
  nesting: 'flat' | 'group',
  command: string,
): { value: unknown, removed: boolean } {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return { value, removed: false }
  }

  const entry = value as Record<string, unknown>
  if (nesting === 'flat') {
    return entry.command === command
      ? { value: undefined, removed: true }
      : { value, removed: false }
  }

  if (!Array.isArray(entry.hooks)) {
    return { value, removed: false }
  }

  const kept = entry.hooks.filter((inner) => {
    return typeof inner !== 'object'
      || inner === null
      || Array.isArray(inner)
      || (inner as Record<string, unknown>).command !== command
  })
  if (kept.length === entry.hooks.length) {
    return { value, removed: false }
  }
  return kept.length > 0
    ? { value: { ...entry, hooks: kept }, removed: true }
    : { value: undefined, removed: true }
}

function containsPathReference(value: unknown, target: string): boolean {
  if (typeof value === 'string') {
    return value.includes(target)
  }
  if (Array.isArray(value)) {
    return value.some(item => containsPathReference(item, target))
  }
  if (typeof value === 'object' && value !== null) {
    return Object.values(value).some(item => containsPathReference(item, target))
  }
  return false
}

function removeManagedHookScript(hook: ProjectionState['hooks'][number]): void {
  const targetStats = fs.lstatSync(hook.scriptTarget, { throwIfNoEntry: false })
  if (!targetStats) {
    return
  }
  if (targetStats.isSymbolicLink()) {
    removeMatchingLink(hook.source, hook.scriptTarget)
    return
  }
  if (targetStats.isFile() && hashProjectionValue(fs.readFileSync(hook.scriptTarget, 'utf8')) === hook.scriptHash) {
    fs.unlinkSync(hook.scriptTarget)
  }
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') {
    return JSON.stringify(value)
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return JSON.stringify(value)
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(',')}]`
  }
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>
    return `{${Object.keys(record).sort().map(key => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(',')}}`
  }
  throw new TypeError('AIRules projection values must be JSON-compatible')
}

function samePath(left: string, right: string): boolean {
  const normalizedLeft = path.normalize(left)
  const normalizedRight = path.normalize(right)
  return process.platform === 'win32'
    ? normalizedLeft.toLowerCase() === normalizedRight.toLowerCase()
    : normalizedLeft === normalizedRight
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
