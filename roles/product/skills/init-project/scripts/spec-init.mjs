#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = path.resolve(process.argv[2] ?? process.cwd())
const skipOpenSpecCommands = process.env.AIRULES_SKIP_OPENSPEC_VALIDATE === '1'
const schemaName = 'product-pm-bridge'

const skillRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const schemaSourceDir = path.join(skillRoot, 'assets', schemaName)
const knowledgeSourcePath = path.join(skillRoot, 'assets', 'knowledge', 'index.md')

function rel(filePath) {
  return path.relative(projectRoot, filePath).replace(/\\/g, '/')
}

function assertAssetExists(assetPath, label) {
  if (!existsSync(assetPath)) {
    throw new Error(`product init-project asset missing: ${label}`)
  }
}

function copyFileIfMissing(sourcePath, targetPath, created) {
  if (existsSync(targetPath)) {
    return
  }

  mkdirSync(path.dirname(targetPath), { recursive: true })
  copyFileSync(sourcePath, targetPath)
  created.push(rel(targetPath))
}

function copyDirectoryIfMissing(sourceDir, targetDir, created) {
  assertAssetExists(sourceDir, path.relative(skillRoot, sourceDir).replace(/\\/g, '/'))

  for (const entry of readdirSync(sourceDir, { withFileTypes: true })) {
    const sourcePath = path.join(sourceDir, entry.name)
    const targetPath = path.join(targetDir, entry.name)

    if (entry.isDirectory()) {
      copyDirectoryIfMissing(sourcePath, targetPath, created)
      continue
    }

    if (entry.isFile()) {
      copyFileIfMissing(sourcePath, targetPath, created)
      continue
    }

    throw new Error(`Unsupported product init-project asset type: ${sourcePath}`)
  }
}

function resolveOpenSpecCommand() {
  const pathValue = process.env.PATH ?? process.env.Path ?? ''
  const candidates = process.platform === 'win32'
    ? ['openspec.cmd', 'openspec.bat', 'openspec.exe']
    : ['openspec']

  for (const dir of pathValue.split(path.delimiter).filter(Boolean)) {
    for (const candidate of candidates) {
      const fullPath = path.join(dir, candidate)
      if (existsSync(fullPath) && statSync(fullPath).isFile()) {
        return fullPath
      }
    }
  }

  return null
}

function requireOpenSpecCommand() {
  const command = resolveOpenSpecCommand()
  if (!command) {
    throw new Error('MISSING openspec CLI；请先安装 @fission-ai/openspec，或先运行 AIRules product role setup。')
  }
  return command
}

function runOpenSpec(command, args) {
  const result = spawnSync(command, args, {
    cwd: projectRoot,
    encoding: 'utf8',
    shell: process.platform === 'win32' && /\.(?:cmd|bat)$/i.test(command),
  })
  if (result.error) {
    throw result.error
  }

  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed with exit ${result.status}\n${result.stdout ?? ''}${result.stderr ?? ''}`)
  }

  return {
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  }
}

function initializeOpenSpecProject(command) {
  const openspecDir = path.join(projectRoot, 'openspec')
  if (existsSync(openspecDir)) {
    return
  }

  runOpenSpec(command, ['init', projectRoot, '--tools', 'none', '--no-color'])
  console.log('[airules] 已运行 openspec init --tools none')
}

function validateOpenSpecSchema(command) {
  runOpenSpec(command, ['schema', 'validate', schemaName])

  const schemas = runOpenSpec(command, ['schemas'])
  const output = `${schemas.stdout}\n${schemas.stderr}`
  if (!output.includes(schemaName)) {
    throw new Error(`openspec schemas 未列出 ${schemaName}；schema 未注册成功。`)
  }

  console.log(`[airules] OpenSpec schema 已注册并通过校验：${schemaName}`)
}

assertAssetExists(schemaSourceDir, `assets/${schemaName}`)
assertAssetExists(knowledgeSourcePath, 'assets/knowledge/index.md')

const openspecDir = path.join(projectRoot, 'openspec')
const schemaTargetDir = path.join(openspecDir, 'schemas', schemaName)
const knowledgeTargetPath = path.join(projectRoot, 'knowledge', 'index.md')
const created = []

let openSpecCommand = null
if (!skipOpenSpecCommands) {
  openSpecCommand = requireOpenSpecCommand()
  initializeOpenSpecProject(openSpecCommand)
}
else {
  console.log('[airules] 已跳过 OpenSpec CLI 命令（AIRULES_SKIP_OPENSPEC_VALIDATE=1）')
}

copyDirectoryIfMissing(schemaSourceDir, schemaTargetDir, created)
copyFileIfMissing(knowledgeSourcePath, knowledgeTargetPath, created)

if (created.length === 0) {
  console.log('[airules] Product OpenSpec schema 与 knowledge/index.md 已存在，跳过')
}
else {
  console.log(`[airules] 已复制产品 OpenSpec schema 与 knowledge 入口：${created.join(', ')}`)
}

if (openSpecCommand) {
  validateOpenSpecSchema(openSpecCommand)
}
