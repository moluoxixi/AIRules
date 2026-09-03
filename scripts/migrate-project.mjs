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
const defaultPreservedTargetPaths = ['.git', 'node_modules']
const rootReadmePattern = /^README.*\.md$/iu

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

function relativePathKey(value) {
  return process.platform === 'win32' ? value.toLowerCase() : value
}

function isSameOrChildRelativePath(candidate, parent) {
  const candidateKey = relativePathKey(candidate)
  const parentKey = relativePathKey(parent)
  return candidateKey === parentKey || candidateKey.startsWith(`${parentKey}/`)
}

function relativePathsOverlap(left, right) {
  return isSameOrChildRelativePath(left, right) || isSameOrChildRelativePath(right, left)
}

function validatePreservedPath(value) {
  const segments = value.split('/')
  if (
    value === ''
    || value.includes('\0')
    || value.includes('\\')
    || path.posix.isAbsolute(value)
    || path.win32.isAbsolute(value)
    || /^[A-Za-z]:/u.test(value)
    || segments.some(segment => segment === '' || segment === '.' || segment === '..' || /[. ]$/u.test(segment))
  ) {
    throw new Error(`--preserve requires a safe relative path: ${value || '<empty>'}`)
  }
  return segments.join('/')
}

function normalizePreservedPaths(values) {
  const preserved = []
  for (const value of [...defaultPreservedTargetPaths, ...values]) {
    const candidate = validatePreservedPath(value)
    if (preserved.some(parent => isSameOrChildRelativePath(candidate, parent)))
      continue
    for (let index = preserved.length - 1; index >= 0; index -= 1) {
      if (isSameOrChildRelativePath(preserved[index], candidate))
        preserved.splice(index, 1)
    }
    preserved.push(candidate)
  }
  return preserved
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

function validatePreservedTargetPaths(targetRoot, preservedPaths) {
  for (const preservedPath of preservedPaths) {
    const segments = preservedPath.split('/')
    let cursor = targetRoot
    for (let index = 0; index < segments.length; index += 1) {
      cursor = path.join(cursor, segments[index])
      const stats = lstatSync(cursor, { throwIfNoEntry: false })
      if (!stats)
        break
      if (index < segments.length - 1 && stats.isSymbolicLink())
        throw new Error(`Symbolic-link parent is not allowed in --preserve path: ${preservedPath}`)
      if (index < segments.length - 1 && !stats.isDirectory())
        throw new Error(`Non-directory parent is not allowed in --preserve path: ${preservedPath}`)
    }
  }
}

function cleanTargetDirectory(currentDirectory, relativeDirectory, preservedPaths) {
  for (const entry of readdirSync(currentDirectory)) {
    const relativePath = relativeDirectory ? `${relativeDirectory}/${entry}` : entry
    if (preservedPaths.some(preservedPath => isSameOrChildRelativePath(relativePath, preservedPath)))
      continue

    const entryPath = path.join(currentDirectory, entry)
    const containsPreservedPath = preservedPaths.some(preservedPath => isSameOrChildRelativePath(preservedPath, relativePath))
    if (containsPreservedPath) {
      cleanTargetDirectory(entryPath, relativePath, preservedPaths)
      continue
    }
    rmSync(entryPath, {
      force: true,
      maxRetries: 3,
      recursive: true,
      retryDelay: 100,
    })
  }
}

function cleanTarget(targetRoot, preservedPaths) {
  mkdirSync(targetRoot, { recursive: true })
  cleanTargetDirectory(targetRoot, '', preservedPaths)
}

function validateRenamePlan(sourceDirectory, replacement, relativeDirectory = '', destinations = new Map()) {
  for (const entry of readdirSync(sourceDirectory)) {
    const relativePath = relativeDirectory ? `${relativeDirectory}/${entry}` : entry
    if (isSourceOnly(relativePath))
      continue

    const destination = replaceProjectName(relativePath, replacement)
    const destinationKey = relativePathKey(destination)
    const existing = destinations.get(destinationKey)
    if (existing && existing.source !== relativePath) {
      throw new Error(`Rename collision: ${existing.source} and ${relativePath} both map to ${destination}`)
    }
    destinations.set(destinationKey, { destination, source: relativePath })

    const sourcePath = path.join(sourceDirectory, entry)
    const stats = lstatSync(sourcePath)
    if (stats.isDirectory() && !stats.isSymbolicLink())
      validateRenamePlan(sourcePath, replacement, relativePath, destinations)
  }
  return destinations
}

function validatePreserveConflicts(preservedPaths, destinations) {
  for (const preservedPath of preservedPaths) {
    for (const { destination } of destinations.values()) {
      if (relativePathsOverlap(preservedPath, destination)) {
        throw new Error(`--preserve path overlaps migration output: ${preservedPath} and ${destination}`)
      }
    }
    for (const cleanupRoot of trellisOwnedTargetRoots) {
      if (relativePathsOverlap(preservedPath, cleanupRoot))
        throw new Error(`--preserve path overlaps Trellis cleanup target: ${preservedPath} and ${cleanupRoot}`)
    }
  }
}

function rootReadme(relativePath) {
  return !relativePath.includes('/') && rootReadmePattern.test(relativePath)
}

function textLines(value) {
  const lines = []
  let start = 0
  while (start < value.length) {
    let contentEnd = start
    while (contentEnd < value.length && value[contentEnd] !== '\r' && value[contentEnd] !== '\n')
      contentEnd += 1
    let end = contentEnd
    if (value[end] === '\r' && value[end + 1] === '\n')
      end += 2
    else if (value[end] === '\r' || value[end] === '\n')
      end += 1
    lines.push({ content: value.slice(start, contentEnd), end, start })
    start = end
  }
  return lines
}

function markdownIndent(line) {
  let offset = 0
  while (offset < 3 && line[offset] === ' ')
    offset += 1
  return offset
}

function openingFence(line) {
  const offset = markdownIndent(line)
  const character = line[offset]
  if (character !== '`' && character !== '~')
    return undefined
  let end = offset
  while (line[end] === character)
    end += 1
  const length = end - offset
  if (length < 3 || (character === '`' && line.slice(end).includes('`')))
    return undefined
  return { character, length }
}

function closesFence(line, fence) {
  const offset = markdownIndent(line)
  if (line[offset] !== fence.character)
    return false
  let end = offset
  while (line[end] === fence.character)
    end += 1
  if (end - offset < fence.length)
    return false
  return [...line.slice(end)].every(character => character === ' ' || character === '\t')
}

function atxHeading(line) {
  const offset = markdownIndent(line)
  let end = offset
  while (line[end] === '#')
    end += 1
  const level = end - offset
  if (level < 1 || level > 6)
    return undefined
  if (end < line.length && line[end] !== ' ' && line[end] !== '\t')
    return undefined
  const text = line.slice(end)
    .replace(/^[ \t]+/u, '')
    .replace(/[ \t]+#+[ \t]*$/u, '')
    .trim()
  return {
    level,
    text,
  }
}

function trellisRoleHeading(heading) {
  return heading.level === 2 && /^(?:trellis|`trellis`)$/iu.test(heading.text)
}

function removeTrellisReadmeSections(value) {
  const ranges = []
  let fence
  let sectionStart
  for (const line of textLines(value)) {
    if (fence) {
      if (closesFence(line.content, fence))
        fence = undefined
      continue
    }

    const openedFence = openingFence(line.content)
    if (openedFence) {
      fence = openedFence
      continue
    }

    const heading = atxHeading(line.content)
    if (!heading || heading.level > 2)
      continue
    if (sectionStart !== undefined) {
      ranges.push([sectionStart, line.start])
      sectionStart = undefined
    }
    if (trellisRoleHeading(heading))
      sectionStart = line.start
  }
  if (sectionStart !== undefined)
    ranges.push([sectionStart, value.length])
  if (ranges.length === 0)
    return value

  let cursor = 0
  let updated = ''
  for (const [start, end] of ranges) {
    updated += value.slice(cursor, start)
    cursor = end
  }
  return `${updated}${value.slice(cursor)}`
}

function validateRootReadmes(sourceDirectory) {
  for (const entry of readdirSync(sourceDirectory)) {
    if (!rootReadme(entry))
      continue
    const filePath = path.join(sourceDirectory, entry)
    const stats = lstatSync(filePath)
    if (!stats.isFile() || stats.isSymbolicLink())
      throw new Error(`${entry} must be a regular UTF-8 file`)
    if (!decodeUtf8(readFileSync(filePath)))
      throw new Error(`${entry} must be UTF-8 text`)
  }
}

function replaceCopiedText(sourcePath, targetPath, replacement, repositoryUrl, relativePath) {
  const content = readFileSync(sourcePath)
  const decodedContent = decodeUtf8(content)
  if (!decodedContent)
    return

  const renamed = replaceProjectText(decodedContent.text, replacement, repositoryUrl)
  const replaced = rootReadme(relativePath) ? removeTrellisReadmeSections(renamed) : renamed
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
      replaceCopiedText(sourcePath, targetPath, replacement, repositoryUrl, relativePath)
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
  updateTargetText(targetRoot, 'SKILLS_ORGANIZATION.md', removeTrellisOrganizationContent)
  updateTargetText(targetRoot, 'skills/common/spec-organization/SKILL.md', content => content
    .replaceAll(', `.trellis/spec`', '')
    .replaceAll('、`.trellis/spec/`', ''))
}

function removeTrellisOrganizationContent(content) {
  const lines = textLines(content)
  const removed = new Set()
  for (let index = 0; index < lines.length; index += 1) {
    const treeEntry = /^([ \t│]*)[├└]──[ \t]+trellis\/?[ \t]*$/iu.exec(lines[index].content)
    if (treeEntry) {
      removed.add(index)
      const branchOffset = treeEntry[1].length
      for (let childIndex = index + 1; childIndex < lines.length; childIndex += 1) {
        const childBranchOffset = lines[childIndex].content.search(/[├└]──/u)
        if (childBranchOffset > branchOffset) {
          removed.add(childIndex)
          continue
        }
        break
      }
    }
    if (/trellis/iu.test(lines[index].content))
      removed.add(index)
  }
  return lines.filter((_, index) => !removed.has(index)).map(line => content.slice(line.start, line.end)).join('')
}

function preservedForResidualScan(relativePath, preservedPaths) {
  return preservedPaths.some(preservedPath => isSameOrChildRelativePath(relativePath, preservedPath))
}

function preserveAncestor(relativePath, preservedPaths) {
  return preservedPaths.some(preservedPath => isSameOrChildRelativePath(preservedPath, relativePath))
}

function findTrellisResiduals(targetRoot, preservedPaths, currentDirectory = targetRoot, residuals = []) {
  for (const entry of readdirSync(currentDirectory, { withFileTypes: true })) {
    const entryPath = path.join(currentDirectory, entry.name)
    const relativePath = normalizeRelativePath(path.relative(targetRoot, entryPath))
    if (preservedForResidualScan(relativePath, preservedPaths) || rootReadme(relativePath))
      continue
    if (!preserveAncestor(relativePath, preservedPaths) && relativePath.toLowerCase().includes('trellis'))
      residuals.push(`path:${relativePath}`)
    if (entry.isDirectory()) {
      findTrellisResiduals(targetRoot, preservedPaths, entryPath, residuals)
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

function assertNoTrellisContent(targetRoot, preservedPaths) {
  const residuals = findTrellisResiduals(targetRoot, preservedPaths)
  if (residuals.length > 0) {
    throw new Error(`Trellis content remains after cleanup:\n${residuals.slice(0, 20).join('\n')}`)
  }
}

function migrationSummary(targetRoot, dryRun, replacement, repositoryUrl, preservedPaths) {
  const targetEntries = existsSync(targetRoot)
    ? readdirSync(targetRoot).filter(entry => !preservedPaths.some(preservedPath => relativePathsOverlap(entry, preservedPath)))
    : []
  const sourceEntries = readdirSync(sourceRoot).filter(entry => !isSourceOnly(entry))

  return [
    `Mode: ${dryRun ? 'dry-run' : 'execute'}`,
    `Source: ${sourceRoot}`,
    `Target: ${targetRoot}`,
    `Project name: ${replacement.projectName}`,
    `Name forms: moluoxixi -> ${replacement.projectName}, Moluoxixi -> ${replacement.display}, MOLUOXIXI -> ${replacement.constant}`,
    `Repository URL: ${repositoryUrl ?? replaceProjectName(sourceGithubRepository, replacement)}`,
    `Preserved target paths: ${preservedPaths.join(', ')}`,
    `Target entries to remove: ${targetEntries.length}`,
    `Source top-level entries to copy: ${sourceEntries.length}`,
  ].join('\n')
}

function usage() {
  return `Usage:
  node scripts/migrate-project.mjs <target-directory> [--name <name>] [--repository-url <url>] [--preserve <relative-path>]... --dry-run
  node scripts/migrate-project.mjs <target-directory> [--name <name>] [--repository-url <url>] [--preserve <relative-path>]... --yes

The target is cleared before migration, except for root .git, root node_modules,
and each target-relative path supplied with a repeatable --preserve option.
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
Root README*.md files keep their original content except for Trellis role H2 sections.

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
  const preservedPaths = []

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
    else if (argument === '--preserve') {
      const value = args[index + 1]
      if (!value || value.startsWith('-'))
        throw new Error('--preserve requires a value')
      preservedPaths.push(value)
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
    preservedPaths,
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
  const preservedPaths = normalizePreservedPaths(options.preservedPaths)
  if (!options.dryRun && !options.confirmed)
    throw new Error('Refusing destructive migration without --yes. Run with --dry-run first.')

  const targetRoot = validateTarget(options.target)
  validatePreservedTargetPaths(targetRoot, preservedPaths)
  const destinations = validateRenamePlan(sourceRoot, replacement)
  validatePreserveConflicts(preservedPaths, destinations)
  validateRootReadmes(sourceRoot)
  console.log(migrationSummary(targetRoot, options.dryRun, replacement, repositoryUrl, preservedPaths))
  if (options.dryRun)
    return

  cleanTarget(targetRoot, preservedPaths)
  copyIncluded(sourceRoot, targetRoot, replacement, repositoryUrl)
  removeTrellisOwnedContent(targetRoot)
  assertNoTrellisContent(targetRoot, preservedPaths)
  console.log('Migration complete')
}

try {
  main()
}
catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
}
