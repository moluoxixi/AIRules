#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// 项目级 OpenSpec 初始化：
// - openspec CLI 负责创建 openspec/ 原生目录结构。
// - AIRules 只把随 init-project skill 分发的资产复制进目标项目。

const projectRoot = path.resolve(process.argv[2] ?? process.cwd())
const skipOpenSpecCommands = process.env.AIRULES_SKIP_OPENSPEC_VALIDATE === '1'
const skipBmadInstall = process.env.AIRULES_SKIP_BMAD_INSTALL === '1'
const schemaName = 'superpowers-bridge'
const openSpecToolTargets = [
  { dir: '.claude', tool: 'claude' },
  { dir: '.codex', tool: 'codex' },
  { dir: '.cursor', tool: 'cursor' },
  { dir: '.qoder', tool: 'qoder' },
  { dir: '.trae', tool: 'trae' },
  { dir: '.opencode', tool: 'opencode' },
]
const fallbackOpenSpecTool = 'qoder'
const bmadToolTargets = [
  { dir: '.claude', tool: 'claude-code' },
  { dir: '.codex', tool: 'codex' },
  { dir: '.cursor', tool: 'cursor' },
  { dir: '.qoder', tool: 'qoder' },
  { dir: '.trae', tool: 'trae' },
  { dir: '.opencode', tool: 'opencode' },
]
const fallbackBmadTool = 'qoder'

const skillRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const schemaSourceDir = path.join(skillRoot, 'assets', schemaName)
const knowledgeSourcePath = path.join(skillRoot, 'assets', 'knowledge', 'index.md')
const openspecDir = path.join(projectRoot, 'openspec')
const schemaTargetDir = path.join(openspecDir, 'schemas', schemaName)
const knowledgeTargetPath = path.join(projectRoot, 'knowledge', 'index.md')
const created = []

function rel(filePath) {
  return path.relative(projectRoot, filePath).replace(/\\/g, '/')
}

function assertAssetExists(assetPath, label) {
  if (!existsSync(assetPath)) {
    throw new Error(`init-project asset missing: ${label}`)
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

    throw new Error(`Unsupported init-project asset type: ${sourcePath}`)
  }
}

function resolveOpenSpecCommand() {
  return resolveCommand(
    process.platform === 'win32'
      ? ['openspec.cmd', 'openspec.bat', 'openspec.exe']
      : ['openspec'],
  )
}

function resolveBmadCommand() {
  return resolveCommand(
    process.platform === 'win32'
      ? ['bmad-method.cmd', 'bmad-method.bat', 'bmad-method.exe', 'bmad.cmd', 'bmad.bat', 'bmad.exe']
      : ['bmad-method', 'bmad'],
  )
}

function resolveCommand(candidates) {
  const pathValue = process.env.PATH ?? process.env.Path ?? ''

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
    throw new Error('MISSING openspec CLI；请先安装 @fission-ai/openspec，或先运行 AIRules openspec-development role setup。')
  }
  return command
}

function requireBmadCommand() {
  const command = resolveBmadCommand()
  if (!command) {
    throw new Error('MISSING bmad-method CLI；请先安装 bmad-method，或先运行 AIRules openspec-development role setup。')
  }
  return command
}

function runOpenSpec(command, args) {
  return runCommand(command, args)
}

function runBmad(command, args) {
  return runCommand(command, args)
}

function runCommand(command, args) {
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
  const openSpecTools = resolveOpenSpecTools()
  runOpenSpec(command, ['init', projectRoot, '--tools', openSpecTools, '--no-color'])
  console.log(`[airules] 已运行 openspec init --tools ${openSpecTools}`)
}

function resolveOpenSpecTools() {
  const tools = openSpecToolTargets
    .filter(target => existsSync(path.join(projectRoot, target.dir)))
    .map(target => target.tool)

  return tools.length > 0 ? tools.join(',') : fallbackOpenSpecTool
}

function initializeBmadProject(command) {
  const bmadTools = resolveBmadTools()
  runBmad(command, ['install', '--directory', projectRoot, '--modules', 'bmm', '--tools', bmadTools, '--yes'])
  console.log(`[airules] 已运行 bmad-method install --modules bmm --tools ${bmadTools}`)
}

function resolveBmadTools() {
  const tools = bmadToolTargets
    .filter(target => existsSync(path.join(projectRoot, target.dir)))
    .map(target => target.tool)

  return tools.length > 0 ? tools.join(',') : fallbackBmadTool
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

function setOpenSpecDefaultSchema() {
  const configPath = path.join(openspecDir, 'config.yaml')
  const schemaLine = `schema: ${schemaName}`
  const nextContent = existsSync(configPath)
    ? updateSchemaField(readFileSync(configPath, 'utf8'), schemaLine)
    : `${schemaLine}\n`

  if (existsSync(configPath) && readFileSync(configPath, 'utf8') === nextContent) {
    return
  }

  mkdirSync(path.dirname(configPath), { recursive: true })
  writeFileSync(configPath, nextContent, 'utf8')
  console.log(`[airules] 已设置 OpenSpec 默认 schema：${schemaName}`)
}

function updateSchemaField(raw, schemaLine) {
  if (/^schema\s*:/m.test(raw)) {
    return raw.replace(/^schema\s*:.*$/m, schemaLine)
  }

  const trimmed = raw.trimEnd()
  return trimmed.length > 0 ? `${trimmed}\n${schemaLine}\n` : `${schemaLine}\n`
}

assertAssetExists(schemaSourceDir, `assets/${schemaName}`)
assertAssetExists(knowledgeSourcePath, 'assets/knowledge/index.md')

let openSpecCommand = null
if (!skipOpenSpecCommands) {
  openSpecCommand = requireOpenSpecCommand()
  initializeOpenSpecProject(openSpecCommand)
}
else {
  console.log('[airules] 已跳过 OpenSpec CLI 命令（AIRULES_SKIP_OPENSPEC_VALIDATE=1）')
}

if (!skipBmadInstall) {
  initializeBmadProject(requireBmadCommand())
}
else {
  console.log('[airules] 已跳过 BMAD BMM runtime 安装（AIRULES_SKIP_BMAD_INSTALL=1）')
}

copyDirectoryIfMissing(schemaSourceDir, schemaTargetDir, created)
copyFileIfMissing(knowledgeSourcePath, knowledgeTargetPath, created)

if (created.length === 0) {
  console.log('[airules] OpenSpec schema 与 knowledge/index.md 已存在，跳过')
}
else {
  console.log(`[airules] 已复制项目级 OpenSpec schema 与 knowledge 入口：${created.join(', ')}`)
}

if (openSpecCommand) {
  setOpenSpecDefaultSchema()
  validateOpenSpecSchema(openSpecCommand)
}
