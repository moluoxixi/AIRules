#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs'
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

const ruleSections = referencePaths.map((referencePath) => {
  const absoluteReferencePath = path.resolve(referencePath)
  const content = readFileSync(absoluteReferencePath, 'utf8')

  return content.trimEnd()
})

writeFileSync(agentsPath, `${ruleSections.join('\n\n')}\n`, 'utf8')
console.log(`[airules] Updated ${agentsPath}`)
