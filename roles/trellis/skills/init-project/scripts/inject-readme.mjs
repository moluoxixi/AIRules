import { Buffer } from 'node:buffer'
import { randomUUID } from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { TextDecoder } from 'node:util'

const START = '<!-- AIRULES:TRELLIS:START -->'
const END = '<!-- AIRULES:TRELLIS:END -->'
const UTF8_DECODER = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true })
const skillRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

try {
  const projectRoot = resolveProjectRoot(process.argv.slice(2))
  const target = path.join(projectRoot, 'README.md')
  const stats = fs.lstatSync(target, { throwIfNoEntry: false })
  if (stats && (!stats.isFile() || stats.isSymbolicLink()))
    throw new Error('README.md must be a regular file')
  const current = stats ? decodeUtf8(fs.readFileSync(target)) : ''
  const template = decodeUtf8(fs.readFileSync(path.join(skillRoot, 'assets', 'readme-usage.md')))
  const desired = upsertManagedBlock(current, template)
  const status = !stats ? 'created' : current === desired ? 'unchanged' : 'updated'
  if (status !== 'unchanged')
    replaceFile(target, Buffer.from(desired), stats?.mode)
  process.stdout.write(`${JSON.stringify({ readme: 'README.md', status })}\n`)
}
catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 2
}

function resolveProjectRoot(args) {
  let projectRoot = process.cwd()
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] !== '--project' || !args[index + 1] || index + 2 !== args.length)
      throw new Error('Usage: inject-readme.mjs [--project <project-root>]')
    projectRoot = args[index + 1]
    index += 1
  }
  const resolved = path.resolve(projectRoot)
  const stats = fs.lstatSync(resolved, { throwIfNoEntry: false })
  if (!stats?.isDirectory() || stats.isSymbolicLink())
    throw new Error(`Project root must be a real directory: ${resolved}`)
  if (resolved === path.resolve(os.homedir()))
    throw new Error('Refusing to inject README.md into the user home directory')
  return resolved
}

function decodeUtf8(content) {
  if (content.includes(0))
    throw new Error('README.md is not UTF-8 text; preserving it unchanged')
  try {
    return UTF8_DECODER.decode(content)
  }
  catch {
    throw new Error('README.md is not UTF-8 text; preserving it unchanged')
  }
}

function upsertManagedBlock(current, template) {
  const managed = `${START}\n${template.trim()}\n${END}`
  const starts = occurrences(current, START)
  const ends = occurrences(current, END)
  if (starts.length !== ends.length || starts.length > 1 || (starts.length === 1 && ends[0] < starts[0]))
    throw new Error('README.md contains malformed or duplicate AIRules Trellis markers')
  if (starts.length === 0)
    return current.trim() ? `${trimTrailingBoundary(current)}\n\n${managed}\n` : `${managed}\n`
  const updated = `${current.slice(0, starts[0])}${managed}${current.slice(ends[0] + END.length)}`
  return /\r?\n$/u.test(updated) ? updated : `${updated}\n`
}

function occurrences(content, marker) {
  const matches = []
  let offset = 0
  while (true) {
    const match = content.indexOf(marker, offset)
    if (match < 0)
      break
    matches.push(match)
    offset = match + marker.length
  }
  return matches
}

function trimTrailingBoundary(content) {
  return content.replace(/(?:\r?\n[ \t]*)+$/u, '')
}

function replaceFile(target, content, mode) {
  const temporary = path.join(path.dirname(target), `.README.md.airules-new-${randomUUID()}`)
  const backup = path.join(path.dirname(target), `.README.md.airules-old-${randomUUID()}`)
  fs.writeFileSync(temporary, content, { flag: 'wx', ...(mode === undefined ? {} : { mode }) })
  try {
    if (!fs.existsSync(target)) {
      fs.renameSync(temporary, target)
      return
    }
    try {
      fs.renameSync(temporary, target)
      return
    }
    catch (error) {
      if (!['EACCES', 'EEXIST', 'EPERM'].includes(error?.code))
        throw error
    }
    fs.renameSync(target, backup)
    try {
      fs.renameSync(temporary, target)
    }
    catch (error) {
      fs.renameSync(backup, target)
      throw error
    }
    fs.rmSync(backup, { force: true })
  }
  finally {
    fs.rmSync(temporary, { force: true })
  }
}
