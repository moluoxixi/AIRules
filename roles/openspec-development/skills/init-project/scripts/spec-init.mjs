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
const baseSchemaName = 'superpowers-bridge'
const frontendSchemaName = 'frontend-superpowers-bridge'
const schemaRepositoryUrl = 'https://github.com/JiangWay/openspec-schemas.git'
const schemaSourceOverride = process.env.AIRULES_OPENSPEC_SCHEMA_SOURCE_DIR
const projectedBmadSkillsDirOverride = process.env.AIRULES_PROJECTED_BMAD_SKILLS_DIR
const frontendDependencySignals = [
  '@angular/core',
  '@remix-run/react',
  '@vitejs/plugin-react',
  '@vitejs/plugin-vue',
  'astro',
  'next',
  'nuxt',
  'react',
  'solid-js',
  'svelte',
  'vite',
  'vue',
]
const frontendScriptSignals = [
  'astro',
  'next',
  'nuxt',
  'svelte-kit',
  'vite',
  'webpack',
]
const frontendConfigSignals = [
  'angular.json',
  'astro.config.mjs',
  'astro.config.ts',
  'next.config.js',
  'next.config.mjs',
  'nuxt.config.ts',
  'svelte.config.js',
  'vite.config.js',
  'vite.config.mjs',
  'vite.config.ts',
]
const openSpecToolTargets = [
  { dir: '.claude', tool: 'claude' },
  { dir: '.codex', tool: 'codex' },
  { dir: '.cursor', tool: 'cursor' },
  { dir: '.qoder', tool: 'qoder' },
  { dir: '.trae', tool: 'trae' },
  { dir: '.opencode', tool: 'opencode' },
]
const fallbackOpenSpecTool = 'qoder'
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
const requiredBmadProjectedSkills = [
  'bmad-prd',
  'bmad-create-epics-and-stories',
  'bmad-generate-project-context',
  'bmad-shard-doc',
]
const frontendExecutionAgents = [
  'planner',
  'tdd-guide',
  'pr-test-analyzer',
  'e2e-runner',
  'code-reviewer',
  'typescript-reviewer',
  'react-reviewer',
  'vue-reviewer',
  'react-build-resolver',
  'build-error-resolver',
  'silent-failure-hunter',
]

const skillRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const projectedBmadSkillsDir = projectedBmadSkillsDirOverride
  ? path.resolve(projectedBmadSkillsDirOverride)
  : path.dirname(skillRoot)
const knowledgeSourcePath = path.join(skillRoot, 'assets', 'knowledge', 'index.md')
const openspecDir = path.join(projectRoot, 'openspec')
const schemaName = detectFrontendProject() ? frontendSchemaName : baseSchemaName
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

function detectFrontendProject() {
  const packageJsonPath = path.join(projectRoot, 'package.json')
  if (existsSync(packageJsonPath)) {
    const pkg = readPackageJson(packageJsonPath)
    if (packageHasFrontendDependency(pkg) || packageHasFrontendScript(pkg)) {
      console.log(`[airules] 已检测到前端项目，使用 ${frontendSchemaName} schema`)
      return true
    }
  }

  if (frontendConfigSignals.some(fileName => existsSync(path.join(projectRoot, fileName)))) {
    console.log(`[airules] 已检测到前端项目，使用 ${frontendSchemaName} schema`)
    return true
  }

  return false
}

function readPackageJson(packageJsonPath) {
  try {
    const parsed = JSON.parse(readFileSync(packageJsonPath, 'utf8'))
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      throw new Error('package.json 根节点必须是对象')
    }
    return parsed
  }
  catch (error) {
    throw new Error(`package.json 解析失败 ${packageJsonPath}: ${error.message}`)
  }
}

function packageHasFrontendDependency(pkg) {
  const dependencySections = [
    pkg.dependencies,
    pkg.devDependencies,
    pkg.peerDependencies,
    pkg.optionalDependencies,
  ]

  return dependencySections.some(section =>
    section
    && typeof section === 'object'
    && !Array.isArray(section)
    && Object.keys(section).some(name => frontendDependencySignals.includes(name)),
  )
}

function packageHasFrontendScript(pkg) {
  const scripts = pkg.scripts
  if (!scripts || typeof scripts !== 'object' || Array.isArray(scripts)) {
    return false
  }

  return Object.values(scripts).some(value =>
    typeof value === 'string'
    && frontendScriptSignals.some(signal => new RegExp(`(^|\\s)${escapeRegExp(signal)}(\\s|$|:)`).test(value)),
  )
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

function runOpenSpec(command, args) {
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

function validateProjectedBmadSkills() {
  const missingSkills = requiredBmadProjectedSkills.filter(skillName =>
    !existsSync(path.join(projectedBmadSkillsDir, skillName, 'SKILL.md')),
  )

  if (missingSkills.length > 0) {
    throw new Error(`MISSING BMAD projected skills：${missingSkills.join(', ')}；请先运行 AIRules openspec-development role sync，确保 BMAD skills 通过 vendor sparse clone/projection 安装。`)
  }

  console.log(`[airules] 已确认 BMAD projected skills：${requiredBmadProjectedSkills.join(', ')}`)
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
    const sourceDir = path.join(cloneDir, baseSchemaName)
    assertAssetExists(sourceDir, `${schemaRepositoryUrl}/${baseSchemaName}`)
    assertAssetExists(path.join(sourceDir, 'schema.yaml'), `${schemaRepositoryUrl}/${baseSchemaName}/schema.yaml`)
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

function resolveInstallSchemaSourceDir() {
  const baseSource = resolveSchemaSourceDir()
  if (schemaName !== frontendSchemaName) {
    return baseSource
  }

  const tempRoot = mkdtempSync(path.join(tmpdir(), 'airules-frontend-schema-'))
  const sourceDir = path.join(tempRoot, frontendSchemaName)

  try {
    deriveFrontendSchema(baseSource.sourceDir, sourceDir)
    return {
      sourceDir,
      cleanup: () => {
        baseSource.cleanup()
        rmSync(tempRoot, { recursive: true, force: true })
      },
    }
  }
  catch (error) {
    baseSource.cleanup()
    rmSync(tempRoot, { recursive: true, force: true })
    throw error
  }
}

function deriveFrontendSchema(sourceDir, targetDir) {
  copyDirectoryWithTransform(sourceDir, targetDir, (relativePath, content) => {
    const normalizedPath = relativePath.replace(/\\/g, '/')
    if (normalizedPath === 'schema.yaml') {
      return deriveFrontendSchemaYaml(content)
    }
    if (normalizedPath === 'README.md' || normalizedPath === 'README.zh-TW.md') {
      return appendIfMissing(content, '## Frontend Superpowers Bridge', frontendReadmeAppendix())
    }
    if (normalizedPath === 'templates/adopters/CLAUDE.md.fragment.md' || normalizedPath === 'templates/adopters/CLAUDE.md.fragment.zh-TW.md') {
      return appendIfMissing(content, '## ECC Execution Agents', frontendAdopterAppendix())
    }
    if (normalizedPath === 'templates/design.md') {
      return appendIfMissing(content, '## Frontend Test Matrix', frontendDesignTemplateAppendix())
    }
    if (normalizedPath === 'templates/verify.md') {
      return appendIfMissing(content, '## 6. Frontend Verification Evidence', frontendVerifyTemplateAppendix())
    }
    return content
  })
}

function copyDirectoryWithTransform(sourceDir, targetDir, transform, rootDir = sourceDir) {
  assertAssetExists(sourceDir, path.relative(skillRoot, sourceDir).replace(/\\/g, '/'))
  mkdirSync(targetDir, { recursive: true })

  for (const entry of readdirSync(sourceDir, { withFileTypes: true })) {
    const sourcePath = path.join(sourceDir, entry.name)
    const targetPath = path.join(targetDir, entry.name)

    if (entry.isDirectory()) {
      copyDirectoryWithTransform(sourcePath, targetPath, transform, rootDir)
      continue
    }

    if (entry.isFile()) {
      mkdirSync(path.dirname(targetPath), { recursive: true })
      const relativePath = path.relative(rootDir, sourcePath)
      if (isTextSchemaAsset(sourcePath)) {
        writeFileSync(targetPath, transform(relativePath, readFileSync(sourcePath, 'utf8')), 'utf8')
      }
      else {
        copyFileSync(sourcePath, targetPath)
      }
      continue
    }

    throw new Error(`Unsupported init-project asset type: ${sourcePath}`)
  }
}

function isTextSchemaAsset(sourcePath) {
  return /\.(?:md|ya?ml|txt|json)$/i.test(sourcePath)
}

function deriveFrontendSchemaYaml(raw) {
  let next = raw.replace(/^name:\s*superpowers-bridge\s*$/m, `name: ${frontendSchemaName}`)
  if (next === raw) {
    throw new Error('frontend schema 派生失败：schema.yaml 缺少 name: superpowers-bridge')
  }

  next = appendToDescription(next, frontendSchemaDescription())
  next = appendToArtifactInstruction(next, 'design', frontendDesignInstruction())
  next = appendToArtifactInstruction(next, 'tasks', frontendTasksInstruction())
  next = appendToArtifactInstruction(next, 'plan', frontendPlanInstruction())
  next = appendToArtifactInstruction(next, 'verify', frontendVerifyInstruction())
  next = appendToApplyInstruction(next, frontendApplyInstruction())
  return next
}

function appendToDescription(raw, block) {
  if (raw.includes('Frontend execution agent bridge')) {
    return raw
  }
  if (!/^description:\s*>\s*$/m.test(raw)) {
    throw new Error('frontend schema 派生失败：schema.yaml 缺少 description: > 块')
  }
  if (!/\nartifacts:/.test(raw)) {
    throw new Error('frontend schema 派生失败：schema.yaml 缺少 artifacts 块')
  }
  return raw.replace(/\nartifacts:/, `\n${indentBlock(block, 2)}\n\nartifacts:`)
}

function appendToArtifactInstruction(raw, artifactId, block) {
  if (raw.includes(block.trim().split('\n')[0])) {
    return raw
  }

  const pattern = new RegExp(`(\\n  - id: ${escapeRegExp(artifactId)}\\n[\\s\\S]*?\\n    instruction: \\|\\n)([\\s\\S]*?)(\\n    requires:)`)
  if (!pattern.test(raw)) {
    throw new Error(`frontend schema 派生失败：schema.yaml 缺少 ${artifactId}.instruction`)
  }

  return raw.replace(pattern, (_match, head, body, tail) =>
    `${head}${body.trimEnd()}\n${indentBlock(block, 6)}${tail}`)
}

function appendToApplyInstruction(raw, block) {
  if (raw.includes('Confirm these ECC agents are available before frontend apply')) {
    return raw
  }

  const pattern = /(\napply:\n[\s\S]*?\n {2}instruction: \|\n)([\s\S]*)$/
  if (!pattern.test(raw)) {
    throw new Error('frontend schema 派生失败：schema.yaml 缺少 apply.instruction')
  }

  return raw.replace(pattern, (_match, head, body) =>
    `${head}${body.trimEnd()}\n${indentBlock(block, 4)}\n`)
}

function appendIfMissing(raw, marker, block) {
  return raw.includes(marker) ? raw : `${raw.trimEnd()}\n\n${block.trim()}\n`
}

function indentBlock(block, spaces) {
  const indent = ' '.repeat(spaces)
  return block.trim().split('\n').map(line => line.length > 0 ? `${indent}${line}` : '').join('\n')
}

function frontendSchemaDescription() {
  return `
Frontend execution agent bridge:
Requires ECC agents for frontend execution: ${frontendExecutionAgents.join(', ')}.
Frontend additions: design MUST include Layout, Fields, Components,
States, and Frontend Test Matrix. UI-required fields missing from API,
OpenAPI, interface code, API client, store, route params, permission,
state, persistence, static, or derived contracts MUST be marked
\`MISSING blocked: <reason>\` and block apply. Every UI unit MUST be
classified as existing, wrap existing, or new.
`
}

function frontendDesignInstruction() {
  return `
Frontend design gate:
- Include Layout, Fields, Components, States, and Frontend Test Matrix.
- Fields rows must map every UI field to API, OpenAPI, interface code,
  API client, store, route params, permission, state, persistence,
  static, or derived.
- Missing UI-required fields must be written as
  \`MISSING blocked: <reason>\` and must stop implementation.
- Components must classify each UI unit as existing, wrap existing, or new.
`
}

function frontendTasksInstruction() {
  return `
Frontend task gate:
- Add explicit tasks for field-contract comparison, component reuse search,
  layout/state review, TDD implementation, frontend verification evidence,
  and review.
- If design.md contains any \`MISSING blocked:\` row, stop instead of
  creating implementation tasks that assume the field exists.
`
}

function frontendPlanInstruction() {
  return `
Frontend planning gate:
- Preserve design.md Fields, Components, States, and Frontend Test Matrix.
- Do not introduce UI fields, store fields, route params, permission checks,
  or component abstractions absent from design.md.
- Missing automated tooling must be recorded as
  \`MISSING blocked: no frontend test runner\` or
  \`NOT RUN automated: <reason>\`.
`
}

function frontendVerifyInstruction() {
  return `
Frontend verification gate:
- Confirm design.md contains Layout, Fields, Components, States, and
  Frontend Test Matrix.
- Record commands, exit status, desktop/mobile coverage, console/network
  checks, and screenshot/log paths where applicable.
- Missing tools must be marked \`MISSING blocked\` or
  \`NOT RUN automated: <reason>\`; do not infer PASS.
`
}

function frontendApplyInstruction() {
  return `
Frontend execution agent bridge:
- Confirm these ECC agents are available before frontend apply:
  ${frontendExecutionAgents.join(', ')}.
- Read design.md before implementation and stop on any
  \`MISSING blocked: <reason>\` field row.
- Use the ECC agents for planning, TDD guidance, test analysis,
  E2E/browser validation, code review, framework review, build resolution,
  and silent-failure hunting where the task surface matches the agent.
`
}

function frontendReadmeAppendix() {
  return `
## Frontend Superpowers Bridge

This derived schema is generated from \`superpowers-bridge\` for frontend projects. It adds field, component, state, route, permission, responsive, browser, and frontend test evidence gates.

## ECC Execution Agent Bridge

Expected ECC agents: ${frontendExecutionAgents.join(', ')}.
`
}

function frontendAdopterAppendix() {
  return `
## ECC Execution Agents

For frontend changes, use these ECC agents where the task surface matches: ${frontendExecutionAgents.join(', ')}.
`
}

function frontendDesignTemplateAppendix() {
  return `
## Layout

Page regions, responsive behavior, navigation, and interaction flow.

## Fields

| Area | Field Name | UI Purpose | Source Type | Source Path / Endpoint | Exists? | Missing Status | Component Decision | Component Path | Display Shape | Permission Control | State Coverage | Test Point |
|---|---|---|---|---|---|---|---|---|---|---|---|---|

Use \`MISSING blocked: <reason>\` for any UI-required field absent from its source contract.

## Components

Classify each UI unit as \`existing\`, \`wrap existing\`, or \`new\`.

## States

Cover loading, empty, error, disabled, success, permission-denied, pending, and N/A decisions.

## Frontend Test Matrix

Map fields, states, routes, interactions, permissions, responsive behavior, and observable errors to automated or explicitly blocked evidence.
`
}

function frontendVerifyTemplateAppendix() {
  return `
## 5. Frontend Design Gate

- Layout:
- Fields:
- Components:
- States:
- Frontend Test Matrix:
- Blocking \`MISSING blocked:\` rows:

## 6. Frontend Verification Evidence

| Surface | Command / Evidence | Exit Status | Desktop | Mobile | Console / Network | Result |
|---|---|---|---|---|---|---|
`
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function installOpenSpecSchema(created) {
  if (schemaIsAlreadyInstalled()) {
    return
  }

  const { sourceDir, cleanup } = resolveInstallSchemaSourceDir()
  try {
    copyDirectoryIfMissing(sourceDir, schemaTargetDir, created)
  }
  finally {
    cleanup()
  }
}

assertAssetExists(knowledgeSourcePath, 'assets/knowledge/index.md')
validateProjectedBmadSkills()

let openSpecCommand = null
if (!skipOpenSpecCommands) {
  openSpecCommand = requireOpenSpecCommand()
  initializeOpenSpecProject(openSpecCommand)
}
else {
  console.log('[airules] 已跳过 OpenSpec CLI 命令（AIRULES_SKIP_OPENSPEC_VALIDATE=1）')
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
