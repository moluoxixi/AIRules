#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { updateRepository } from './repository-update.js'

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)

function optionValue(name) {
  const index = args.indexOf(name)
  if (index >= 0)
    return args[index + 1]
  const prefix = `${name}=`
  return args.find(argument => argument.startsWith(prefix))?.slice(prefix.length)
}

function updateBeforeInstall() {
  const command = args[0]
  if (command !== 'install' && command !== 'sync')
    return

  const { positionals, values } = parseArgs({
    args: args.slice(1),
    allowPositionals: true,
    options: {
      'help': { type: 'boolean', short: 'h' },
      'home': { type: 'string' },
      'host': { type: 'string' },
      'no-verify': { type: 'boolean' },
      'repo-root': { type: 'string' },
      'role': { type: 'string' },
      'skip-vendors': { type: 'boolean' },
      'user-home': { type: 'string' },
    },
    strict: true,
  })
  if (values.help === true)
    return
  if (positionals.length !== 1 && values.role === undefined)
    return
  if (positionals.length > 1 || (positionals.length === 1 && values.role !== undefined))
    return
  const role = positionals[0] ?? values.role
  if (role === undefined || !/^[a-z0-9][a-z0-9-]{0,62}$/u.test(role))
    return

  const repoRoot = path.resolve(optionValue('--repo-root') ?? packageRoot)
  const update = updateRepository(repoRoot, { rebuild: repoRoot === packageRoot })
  if (update.kind === 'package') {
    console.log(`[update] Git checkout unavailable; using packaged AIRules at ${repoRoot}`)
  }
  else if (update.changed) {
    console.log(`[update] AIRules ${update.before.slice(0, 7)} -> ${update.after.slice(0, 7)} (${update.branch})`)
  }
  else {
    console.log(`[update] AIRules is current (${update.branch}, ${update.after.slice(0, 7)})`)
  }
}

try {
  updateBeforeInstall()
  const cli = path.join(packageRoot, 'dist', 'scripts', 'cli.js')
  if (!existsSync(cli))
    throw new Error(`AIRules build output is missing: ${cli}; run npm run build`)

  const result = spawnSync(process.execPath, [cli, ...args], {
    cwd: process.cwd(),
    env: process.env,
    stdio: 'inherit',
  })
  if (result.error)
    throw result.error
  process.exit(result.status ?? 1)
}
catch (error) {
  console.error(String(error))
  process.exit(1)
}
