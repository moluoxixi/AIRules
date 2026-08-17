import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const scriptRoot = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(scriptRoot, '..', '..')
const manifestPath = path.join(scriptRoot, 'manifest.json')

function usage() {
  return `Usage: node .sync/moluoxixi/scan.mjs [options]

Read-only comparison of finalized Moluoxixi packages with Trellis.

Options:
  --target <ref>  Candidate upstream commit or ref (default: origin/main)
  --fetch         Fetch origin in the ignored working clone before scanning
  --json          Print machine-readable JSON
  --help          Show this help
`
}

export function parseArgs(argv) {
  const options = { fetch: false, json: false, target: 'origin/main' }
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === '--fetch') {
      options.fetch = true
    }
    else if (argument === '--json') {
      options.json = true
    }
    else if (argument === '--help' || argument === '-h') {
      options.help = true
    }
    else if (argument === '--target') {
      const target = argv[index + 1]
      if (!target || target.startsWith('--'))
        throw new Error('--target requires a value')
      options.target = target
      index += 1
    }
    else {
      throw new Error(`Unknown option: ${argument}`)
    }
  }
  return options
}

function git(cwd, args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
}

function normalizePath(value, label) {
  const normalized = path.posix.normalize(String(value).replaceAll('\\', '/'))
  if (!normalized || normalized === '.' || path.posix.isAbsolute(normalized) || normalized.startsWith('../') || normalized.includes('\0'))
    throw new Error(`Unsafe ${label}: ${value}`)
  return normalized
}

export function parseTree(output) {
  const entries = new Map()
  for (const line of output.split(/\r?\n/u).filter(Boolean)) {
    const match = line.match(/^(\d+)\s+\w+\s+([a-f0-9]+)\t(.+)$/u)
    if (!match)
      throw new Error(`Unexpected git ls-tree output: ${line}`)
    entries.set(match[3], { mode: match[1], oid: match[2] })
  }
  return entries
}

export function compareTrees(baseEntries, finalizedEntries) {
  const paths = [...new Set([...baseEntries.keys(), ...finalizedEntries.keys()])].sort()
  return paths.flatMap((entryPath) => {
    const base = baseEntries.get(entryPath)
    const finalized = finalizedEntries.get(entryPath)
    if (!base)
      return [{ status: 'A', paths: [entryPath] }]
    if (!finalized)
      return [{ status: 'D', paths: [entryPath] }]
    if (base.mode !== finalized.mode || base.oid !== finalized.oid)
      return [{ status: 'M', paths: [entryPath] }]
    return []
  })
}

export function parseNameStatus(output) {
  return output.split(/\r?\n/u).filter(Boolean).map((line) => {
    const fields = line.split('\t')
    const status = fields.shift()
    if (!status || fields.length === 0)
      throw new Error(`Unexpected git diff output: ${line}`)
    return { status, paths: fields }
  })
}

export function classifyChanges(localChanges, incomingChanges) {
  const localPaths = new Set(localChanges.flatMap(change => change.paths))
  const incomingPaths = new Set(incomingChanges.flatMap(change => change.paths))
  const overlaps = [...localPaths].filter(entryPath => incomingPaths.has(entryPath)).sort()
  const overlapSet = new Set(overlaps)
  return {
    incomingOnly: incomingChanges.filter(change => change.paths.every(entryPath => !overlapSet.has(entryPath))),
    localOnly: localChanges.filter(change => change.paths.every(entryPath => !overlapSet.has(entryPath))),
    overlaps,
  }
}

function readManifest() {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
  if (manifest.schemaVersion !== 1 || !manifest.upstream?.source || !manifest.upstream?.baseline?.revision || !Array.isArray(manifest.packages))
    throw new Error(`Invalid maintenance manifest: ${manifestPath}`)
  for (const entry of manifest.packages) {
    entry.upstreamPath = normalizePath(entry.upstreamPath, 'upstream package path')
    entry.finalizedPath = normalizePath(entry.finalizedPath, 'finalized package path')
  }
  manifest.workingClone = normalizePath(manifest.workingClone, 'working clone path')
  return manifest
}

function mapFinalizedTree(manifest, output) {
  const source = parseTree(output)
  const mapped = new Map()
  for (const [entryPath, value] of source) {
    const mapping = manifest.packages.find(item => entryPath === item.finalizedPath || entryPath.startsWith(`${item.finalizedPath}/`))
    if (!mapping)
      continue
    const suffix = entryPath.slice(mapping.finalizedPath.length)
    mapped.set(`${mapping.upstreamPath}${suffix}`, value)
  }
  return mapped
}

export function scan(options = {}) {
  const manifest = readManifest()
  const cloneRoot = path.resolve(repoRoot, ...manifest.workingClone.split('/'))
  if (!fs.statSync(path.join(cloneRoot, '.git'), { throwIfNoEntry: false })?.isDirectory())
    throw new Error(`Missing upstream clone: ${cloneRoot}`)

  const remote = git(cloneRoot, ['remote', 'get-url', 'origin']).replace(/\/$/u, '')
  const expected = manifest.upstream.source.replace(/\/$/u, '')
  if (remote !== expected)
    throw new Error(`Unexpected upstream remote: ${remote}`)
  if (options.fetch)
    git(cloneRoot, ['fetch', '--prune', 'origin'])

  const finalizedPaths = manifest.packages.map(entry => entry.finalizedPath)
  const dirty = git(repoRoot, ['status', '--porcelain', '--untracked-files=all', '--', ...finalizedPaths])
  if (dirty)
    throw new Error('Finalized package trees are dirty; commit or restore them before scanning.')

  const baseline = git(cloneRoot, ['rev-parse', `${manifest.upstream.baseline.revision}^{commit}`])
  const targetRef = options.target ?? 'origin/main'
  const target = git(cloneRoot, ['rev-parse', `${targetRef}^{commit}`])
  const upstreamPaths = manifest.packages.map(entry => entry.upstreamPath)
  const baseTree = parseTree(git(cloneRoot, ['ls-tree', '-r', '--full-tree', baseline, '--', ...upstreamPaths]))
  const finalizedTree = mapFinalizedTree(manifest, git(repoRoot, ['ls-tree', '-r', '--full-tree', 'HEAD', '--', ...finalizedPaths]))
  const localChanges = compareTrees(baseTree, finalizedTree)
  const incomingChanges = parseNameStatus(git(cloneRoot, ['diff', '--name-status', '--find-renames', baseline, target, '--', ...upstreamPaths]))
  const classified = classifyChanges(localChanges, incomingChanges)

  return {
    role: manifest.role,
    upstream: { baseline, source: manifest.upstream.source, target, targetRef },
    summary: {
      incomingChanges: incomingChanges.length,
      localChanges: localChanges.length,
      overlaps: classified.overlaps.length,
    },
    ...classified,
  }
}

function printHuman(result) {
  console.log(`Moluoxixi package diff scan`)
  console.log(`  baseline: ${result.upstream.baseline}`)
  console.log(`  target:   ${result.upstream.target}`)
  console.log(`  local:    ${result.summary.localChanges}`)
  console.log(`  incoming: ${result.summary.incomingChanges}`)
  console.log(`  overlaps: ${result.summary.overlaps}`)
  for (const entryPath of result.overlaps) console.log(`    ${entryPath}`)
}

function main() {
  try {
    const options = parseArgs(process.argv.slice(2))
    if (options.help) {
      process.stdout.write(usage())
      return
    }
    const result = scan(options)
    if (options.json)
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
    else printHuman(result)
  }
  catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href)
  main()
