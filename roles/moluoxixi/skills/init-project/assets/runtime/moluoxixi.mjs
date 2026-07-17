#!/usr/bin/env node

import { Buffer } from 'node:buffer'
import { spawnSync } from 'node:child_process'
import { createHash, randomUUID } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const RUNTIME_DIR = path.dirname(fileURLToPath(import.meta.url))
const VERSION = '0.6.7-airules.1'
const PROJECT_ROOT_DIR = '.moluoxixi'
const WORKFLOW_MANIFEST_PATH = `${PROJECT_ROOT_DIR}/workflow.md`
const NAMESPACED_SKILL_RENAMES = {
  'moluoxixi-before-dev': 'before-dev',
  'moluoxixi-brainstorm': 'brainstorm',
  'moluoxixi-break-loop': 'break-loop',
  'channel': 'channel',
  'moluoxixi-continue': 'continue',
  'moluoxixi-finish-work': 'finish-work',
  'meta': 'meta',
  'session-insight': 'session-insight',
  'spec-bootstrap': 'spec-bootstrap',
  'moluoxixi-start': 'start',
  'moluoxixi-update-spec': 'update-spec',
}

function sha256(content) {
  return createHash('sha256').update(content).digest('hex')
}

function findProjectRoot(start = process.cwd()) {
  let current = path.resolve(start)
  while (true) {
    if (fs.existsSync(path.join(current, PROJECT_ROOT_DIR)))
      return current
    const parent = path.dirname(current)
    if (parent === current)
      break
    current = parent
  }
  if (path.basename(path.dirname(RUNTIME_DIR)) === PROJECT_ROOT_DIR)
    return path.resolve(RUNTIME_DIR, '..', '..')
  throw new Error(`No ${PROJECT_ROOT_DIR} directory found from ${start}`)
}

function runNode(entry, args) {
  const result = spawnSync(process.execPath, [entry, ...args], {
    cwd: process.cwd(),
    env: process.env,
    stdio: 'inherit',
    windowsHide: true,
  })
  if (result.error)
    throw result.error
  process.exitCode = result.status ?? 1
}

function parseValue(args, index, flag) {
  const value = args[index + 1]
  if (!value || value.startsWith('-'))
    throw new Error(`${flag} requires a value`)
  return value
}

function update(args) {
  const projectRoot = findProjectRoot()
  const manifestPath = path.join(projectRoot, PROJECT_ROOT_DIR, 'airules-init-manifest.json')
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
  const forwarded = ['--project', projectRoot]
  const platforms = []

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (arg === '--dry-run' || arg === '--force') {
      forwarded.push(arg)
    }
    else if (arg === '--skip-all') {
      continue
    }
    else if (arg === '--platform') {
      platforms.push(...parseValue(args, index++, arg).split(','))
    }
    else if (arg === '--python' || arg === '--developer') {
      forwarded.push(arg, parseValue(args, index++, arg))
    }
    else if (arg === '--help' || arg === '-h') {
      process.stdout.write('Usage: moluoxixi.mjs update [--platform <ids>] [--dry-run] [--force] [--python <command>]\n')
      return
    }
    else {
      throw new Error(`Unsupported AIRules update option: ${arg}`)
    }
  }

  const selected = platforms.length > 0 ? platforms : manifest.platforms
  if (!Array.isArray(selected) || selected.length === 0)
    throw new Error('Cannot infer initialized platforms; pass --platform')
  forwarded.push('--platform', selected.join(','))

  const projectUpdater = path.join(projectRoot, PROJECT_ROOT_DIR, 'runtime', 'update', 'init-project', 'scripts', 'init-project.mjs')
  const bundledUpdater = path.resolve(RUNTIME_DIR, '..', '..', 'scripts', 'init-project.mjs')
  const entry = fs.existsSync(projectUpdater) ? projectUpdater : bundledUpdater
  if (!fs.existsSync(entry))
    throw new Error('AIRules updater assets are missing; re-run the init-project skill')
  runNode(entry, forwarded)
}

function parseWorkflowArgs(args) {
  const result = { createNew: false, force: false, list: false, template: undefined }
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (arg === '--list')
      result.list = true
    else if (arg === '--force' || arg === '-f')
      result.force = true
    else if (arg === '--create-new' || arg === '-n')
      result.createNew = true
    else if (arg === '--template' || arg === '-t')
      result.template = parseValue(args, index++, arg)
    else if (arg === '--help' || arg === '-h')
      result.help = true
    else throw new Error(`Unknown workflow option: ${arg}`)
  }
  return result
}

function writeAtomic(target, content) {
  const temporary = `${target}.airules-new-${randomUUID()}`
  const backup = `${target}.airules-old-${randomUUID()}`
  const existed = fs.existsSync(target)
  fs.writeFileSync(temporary, content, { flag: 'wx' })
  try {
    if (existed)
      fs.renameSync(target, backup)
    fs.renameSync(temporary, target)
    if (existed)
      fs.rmSync(backup, { force: true })
  }
  catch (error) {
    fs.rmSync(temporary, { force: true })
    if (existed && fs.existsSync(backup) && !fs.existsSync(target))
      fs.renameSync(backup, target)
    throw error
  }
}

function localizeNativeWorkflow(content) {
  let localized = content
    .replaceAll('moluoxixi channel', `node ${PROJECT_ROOT_DIR}/runtime/moluoxixi.mjs channel`)
    .replaceAll('moluoxixi mem', `node ${PROJECT_ROOT_DIR}/runtime/moluoxixi.mjs mem`)
    .replaceAll('moluoxixi workflow', `node ${PROJECT_ROOT_DIR}/runtime/moluoxixi.mjs workflow`)
    .replaceAll('moluoxixi update', `node ${PROJECT_ROOT_DIR}/runtime/moluoxixi.mjs update`)
  for (const [namespacedName, canonicalName] of Object.entries(NAMESPACED_SKILL_RENAMES))
    localized = localized.replaceAll(namespacedName, canonicalName)
  return localized
}

function workflow(args) {
  const options = parseWorkflowArgs(args)
  if (options.help) {
    process.stdout.write('Usage: moluoxixi.mjs workflow [--list] [--template native|<local.md>] [--force] [--create-new]\n')
    return
  }
  if (options.list) {
    process.stdout.write('native\tAIRules-migrated Moluoxixi workflow\nlocal-file\tPass a local Markdown path to --template\n')
    return
  }

  const projectRoot = findProjectRoot()
  const manifestPath = path.join(projectRoot, PROJECT_ROOT_DIR, 'airules-init-manifest.json')
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
  const target = path.join(projectRoot, PROJECT_ROOT_DIR, 'workflow.md')
  const templateId = options.template ?? 'native'
  const nativeTemplate = path.join(projectRoot, PROJECT_ROOT_DIR, 'runtime', 'update', 'init-project', 'assets', 'moluoxixi-v0.6.7', 'templates', 'moluoxixi', 'workflow.md')
  const source = templateId === 'native' ? nativeTemplate : path.resolve(projectRoot, templateId)
  if (!fs.statSync(source, { throwIfNoEntry: false })?.isFile())
    throw new Error(`Workflow template is unavailable: ${source}`)
  const desired = templateId === 'native'
    ? Buffer.from(localizeNativeWorkflow(fs.readFileSync(source, 'utf8')))
    : fs.readFileSync(source)
  const current = fs.readFileSync(target)
  const owned = manifest.entries?.[WORKFLOW_MANIFEST_PATH]
  const pristine = owned?.baselineHash === sha256(current)

  if (!current.equals(desired) && !pristine && !options.force && !options.createNew) {
    throw new Error(`${WORKFLOW_MANIFEST_PATH} has local edits; use --force or --create-new`)
  }
  if (current.equals(desired) && !options.createNew) {
    process.stdout.write(`${WORKFLOW_MANIFEST_PATH} already matches the selected template\n`)
    return
  }

  const destination = options.createNew ? `${target}.new` : target
  writeAtomic(destination, desired)
  if (!options.createNew) {
    if (templateId === 'native') {
      manifest.entries[WORKFLOW_MANIFEST_PATH] = {
        baselineHash: sha256(desired),
        mode: 'replace',
        platform: 'shared',
        templateHash: sha256(desired),
      }
    }
    else {
      delete manifest.entries[WORKFLOW_MANIFEST_PATH]
    }
    writeAtomic(manifestPath, Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`))
  }
  process.stdout.write(`${path.relative(projectRoot, destination)} written\n`)
}

function printHelp() {
  process.stdout.write(`Moluoxixi runtime ${VERSION}\n\nUsage: node moluoxixi.mjs <command> [options]\n\nCommands:\n  channel   Durable local multi-agent channels and workers\n  mem       Search local Claude, Codex, and Pi conversation history\n  workflow  List or replace the active project workflow\n  update    Refresh AIRules-owned project assets\n`)
}

try {
  const [command, ...args] = process.argv.slice(2)
  if (!command || command === '--help' || command === '-h' || command === 'help')
    printHelp()
  else if (command === '--version' || command === '-V' || command === 'version')
    process.stdout.write(`${VERSION}\n`)
  else if (command === 'channel' || command === 'mem')
    runNode(path.join(RUNTIME_DIR, 'vendor', 'channel-mem.mjs'), [command, ...args])
  else if (command === 'update')
    update(args)
  else if (command === 'workflow')
    workflow(args)
  else throw new Error(`Unknown command: ${command}`)
}
catch (error) {
  process.stderr.write(`Error: ${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
}
