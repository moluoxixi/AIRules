#!/usr/bin/env node

import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { parseArgs } from 'node:util'

const DASHBOARD = '@terranc/trellis-dashboard@0.1.5'
const USAGE = 'Usage: node .trellis/scripts/airules-dashboard.mjs [--port <1-65535>] [--no-open] [--help]'

export function launchDashboard(argv, { cwd = process.cwd(), platform = process.platform, spawn = spawnSync } = {}) {
  const { values } = parseArgs({
    args: argv,
    options: {
      'help': { type: 'boolean', short: 'h' },
      'no-open': { type: 'boolean' },
      'port': { type: 'string' },
    },
  })
  if (values.help) {
    console.log(USAGE)
    return 0
  }
  const port = values.port
  if (port !== undefined && (!/^[1-9]\d{0,4}$/u.test(port) || Number(port) > 65535))
    throw new Error('--port must be an integer from 1 to 65535')
  if (!fs.statSync(path.join(cwd, '.trellis'), { throwIfNoEntry: false })?.isDirectory())
    throw new Error('Run this command from an initialized Trellis project root (.trellis required)')

  const args = ['exec', '--yes', '--ignore-scripts', `--package=${DASHBOARD}`, '--', 'trellis-dashboard']
  if (values['no-open'])
    args.push('--no-open')
  if (port !== undefined)
    args.push('--port', port)

  // Windows npm is a .cmd shim. Only fixed tokens and a validated numeric port
  // can reach cmd.exe; project paths are passed as cwd, never as shell arguments.
  const windows = platform === 'win32'
  const result = spawn(windows ? ['npm.cmd', ...args].join(' ') : 'npm', windows ? [] : args, {
    cwd,
    shell: windows,
    stdio: 'inherit',
  })
  if (result.error?.code === 'ENOENT' || (windows && result.status === 9009))
    throw new Error('npm was not found. Install Node.js 18+ with npm and try again.')
  if (result.error)
    throw result.error
  return result.status ?? (result.signal === 'SIGINT' ? 130 : 1)
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    process.exitCode = launchDashboard(process.argv.slice(2))
  }
  catch (error) {
    console.error(`Trellis Dashboard: ${error instanceof Error ? error.message : String(error)}`)
    process.exitCode = 1
  }
}
