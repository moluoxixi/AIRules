import { randomUUID } from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

export function assertProjectRoot(value) {
  const root = path.resolve(value)
  const stats = fs.lstatSync(root, { throwIfNoEntry: false })
  if (!stats?.isDirectory() || stats.isSymbolicLink())
    throw new Error(`Project root must be a real directory: ${root}`)
  if (root === path.resolve(os.homedir()) && process.env.TRELLIS_ALLOW_HOMEDIR !== '1')
    throw new Error('Refusing to initialize the user home directory')
  return root
}

export function safeTarget(projectRoot, relativePath) {
  const normalized = path.posix.normalize(String(relativePath).replace(/\\/gu, '/'))
  if (!normalized || normalized === '.' || normalized === '..' || normalized.startsWith('../') || path.posix.isAbsolute(normalized) || normalized.includes('\0'))
    throw new Error(`Unsafe extension path: ${relativePath}`)
  const target = path.resolve(projectRoot, ...normalized.split('/'))
  const relative = path.relative(projectRoot, target)
  if (!relative || relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative))
    throw new Error(`Extension path escapes the project: ${relativePath}`)

  let current = projectRoot
  for (const segment of normalized.split('/').slice(0, -1)) {
    current = path.join(current, segment)
    const stats = fs.lstatSync(current, { throwIfNoEntry: false })
    if (!stats)
      break
    if (!stats.isDirectory() || stats.isSymbolicLink())
      throw new Error(`Extension path contains an unsafe parent: ${relativePath}`)
  }
  return target
}

export function commitExtension(projectRoot, operations, manifestOperation, directories = [], options = {}) {
  const journal = []
  const createdDirectories = []
  let writes = 0
  try {
    for (const relativePath of directories)
      ensureDirectory(safeTarget(projectRoot, `${relativePath}/.keep-placeholder`), projectRoot, createdDirectories, true)
    for (const operation of [...operations, manifestOperation]) {
      if (!['created', 'updated'].includes(operation.status))
        continue
      if (Number.isInteger(options.failAfter) && writes >= options.failAfter)
        throw new Error('Injected extension transaction failure')
      transactionalWrite(operation.target, operation.desired, projectRoot, createdDirectories, journal)
      writes += 1
    }
  }
  catch (error) {
    const rollbackErrors = rollback(journal, createdDirectories)
    const suffix = rollbackErrors.length > 0 ? `; rollback errors: ${rollbackErrors.join('; ')}` : ''
    throw new Error(`Knowledge extension installation failed and was rolled back: ${String(error)}${suffix}`)
  }
  for (const entry of journal) {
    if (entry.backup)
      removeBestEffort(entry.backup)
  }
}

function ensureDirectory(target, projectRoot, createdDirectories, targetIsPlaceholder = false) {
  const directory = targetIsPlaceholder ? path.dirname(target) : path.dirname(target)
  if (directory === projectRoot || fs.existsSync(directory))
    return
  ensureDirectory(directory, projectRoot, createdDirectories)
  fs.mkdirSync(directory)
  createdDirectories.push(directory)
}

function transactionalWrite(target, content, projectRoot, createdDirectories, journal) {
  ensureDirectory(target, projectRoot, createdDirectories)
  const temporary = `${target}.airules-new-${randomUUID()}`
  const existed = fs.existsSync(target)
  const backup = existed ? `${target}.airules-old-${randomUUID()}` : undefined
  const entry = { backup, installed: false, moved: false, target }
  let handle
  try {
    handle = fs.openSync(temporary, 'wx', 0o644)
    fs.writeFileSync(handle, content)
    fs.fsyncSync(handle)
    fs.closeSync(handle)
    handle = undefined
    journal.push(entry)
    if (backup) {
      fs.renameSync(target, backup)
      entry.moved = true
    }
    fs.renameSync(temporary, target)
    entry.installed = true
  }
  catch (error) {
    if (handle !== undefined)
      fs.closeSync(handle)
    fs.rmSync(temporary, { force: true })
    throw error
  }
}

function rollback(journal, createdDirectories) {
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
  for (const directory of [...createdDirectories].reverse()) {
    try {
      fs.rmdirSync(directory)
    }
    catch {}
  }
  return errors
}

function removeBestEffort(target) {
  try {
    fs.rmSync(target, { force: true })
  }
  catch {}
}
