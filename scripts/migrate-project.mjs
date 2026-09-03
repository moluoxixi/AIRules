#!/usr/bin/env node
import { Buffer } from 'node:buffer'
import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { parseEnv, TextDecoder } from 'node:util'

const scriptPath = fileURLToPath(import.meta.url)
const sourceRoot = path.resolve(path.dirname(scriptPath), '..')
const scriptRelativePath = normalizeRelativePath(path.relative(sourceRoot, scriptPath))
const defaultProjectName = 'busyming'
const sourceGithubRepository = 'https://github.com/moluoxixi/AIRules'
const localEnvironmentFile = '.env.local'
const targetEnvironmentVariable = 'AIRULES_MIGRATE_TARGET'
const repositoryUrlEnvironmentVariable = 'AIRULES_MIGRATE_REPOSITORY_URL'
const utf8Decoder = new TextDecoder('utf-8', { fatal: true })

const sourceOnlyPrefixes = [
  '.claude',
  '.github',
  localEnvironmentFile,
  'roles/trellis',
  scriptRelativePath,
  'scripts/lib/__test__/migrate-project.test.ts',
]

const trellisOwnedTargetRoots = ['.agents', '.codex', '.trellis']

function normalizeRelativePath(value) {
  return value.split(path.sep).join('/')
}

function loadLocalEnvironment() {
  const environmentPath = path.join(sourceRoot, localEnvironmentFile)
  if (!existsSync(environmentPath))
    return

  let values
  try {
    values = parseEnv(readFileSync(environmentPath, 'utf8'))
  }
  catch (error) {
    throw new Error(`Cannot parse ${localEnvironmentFile}: ${error instanceof Error ? error.message : String(error)}`)
  }
  for (const [name, value] of Object.entries(values)) {
    if (process.env[name] === undefined)
      process.env[name] = value
  }
}

function createNameReplacement(projectName) {
  if (!/^[a-z][a-z0-9-]{0,62}$/u.test(projectName) || projectName.endsWith('-') || projectName.includes('--')) {
    throw new Error('Project name must be a lowercase kebab-case identifier of at most 63 characters')
  }

  return {
    constant: projectName.replaceAll('-', '_').toUpperCase(),
    display: projectName
      .split('-')
      .map(segment => `${segment[0].toUpperCase()}${segment.slice(1)}`)
      .join(''),
    projectName,
  }
}

function validateRepositoryUrl(value) {
  if (/\s/u.test(value))
    throw new Error('--repository-url must be a non-empty link without whitespace')
  return value
}

function replaceProjectName(value, replacement) {
  return value
    .replaceAll('MOLUOXIXI', replacement.constant)
    .replaceAll('Moluoxixi', replacement.display)
    .replaceAll('moluoxixi', replacement.projectName)
}

function replaceProjectText(value, replacement, repositoryUrl) {
  if (!repositoryUrl)
    return replaceProjectName(value, replacement)

  return value
    .replaceAll(`${sourceGithubRepository}.git`, sourceGithubRepository)
    .split(sourceGithubRepository)
    .map(segment => replaceProjectName(segment, replacement))
    .join(repositoryUrl)
}

function isSameOrChildPath(candidate, parent) {
  const relative = path.relative(parent, candidate)
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative))
}

function canonicalizePath(value) {
  const missingParts = []
  let cursor = path.resolve(value)

  while (!existsSync(cursor)) {
    const parent = path.dirname(cursor)
    if (parent === cursor)
      throw new Error(`Cannot resolve path: ${value}`)
    missingParts.unshift(path.basename(cursor))
    cursor = parent
  }

  return path.resolve(realpathSync.native(cursor), ...missingParts)
}

function isSourceOnly(relativePath) {
  const normalized = normalizeRelativePath(relativePath)
  const segments = normalized.split('/')

  if (segments.includes('.git') || segments.includes('node_modules'))
    return true

  return sourceOnlyPrefixes.some(prefix => normalized === prefix || normalized.startsWith(`${prefix}/`))
}

function validateTarget(targetArgument) {
  const resolvedTargetArgument = path.resolve(targetArgument)
  if (existsSync(resolvedTargetArgument) && lstatSync(resolvedTargetArgument).isSymbolicLink())
    throw new Error(`Refusing to clean a symbolic-link target: ${resolvedTargetArgument}`)

  const targetRoot = canonicalizePath(targetArgument)
  const canonicalSourceRoot = canonicalizePath(sourceRoot)

  if (targetRoot === path.parse(targetRoot).root)
    throw new Error(`Refusing to use a filesystem root as the target: ${targetRoot}`)
  if (isSameOrChildPath(targetRoot, canonicalSourceRoot) || isSameOrChildPath(canonicalSourceRoot, targetRoot)) {
    throw new Error('Source and target directories must not overlap')
  }

  if (existsSync(targetRoot)) {
    const targetStats = lstatSync(targetRoot)
    if (!targetStats.isDirectory())
      throw new Error(`Target must be a directory: ${targetRoot}`)
  }

  return targetRoot
}

function cleanTarget(targetRoot) {
  mkdirSync(targetRoot, { recursive: true })
  for (const entry of readdirSync(targetRoot)) {
    if (entry === '.git')
      continue
    rmSync(path.join(targetRoot, entry), {
      force: true,
      maxRetries: 3,
      recursive: true,
      retryDelay: 100,
    })
  }
}

function validateRenamePlan(sourceDirectory, replacement, relativeDirectory = '', destinations = new Map()) {
  for (const entry of readdirSync(sourceDirectory)) {
    const relativePath = relativeDirectory ? `${relativeDirectory}/${entry}` : entry
    if (isSourceOnly(relativePath))
      continue

    const destination = replaceProjectName(relativePath, replacement)
    const destinationKey = process.platform === 'win32' ? destination.toLowerCase() : destination
    const existing = destinations.get(destinationKey)
    if (existing && existing !== relativePath) {
      throw new Error(`Rename collision: ${existing} and ${relativePath} both map to ${destination}`)
    }
    destinations.set(destinationKey, relativePath)

    const sourcePath = path.join(sourceDirectory, entry)
    const stats = lstatSync(sourcePath)
    if (stats.isDirectory() && !stats.isSymbolicLink())
      validateRenamePlan(sourcePath, replacement, relativePath, destinations)
  }
}

function replaceCopiedText(sourcePath, targetPath, replacement, repositoryUrl) {
  const content = readFileSync(sourcePath)
  const decodedContent = decodeUtf8(content)
  if (!decodedContent)
    return

  const replaced = replaceProjectText(decodedContent.text, replacement, repositoryUrl)
  if (replaced !== decodedContent.text)
    writeUtf8(targetPath, replaced, decodedContent.hasByteOrderMark)
}

function copyIncluded(sourceDirectory, targetDirectory, replacement, repositoryUrl, relativeDirectory = '') {
  mkdirSync(targetDirectory, { recursive: true })

  for (const entry of readdirSync(sourceDirectory)) {
    const relativePath = relativeDirectory ? `${relativeDirectory}/${entry}` : entry
    if (isSourceOnly(relativePath))
      continue

    const sourcePath = path.join(sourceDirectory, entry)
    const targetPath = path.join(targetDirectory, replaceProjectName(entry, replacement))
    const stats = lstatSync(sourcePath)

    if (stats.isDirectory() && !stats.isSymbolicLink()) {
      copyIncluded(sourcePath, targetPath, replacement, repositoryUrl, relativePath)
      continue
    }

    cpSync(sourcePath, targetPath, {
      dereference: false,
      errorOnExist: true,
      force: false,
      preserveTimestamps: true,
      verbatimSymlinks: true,
    })
    if (stats.isFile())
      replaceCopiedText(sourcePath, targetPath, replacement, repositoryUrl)
  }
}

function decodeUtf8(content) {
  if (content.includes(0))
    return undefined

  const hasByteOrderMark = content.length >= 3
    && content[0] === 0xEF
    && content[1] === 0xBB
    && content[2] === 0xBF
  try {
    return {
      hasByteOrderMark,
      text: utf8Decoder.decode(hasByteOrderMark ? content.subarray(3) : content),
    }
  }
  catch {
    return undefined
  }
}

function writeUtf8(filePath, text, hasByteOrderMark = false) {
  const encoded = Buffer.from(text, 'utf8')
  writeFileSync(
    filePath,
    hasByteOrderMark ? Buffer.concat([Buffer.from([0xEF, 0xBB, 0xBF]), encoded]) : encoded,
  )
}

function updateTargetText(targetRoot, relativePath, transform) {
  const filePath = path.join(targetRoot, relativePath)
  if (!existsSync(filePath))
    return
  const stats = lstatSync(filePath)
  if (!stats.isFile() || stats.isSymbolicLink())
    throw new Error(`Expected a regular text file while removing Trellis content: ${relativePath}`)

  const decodedContent = decodeUtf8(readFileSync(filePath))
  if (!decodedContent)
    throw new Error(`Expected UTF-8 text while removing Trellis content: ${relativePath}`)
  const updated = transform(decodedContent.text)
  if (updated !== decodedContent.text)
    writeUtf8(filePath, updated, decodedContent.hasByteOrderMark)
}

function removeMatchingLines(content, pattern) {
  const newline = content.includes('\r\n') ? '\r\n' : '\n'
  const trailingNewline = /\r?\n$/u.test(content)
  const updated = content.split(/\r?\n/u).filter(line => !pattern.test(line)).join(newline)
  return trailingNewline && !updated.endsWith(newline) ? `${updated}${newline}` : updated
}

function removeTrellisOwnedContent(targetRoot) {
  for (const relativePath of trellisOwnedTargetRoots)
    rmSync(path.join(targetRoot, relativePath), { force: true, recursive: true })

  updateTargetText(targetRoot, 'AGENTS.md', content => content.replace(
    /\r?\n?<!-- AIRULES:TRELLIS-EXTENSION:START -->[\s\S]*?<!-- AIRULES:TRELLIS-EXTENSION:END -->\r?\n?/gu,
    '\n',
  ))
  updateTargetText(targetRoot, '.gitattributes', content => content.replace(/\r?\n# Trellis:[\s\S]*$/u, '\n'))
  updateTargetText(targetRoot, 'capabilities/README.md', content => removeMatchingLines(content, /\|\s*`trellis`\s*\|/iu))
  updateTargetText(targetRoot, 'eslint.config.ts', content => removeMatchingLines(content, /^\s*['"]\.trellis['"],?\s*$/u))
  updateTargetText(targetRoot, 'scripts/verify-packed-airules.mjs', content => content
    .replace(/^\s*const trellisManifest = .*\r?\n/mu, '')
    .replaceAll('!fs.existsSync(trellisManifest) || ', '')
    .replaceAll(', trellisManifest', ''))
  updateTargetText(targetRoot, 'skills/common/spec-organization/SKILL.md', content => content
    .replaceAll(', `.trellis/spec`', '')
    .replaceAll('、`.trellis/spec/`', ''))
}

function discoverRoles(targetRoot) {
  const rolesRoot = path.join(targetRoot, 'roles')
  if (!existsSync(rolesRoot))
    return []
  return readdirSync(rolesRoot, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && existsSync(path.join(rolesRoot, entry.name, 'role.yaml')))
    .map(entry => entry.name)
    .sort((left, right) => left.localeCompare(right, 'en'))
}

function roleAssets(targetRoot, roleId) {
  return ['skills', 'mcp', 'packages']
    .filter(asset => existsSync(path.join(targetRoot, 'roles', roleId, asset)))
}

function roleWorkflow(roleId, language, hasProjectInitializer) {
  if (language === 'zh') {
    if (roleId === 'trellis')
      return '工作流：首次接入时运行一次 `init-project`；日常按“规划（Plan）→ 执行（Execute）→ 完成（Finish）”推进。'
    if (roleId === 'moluoxixi')
      return '工作流：首次接入时运行一次 `init-project`；之后按需求、任务、实现、检查和完成推进，并结合项目知识库。'
    if (!hasProjectInitializer)
      return '工作流：提出问题 → AI 选择合适的 skill → 在当前项目中实施并复核；不需要项目初始化。'
    return '工作流：首次接入时运行一次 `init-project`；之后直接描述需求，由项目工作流推进任务、实现、检查和完成。'
  }
  if (roleId === 'trellis')
    return 'Workflow: run `init-project` once for first-time setup; then move through Plan → Execute → Finish.'
  if (roleId === 'moluoxixi')
    return 'Workflow: run `init-project` once for first-time setup; then move through requirement, task, implementation, checking, and completion with the project knowledge base.'
  if (!hasProjectInitializer)
    return 'Workflow: state the problem → the AI selects the relevant skill → implement and review in the current project; no project initialization is required.'
  return 'Workflow: run `init-project` once for first-time setup; then describe requirements directly and let the project workflow guide task, implementation, checking, and completion.'
}

function readPackageMetadata(targetRoot, replacement) {
  const manifestPath = path.join(targetRoot, 'package.json')
  if (!existsSync(manifestPath)) {
    return {
      description: 'AI role assets for supported coding hosts.',
      license: 'MIT',
      name: `${replacement.projectName}-ai-rules`,
    }
  }
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  return {
    description: typeof manifest.description === 'string' ? manifest.description : 'AI role assets for supported coding hosts.',
    license: typeof manifest.license === 'string' ? manifest.license : 'MIT',
    name: typeof manifest.name === 'string' ? manifest.name : `${replacement.projectName}-ai-rules`,
  }
}

function renderRoleSections(targetRoot, roles, language, packageName) {
  return roles.map((roleId) => {
    const assets = roleAssets(targetRoot, roleId)
    const assetSummary = assets.length > 0 ? assets.map(asset => `\`${asset}\``).join(', ') : language === 'zh' ? '无独立资产目录' : 'No dedicated asset directories'
    const hasProjectInitializer = existsSync(path.join(targetRoot, 'roles', roleId, 'skills', 'init-project', 'SKILL.md'))
    if (language === 'zh') {
      return `## \`${roleId}\`

${hasProjectInitializer
  ? '适合需要角色专属项目工作流、初始化能力和配套资产的用户。'
  : '适合直接使用角色 skills，而不需要项目工作流或初始化状态的用户。'}

### 安装

\`\`\`bash
npm install --global ${packageName}
airules install ${roleId} --host all
airules verify ${roleId} --host all
\`\`\`

### 功能

- 分发角色资产：${assetSummary}。
- ${hasProjectInitializer
  ? '提供项目初始化入口，并在项目中维护角色专属工作流和状态。'
  : '安装后由 AI 根据任务直接选择对应 skills，不创建角色专属项目状态。'}

### 用法

${hasProjectInitializer
  ? '安装后，在目标项目的 AI 宿主中要求 AI 使用 `init-project` 初始化当前项目并配置实际宿主；初始化完成后再直接描述任务。'
  : '该角色无需项目初始化。安装后在对应 AI 宿主中直接描述任务，AI 会按需调用该角色的 skills。'}

${roleWorkflow(roleId, 'zh', hasProjectInitializer)}

角色目录：[\`roles/${roleId}\`](roles/${roleId})`
    }
    return `## \`${roleId}\`

${hasProjectInitializer
  ? 'For users who need the role-specific project workflow, initialization, and supporting assets.'
  : 'For users who want to invoke the role skills directly without project workflow state or initialization.'}

### Install

\`\`\`bash
npm install --global ${packageName}
airules install ${roleId} --host all
airules verify ${roleId} --host all
\`\`\`

### Features

- Distributes role assets: ${assetSummary}.
- ${hasProjectInitializer
  ? 'Provides a project initializer and maintains the role-specific workflow and state in the project.'
  : 'Lets the AI select the relevant skills directly after installation and creates no role-specific project state.'}

### Usage

${hasProjectInitializer
  ? 'After installation, ask the AI in the target project to use `init-project` to initialize the project and configure the actual host. Then describe the task normally.'
  : 'This role requires no project initialization. Describe the task directly in the selected AI host, which will invoke the role skills as needed.'}

${roleWorkflow(roleId, 'en', hasProjectInitializer)}

Role directory: [\`roles/${roleId}\`](roles/${roleId})`
  }).join('\n\n')
}

function regenerateReadmes(targetRoot, replacement) {
  const roles = discoverRoles(targetRoot)
  const metadata = readPackageMetadata(targetRoot, replacement)
  const chinese = `# ${replacement.display} AIRules

${replacement.display} AIRules 为受支持的 AI 编程宿主分发带版本的 skills、MCP 配置和角色专属资产。

[English](README-en.md)

${renderRoleSections(targetRoot, roles, 'zh', metadata.name) || '当前没有可用角色。'}

## 开发

\`\`\`bash
npm install
npm test
\`\`\`

## 许可证

${metadata.license}
`
  const english = `# ${replacement.display} AIRules

${metadata.description}

[简体中文](README.md)

${renderRoleSections(targetRoot, roles, 'en', metadata.name) || 'No roles are currently available.'}

## Development

\`\`\`bash
npm install
npm test
\`\`\`

## License

${metadata.license}
`
  writeUtf8(path.join(targetRoot, 'README.md'), chinese)
  writeUtf8(path.join(targetRoot, 'README-en.md'), english)
  rmSync(path.join(targetRoot, 'README-zh.md'), { force: true })
  writeUtf8(path.join(targetRoot, 'SKILLS_ORGANIZATION.md'), `# Skills Organization

Shared skills live in [\`skills/common\`](skills/common). Role-owned skills remain under their role directory.

## Roles

${renderRoleSections(targetRoot, roles, 'en', metadata.name) || 'No roles are currently available.'}
`)
}

function findTrellisResiduals(targetRoot, currentDirectory = targetRoot, residuals = []) {
  for (const entry of readdirSync(currentDirectory, { withFileTypes: true })) {
    if (currentDirectory === targetRoot && entry.name === '.git')
      continue
    const entryPath = path.join(currentDirectory, entry.name)
    const relativePath = normalizeRelativePath(path.relative(targetRoot, entryPath))
    if (relativePath.toLowerCase().includes('trellis'))
      residuals.push(`path:${relativePath}`)
    if (entry.isDirectory()) {
      findTrellisResiduals(targetRoot, entryPath, residuals)
    }
    else if (entry.isSymbolicLink()) {
      if (readlinkSync(entryPath).toLowerCase().includes('trellis'))
        residuals.push(`link:${relativePath}`)
    }
    else if (readFileSync(entryPath).toString('latin1').toLowerCase().includes('trellis')) {
      residuals.push(`content:${relativePath}`)
    }
  }
  return residuals
}

function assertNoTrellisContent(targetRoot) {
  const residuals = findTrellisResiduals(targetRoot)
  if (residuals.length > 0) {
    throw new Error(`Trellis content remains after cleanup:\n${residuals.slice(0, 20).join('\n')}`)
  }
}

function migrationSummary(targetRoot, dryRun, replacement, repositoryUrl) {
  const targetEntries = existsSync(targetRoot)
    ? readdirSync(targetRoot).filter(entry => entry !== '.git')
    : []
  const sourceEntries = readdirSync(sourceRoot).filter(entry => !isSourceOnly(entry))

  return [
    `Mode: ${dryRun ? 'dry-run' : 'execute'}`,
    `Source: ${sourceRoot}`,
    `Target: ${targetRoot}`,
    `Project name: ${replacement.projectName}`,
    `Name forms: moluoxixi -> ${replacement.projectName}, Moluoxixi -> ${replacement.display}, MOLUOXIXI -> ${replacement.constant}`,
    `Repository URL: ${repositoryUrl ?? replaceProjectName(sourceGithubRepository, replacement)}`,
    `Target entries to remove: ${targetEntries.length}`,
    `Source top-level entries to copy: ${sourceEntries.length}`,
  ].join('\n')
}

function usage() {
  return `Usage:
  node scripts/migrate-project.mjs <target-directory> [--name <name>] [--repository-url <url>] --dry-run
  node scripts/migrate-project.mjs <target-directory> [--name <name>] [--repository-url <url>] --yes

The target is cleared before migration, except for its root .git entry.
Moluoxixi path names and UTF-8 text are renamed to "${defaultProjectName}" by default.
Use --name to select another lowercase kebab-case project name.
Use --repository-url to replace this project's GitHub repository links with any specified link.
The root ${localEnvironmentFile} file is loaded automatically and supports:
  - ${targetEnvironmentVariable}
  - ${repositoryUrlEnvironmentVariable}
CLI arguments override process environment variables, which override ${localEnvironmentFile} values.
The following source content is not copied:
  - all .git metadata
  - node_modules directories at any depth
  - root .github and .claude directories
  - root ${localEnvironmentFile}
  - roles/trellis
  - this migration script and its test

Everything else is copied, including other ignored content when present. The source directory remains unchanged.
Trellis-owned target roots and remaining Trellis references are removed after copying.

Use --dry-run to validate paths without changing either directory.
Use --yes to acknowledge that the target cleanup is destructive.`
}

function parseArguments(args) {
  let target
  let dryRun = false
  let confirmed = false
  let help = false
  let projectName = defaultProjectName
  let repositoryUrl = process.env[repositoryUrlEnvironmentVariable] || undefined

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index]
    if (argument === '--dry-run') {
      dryRun = true
    }
    else if (argument === '--yes') {
      confirmed = true
    }
    else if (argument === '--help' || argument === '-h') {
      help = true
    }
    else if (argument === '--name') {
      const value = args[index + 1]
      if (!value || value.startsWith('-'))
        throw new Error('--name requires a value')
      projectName = value
      index += 1
    }
    else if (argument === '--repository-url') {
      const value = args[index + 1]
      if (!value || value.startsWith('-'))
        throw new Error('--repository-url requires a value')
      repositoryUrl = value
      index += 1
    }
    else if (argument.startsWith('-')) {
      throw new Error(`Unknown option: ${argument}`)
    }
    else if (target) {
      throw new Error('Only one target directory may be specified')
    }
    else {
      target = argument
    }
  }

  return {
    confirmed,
    dryRun,
    help,
    projectName,
    repositoryUrl,
    target: (target ?? process.env[targetEnvironmentVariable]) || undefined,
  }
}

function main() {
  loadLocalEnvironment()
  const options = parseArguments(process.argv.slice(2))
  if (options.help) {
    console.log(usage())
    return
  }
  if (!options.target)
    throw new Error(usage())
  const replacement = createNameReplacement(options.projectName)
  const repositoryUrl = options.repositoryUrl ? validateRepositoryUrl(options.repositoryUrl) : undefined
  if (!options.dryRun && !options.confirmed)
    throw new Error('Refusing destructive migration without --yes. Run with --dry-run first.')

  const targetRoot = validateTarget(options.target)
  validateRenamePlan(sourceRoot, replacement)
  console.log(migrationSummary(targetRoot, options.dryRun, replacement, repositoryUrl))
  if (options.dryRun)
    return

  cleanTarget(targetRoot)
  copyIncluded(sourceRoot, targetRoot, replacement, repositoryUrl)
  removeTrellisOwnedContent(targetRoot)
  regenerateReadmes(targetRoot, replacement)
  assertNoTrellisContent(targetRoot)
  console.log('Migration complete')
}

try {
  main()
}
catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
}
