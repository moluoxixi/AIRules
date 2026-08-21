#!/usr/bin/env node

import { spawnSync } from 'node:child_process'
import path from 'node:path'
import process from 'node:process'

const packageName = '@moluoxixi/airules-moluoxixi-cli'

const platformFlags = new Set([
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
])
const platformAliases = { 'claude-code': 'claude', 'windsurf': 'devin' }
const valueOptions = new Set([
  '--user',
  '--developer',
  '--template',
  '--registry',
  '--workflow',
  '--workflow-source',
  '--project',
  '--platform',
])
const unsupportedOptions = new Set([
  '--dry-run',
  '--python',
  '--project-type',
  '--package',
  '--default-package',
  '--package-template',
  '--package-registry',
  '--migrate',
  '--allow-downgrade',
  '--create-new',
  '--skip-all',
])

function readValue(args, index, option) {
  const inline = option.includes('=') ? option.slice(option.indexOf('=') + 1) : undefined
  if (inline !== undefined)
    return { value: inline, next: index }
  const value = args[index + 1]
  if (value === undefined || value.startsWith('--'))
    throw new Error(`${option} requires a value`)
  return { value, next: index + 1 }
}

const input = process.argv.slice(2)
const cliArgs = ['init']
let projectRoot = process.cwd()
const platforms = []
for (let index = 0; index < input.length; index += 1) {
  const argument = input[index]
  const option = argument.includes('=') ? argument.slice(0, argument.indexOf('=')) : argument
  if (unsupportedOptions.has(option))
    throw new Error(`${option} is handled by the package CLI update workflow and is not an init option`)
  if (option === '--project') {
    const result = readValue(input, index, argument)
    projectRoot = path.resolve(result.value)
    index = result.next
    continue
  }
  if (option === '--platform') {
    const result = readValue(input, index, argument)
    platforms.push(...result.value.split(',').map(value => value.trim()).filter(Boolean))
    index = result.next
    continue
  }
  if (option === '--developer') {
    const result = readValue(input, index, argument)
    cliArgs.push('--user', result.value)
    index = result.next
    continue
  }
  if (option === '--user' || valueOptions.has(option)) {
    const result = readValue(input, index, argument)
    cliArgs.push(option, result.value)
    index = result.next
    continue
  }
  cliArgs.push(argument)
}

const expandedPlatforms = [...new Set(platforms.flatMap((platform) => {
  const normalized = platformAliases[platform] ?? platform
  return normalized === 'all' ? [...platformFlags] : [normalized]
}))]
for (const platform of expandedPlatforms) {
  if (!platformFlags.has(platform))
    throw new Error(`Unsupported --platform value: ${platform}`)
  cliArgs.push(`--${platform}`)
}

const installedExecutable = process.platform === 'win32' ? 'moluoxixi.cmd' : 'moluoxixi'
const cliEntry = process.env.MOLUOXIXI_CLI_ENTRY
const executable = process.env.MOLUOXIXI_CLI || installedExecutable
function commandAvailable(command) {
  const locator = process.platform === 'win32' ? 'where.exe' : 'which'
  const result = spawnSync(locator, [command], {
    stdio: 'ignore',
    windowsHide: true,
  })
  return result.status === 0
}

const spawnOptions = {
  cwd: projectRoot,
  env: process.env,
  stdio: 'inherit',
  windowsHide: true,
  ...(process.platform === 'win32' && !cliEntry ? { shell: true } : {}),
}
let result
if (cliEntry) {
  result = spawnSync(process.execPath, [cliEntry, ...cliArgs], {
    cwd: projectRoot,
    env: process.env,
    stdio: 'inherit',
    windowsHide: true,
  })
}
else if (process.env.MOLUOXIXI_CLI || commandAvailable(installedExecutable)) {
  result = spawnSync(executable, cliArgs, spawnOptions)
}
else {
  const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx'
  result = spawnSync(npx, ['--yes', `--package=${packageName}`, 'moluoxixi', ...cliArgs], {
    cwd: projectRoot,
    env: process.env,
    stdio: 'inherit',
    windowsHide: true,
    ...(process.platform === 'win32' ? { shell: true } : {}),
  })
}
if (result.error)
  throw result.error
process.exitCode = result.status ?? 1
