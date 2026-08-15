#!/usr/bin/env node

import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const roleRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const entry = path.join(roleRoot, 'skills', 'init-project', 'scripts', 'init-project.mjs')

if (!fs.statSync(entry, { throwIfNoEntry: false })?.isFile())
  throw new Error(`Moluoxixi initializer is missing from the installed role: ${entry}`)

const result = spawnSync(process.execPath, [entry, ...process.argv.slice(2)], {
  cwd: process.cwd(),
  env: process.env,
  stdio: 'inherit',
  windowsHide: true,
})
if (result.error)
  throw result.error
process.exitCode = result.status ?? 1
