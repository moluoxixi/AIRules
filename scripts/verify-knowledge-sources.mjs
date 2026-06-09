#!/usr/bin/env node
import { existsSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'

const VALID_SOURCE_TYPES = new Set(['filesystem'])
const VALID_EVIDENCE_STATUSES = new Set(['PASS', 'MISSING evidence', 'MISSING conflict', 'FAIL', 'NOT RUN'])
const FORBIDDEN_FILESYSTEM_ROOTS = new Set([
  'vendor',
  'node_modules',
  'dist',
  'coverage',
  '.git',
  '.codegraph',
])

function readJsonFile(filePath) {
  const absolutePath = path.resolve(filePath)

  if (!existsSync(absolutePath))
    throw new Error(`路径不存在：${filePath}`)

  if (!statSync(absolutePath).isFile())
    throw new Error(`路径必须是 JSON 文件：${filePath}`)

  try {
    return JSON.parse(readFileSync(absolutePath, 'utf8'))
  }
  catch (error) {
    throw new Error(`${filePath} 不是合法 JSON：${error.message}`)
  }
}

function assertRecord(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error(`${label} 必须是对象`)
}

function assertText(value, label) {
  if (typeof value !== 'string' || value.trim() === '')
    throw new Error(`${label} 必须是非空字符串`)

  if (/^MISSING\b/i.test(value.trim()))
    throw new Error(`${label} 必须是已确认值`)
}

function assertStatusText(value, label) {
  if (typeof value !== 'string' || value.trim() === '')
    throw new Error(`${label} 必须是非空字符串`)
}

function assertOwner(value, label) {
  if (typeof value !== 'string' || value.trim() === '' || /^MISSING\b/i.test(value.trim()))
    throw new Error(`${label} owner 必须是已确认负责人`)
}

function assertStringArray(value, label) {
  if (!Array.isArray(value) || value.length === 0)
    throw new Error(`${label} 必须是非空字符串数组`)

  for (const item of value)
    assertText(item, label)
}

function normalizePattern(pattern) {
  return pattern.replaceAll('\\', '/').replace(/^\.\//, '').replace(/^\/+/, '')
}

function forbiddenRoot(pattern) {
  const normalizedPattern = normalizePattern(pattern)
  const parts = normalizedPattern.split('/').filter(Boolean)

  return parts.find(part => FORBIDDEN_FILESYSTEM_ROOTS.has(part))
}

function verifyFilesystemSource(source) {
  assertStringArray(source.include, `source ${source.id} include`)
  assertStringArray(source.exclude, `source ${source.id} exclude`)

  for (const pattern of source.include) {
    if (forbiddenRoot(pattern))
      throw new Error(`source ${source.id} include 不得包含受禁路径 ${normalizePattern(pattern)}`)
  }
}

function verifySource(source, seenIds) {
  assertRecord(source, 'knowledge source')
  assertText(source.id, 'knowledge source id')

  if (seenIds.has(source.id))
    throw new Error(`knowledge source id 重复：${source.id}`)

  seenIds.add(source.id)
  assertText(source.type, `source ${source.id} type`)
  assertText(source.purpose, `source ${source.id} purpose`)
  assertOwner(source.owner, `source ${source.id}`)
  assertText(source.trust, `source ${source.id} trust`)

  if (!VALID_SOURCE_TYPES.has(source.type))
    throw new Error(`source ${source.id} type 必须是 filesystem`)

  if (source.type === 'filesystem')
    verifyFilesystemSource(source)
}

function verifyRegistry(filePath) {
  const registry = readJsonFile(filePath)
  assertRecord(registry, filePath)

  if (registry.version !== 1)
    throw new Error(`${filePath} version 必须是 1`)

  if (!Array.isArray(registry.sources) || registry.sources.length === 0)
    throw new Error(`${filePath} sources 必须是非空数组`)

  const seenIds = new Set()
  for (const source of registry.sources)
    verifySource(source, seenIds)
}

function hasSources(evidence) {
  return Array.isArray(evidence.sources) && evidence.sources.length > 0
}

function verifyEvidenceSources(sources, label) {
  if (!Array.isArray(sources))
    throw new Error(`${label} sources 必须是数组`)

  for (const source of sources) {
    assertRecord(source, `${label} source`)
    assertText(source.sourceId, `${label} sourceId`)

    if (typeof source.path !== 'string' && typeof source.url !== 'string')
      throw new Error(`${label} source 必须声明 path 或 url`)
  }
}

function verifyConflicts(conflicts, status, label) {
  if (conflicts === undefined)
    return

  if (!Array.isArray(conflicts))
    throw new Error(`${label} conflicts 必须是数组`)

  if (conflicts.length === 0)
    return

  if (status !== 'MISSING conflict')
    throw new Error(`${label} 存在 conflicts 时 status 必须是 MISSING conflict`)

  for (const conflict of conflicts) {
    assertRecord(conflict, `${label} conflict`)
    assertStringArray(conflict.sourceIds, `${label} conflict sourceIds`)
    assertText(conflict.summary, `${label} conflict summary`)
  }
}

function verifyEvidenceReport(filePath) {
  const evidence = readJsonFile(filePath)
  assertRecord(evidence, filePath)
  assertStatusText(evidence.status, `${filePath} status`)

  if (!VALID_EVIDENCE_STATUSES.has(evidence.status))
    throw new Error(`${filePath} status 必须是 PASS、MISSING evidence、MISSING conflict、FAIL 或 NOT RUN`)

  assertText(evidence.query, `${filePath} query`)
  verifyEvidenceSources(evidence.sources ?? [], filePath)
  verifyConflicts(evidence.conflicts, evidence.status, filePath)

  if (evidence.status === 'PASS' && !hasSources(evidence))
    throw new Error(`${filePath} PASS 需要至少一个来源`)

  if (evidence.status === 'MISSING evidence')
    assertText(evidence.reason, `${filePath} reason`)

  if (evidence.status === 'MISSING conflict' && (!Array.isArray(evidence.conflicts) || evidence.conflicts.length === 0))
    throw new Error(`${filePath} MISSING conflict 必须声明 conflicts`)

  if ((evidence.status === 'FAIL' || evidence.status === 'NOT RUN') && typeof evidence.reason !== 'string')
    throw new Error(`${filePath} ${evidence.status} 必须声明 reason`)
}

function main(args) {
  if (args.length === 0)
    throw new Error('Usage: node scripts/verify-knowledge-sources.mjs [--evidence] <json-file> [...]')

  if (args[0] === '--evidence') {
    const evidenceFiles = args.slice(1)
    if (evidenceFiles.length === 0)
      throw new Error('Usage: node scripts/verify-knowledge-sources.mjs --evidence <evidence-json> [...]')

    for (const filePath of evidenceFiles)
      verifyEvidenceReport(filePath)

    console.log(`PASS knowledge evidence is valid (${evidenceFiles.length} checked)`)
    return
  }

  for (const filePath of args)
    verifyRegistry(filePath)

  console.log(`PASS knowledge sources are valid (${args.length} checked)`)
}

try {
  main(process.argv.slice(2))
}
catch (error) {
  console.error(`FAIL ${error.message}`)
  process.exitCode = 1
}
