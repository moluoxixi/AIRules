#!/usr/bin/env node

import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

function findRuntime() {
  let project = path.resolve(process.cwd())
  while (true) {
    const candidate = path.join(project, '.trellis', 'runtime', 'trellis.mjs')
    if (fs.statSync(candidate, { throwIfNoEntry: false })?.isFile())
      return candidate
    const parent = path.dirname(project)
    if (parent === project)
      break
    project = parent
  }

  let current = path.dirname(fs.realpathSync(fileURLToPath(import.meta.url)))
  while (true) {
    const projectRuntime = path.join(current, '.trellis', 'runtime', 'trellis.mjs')
    if (fs.statSync(projectRuntime, { throwIfNoEntry: false })?.isFile())
      return projectRuntime
    if (path.basename(current) === 'moluoxixi') {
      const candidate = path.join(current, 'runtime', 'trellis.mjs')
      if (fs.statSync(candidate, { throwIfNoEntry: false })?.isFile())
        return candidate
    }
    if (path.basename(current) === 'vendor') {
      const candidate = path.join(path.dirname(current), 'roles', 'moluoxixi', 'runtime', 'trellis.mjs')
      if (fs.statSync(candidate, { throwIfNoEntry: false })?.isFile())
        return candidate
    }
    const parent = path.dirname(current)
    if (parent === current)
      break
    current = parent
  }
  throw new Error('Moluoxixi Trellis runtime is unavailable; run the init-project skill in this project')
}

try {
  const result = spawnSync(process.execPath, [findRuntime(), ...process.argv.slice(2)], {
    cwd: process.cwd(),
    env: process.env,
    stdio: 'inherit',
    windowsHide: true,
  })
  if (result.error)
    throw result.error
  process.exitCode = result.status ?? 1
}
catch (error) {
  process.stderr.write(`Error: ${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
}
