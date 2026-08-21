#!/usr/bin/env node

import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { installExtension, normalizePlatforms, PLATFORM_ORDER } from './install-extension.mjs'

const SKILL_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function main() {
  const options = parseArgs(process.argv.slice(2))
  const projectRoot = path.resolve(options.project ?? process.cwd())
  const platforms = normalizePlatforms(options.platforms)
  const cli = resolveRoleCli()
  const cliArgs = [
    'init',
    ...platforms.map(platform => `--${platform}`),
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
  if (!fs.statSync(path.join(projectRoot, '.moluoxixi'), { throwIfNoEntry: false })?.isDirectory())
    throw new Error('Moluoxixi initialization exited successfully but did not create .moluoxixi')

  const extension = installExtension({
    project: projectRoot,
    platforms,
    force: options.force,
  })
  process.stdout.write(`${JSON.stringify({ extension }, null, 2)}\n`)
  if (extension.conflicts.length > 0)
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
      options.passthrough.push('--user', requireValue(argv, ++index, '--developer'))
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
  if (arg === '--claude-code')
    return 'claude'
  if (arg === '--windsurf')
    return 'devin'
  const value = arg.startsWith('--') ? arg.slice(2) : ''
  return PLATFORM_ORDER.includes(value) ? value : undefined
}

function requireValue(argv, index, option) {
  const value = argv[index]
  if (!value || value.startsWith('--'))
    throw new Error(`${option} requires a value`)
  return value
}

function resolveRoleCli() {
  if (process.env.MOLUOXIXI_ROLE_CLI)
    return classifyEntry(path.resolve(process.env.MOLUOXIXI_ROLE_CLI))

  const relative = path.join('packages', 'cli')
  const roleRoots = [
    path.resolve(SKILL_ROOT, '..', '..'),
    path.resolve(SKILL_ROOT, '..', '..', '..', 'roles', 'moluoxixi'),
    path.join(os.homedir(), '.moluoxixi', 'roles', 'moluoxixi'),
    path.join(os.homedir(), '.airules', 'roles', 'moluoxixi'),
  ]
  for (const roleRoot of roleRoots) {
    const dist = path.join(roleRoot, relative, 'dist', 'cli', 'index.js')
    if (fs.statSync(dist, { throwIfNoEntry: false })?.isFile())
      return { entry: dist, kind: 'node' }
  }
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'
  const npmRoot = spawnSync(npm, ['root', '--global'], {
    encoding: 'utf8',
    timeout: 5000,
    windowsHide: true,
  })
  if (npmRoot.status === 0) {
    const dist = path.join(
      npmRoot.stdout.trim(),
      '@moluoxixi',
      'airules-moluoxixi-cli',
      'dist',
      'cli',
      'index.js',
    )
    if (fs.statSync(dist, { throwIfNoEntry: false })?.isFile())
      return { entry: dist, kind: 'node' }
  }
  throw new Error('The installed Moluoxixi role CLI is missing; run `airules install moluoxixi` first')
}

function classifyEntry(entry) {
  if (!fs.statSync(entry, { throwIfNoEntry: false })?.isFile())
    throw new Error(`Moluoxixi role CLI does not exist: ${entry}`)
  return { entry, kind: /\.[cm]?js$/iu.test(entry) ? 'node' : 'command' }
}

try {
  main()
}
catch (error) {
  process.stderr.write(`Error: ${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
}
