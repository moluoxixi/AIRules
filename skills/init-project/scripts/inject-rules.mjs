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
const normalizedBaseReferencePath = path.resolve(baseReferencePath)
const extraReferencePaths = referenceArgs
  .map(referencePath => path.resolve(referencePath))
  .filter(referencePath => referencePath !== normalizedBaseReferencePath)
const referencePaths = [normalizedBaseReferencePath, ...extraReferencePaths]

const projectRoot = path.resolve(projectRootArg)
const agentsPath = path.join(projectRoot, 'AGENTS.md')
const startMarker = '<!-- AIRULES_INIT_PROJECT_RULES_START -->'
const endMarker = '<!-- AIRULES_INIT_PROJECT_RULES_END -->'

const currentContent = existsSync(agentsPath)
  ? readFileSync(agentsPath, 'utf8')
  : '# AGENTS.md\n'

const ruleSections = referencePaths.map((referencePath) => {
  const absoluteReferencePath = path.resolve(referencePath)
  const title = path.basename(referencePath, path.extname(referencePath))
  const content = readFileSync(absoluteReferencePath, 'utf8')

  return `### ${title}\n\n${content}`
})

const managedBlock = [
  startMarker,
  '<!-- This block is managed by AIRules init-project. Re-run the skill to update it. -->',
  '## AIRules 项目初始化规则',
  ...ruleSections,
  endMarker,
].join('\n\n')

const startIndex = currentContent.indexOf(startMarker)
const endIndex = currentContent.indexOf(endMarker)

if ((startIndex === -1) !== (endIndex === -1) || endIndex < startIndex) {
  throw new Error(`Invalid AIRules managed block markers in ${agentsPath}`)
}

const baseContent = startIndex === -1
  ? currentContent
  : `${currentContent.slice(0, startIndex)}${currentContent.slice(endIndex + endMarker.length)}`

const separator = baseContent.endsWith('\n') ? '\n' : '\n\n'
writeFileSync(agentsPath, `${baseContent}${separator}${managedBlock}\n`, 'utf8')
console.log(`[airules] Updated ${agentsPath}`)
