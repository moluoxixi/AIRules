import { Buffer } from 'node:buffer'
import { randomUUID } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { GENERATOR_VERSION, MANIFEST_PATH, sha256, UPSTREAM_REVISION } from '../constants.mjs'
import { assertSafeTarget } from './safety.mjs'

export function commit(projectRoot, operations, manifest, platforms, options = {}) {
  const journal = []
  const createdDirs = []
  try {
    for (const operation of operations) {
      if (operation.status === 'removed') {
        transactionalRemove(operation.target, journal)
        continue
      }
      if (operation.status !== 'created' && operation.status !== 'updated' && operation.status !== 'proposed')
        continue
      transactionalWrite(operation.target, operation.desired, operation.executable, projectRoot, createdDirs, journal)
    }
    const nextEntries = { ...manifest.entries }
    for (const operation of operations) {
      if (operation.status === 'removed') {
        delete nextEntries[operation.relativePath]
        continue
      }
      if (operation.status === 'preserved')
        continue
      if (operation.managed === false)
        continue
      if (operation.status === 'created' || operation.status === 'updated' || operation.status === 'unchanged') {
        nextEntries[operation.relativePath] = {
          baselineHash: sha256(operation.desired),
          mode: operation.merge,
          platform: operation.platform,
          templateHash: sha256(operation.content),
        }
      }
    }
    const nextManifest = Buffer.from(`${JSON.stringify({
      schemaVersion: 1,
      generatorVersion: GENERATOR_VERSION,
      upstreamRevision: UPSTREAM_REVISION,
      platforms: [...new Set([...(manifest.platforms ?? []), ...platforms])].sort(),
      features: {
        ...(manifest.features ?? {}),
        claudeStatusline: manifest.features?.claudeStatusline === true || options.withStatusline === true,
      },
      project: {
        packages: options.packages ?? manifest.project?.packages ?? [],
        ...(options.defaultPackage ? { defaultPackage: options.defaultPackage } : {}),
      },
      entries: Object.fromEntries(Object.entries(nextEntries).sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)),
    }, null, 2)}\n`)
    const manifestTarget = assertSafeTarget(projectRoot, MANIFEST_PATH)
    transactionalWrite(manifestTarget, nextManifest, false, projectRoot, createdDirs, journal)
    for (const entry of journal) {
      if (entry.moved && entry.backup)
        fs.rmSync(entry.backup, { force: true })
    }
    for (const operation of operations) {
      if (operation.status === 'removed')
        removeEmptyParents(operation.target, projectRoot)
    }
  }
  catch (error) {
    const rollbackErrors = rollback(journal, createdDirs)
    const suffix = rollbackErrors.length > 0 ? `; rollback errors: ${rollbackErrors.join('; ')}` : ''
    throw new Error(`Initialization failed and was rolled back: ${String(error)}${suffix}`)
  }
}

function ensureParent(target, projectRoot, createdDirs) {
  const parent = path.dirname(target)
  if (parent === projectRoot || fs.existsSync(parent))
    return
  ensureParent(parent, projectRoot, createdDirs)
  fs.mkdirSync(parent)
  createdDirs.push(parent)
}

function transactionalWrite(target, content, executable, projectRoot, createdDirs, journal) {
  ensureParent(target, projectRoot, createdDirs)
  const temporary = `${target}.airules-new-${randomUUID()}`
  const backup = `${target}.airules-old-${randomUUID()}`
  const existed = fs.existsSync(target)
  const entry = { backup: existed ? backup : undefined, installed: false, moved: false, target }
  try {
    fs.writeFileSync(temporary, content, { flag: 'wx', mode: executable ? 0o755 : 0o644 })
    journal.push(entry)
    if (existed) {
      fs.renameSync(target, backup)
      entry.moved = true
    }
    fs.renameSync(temporary, target)
    entry.installed = true
  }
  catch (error) {
    fs.rmSync(temporary, { force: true })
    throw error
  }
}

function transactionalRemove(target, journal) {
  if (!fs.existsSync(target))
    return
  const backup = `${target}.airules-old-${randomUUID()}`
  const entry = { backup, installed: false, moved: false, target }
  journal.push(entry)
  fs.renameSync(target, backup)
  entry.moved = true
}

function removeEmptyParents(target, projectRoot) {
  let current = path.dirname(target)
  while (current !== projectRoot) {
    try {
      fs.rmdirSync(current)
    }
    catch {
      break
    }
    current = path.dirname(current)
  }
}

function rollback(journal, createdDirs) {
  const errors = []
  for (const entry of [...journal].reverse()) {
    try {
      if (entry.installed)
        fs.rmSync(entry.target, { force: true })
      if (entry.moved && entry.backup && fs.existsSync(entry.backup))
        fs.renameSync(entry.backup, entry.target)
    }
    catch (error) {
      errors.push(String(error))
    }
  }
  for (const directory of [...createdDirs].reverse()) {
    try {
      fs.rmdirSync(directory)
    }
    catch {}
  }
  return errors
}
