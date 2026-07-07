#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// 项目级 OpenSpec 初始化：
// - openspec CLI 负责创建 openspec/ 原生目录结构。
// - superpowers-bridge schema 从 JiangWay/openspec-schemas.git 运行时获取。

const projectRoot = path.resolve(process.argv[2] ?? process.cwd())
const skipOpenSpecCommands = process.env.AIRULES_SKIP_OPENSPEC_VALIDATE === '1'
const skipBmadInstall = process.env.AIRULES_SKIP_BMAD_INSTALL === '1'
const schemaName = 'superpowers-bridge'
const schemaRepositoryUrl = 'https://github.com/JiangWay/openspec-schemas.git'
const schemaSourceOverride = process.env.AIRULES_OPENSPEC_SCHEMA_SOURCE_DIR
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
const openSpecWorkflows = [
  'propose',
  'explore',
  'new',
  'continue',
  'apply',
  'ff',
  'sync',
  'archive',
  'bulk-archive',
  'verify',
  'onboard',
]

const skillRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
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

function resolveGitCommand() {
  return resolveCommand(
    process.platform === 'win32'
      ? ['git.exe', 'git.cmd', 'git.bat']
      : ['git'],
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

function requireGitCommand() {
  const command = resolveGitCommand()
  if (!command) {
    throw new Error('MISSING git CLI；需要从 JiangWay/openspec-schemas.git 克隆 superpowers-bridge schema。')
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

function runGit(command, args) {
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
  configureOpenSpecFullWorkflow(command)
  const openSpecTools = resolveOpenSpecTools()
  runOpenSpec(command, ['init', projectRoot, '--tools', openSpecTools, '--no-color'])
  console.log(`[airules] 已运行 openspec init --tools ${openSpecTools}`)
}

function configureOpenSpecFullWorkflow(command) {
  const configPathResult = runOpenSpec(command, ['config', 'path'])
  const configPath = configPathResult.stdout
    .split(/\r?\n/)
    .map(line => line.trim())
    .find(Boolean)

  if (!configPath) {
    throw new Error('openspec config path 未返回配置文件路径；无法安装全量 OpenSpec commands。')
  }

  const existingConfig = readOpenSpecGlobalConfig(configPath)
  const nextConfig = {
    ...existingConfig,
    profile: 'custom',
    delivery: 'both',
    workflows: openSpecWorkflows,
  }

  mkdirSync(path.dirname(configPath), { recursive: true })
  writeFileSync(configPath, `${JSON.stringify(nextConfig, null, 2)}\n`, 'utf8')
  console.log(`[airules] 已配置 OpenSpec 全量 workflow commands：${openSpecWorkflows.join(', ')}`)
}

function readOpenSpecGlobalConfig(configPath) {
  if (!existsSync(configPath)) {
    return {}
  }

  try {
    return JSON.parse(readFileSync(configPath, 'utf8'))
  }
  catch (error) {
    throw new Error(`OpenSpec 全局配置解析失败 ${configPath}: ${error.message}`)
  }
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

function schemaIsAlreadyInstalled() {
  return existsSync(path.join(schemaTargetDir, 'schema.yaml'))
    && existsSync(path.join(schemaTargetDir, 'templates', 'tasks.md'))
}

function resolveSchemaSourceDir() {
  if (schemaSourceOverride) {
    const sourceDir = path.resolve(schemaSourceOverride)
    assertAssetExists(sourceDir, 'AIRULES_OPENSPEC_SCHEMA_SOURCE_DIR')
    assertAssetExists(path.join(sourceDir, 'schema.yaml'), 'AIRULES_OPENSPEC_SCHEMA_SOURCE_DIR/schema.yaml')
    return { sourceDir, cleanup: () => {} }
  }

  const gitCommand = requireGitCommand()
  const tempRoot = mkdtempSync(path.join(tmpdir(), 'airules-openspec-schemas-'))
  const cloneDir = path.join(tempRoot, 'openspec-schemas')

  try {
    runGit(gitCommand, ['clone', '--depth', '1', schemaRepositoryUrl, cloneDir])
    const sourceDir = path.join(cloneDir, schemaName)
    assertAssetExists(sourceDir, `${schemaRepositoryUrl}/${schemaName}`)
    assertAssetExists(path.join(sourceDir, 'schema.yaml'), `${schemaRepositoryUrl}/${schemaName}/schema.yaml`)
    return {
      sourceDir,
      cleanup: () => rmSync(tempRoot, { recursive: true, force: true }),
    }
  }
  catch (error) {
    rmSync(tempRoot, { recursive: true, force: true })
    throw error
  }
}

function installOpenSpecSchema(created) {
  if (schemaIsAlreadyInstalled()) {
    return
  }

  const { sourceDir, cleanup } = resolveSchemaSourceDir()
  try {
    copyDirectoryIfMissing(sourceDir, schemaTargetDir, created)
  }
  finally {
    cleanup()
  }
}

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

installOpenSpecSchema(created)
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
