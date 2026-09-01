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
  rmdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { TextDecoder } from 'node:util'

const scriptPath = fileURLToPath(import.meta.url)
const sourceRoot = path.resolve(path.dirname(scriptPath), '..')
const scriptRelativePath = normalizeRelativePath(path.relative(sourceRoot, scriptPath))
const defaultProjectName = 'busyming'
const utf8Decoder = new TextDecoder('utf-8', { fatal: true })

const sourceOnlyPrefixes = [
  '.claude',
  '.github',
  '.trellis',
  'roles/trellis',
  scriptRelativePath,
  'scripts/lib/__test__/migrate-project.test.ts',
]

const trellisOwnedTargetRoots = ['.agents', '.codex', '.trellis']

function normalizeRelativePath(value) {
  return value.split(path.sep).join('/')
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

function replaceProjectName(value, replacement) {
  return value
    .replaceAll('MOLUOXIXI', replacement.constant)
    .replaceAll('Moluoxixi', replacement.display)
    .replaceAll('moluoxixi', replacement.projectName)
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

  if (segments.includes('.git'))
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

function replaceCopiedText(sourcePath, targetPath, replacement) {
  const content = readFileSync(sourcePath)
  const decodedContent = decodeUtf8(content)
  if (!decodedContent)
    return

  const replaced = replaceProjectName(decodedContent.text, replacement)
  if (replaced !== decodedContent.text)
    writeUtf8(targetPath, replaced, decodedContent.hasByteOrderMark)
}

function copyIncluded(sourceDirectory, targetDirectory, replacement, relativeDirectory = '') {
  mkdirSync(targetDirectory, { recursive: true })

  for (const entry of readdirSync(sourceDirectory)) {
    const relativePath = relativeDirectory ? `${relativeDirectory}/${entry}` : entry
    if (isSourceOnly(relativePath))
      continue

    const sourcePath = path.join(sourceDirectory, entry)
    const targetPath = path.join(targetDirectory, replaceProjectName(entry, replacement))
    const stats = lstatSync(sourcePath)

    if (stats.isDirectory() && !stats.isSymbolicLink()) {
      copyIncluded(sourcePath, targetPath, replacement, relativePath)
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
      replaceCopiedText(sourcePath, targetPath, replacement)
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

function renderRoleSections(targetRoot, roles, language) {
  return roles.map((roleId) => {
    const assets = roleAssets(targetRoot, roleId)
    const assetSummary = assets.length > 0 ? assets.map(asset => `\`${asset}\``).join(', ') : language === 'zh' ? '无独立资产目录' : 'No dedicated asset directories'
    if (language === 'zh') {
      return `### \`${roleId}\`

角色目录：[\`roles/${roleId}\`](roles/${roleId})

资产：${assetSummary}

\`\`\`bash
airules install ${roleId} --host all
airules verify ${roleId} --host all
\`\`\``
    }
    return `### \`${roleId}\`

Role directory: [\`roles/${roleId}\`](roles/${roleId})

Assets: ${assetSummary}

\`\`\`bash
airules install ${roleId} --host all
airules verify ${roleId} --host all
\`\`\``
  }).join('\n\n')
}

function regenerateReadmes(targetRoot, replacement) {
  const roles = discoverRoles(targetRoot)
  const metadata = readPackageMetadata(targetRoot, replacement)
  const english = `# ${replacement.display} AIRules

${metadata.description}

## Install

\`\`\`bash
npm install --global ${metadata.name}
airules --version
\`\`\`

## Roles

${renderRoleSections(targetRoot, roles, 'en') || 'No roles are currently available.'}

## Development

\`\`\`bash
npm install
npm test
\`\`\`

Chinese documentation: [README-zh.md](README-zh.md)

## License

${metadata.license}
`
  const chinese = `# ${replacement.display} AIRules

${metadata.description}

## 安装

\`\`\`bash
npm install --global ${metadata.name}
airules --version
\`\`\`

## Roles

${renderRoleSections(targetRoot, roles, 'zh') || '当前没有可用角色。'}

## 开发

\`\`\`bash
npm install
npm test
\`\`\`

English documentation: [README.md](README.md)

## 许可证

${metadata.license}
`
  writeUtf8(path.join(targetRoot, 'README.md'), english)
  writeUtf8(path.join(targetRoot, 'README-zh.md'), chinese)
  writeUtf8(path.join(targetRoot, 'SKILLS_ORGANIZATION.md'), `# Skills Organization

Shared skills live in [\`skills/common\`](skills/common). Role-owned skills remain under their role directory.

## Roles

${renderRoleSections(targetRoot, roles, 'en') || 'No roles are currently available.'}
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

function removeIncluded(sourceDirectory, relativeDirectory = '') {
  for (const entry of readdirSync(sourceDirectory)) {
    const relativePath = relativeDirectory ? `${relativeDirectory}/${entry}` : entry
    if (isSourceOnly(relativePath))
      continue

    const sourcePath = path.join(sourceDirectory, entry)
    const stats = lstatSync(sourcePath)

    if (stats.isDirectory() && !stats.isSymbolicLink()) {
      removeIncluded(sourcePath, relativePath)
      if (readdirSync(sourcePath).length === 0)
        rmdirSync(sourcePath)
      continue
    }

    rmSync(sourcePath, { force: true })
  }
}

function migrationSummary(targetRoot, dryRun, replacement) {
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
    `Target entries to remove: ${targetEntries.length}`,
    `Source top-level entries to migrate: ${sourceEntries.length}`,
  ].join('\n')
}

function usage() {
  return `Usage:
  node scripts/migrate-project.mjs <target-directory> [--name <name>] --dry-run
  node scripts/migrate-project.mjs <target-directory> [--name <name>] --yes

The target is cleared before migration, except for its root .git entry.
Moluoxixi path names and UTF-8 text are renamed to "${defaultProjectName}" by default.
Use --name to select another lowercase kebab-case project name.
The following source content is retained and not migrated:
  - all .git metadata
  - root .github and .claude directories
  - roles/trellis
  - this migration script and its test

Everything else is migrated, including ignored content when present.
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

  return { confirmed, dryRun, help, projectName, target }
}

function main() {
  const options = parseArguments(process.argv.slice(2))
  if (options.help) {
    console.log(usage())
    return
  }
  if (!options.target)
    throw new Error(usage())
  const replacement = createNameReplacement(options.projectName)
  if (!options.dryRun && !options.confirmed)
    throw new Error('Refusing destructive migration without --yes. Run with --dry-run first.')

  const targetRoot = validateTarget(options.target)
  validateRenamePlan(sourceRoot, replacement)
  console.log(migrationSummary(targetRoot, options.dryRun, replacement))
  if (options.dryRun)
    return

  cleanTarget(targetRoot)
  copyIncluded(sourceRoot, targetRoot, replacement)
  removeTrellisOwnedContent(targetRoot)
  regenerateReadmes(targetRoot, replacement)
  assertNoTrellisContent(targetRoot)
  removeIncluded(sourceRoot)
  console.log('Migration complete')
}

try {
  main()
}
catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
}
