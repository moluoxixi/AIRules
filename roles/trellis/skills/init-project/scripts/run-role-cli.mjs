#!/usr/bin/env node

import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { installExtension, normalizePlatforms, PLATFORM_ORDER } from './install-extension.mjs'
import { localizeBootstrapTask } from './localize-bootstrap.mjs'

const SKILL_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function main() {
  const options = parseArgs(process.argv.slice(2))
  const projectRoot = resolveProjectRoot(options.project ?? process.cwd())
  const platforms = normalizePlatforms(options.platforms)
  const cli = resolveRoleCli()
  const workflowRootExisted = fs.existsSync(path.join(projectRoot, '.trellis'))
  const bootstrapTaskExisted = fs.existsSync(path.join(projectRoot, '.trellis', 'tasks', '00-bootstrap-guidelines', 'task.json'))
  const cliArgs = [
    'init',
    ...platforms.map(nativePlatformFlag),
    ...options.passthrough,
  ]
  const command = cli.kind === 'node' ? process.execPath : cli.entry
  const args = cli.kind === 'node' ? [cli.entry, ...cliArgs] : cliArgs
  const result = spawnSync(command, args, {
    cwd: projectRoot,
    env: process.env,
    stdio: 'inherit',
    windowsHide: true,
  })
  if (result.error)
    throw result.error
  if (result.status !== 0) {
    process.exitCode = result.status ?? 1
    return
  }
  if (!fs.statSync(path.join(projectRoot, '.trellis'), { throwIfNoEntry: false })?.isDirectory())
    throw new Error('Trellis initialization exited successfully but did not create .trellis')

  const bootstrapTaskCreated = !bootstrapTaskExisted
    && fs.existsSync(path.join(projectRoot, '.trellis', 'tasks', '00-bootstrap-guidelines', 'task.json'))
  const bootstrapLocalization = bootstrapTaskExisted
    ? { status: 'preserved', reason: 'preexisting-task' }
    : workflowRootExisted
      ? { status: 'preserved', reason: 'reinitialization' }
      : localizeBootstrapTask({
          project: projectRoot,
          enabled: true,
        })
  const extension = installExtension({
    project: projectRoot,
    platforms,
    force: options.force,
  })
  const readme = injectReadme(projectRoot)
  process.stdout.write(`${JSON.stringify({
    freshInitialization: !workflowRootExisted,
    bootstrapTaskCreated,
    bootstrapLocalization,
    extension,
    readme,
  }, null, 2)}\n`)
  if (extension.conflicts.length > 0 || readme.status === 'conflict')
    process.exitCode = 2
}

function parseArgs(argv) {
  const options = { force: false, passthrough: [], platforms: [], project: undefined }
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--project') {
      options.project = requireValue(argv, ++index, '--project')
      continue
    }
    if (arg.startsWith('--project=')) {
      options.project = arg.slice('--project='.length)
      continue
    }
    if (arg === '--platform') {
      options.platforms.push(requireValue(argv, ++index, '--platform'))
      continue
    }
    if (arg.startsWith('--platform=')) {
      options.platforms.push(arg.slice('--platform='.length))
      continue
    }
    if (arg === '--developer') {
      options.passthrough.push('-u', requireValue(argv, ++index, '--developer'))
      continue
    }
    if (arg.startsWith('--developer=')) {
      options.passthrough.push('-u', arg.slice('--developer='.length))
      continue
    }
    if (arg === '--force')
      options.force = true
    const platform = platformFlag(arg)
    if (platform)
      options.platforms.push(platform)
    else options.passthrough.push(arg)
  }
  return options
}

function platformFlag(arg) {
  if (arg === '--claude' || arg === '--claude-code')
    return 'claude'
  if (arg === '--windsurf')
    return 'devin'
  const value = arg.startsWith('--') ? arg.slice(2) : ''
  return PLATFORM_ORDER.includes(value) ? value : undefined
}

function nativePlatformFlag(platform) {
  return platform === 'claude' ? '--claude' : `--${platform}`
}

function requireValue(argv, index, option) {
  const value = argv[index]
  if (!value || value.startsWith('--'))
    throw new Error(`${option} requires a value`)
  return value
}

function resolveProjectRoot(value) {
  const root = path.resolve(value)
  const stats = fs.lstatSync(root, { throwIfNoEntry: false })
  if (!stats?.isDirectory() || stats.isSymbolicLink())
    throw new Error(`Project root must be a real directory: ${root}`)
  if (root === path.resolve(os.homedir()) && process.env.TRELLIS_ALLOW_HOMEDIR !== '1')
    throw new Error('Refusing to initialize the user home directory')
  return root
}

function resolveRoleCli() {
  if (process.env.TRELLIS_ROLE_CLI)
    return classifyEntry(path.resolve(process.env.TRELLIS_ROLE_CLI))
  if (process.platform !== 'win32')
    return { entry: 'trellis', kind: 'command' }

  const searchRoots = new Set()
  for (const entry of String(process.env.PATH ?? '').split(path.delimiter)) {
    if (entry)
      searchRoots.add(path.resolve(entry))
  }
  if (process.env.APPDATA)
    searchRoots.add(path.resolve(process.env.APPDATA, 'npm'))
  if (process.env.npm_config_prefix)
    searchRoots.add(path.resolve(process.env.npm_config_prefix))

  for (const binRoot of searchRoots) {
    const packageRoot = path.join(binRoot, 'node_modules', '@mindfoldhq', 'trellis')
    const packageJson = path.join(packageRoot, 'package.json')
    if (!fs.statSync(packageJson, { throwIfNoEntry: false })?.isFile())
      continue
    let manifest
    try {
      manifest = JSON.parse(fs.readFileSync(packageJson, 'utf8'))
    }
    catch {
      continue
    }
    const bin = typeof manifest.bin === 'string' ? manifest.bin : manifest.bin?.trellis
    if (typeof bin !== 'string')
      continue
    const entry = path.resolve(packageRoot, bin)
    const relative = path.relative(packageRoot, entry)
    if (relative && relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative) && fs.statSync(entry, { throwIfNoEntry: false })?.isFile())
      return { entry, kind: 'node' }
  }
  throw new Error('The installed Trellis CLI is missing; run `airules install trellis` first')
}

function classifyEntry(entry) {
  if (!fs.statSync(entry, { throwIfNoEntry: false })?.isFile())
    throw new Error(`Trellis role CLI does not exist: ${entry}`)
  return { entry, kind: /\.[cm]?js$/iu.test(entry) ? 'node' : 'command' }
}

function injectReadme(projectRoot) {
  const injector = process.env.TRELLIS_README_INJECTOR
    ? path.resolve(process.env.TRELLIS_README_INJECTOR)
    : path.join(SKILL_ROOT, 'scripts', 'inject-readme.mjs')
  if (!fs.statSync(injector, { throwIfNoEntry: false })?.isFile())
    throw new Error(`Trellis README injector does not exist: ${injector}`)
  const result = spawnSync(process.execPath, [injector, '--project', projectRoot], {
    cwd: projectRoot,
    encoding: 'utf8',
    env: process.env,
    windowsHide: true,
  })
  if (result.error)
    throw result.error
  if (result.status === 2) {
    if (result.stderr)
      process.stderr.write(result.stderr)
    return { status: 'conflict' }
  }
  if (result.status !== 0) {
    const error = new Error(`Trellis README injector failed with exit code ${result.status ?? 1}${result.stderr ? `: ${result.stderr.trim()}` : ''}`)
    error.exitCode = result.status ?? 1
    throw error
  }
  try {
    return JSON.parse(result.stdout)
  }
  catch {
    throw new Error('README injector returned invalid output')
  }
}

try {
  main()
}
catch (error) {
  process.stderr.write(`Error: ${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = Number.isInteger(error?.exitCode) ? error.exitCode : 1
}
