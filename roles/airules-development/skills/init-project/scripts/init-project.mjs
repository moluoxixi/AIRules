#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const skillRoot = path.resolve(currentDir, '..')
const projectAssets = path.join(skillRoot, 'assets', 'project-root')
const projectRules = path.join(skillRoot, 'assets', 'project-rules.md')
const markerStart = '<!-- AIRULES:DEVELOPMENT-WORKFLOW:START -->'
const markerEnd = '<!-- AIRULES:DEVELOPMENT-WORKFLOW:END -->'

function parseArgs(argv) {
  let projectRoot
  let verify = true
  let json = false

  for (const argument of argv) {
    if (argument === '--no-verify') {
      verify = false
    }
    else if (argument === '--json') {
      json = true
    }
    else if (argument.startsWith('--')) {
      throw new Error(`Unknown option: ${argument}`)
    }
    else if (projectRoot === undefined) {
      projectRoot = argument
    }
    else {
      throw new Error(`Unexpected argument: ${argument}`)
    }
  }

  return {
    json,
    projectRoot: path.resolve(projectRoot ?? process.cwd()),
    verify,
  }
}

function requireDirectory(directory, label) {
  if (!fs.statSync(directory, { throwIfNoEntry: false })?.isDirectory()) {
    throw new Error(`${label} does not exist: ${directory}`)
  }
}

function copyTree(sourceRoot, targetRoot) {
  for (const entry of fs.readdirSync(sourceRoot, { withFileTypes: true })) {
    const source = path.join(sourceRoot, entry.name)
    const target = path.join(targetRoot, entry.name)
    if (entry.isDirectory()) {
      fs.mkdirSync(target, { recursive: true })
      copyTree(source, target)
    }
    else if (entry.isFile()) {
      fs.mkdirSync(path.dirname(target), { recursive: true })
      fs.copyFileSync(source, target)
    }
    else {
      throw new Error(`Unsupported project asset type: ${source}`)
    }
  }
}

function updateManagedBlock(targetFile, body) {
  const block = `${markerStart}\n${body.trim()}\n${markerEnd}`
  const existing = fs.existsSync(targetFile) ? fs.readFileSync(targetFile, 'utf8') : ''
  const start = existing.indexOf(markerStart)
  const end = existing.indexOf(markerEnd)
  let next

  if ((start === -1) !== (end === -1) || (start !== -1 && end < start)) {
    throw new Error(`Malformed AIRules managed block in ${targetFile}`)
  }
  if (start === -1) {
    next = `${existing.trimEnd()}${existing.trim() === '' ? '' : '\n\n'}${block}\n`
  }
  else {
    next = `${existing.slice(0, start)}${block}${existing.slice(end + markerEnd.length)}`
    if (!next.endsWith('\n')) {
      next += '\n'
    }
  }

  if (next !== existing) {
    fs.writeFileSync(targetFile, next, 'utf8')
  }
}

function setDefaultSchema(projectRoot) {
  const configFile = path.join(projectRoot, 'openspec', 'config.yaml')
  fs.mkdirSync(path.dirname(configFile), { recursive: true })
  if (!fs.existsSync(configFile)) {
    fs.writeFileSync(configFile, 'defaultSchema: airules-development\n', 'utf8')
    return
  }

  const existing = fs.readFileSync(configFile, 'utf8')
  const pattern = /^defaultSchema\s*:[^\r\n]*$/mu
  const next = pattern.test(existing)
    ? existing.replace(pattern, 'defaultSchema: airules-development')
    : `defaultSchema: airules-development\n${existing}`
  if (next !== existing) {
    fs.writeFileSync(configFile, next, 'utf8')
  }
}

function writeRuntimeConfig(projectRoot) {
  const configFile = path.join(projectRoot, '.airules', 'workflow', 'config.json')
  const existing = fs.existsSync(configFile) ? JSON.parse(fs.readFileSync(configFile, 'utf8')) : {}
  const next = {
    ...existing,
    schema_version: 1,
    role: 'airules-development',
    openspec_schema: 'airules-development',
    repeated_failure_block_threshold: 2,
  }
  fs.writeFileSync(configFile, `${JSON.stringify(next, null, 2)}\n`, 'utf8')
}

function verifySchema(projectRoot) {
  const result = spawnSync('openspec', ['schema', 'validate', 'airules-development', '--json'], {
    cwd: projectRoot,
    encoding: 'utf8',
    shell: process.platform === 'win32',
  })
  if (result.error || result.status !== 0) {
    throw new Error(`OpenSpec schema validation failed:\n${result.stderr || result.error || result.stdout}`)
  }
  return result.stdout.trim()
}

function main() {
  const options = parseArgs(process.argv.slice(2))
  requireDirectory(options.projectRoot, 'Project root')
  requireDirectory(projectAssets, 'Bundled project assets')

  copyTree(projectAssets, options.projectRoot)
  setDefaultSchema(options.projectRoot)
  writeRuntimeConfig(options.projectRoot)
  updateManagedBlock(
    path.join(options.projectRoot, 'AGENTS.md'),
    fs.readFileSync(projectRules, 'utf8'),
  )

  for (const directory of ['sessions', 'candidates', 'memory']) {
    fs.mkdirSync(path.join(options.projectRoot, 'knowledge', directory), { recursive: true })
  }

  const validation = options.verify ? verifySchema(options.projectRoot) : null
  const result = {
    project_root: options.projectRoot,
    role: 'airules-development',
    runtime: path.join(options.projectRoot, '.airules', 'workflow', 'bin', 'workflow.mjs'),
    schema: path.join(options.projectRoot, 'openspec', 'schemas', 'airules-development', 'schema.yaml'),
    verified: options.verify,
    validation,
  }
  process.stdout.write(options.json ? `${JSON.stringify(result)}\n` : `AIRules development workflow initialized: ${options.projectRoot}\n`)
}

try {
  main()
}
catch (error) {
  const message = error instanceof Error ? error.message : String(error)
  process.stderr.write(`Error: ${message}\n`)
  process.exitCode = 1
}
