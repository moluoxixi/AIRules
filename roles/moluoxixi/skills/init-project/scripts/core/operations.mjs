import { Buffer } from 'node:buffer'
import fs from 'node:fs'
import path from 'node:path'
import { GENERATOR_VERSION, MANIFEST_PATH, sha256, UPSTREAM_REVISION } from '../constants.mjs'
import { mergeJson, migrateLegacyJson, upsertBlock } from './migration.mjs'
import { assertSafeTarget } from './safety.mjs'

export function readManifest(projectRoot) {
  const file = path.join(projectRoot, ...MANIFEST_PATH.split('/'))
  if (!fs.existsSync(file))
    return { schemaVersion: 1, generatorVersion: GENERATOR_VERSION, upstreamRevision: UPSTREAM_REVISION, entries: {} }
  const parsed = JSON.parse(fs.readFileSync(file, 'utf8'))
  if (parsed.schemaVersion !== 1 || typeof parsed.entries !== 'object' || parsed.entries === null || Array.isArray(parsed.entries))
    throw new Error(`Unsupported or malformed manifest: ${file}`)
  return parsed
}

export function prepareOperations(projectRoot, plan, manifest, force, createNew = false) {
  const operations = []
  const result = { conflicts: [], created: [], preserved: [], proposed: [], removed: [], unchanged: [], updated: [] }
  const recordConflict = (relativePath, item, desired = item.content) => {
    result.conflicts.push(relativePath)
    if (!createNew)
      return
    const proposalPath = `${relativePath}.new`
    const proposalTarget = assertSafeTarget(projectRoot, proposalPath)
    const proposalStats = fs.lstatSync(proposalTarget, { throwIfNoEntry: false })
    if (proposalStats) {
      if (!proposalStats.isFile() || proposalStats.isSymbolicLink() || !fs.readFileSync(proposalTarget).equals(desired))
        result.conflicts.push(proposalPath)
      return
    }
    operations.push({ ...item, desired, managed: false, relativePath: proposalPath, status: 'proposed', target: proposalTarget })
    result.proposed.push(proposalPath)
  }
  for (const [relativePath, item] of [...plan.entries()].sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)) {
    const target = assertSafeTarget(projectRoot, relativePath)
    const stats = fs.lstatSync(target, { throwIfNoEntry: false })
    if (stats && (!stats.isFile() || stats.isSymbolicLink())) {
      recordConflict(relativePath, item)
      continue
    }
    const current = stats ? fs.readFileSync(target) : undefined
    const owned = manifest.entries[relativePath]
    let desired = item.content
    try {
      if (current && item.merge === 'json') {
        const template = JSON.parse(item.content.toString('utf8'))
        if (!owned || owned.baselineHash !== sha256(current)) {
          const migrated = migrateLegacyJson(JSON.parse(current.toString('utf8')), template)
          desired = Buffer.from(`${JSON.stringify(mergeJson(migrated, template), null, 2)}\n`)
        }
      }
      else if (item.merge.startsWith('block-')) {
        desired = Buffer.from(upsertBlock(current?.toString('utf8') ?? '', item.content.toString('utf8'), item.merge))
      }
    }
    catch (error) {
      if (!force) {
        recordConflict(relativePath, item, desired)
        continue
      }
    }
    if (!current) {
      operations.push({ ...item, desired, relativePath, target, status: 'created' })
      result.created.push(relativePath)
    }
    else if (current.equals(desired)) {
      const remainsOwned = owned && (owned.baselineHash === sha256(current) || current.equals(item.content))
      const status = remainsOwned ? 'unchanged' : 'preserved'
      result[status].push(relativePath)
      operations.push({ ...item, desired, relativePath, target, status })
    }
    else if (item.merge === 'json' || item.merge.startsWith('block-') || force || (owned && owned.baselineHash === sha256(current))) {
      operations.push({ ...item, desired, relativePath, target, status: 'updated' })
      result.updated.push(relativePath)
    }
    else {
      recordConflict(relativePath, item, desired)
    }
  }
  for (const [relativePath, owned] of Object.entries(manifest.entries)) {
    if (plan.has(relativePath))
      continue
    const target = assertSafeTarget(projectRoot, relativePath)
    const stats = fs.lstatSync(target, { throwIfNoEntry: false })
    if (!stats) {
      operations.push({ relativePath, target, status: 'removed' })
      result.removed.push(relativePath)
    }
    else if (!stats.isFile() || stats.isSymbolicLink()) {
      result.conflicts.push(relativePath)
    }
    else if (force || owned.baselineHash === sha256(fs.readFileSync(target))) {
      operations.push({ relativePath, target, status: 'removed' })
      result.removed.push(relativePath)
    }
    else {
      result.conflicts.push(relativePath)
    }
  }
  return { operations, result }
}
