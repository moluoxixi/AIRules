#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'

const SCENARIO_ID_PATTERN = /\bSCN-[\w-]+-\d{3}\b/g
const SCENARIO_HEADING_PREFIX = '#### Scenario:'
const COVERS_LINE_PREFIX = 'covers:'

function usage() {
  return 'Usage: verify-scenario-coverage.mjs <openspec-change-dir> [test-root]'
}

function walkMarkdownFiles(root) {
  if (!existsSync(root)) {
    return []
  }

  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const absolutePath = path.join(root, entry.name)
    if (entry.isDirectory()) {
      return walkMarkdownFiles(absolutePath)
    }

    return entry.isFile() && entry.name.endsWith('.md') ? [absolutePath] : []
  })
}

function collectScenarioIds(changeDir) {
  const specsDir = path.join(changeDir, 'specs')
  const scenarioIds = new Map()
  const missingIds = []

  for (const filePath of walkMarkdownFiles(specsDir)) {
    const content = readFileSync(filePath, 'utf8')
    const lines = content.split(/\r?\n/)

    for (const [index, line] of lines.entries()) {
      const trimmedLine = line.trim()
      if (!trimmedLine.startsWith(SCENARIO_HEADING_PREFIX)) {
        continue
      }

      const headingText = trimmedLine.slice(SCENARIO_HEADING_PREFIX.length).trim()
      const lineNumber = index + 1
      const scenarioId = headingText.match(SCENARIO_ID_PATTERN)?.[0]

      if (!scenarioId) {
        missingIds.push({ filePath, lineNumber, headingText })
        continue
      }

      scenarioIds.set(scenarioId, { filePath, lineNumber })
    }
  }

  return { scenarioIds, missingIds }
}

function collectCoveredScenarioIds(testRoot) {
  const coveredScenarioIds = new Map()

  for (const filePath of walkMarkdownFiles(testRoot)) {
    const content = readFileSync(filePath, 'utf8')
    for (const line of content.split(/\r?\n/)) {
      const trimmedLine = line.trim()
      if (!trimmedLine.toLowerCase().startsWith(COVERS_LINE_PREFIX)) {
        continue
      }

      const coversValue = trimmedLine.slice(COVERS_LINE_PREFIX.length).trim()
      for (const scenarioMatch of coversValue.matchAll(SCENARIO_ID_PATTERN)) {
        const scenarioId = scenarioMatch[0]
        const files = coveredScenarioIds.get(scenarioId) ?? new Set()
        files.add(filePath)
        coveredScenarioIds.set(scenarioId, files)
      }
    }
  }

  return coveredScenarioIds
}

function relativeToCwd(filePath) {
  return path.relative(process.cwd(), filePath).replace(/\\/g, '/') || '.'
}

function main() {
  const changeDirArg = process.argv[2]
  const testRootArg = process.argv[3] ?? path.join(process.cwd(), 'knowledge', '测试')

  if (!changeDirArg) {
    throw new Error(usage())
  }

  const changeDir = path.resolve(changeDirArg)
  const testRoot = path.resolve(testRootArg)

  if (!existsSync(changeDir) || !statSync(changeDir).isDirectory()) {
    throw new Error(`OpenSpec change directory does not exist: ${changeDir}`)
  }

  const { scenarioIds, missingIds } = collectScenarioIds(changeDir)
  const coveredScenarioIds = collectCoveredScenarioIds(testRoot)
  const missingCoverage = [...scenarioIds.keys()].filter(scenarioId => !coveredScenarioIds.has(scenarioId))

  if (missingIds.length > 0 || missingCoverage.length > 0) {
    console.error('FAIL scenario coverage')

    for (const missing of missingIds) {
      console.error(`- missing Scenario ID: ${relativeToCwd(missing.filePath)}:${missing.lineNumber} (${missing.headingText})`)
    }

    for (const scenarioId of missingCoverage) {
      const source = scenarioIds.get(scenarioId)
      console.error(`- missing TC coverage: ${scenarioId} from ${relativeToCwd(source.filePath)}:${source.lineNumber}`)
    }

    process.exit(1)
  }

  console.log(`PASS scenario coverage: ${scenarioIds.size} scenario(s) covered`)
}

try {
  main()
}
catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
}
