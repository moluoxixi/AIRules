#!/usr/bin/env node

import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { assertProjectRoot, commitExtension, safeTarget } from './core/extension-transaction.mjs'

const SKILL_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const ASSET_ROOT = path.join(SKILL_ROOT, 'assets', 'project-extension')
const MANIFEST_PATH = '.moluoxixi/airules-init-manifest.json'
const GENERATOR_VERSION = '1.0.0'
const BLOCK_START = '<!-- MOLUOXIXI KNOWLEDGE:START -->'
const BLOCK_END = '<!-- MOLUOXIXI KNOWLEDGE:END -->'
const HOOK_MARKER = '--airules-knowledge-hook'

export const PLATFORM_ORDER = [
  'claude',
  'cursor',
  'opencode',
  'codex',
  'kilo',
  'kiro',
  'gemini',
  'antigravity',
  'devin',
  'qoder',
  'codebuddy',
  'copilot',
  'droid',
  'dsh',
  'pi',
  'reasonix',
  'zcode',
  'trae',
  'omp',
  'grok',
  'kimi',
  'snow',
]

const SKILL_ROOTS = {
  claude: '.claude/skills',
  cursor: '.cursor/skills',
  opencode: '.opencode/skills',
  codex: '.agents/skills',
  kilo: '.kilocode/skills',
  kiro: '.kiro/skills',
  gemini: '.agents/skills',
  antigravity: '.agent/skills',
  devin: '.devin/skills',
  qoder: '.qoder/skills',
  codebuddy: '.codebuddy/skills',
  copilot: '.github/skills',
  droid: '.factory/skills',
  dsh: '.agents/skills',
  pi: '.agents/skills',
  reasonix: '.reasonix/skills',
  zcode: '.zcode/skills',
  trae: '.trae/skills',
  omp: '.omp/skills',
  grok: '.grok/skills',
  kimi: '.agents/skills',
  snow: '.snow/skills',
}

export function installExtension({ project, platforms, force = false, dryRun = false, failAfter } = {}) {
  const projectRoot = assertProjectRoot(project ?? process.cwd())
  const selected = normalizePlatforms(platforms ?? [])
  const python = pythonCommand()
  if (!fs.statSync(path.join(projectRoot, '.moluoxixi'), { throwIfNoEntry: false })?.isDirectory())
    throw new Error('Run the Moluoxixi project initializer before installing the AIRules extension')

  const manifest = readManifest(projectRoot)
  const plan = new Map()
  addStatic(plan, '.moluoxixi/scripts/common/knowledge.py', 'runtime/common/knowledge.py')
  addStatic(plan, '.moluoxixi/scripts/knowledge.py', 'runtime/knowledge.py')
  addStatic(plan, '.moluoxixi/scripts/knowledge-hook.py', 'runtime/knowledge-hook.py')
  addStatic(plan, '.moluoxixi/knowledge/.gitignore', 'knowledge/gitignore.txt')
  if (selected.includes('opencode'))
    addStatic(plan, '.opencode/plugins/moluoxixi-knowledge.js', 'hosts/opencode/moluoxixi-knowledge.js')
  if (selected.includes('pi'))
    addStatic(plan, '.pi/extensions/moluoxixi-knowledge.ts', 'hosts/pi/moluoxixi-knowledge.ts')
  if (selected.includes('omp'))
    addStatic(plan, '.omp/extensions/moluoxixi-knowledge.ts', 'hosts/pi/moluoxixi-knowledge.ts')

  for (const skillRoot of new Set(selected.map(platform => SKILL_ROOTS[platform]))) {
    addStatic(plan, `${skillRoot}/moluoxixi-knowledge/SKILL.md`, 'skill/SKILL.md', {
      '{{PYTHON_COMMAND}}': python,
    })
    addStatic(plan, `${skillRoot}/moluoxixi-knowledge/references/organization.md`, 'skill/references/organization.md')
  }
  addBlock(plan, 'AGENTS.md', renderAsset('AGENTS.md', { '{{PYTHON_COMMAND}}': python }))
  for (const hook of hooksFor(selected, python))
    addJsonHook(plan, hook)

  const result = {
    projectRoot,
    platforms: selected,
    manifest: MANIFEST_PATH,
    dryRun,
    created: [],
    updated: [],
    unchanged: [],
    preserved: [],
    conflicts: [],
  }
  const operations = []
  const nextEntries = { ...manifest.entries }
  for (const [relativePath, item] of [...plan].sort(([left], [right]) => left.localeCompare(right))) {
    const prepared = prepareItem(projectRoot, relativePath, item, manifest.entries[relativePath], force)
    operations.push(prepared.operation)
    result[prepared.operation.status].push(relativePath)
    if (prepared.entry)
      nextEntries[relativePath] = prepared.entry
  }

  prepareKnowledgeData(projectRoot, operations, result)
  const nextManifest = Buffer.from(`${JSON.stringify({
    schemaVersion: 1,
    generatorVersion: GENERATOR_VERSION,
    platforms: [...new Set([...(manifest.platforms ?? []), ...selected])].sort(),
    entries: Object.fromEntries(Object.entries(nextEntries).sort(([left], [right]) => left.localeCompare(right))),
  }, null, 2)}\n`)
  const manifestTarget = safeTarget(projectRoot, MANIFEST_PATH)
  const manifestExists = fs.existsSync(manifestTarget)
  const currentManifest = manifestExists ? fs.readFileSync(manifestTarget) : undefined
  const manifestStatus = currentManifest?.equals(nextManifest) ? 'unchanged' : manifestExists ? 'updated' : 'created'
  const manifestOperation = { desired: nextManifest, status: manifestStatus, target: manifestTarget }

  if (!dryRun) {
    commitExtension(
      projectRoot,
      operations,
      manifestOperation,
      ['.moluoxixi/knowledge/sources', '.moluoxixi/knowledge/library'],
      { failAfter },
    )
  }
  return result
}

function prepareKnowledgeData(projectRoot, operations, result) {
  const relativePath = '.moluoxixi/knowledge/index.md'
  const target = safeTarget(projectRoot, relativePath)
  if (fs.existsSync(target)) {
    result.preserved.push(relativePath)
    operations.push({ relativePath, status: 'preserved', target })
    return
  }
  result.created.push(relativePath)
  operations.push({ desired: readAsset('knowledge/index.md'), relativePath, status: 'created', target })
}

function prepareItem(projectRoot, relativePath, item, existingEntry, force) {
  const target = safeTarget(projectRoot, relativePath)
  const stats = fs.lstatSync(target, { throwIfNoEntry: false })
  if (stats && (!stats.isFile() || stats.isSymbolicLink()))
    return conflictOperation(relativePath, target)
  const current = stats ? fs.readFileSync(target) : undefined

  if (item.kind === 'file')
    return prepareStatic(relativePath, target, current, item, existingEntry, force)
  if (item.kind === 'block')
    return prepareBlock(relativePath, target, current, item, existingEntry, force)
  return prepareJson(relativePath, target, current, item, existingEntry)
}

function prepareStatic(relativePath, target, current, item, existingEntry, force) {
  if (!current) {
    if (existingEntry)
      return preservedOperation(relativePath, target)
    return managedOperation(relativePath, target, current, item.content, item, 'created', createdOwnership(current))
  }
  if (current.equals(item.content)) {
    if (!existingEntry)
      return preservedOperation(relativePath, target)
    return managedOperation(relativePath, target, current, item.content, item, 'unchanged', existingEntry.ownership)
  }
  if (!existingEntry && !force)
    return conflictOperation(relativePath, target)
  if (existingEntry && sha256(current) !== existingEntry.installedHash && !force)
    return conflictOperation(relativePath, target)
  const ownership = existingEntry?.ownership ?? createdOwnership(current)
  return managedOperation(relativePath, target, current, item.content, item, 'updated', ownership)
}

function prepareBlock(relativePath, target, current, item, existingEntry, force) {
  const source = current?.toString('utf8') ?? ''
  const located = locateBlock(source)
  if (located.malformed)
    return conflictOperation(relativePath, target)
  const desiredBlock = `${BLOCK_START}\n${item.content.toString('utf8').trim()}\n${BLOCK_END}`
  if (located.content && !existingEntry && located.content !== desiredBlock && !force)
    return conflictOperation(relativePath, target)
  if (located.content && existingEntry?.installedBlockHash && sha256(Buffer.from(located.content)) !== existingEntry.installedBlockHash && !force)
    return conflictOperation(relativePath, target)
  const desiredText = located.content
    ? `${source.slice(0, located.start)}${desiredBlock}${source.slice(located.end)}`
    : `${source.trimEnd()}${source.trim() ? '\n\n' : ''}${desiredBlock}\n`
  const desired = Buffer.from(desiredText)
  const status = !current ? 'created' : current.equals(desired) ? 'unchanged' : 'updated'
  const ownership = existingEntry?.ownership ?? createdOwnership(current)
  return {
    operation: { desired, relativePath, status, target },
    entry: {
      kind: 'block',
      installedHash: sha256(desired),
      installedBlockHash: sha256(Buffer.from(desiredBlock)),
      ownership,
      sourceHash: sha256(item.content),
    },
  }
}

function prepareJson(relativePath, target, current, item, existingEntry) {
  let parsed = {}
  if (current) {
    try {
      parsed = JSON.parse(current.toString('utf8'))
    }
    catch {
      return conflictOperation(relativePath, target)
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
      return conflictOperation(relativePath, target)
  }
  const desired = Buffer.from(`${JSON.stringify(upsertJsonHook(parsed, item), null, 2)}\n`)
  const status = !current ? 'created' : current.equals(desired) ? 'unchanged' : 'updated'
  return {
    operation: { desired, relativePath, status, target },
    entry: {
      kind: 'json-hook',
      installedHash: sha256(desired),
      ownership: existingEntry?.ownership ?? createdOwnership(current),
      sourceHash: sha256(Buffer.from(JSON.stringify(item.hook))),
    },
  }
}

function upsertJsonHook(parsed, item) {
  const cloned = structuredClone(parsed)
  let cursor = cloned
  for (const key of item.objectPath.slice(0, -1)) {
    if (!cursor[key] || typeof cursor[key] !== 'object' || Array.isArray(cursor[key]))
      cursor[key] = {}
    cursor = cursor[key]
  }
  const key = item.objectPath.at(-1)
  const existing = Array.isArray(cursor[key]) ? cursor[key] : []
  cursor[key] = [...stripManagedHooks(existing), item.hook]
  return cloned
}

function stripManagedHooks(entries) {
  const output = []
  for (const entry of entries) {
    if (hasHookMarker(entry))
      continue
    if (entry && typeof entry === 'object' && Array.isArray(entry.hooks)) {
      const hooks = entry.hooks.filter(child => !hasHookMarker(child))
      if (hooks.length > 0)
        output.push({ ...entry, hooks })
      else if (!entry.hooks.some(hasHookMarker))
        output.push(entry)
      continue
    }
    output.push(entry)
  }
  return output
}

function hasHookMarker(value) {
  if (!value || typeof value !== 'object')
    return false
  return ['command', 'bash', 'powershell'].some(key => typeof value[key] === 'string' && value[key].includes(HOOK_MARKER))
}

function hooksFor(platforms, python) {
  const command = (platform, event = 'prompt') => `${python} -X utf8 .moluoxixi/scripts/knowledge-hook.py --platform ${platform} --event ${event} ${HOOK_MARKER}`
  const grouped = (platform, event = 'prompt') => ({ hooks: [{ type: 'command', command: command(platform, event), timeout: 15 }] })
  const hooks = []
  const add = (platform, relativePath, objectPath, hook) => {
    if (platforms.includes(platform))
      hooks.push({ platform, relativePath, objectPath, hook })
  }
  add('claude', '.claude/settings.json', ['hooks', 'UserPromptSubmit'], grouped('claude'))
  add('cursor', '.cursor/hooks.json', ['hooks', 'sessionStart'], { command: command('cursor', 'session'), timeout: 15 })
  add('codex', '.codex/hooks.json', ['hooks', 'UserPromptSubmit'], grouped('codex'))
  add('gemini', '.gemini/settings.json', ['hooks', 'BeforeAgent'], grouped('gemini'))
  add('qoder', '.qoder/settings.json', ['hooks', 'UserPromptSubmit'], grouped('qoder'))
  add('codebuddy', '.codebuddy/settings.json', ['hooks', 'UserPromptSubmit'], grouped('codebuddy'))
  add('droid', '.factory/settings.json', ['hooks', 'UserPromptSubmit'], grouped('droid'))
  add('kiro', '.kiro/agents/moluoxixi.json', ['hooks', 'userPromptSubmit'], { command: command('kiro') })
  add('trae', '.trae/hooks.json', ['hooks', 'UserPromptSubmit'], grouped('trae'))
  add('zcode', '.zcode/config.json', ['hooks', 'events', 'UserPromptSubmit'], grouped('zcode'))
  add('snow', '.snow/hooks/onUserMessage.json', ['onUserMessage'], {
    description: 'Inject the AIRules project knowledge index and pending source changes',
    hooks: [{
      type: 'command',
      command: command('snow'),
      timeout: 15000,
      enabled: true,
    }],
  })
  if (platforms.includes('copilot')) {
    const hook = {
      type: 'command',
      bash: command('copilot'),
      powershell: command('copilot'),
      timeoutSec: 15,
    }
    hooks.push({ platform: 'copilot', relativePath: '.github/copilot/hooks.json', objectPath: ['hooks', 'userPromptSubmitted'], hook })
    hooks.push({ platform: 'copilot', relativePath: '.github/hooks/moluoxixi.json', objectPath: ['hooks', 'userPromptSubmitted'], hook })
  }
  return hooks
}

function addStatic(plan, relativePath, assetPath, replacements) {
  const content = replacements ? renderAsset(assetPath, replacements) : readAsset(assetPath)
  plan.set(relativePath, { kind: 'file', content })
}

function addBlock(plan, relativePath, content) {
  plan.set(relativePath, { kind: 'block', content })
}

function addJsonHook(plan, hook) {
  plan.set(hook.relativePath, { kind: 'json-hook', ...hook })
}

function readAsset(relativePath) {
  const normalized = path.posix.normalize(relativePath)
  if (!normalized || normalized === '..' || normalized.startsWith('../') || path.posix.isAbsolute(normalized))
    throw new Error(`Unsafe extension asset: ${relativePath}`)
  const target = path.join(ASSET_ROOT, ...normalized.split('/'))
  const stats = fs.lstatSync(target, { throwIfNoEntry: false })
  if (!stats?.isFile() || stats.isSymbolicLink())
    throw new Error(`Missing extension asset: ${relativePath}`)
  return fs.readFileSync(target)
}

function renderAsset(relativePath, replacements) {
  let content = readAsset(relativePath).toString('utf8')
  for (const [placeholder, value] of Object.entries(replacements))
    content = content.replaceAll(placeholder, value)
  return Buffer.from(content)
}

function managedOperation(relativePath, target, current, desired, item, status, ownership) {
  return {
    operation: { desired, relativePath, status, target },
    entry: {
      kind: item.kind,
      installedHash: sha256(desired),
      ownership,
      sourceHash: sha256(item.content),
    },
  }
}

function conflictOperation(relativePath, target) {
  return { operation: { relativePath, status: 'conflicts', target } }
}

function preservedOperation(relativePath, target) {
  return { operation: { relativePath, status: 'preserved', target } }
}

function createdOwnership(current) {
  if (!current)
    return { type: 'created' }
  return { type: 'modified', originalContent: current.toString('base64'), originalHash: sha256(current) }
}

function locateBlock(source) {
  const start = source.indexOf(BLOCK_START)
  const endMarker = source.indexOf(BLOCK_END)
  if ((start < 0) !== (endMarker < 0) || (start >= 0 && source.includes(BLOCK_START, start + 1)) || (endMarker >= 0 && source.includes(BLOCK_END, endMarker + 1)) || (start >= 0 && endMarker < start))
    return { malformed: true }
  if (start < 0)
    return { malformed: false }
  const end = endMarker + BLOCK_END.length
  return { content: source.slice(start, end), end, malformed: false, start }
}

function readManifest(projectRoot) {
  const target = safeTarget(projectRoot, MANIFEST_PATH)
  if (!fs.existsSync(target))
    return { schemaVersion: 1, entries: {}, platforms: [] }
  let parsed
  try {
    parsed = JSON.parse(fs.readFileSync(target, 'utf8'))
  }
  catch (error) {
    throw new Error(`Cannot read extension manifest: ${error}`)
  }
  if (parsed?.schemaVersion !== 1 || !parsed.entries || typeof parsed.entries !== 'object' || Array.isArray(parsed.entries))
    throw new Error(`Unsupported extension manifest: ${target}`)
  return parsed
}

export function normalizePlatforms(values) {
  const aliases = { 'claude-code': 'claude', 'windsurf': 'devin' }
  const requested = values.flatMap(value => String(value).split(',')).filter(Boolean)
  const expanded = requested.flatMap(value => value === 'all' ? PLATFORM_ORDER : [aliases[value] ?? value])
  const unique = [...new Set(expanded)]
  if (unique.length === 0)
    throw new Error('At least one platform is required for the knowledge extension')
  for (const platform of unique) {
    if (!PLATFORM_ORDER.includes(platform))
      throw new Error(`Unsupported platform: ${platform}`)
  }
  return PLATFORM_ORDER.filter(platform => unique.includes(platform))
}

function pythonCommand() {
  return process.platform === 'win32' ? 'python' : 'python3'
}

function sha256(content) {
  return createHash('sha256').update(content).digest('hex')
}

function parseCli(argv) {
  const options = { platforms: [] }
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--project')
      options.project = argv[++index]
    else if (arg === '--platform')
      options.platforms.push(argv[++index])
    else if (arg === '--force')
      options.force = true
    else if (arg === '--dry-run')
      options.dryRun = true
    else throw new Error(`Unknown extension option: ${arg}`)
  }
  return options
}

if (path.resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  try {
    const result = installExtension(parseCli(process.argv.slice(2)))
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
    if (result.conflicts.length > 0)
      process.exitCode = 2
  }
  catch (error) {
    process.stderr.write(`Error: ${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  }
}
