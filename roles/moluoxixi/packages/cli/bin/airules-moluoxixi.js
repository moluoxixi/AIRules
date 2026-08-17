#!/usr/bin/env node

import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const roleRoot = path.resolve(packageRoot, '..', '..')
const version = JSON.parse(fs.readFileSync(path.join(packageRoot, 'package.json'), 'utf8')).version

function run(entry, args) {
  if (!fs.statSync(entry, { throwIfNoEntry: false })?.isFile())
    throw new Error(`Moluoxixi role-local entry is missing: ${entry}`)
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

function printHelp() {
  process.stdout.write(`AIRules Moluoxixi CLI ${version}\n\nUsage: airules-moluoxixi <command> [options]\n\nCommands:\n  init-project  Initialize or update a project from the installed role\n  channel       Run the bundled local channel runtime\n  mem           Search local conversation history\n`)
}

try {
  const [command, ...args] = process.argv.slice(2)
  if (!command || command === '--help' || command === '-h' || command === 'help')
    printHelp()
  else if (command === '--version' || command === '-v' || command === '-V' || command === 'version')
    process.stdout.write(`${version}\n`)
  else if (command === 'init' || command === 'init-project')
    run(path.join(packageRoot, 'bin', 'init-project.js'), args)
  else if (command === 'channel' || command === 'mem')
    run(path.join(roleRoot, 'skills', 'init-project', 'assets', 'runtime', 'vendor', 'channel-mem.mjs'), [command, ...args])
  else throw new Error(`Unknown command: ${command}`)
}
catch (error) {
  process.stderr.write(`Error: ${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
}
