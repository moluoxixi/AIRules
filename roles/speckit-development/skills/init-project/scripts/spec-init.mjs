#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = path.resolve(process.argv[2] ?? process.cwd())
const integration = process.env.AIRULES_SPECKIT_INTEGRATION ?? 'codex'
const bridgeName = 'speckit-superpowers-bridge'
const bridgeReleaseUrl = 'https://github.com/lihan3238/speckit-superpowers-bridge/releases/latest/download/speckit-superpowers-bridge.zip'
const frontendSchemaName = 'frontend-superpowers-bridge'
const skipBridgeReadiness = process.env.AIRULES_SKIP_SPECKIT_BRIDGE_READINESS === '1'
const skipCodeGraph = process.env.AIRULES_SKIP_CODEGRAPH_INIT === '1'
const frontendDependencySignals = [
  '@angular/core',
  '@remix-run/react',
  '@sveltejs/kit',
  '@vitejs/plugin-react',
  '@vitejs/plugin-vue',
  'astro',
  'next',
  'nuxt',
  'react',
  'react-dom',
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
  'index.html',
  'next.config.js',
  'next.config.mjs',
  'next.config.ts',
  'nuxt.config.js',
  'nuxt.config.mjs',
  'nuxt.config.ts',
  'svelte.config.js',
  'svelte.config.mjs',
  'vite.config.js',
  'vite.config.mjs',
  'vite.config.ts',
]
const skillRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const frontendSchemaSourceDir = path.join(skillRoot, 'assets', 'schemas', frontendSchemaName)
const frontendSchemaTargetDir = path.join(projectRoot, '.specify', 'airules-schemas', frontendSchemaName)
const schemaManifestPath = path.join(projectRoot, '.specify', 'airules-schema.yaml')
const knowledgeSourcePath = path.join(skillRoot, 'assets', 'knowledge', 'index.md')
const knowledgeTargetPath = path.join(projectRoot, 'knowledge', 'index.md')
const created = []

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

function requireSpecifyCommand() {
  const command = resolveCommand(
    process.platform === 'win32'
      ? ['specify.cmd', 'specify.bat', 'specify.exe']
      : ['specify'],
  )
  if (!command) {
    throw new Error('MISSING specify CLI；请先安装 GitHub Spec Kit specify-cli，或先运行 AIRules speckit-development role setup。')
  }
  return command
}

function requireCodeGraphCommand() {
  const command = resolveCommand(
    process.platform === 'win32'
      ? ['codegraph.cmd', 'codegraph.bat', 'codegraph.exe']
      : ['codegraph'],
  )
  if (!command) {
    throw new Error('MISSING codegraph；请先安装 CodeGraph，或先运行 AIRules speckit-development role setup。')
  }
  return command
}

function requirePowerShellCommand() {
  const command = resolveCommand(['pwsh.cmd', 'pwsh.bat', 'pwsh.exe', 'powershell.cmd', 'powershell.bat', 'powershell.exe'])
  if (!command) {
    throw new Error('MISSING PowerShell；需要运行 speckit-superpowers-bridge readiness 脚本。')
  }
  return command
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
      console.log(`[airules] 已检测到前端项目，安装 ${frontendSchemaName} schema`)
      return true
    }
  }

  if (frontendConfigSignals.some(fileName => existsSync(path.join(projectRoot, fileName)))) {
    console.log(`[airules] 已检测到前端项目，安装 ${frontendSchemaName} schema`)
    return true
  }

  return false
}

function readPackageJson(packageJsonPath) {
  try {
    const parsed = JSON.parse(readFileSync(packageJsonPath, 'utf8'))
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('package.json 根节点必须是对象')
    }
    return parsed
  }
  catch (error) {
    throw new Error(`package.json 解析失败 ${packageJsonPath}: ${error.message}`)
  }
}

function packageHasFrontendDependency(pkg) {
  for (const sectionName of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) {
    const section = pkg[sectionName]
    if (section === undefined) {
      continue
    }
    if (section === null || typeof section !== 'object' || Array.isArray(section)) {
      throw new Error(`package.json ${sectionName} 必须是对象`)
    }
    if (Object.keys(section).some(name => frontendDependencySignals.includes(name))) {
      return true
    }
  }

  return false
}

function packageHasFrontendScript(pkg) {
  const scripts = pkg.scripts
  if (scripts === undefined) {
    return false
  }
  if (scripts === null || typeof scripts !== 'object' || Array.isArray(scripts)) {
    throw new Error('package.json scripts 必须是对象')
  }

  return Object.values(scripts).some(value =>
    typeof value === 'string'
    && frontendScriptSignals.some(signal => new RegExp(`(^|\\s)${escapeRegExp(signal)}(\\s|$|:)`).test(value)),
  )
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function initializeSpecKit(command) {
  runCommand(command, ['init', projectRoot, '--integration', integration, '--force'])
  console.log(`[airules] 已运行 specify init --integration ${integration}`)
}

function installBridgeExtension(command) {
  runCommand(command, ['extension', 'add', bridgeName, '--from', bridgeReleaseUrl])
  console.log(`[airules] 已安装 Spec Kit extension：${bridgeName}`)
}

function rewriteInstalledBridgeForProjectedSkills() {
  for (const bridgeRoot of [
    path.join(projectRoot, '.specify', 'extensions', bridgeName),
    path.join(projectRoot, '.agents', 'skills', bridgeName),
    path.join(projectRoot, '.claude', 'skills', bridgeName),
  ]) {
    rewriteTextFilesForProjectedSkills(bridgeRoot)
  }
}

function rewriteTextFilesForProjectedSkills(rootDir) {
  if (!existsSync(rootDir)) {
    return
  }

  for (const entry of readdirSync(rootDir, { withFileTypes: true })) {
    const entryPath = path.join(rootDir, entry.name)
    if (entry.isDirectory()) {
      rewriteTextFilesForProjectedSkills(entryPath)
      continue
    }
    if (entry.isFile() && isTextAsset(entryPath)) {
      const raw = readFileSync(entryPath, 'utf8')
      const next = rewriteSuperpowersPluginReferences(raw)
      if (next !== raw) {
        writeFileSync(entryPath, next, 'utf8')
      }
    }
  }
}

function isTextAsset(filePath) {
  return /\.(?:md|ya?ml|txt|json|ps1|sh)$/i.test(filePath)
}

function rewriteSuperpowersPluginReferences(raw) {
  return raw
    .replaceAll('Superpowers plugin installed, providing skills:', 'AIRules projected skills are available because role sync has projected the required skills:')
    .replaceAll('Superpowers plugin must be installed', 'AIRules projected skills must be available')
    .replaceAll('Requires Superpowers plugin installed', 'Requires AIRules projected skills to be available')
    .replaceAll('install the Superpowers plugin', 'run AIRules role sync so projected skills are available')
    .replaceAll('Install the Superpowers plugin', 'Run AIRules role sync so projected skills are available')
    .replaceAll('the Superpowers plugin', 'AIRules projected skills')
    .replaceAll('Superpowers plugin', 'AIRules projected skills')
    .replaceAll('claude plugin install superpowers@claude-plugins-official', 'AIRules role sync')
    .replaceAll('claude plugin list', 'inspect the available skills list')
    .replaceAll('Use the Skill tool to invoke', 'Invoke')
}

function copyDirectoryWithTransformIfMissing(sourceDir, targetDir, created) {
  assertAssetExists(sourceDir, path.relative(skillRoot, sourceDir).replace(/\\/g, '/'))

  for (const entry of readdirSync(sourceDir, { withFileTypes: true })) {
    const sourcePath = path.join(sourceDir, entry.name)
    const targetPath = path.join(targetDir, entry.name)

    if (entry.isDirectory()) {
      copyDirectoryWithTransformIfMissing(sourcePath, targetPath, created)
      continue
    }

    if (entry.isFile()) {
      copyFileWithTransformIfMissing(sourcePath, targetPath, created)
      continue
    }

    throw new Error(`Unsupported init-project asset type: ${sourcePath}`)
  }
}

function copyFileWithTransformIfMissing(sourcePath, targetPath, created) {
  if (existsSync(targetPath)) {
    return
  }

  mkdirSync(path.dirname(targetPath), { recursive: true })
  if (isTextAsset(sourcePath)) {
    writeFileSync(targetPath, rewriteSuperpowersPluginReferences(readFileSync(sourcePath, 'utf8')), 'utf8')
  }
  else {
    copyFileSync(sourcePath, targetPath)
  }
  created.push(rel(targetPath))
}

function updateSchemaField(raw, schemaLine) {
  if (/^schema\s*:/m.test(raw)) {
    return raw.replace(/^schema\s*:.*$/m, schemaLine)
  }

  const trimmed = raw.trimEnd()
  return trimmed.length > 0 ? `${trimmed}\n${schemaLine}\n` : `${schemaLine}\n`
}

function installFrontendSchema() {
  assertAssetExists(frontendSchemaSourceDir, `assets/schemas/${frontendSchemaName}`)
  assertAssetExists(path.join(frontendSchemaSourceDir, 'schema.yaml'), `assets/schemas/${frontendSchemaName}/schema.yaml`)

  const created = []
  copyDirectoryWithTransformIfMissing(frontendSchemaSourceDir, frontendSchemaTargetDir, created)

  const schemaLine = `schema: ${frontendSchemaName}`
  const manifestContent = existsSync(schemaManifestPath)
    ? updateSchemaField(readFileSync(schemaManifestPath, 'utf8'), schemaLine)
    : `${schemaLine}\n`
  mkdirSync(path.dirname(schemaManifestPath), { recursive: true })
  writeFileSync(schemaManifestPath, manifestContent, 'utf8')

  if (created.length === 0) {
    console.log(`[airules] ${frontendSchemaName} schema 已存在，跳过复制`)
    return
  }

  console.log(`[airules] 已安装前端 schema：${created.join(', ')}`)
}

function initializeCodeGraph() {
  if (skipCodeGraph) {
    console.log('[airules] 已跳过 CodeGraph 初始化（AIRULES_SKIP_CODEGRAPH_INIT=1）')
    return
  }

  runCommand(requireCodeGraphCommand(), ['init', '-i'])
  console.log('[airules] 已运行 codegraph init -i')
}

function runBridgeReadiness() {
  if (skipBridgeReadiness) {
    console.log('[airules] 已跳过 bridge readiness（AIRULES_SKIP_SPECKIT_BRIDGE_READINESS=1）')
    return
  }

  const powershellScript = path.join(projectRoot, '.specify', 'extensions', bridgeName, 'scripts', 'powershell', 'bridge-status.ps1')
  const bashScript = path.join(projectRoot, '.specify', 'extensions', bridgeName, 'scripts', 'bash', 'bridge-status.sh')

  if (process.platform === 'win32' && existsSync(powershellScript)) {
    runCommand(requirePowerShellCommand(), ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', powershellScript, '-Readiness', '-Actor', 'codex'])
    console.log('[airules] Spec Kit bridge readiness 通过（powershell）')
    return
  }

  if (existsSync(bashScript)) {
    runCommand('bash', [bashScript, '--readiness', '--actor', 'codex'])
    console.log('[airules] Spec Kit bridge readiness 通过（bash）')
    return
  }

  throw new Error(`MISSING ${bridgeName} readiness script；extension 安装不完整。`)
}

const specifyCommand = requireSpecifyCommand()
assertAssetExists(knowledgeSourcePath, 'assets/knowledge/index.md')
const isFrontendProject = detectFrontendProject()
initializeSpecKit(specifyCommand)
installBridgeExtension(specifyCommand)
rewriteInstalledBridgeForProjectedSkills()
copyFileWithTransformIfMissing(knowledgeSourcePath, knowledgeTargetPath, created)
if (created.length === 0) {
  console.log('[airules] knowledge/index.md 已存在，跳过')
}
else {
  console.log(`[airules] 已复制知识库入口：${created.join(', ')}`)
}
if (isFrontendProject) {
  installFrontendSchema()
}
initializeCodeGraph()
runBridgeReadiness()
