#!/usr/bin/env node
/**
 * 校验 AIRules L2 变更包结构。
 *
 * 该脚本只检查 repo-maintenance 变更包是否自足，不替代 lint、typecheck、测试或宿主验证。
 */
import fs from 'node:fs'
import path from 'node:path'

const REQUIRED_PACK_FILES = ['proposal.md', 'layer-delta.md', 'design.md', 'tasks.md', 'verification.md']
const REQUIRED_LAYERS = ['repo-maintenance', 'global-baseline', 'project-init', 'generated-project']
const REQUIRED_DELTA_SECTIONS = ['ADDED', 'MODIFIED', 'REMOVED']
const STATUS_MARKERS = ['PASS', 'FAIL', 'MISSING', 'NOT RUN', 'N/A']
const errors = []

function pass(message) {
  console.log(`PASS ${message}`)
}

function fail(message) {
  errors.push(message)
  console.log(`FAIL ${message}`)
}

function parseArgs(args) {
  for (let index = 0; index < args.length; index++) {
    if (args[index] === '--root') {
      index++
      continue
    }

    fail(`未知参数：${args[index]}`)
  }

  const rootIndex = args.indexOf('--root')
  const rootValue = args[rootIndex + 1]
  if (rootIndex !== -1 && (!rootValue || rootValue.startsWith('--'))) {
    fail('参数 --root 必须提供值')
    return { root: process.cwd() }
  }

  return {
    root: rootIndex === -1 ? process.cwd() : path.resolve(process.cwd(), rootValue),
  }
}

function readRequired(root, relativePath) {
  const filePath = path.join(root, relativePath)
  if (!fs.existsSync(filePath)) {
    fail(`change pack missing: ${relativePath}`)
    return ''
  }

  return fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n')
}

function requireTokens(label, content, tokens) {
  const missing = tokens.filter(token => !content.includes(token))
  if (missing.length > 0) {
    fail(`${label} 缺少: ${missing.join(', ')}`)
    return false
  }

  pass(`${label} present`)
  return true
}

function verifyContract(root) {
  const content = readRequired(root, 'docs/delivery/change-pack.md')
  if (!content) {
    return
  }

  requireTokens('change-pack contract', content, [
    'docs/changes/',
    'proposal.md',
    'layer-delta.md',
    'design.md',
    'tasks.md',
    'verification.md',
    'archive',
    'verify:changes',
    'repo-maintenance',
    'global-baseline',
    'project-init',
    'generated-project',
    ...REQUIRED_DELTA_SECTIONS,
    ...STATUS_MARKERS,
  ])
}

function collectPackDirs(changesRoot) {
  if (!fs.existsSync(changesRoot)) {
    fail('change pack missing: docs/changes/')
    return []
  }

  const dirs = []
  for (const entry of fs.readdirSync(changesRoot, { withFileTypes: true })) {
    if (entry.isDirectory() && entry.name !== 'archive') {
      dirs.push(path.join(changesRoot, entry.name))
    }
  }

  const archiveRoot = path.join(changesRoot, 'archive')
  if (!fs.existsSync(archiveRoot)) {
    fail('change pack missing: docs/changes/archive/')
    return dirs
  }

  for (const entry of fs.readdirSync(archiveRoot, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      dirs.push(path.join(archiveRoot, entry.name))
    }
  }

  return dirs.sort((left, right) => left.localeCompare(right))
}

function verifyIndex(root) {
  const content = readRequired(root, 'docs/changes/index.md')
  if (!content) {
    return
  }

  requireTokens('change-pack index', content, ['活动变更', '归档变更'])
}

function hasAnyStatus(content) {
  return STATUS_MARKERS.some(marker => content.includes(marker))
}

function verifyPack(root, packDir) {
  const relativeDir = path.relative(root, packDir).replace(/\\/g, '/')
  for (const fileName of REQUIRED_PACK_FILES) {
    readRequired(root, `${relativeDir}/${fileName}`)
  }

  const proposal = readRequired(root, `${relativeDir}/proposal.md`)
  const delta = readRequired(root, `${relativeDir}/layer-delta.md`)
  const design = readRequired(root, `${relativeDir}/design.md`)
  const tasks = readRequired(root, `${relativeDir}/tasks.md`)
  const verification = readRequired(root, `${relativeDir}/verification.md`)

  requireTokens(`${relativeDir}/proposal.md`, proposal, ['目标', '范围', '非目标', '变更分级', '影响层级', '风险'])
  requireTokens(`${relativeDir}/layer-delta.md`, delta, [...REQUIRED_LAYERS, ...REQUIRED_DELTA_SECTIONS])
  requireTokens(`${relativeDir}/design.md`, design, ['技术方案', '兼容性', '回滚', '验证策略'])
  requireTokens(`${relativeDir}/tasks.md`, tasks, ['- ['])
  requireTokens(`${relativeDir}/verification.md`, verification, ['Command', 'Status'])

  if (!hasAnyStatus(verification)) {
    fail(`${relativeDir}/verification.md 缺少状态: ${STATUS_MARKERS.join(', ')}`)
  }
}

function finish(root) {
  console.log('────────────────────────────')
  if (errors.length > 0) {
    console.log(`FAIL change pack verification has ${errors.length} issue(s)`)
    process.exitCode = 1
    return
  }

  console.log('PASS change packs are valid')
  console.log(`  root: ${root}`)
}

function verify(root) {
  verifyContract(root)
  verifyIndex(root)
  const changesRoot = path.join(root, 'docs', 'changes')
  const packDirs = collectPackDirs(changesRoot)
  if (packDirs.length === 0) {
    pass('change-pack directories n/a')
  }
  for (const packDir of packDirs) {
    verifyPack(root, packDir)
  }
  finish(root)
}

verify(parseArgs(process.argv.slice(2)).root)
