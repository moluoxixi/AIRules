#!/usr/bin/env node

import process from 'node:process'
import { parseArgs, printHelp } from './cli.mjs'
import { MANIFEST_PATH } from './constants.mjs'
import { prepareOperations, readManifest } from './core/operations.mjs'
import { assertSafeProject } from './core/safety.mjs'
import { commit } from './core/transaction.mjs'
import { normalizePlatforms } from './hosts/catalog.mjs'
import { buildPlan, requirePython } from './plan.mjs'

function main() {
  const options = parseArgs(process.argv.slice(2))
  if (options.help) {
    printHelp()
    return
  }
  const projectRoot = assertSafeProject(options.project)
  requirePython(options.python)
  const manifest = readManifest(projectRoot)
  const platforms = normalizePlatforms([...(manifest.platforms ?? []), ...options.platforms])
  const withStatusline = options.withStatusline || manifest.features?.claudeStatusline === true
  const packages = mergePackages(manifest.project?.packages, options.packages)
  const defaultPackage = options.defaultPackage ?? manifest.project?.defaultPackage
  if (defaultPackage && !packages.some(pkg => pkg.name === defaultPackage))
    throw new Error(`Default package is not declared: ${defaultPackage}`)
  const plan = buildPlan(platforms, options.python, options.developer, withStatusline, packages, defaultPackage)
  const prepared = prepareOperations(projectRoot, plan, manifest, options.force, options.createNew && !options.skipAll)
  const summary = {
    projectRoot,
    platforms,
    dryRun: options.dryRun,
    createNew: options.createNew,
    force: options.force,
    skipAll: options.skipAll,
    withStatusline,
    packages,
    defaultPackage,
    manifest: MANIFEST_PATH,
    warnings: platforms.includes('codex')
      ? ['Codex hooks require [features].hooks = true and one-time /hooks approval in the project.']
      : [],
    ...prepared.result,
  }
  if (!options.dryRun)
    commit(projectRoot, prepared.operations, manifest, platforms, { defaultPackage, packages, withStatusline })
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`)
  if (summary.conflicts.length > 0)
    process.exitCode = 2
}

function mergePackages(stored, requested) {
  const merged = new Map()
  for (const pkg of Array.isArray(stored) ? stored.map(validateStoredPackage) : [])
    merged.set(pkg.name, pkg)
  for (const pkg of requested)
    merged.set(pkg.name, pkg)
  return [...merged.values()].sort((left, right) => left.name.localeCompare(right.name))
}

function validateStoredPackage(pkg) {
  const validType = ['frontend', 'backend', 'fullstack', 'unknown'].includes(pkg?.type)
  const validName = typeof pkg?.name === 'string' && /^[A-Za-z0-9][\w.-]{0,63}$/u.test(pkg.name)
  const validPath = typeof pkg?.path === 'string' && pkg.path !== '..' && !pkg.path.startsWith('/') && !pkg.path.startsWith('../') && !pkg.path.includes('/../') && !pkg.path.includes('\0')
  if (!validType || !validName || !validPath)
    throw new Error('Malformed package mapping in initializer manifest')
  return pkg
}

try {
  main()
}
catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
}
