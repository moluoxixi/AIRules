#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const [projectRootArg, ...referenceArgs] = process.argv.slice(2)

if (!projectRootArg) {
  throw new Error('Usage: inject-rules.mjs <project-root> [reference-file ...]')
}

const skillRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const baseReferencePath = path.join(skillRoot, 'references', 'airules-base.md')
const docsReferencePath = path.join(skillRoot, 'references', 'docs.md')
const normalizedBaseReferencePath = path.resolve(baseReferencePath)
const normalizedDocsReferencePath = path.resolve(docsReferencePath)
const projectRoot = path.resolve(projectRootArg)
const agentsPath = path.join(projectRoot, 'AGENTS.md')
const currentContent = existsSync(agentsPath) ? readFileSync(agentsPath, 'utf8') : ''
const hasExistingAgentsContent = currentContent.trim().length > 0
const extraReferencePaths = referenceArgs
  .map(referencePath => path.resolve(referencePath))
  .filter(referencePath =>
    referencePath !== normalizedBaseReferencePath
    && referencePath !== normalizedDocsReferencePath,
  )
const referencePaths = [
  ...(hasExistingAgentsContent ? [] : [normalizedBaseReferencePath]),
  normalizedDocsReferencePath,
  ...extraReferencePaths,
]

function normalizeHeadingTitle(title) {
  return title.trim().toLowerCase()
}

function parseHeadingTitle(line) {
  const trimmedLine = line.trimStart()
  let markerLength = 0

  while (trimmedLine[markerLength] === '#') {
    markerLength++
  }

  if (markerLength === 0 || markerLength > 6) {
    return ''
  }

  const nextCharacter = trimmedLine[markerLength]
  if (nextCharacter !== ' ' && nextCharacter !== '\t') {
    return ''
  }

  let title = trimmedLine.slice(markerLength).trim()
  while (title.endsWith('#')) {
    title = title.slice(0, -1).trimEnd()
  }

  return title.trim()
}

function collectHeadingTitles(content) {
  const titles = new Map()
  let insideFence = false

  for (const rawLine of content.split('\n')) {
    const line = rawLine.endsWith('\r') ? rawLine.slice(0, -1) : rawLine
    const trimmedLine = line.trimStart()

    if (trimmedLine.startsWith('```') || trimmedLine.startsWith('~~~')) {
      insideFence = !insideFence
      continue
    }

    if (insideFence) {
      continue
    }

    const title = parseHeadingTitle(line)
    const normalizedTitle = normalizeHeadingTitle(title)
    if (normalizedTitle) {
      titles.set(normalizedTitle, title)
    }
  }

  return titles
}

function findDuplicateHeadingTitles(currentContent, incomingContent) {
  const currentTitles = collectHeadingTitles(currentContent)
  const incomingTitles = collectHeadingTitles(incomingContent)

  return [...incomingTitles.entries()]
    .filter(([normalizedTitle]) => currentTitles.has(normalizedTitle))
    .map(([, title]) => title)
}

const ruleSections = referencePaths.map((referencePath) => {
  const absoluteReferencePath = path.resolve(referencePath)
  const content = readFileSync(absoluteReferencePath, 'utf8')

  return content.trimEnd()
})

const incomingRules = ruleSections.join('\n\n')
const duplicateTitles = findDuplicateHeadingTitles(currentContent, incomingRules)

if (duplicateTitles.length > 0) {
  console.error('[airules] AGENTS.md contains duplicate headings that require AI review:')
  for (const title of duplicateTitles) {
    console.error(`- ${title}`)
  }

  throw new Error('Duplicate AGENTS.md headings detected; review the existing file and merge the incoming rules manually.')
}

const nextContent = currentContent.trim().length === 0
  ? `${incomingRules}\n`
  : `${currentContent}${currentContent.endsWith('\n') ? '\n' : '\n\n'}${incomingRules}\n`

writeFileSync(agentsPath, nextContent, 'utf8')
console.log(`[airules] Updated ${agentsPath}`)
