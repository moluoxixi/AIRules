#!/usr/bin/env node

import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptPath = fileURLToPath(import.meta.url)
const defaultRoleRoot = path.resolve(path.dirname(scriptPath), '..', 'roles', 'moluoxixi')
const maxCommandOutput = 64 * 1024 * 1024

// Numeric code points keep the gate from matching its own source.
const blockedSignatures = [
  { id: 'legacy-product', codePoints: [116, 114, 101, 108, 108, 105, 115] },
  { id: 'legacy-product-common-misspelling', codePoints: [116, 114, 101, 105, 108, 108, 115] },
  { id: 'legacy-organization', codePoints: [109, 105, 110, 100, 102, 111, 108, 100] },
]

function signatureText(signature) {
  return String.fromCharCode(...signature.codePoints)
}

function normalizeIdentity(value) {
  return value.toLowerCase().replaceAll(/[^a-z0-9]/g, '')
}

function separatedPattern(signature) {
  return new RegExp(
    signature.codePoints.map(codePoint => String.fromCharCode(codePoint)).join('[^a-z0-9]*'),
    'gi',
  )
}

function locationAt(content, offset) {
  let line = 1
  let lineStart = 0
  for (let index = 0; index < offset; index += 1) {
    if (content.charCodeAt(index) === 10) {
      line += 1
      lineStart = index + 1
    }
  }
  return { line, column: offset - lineStart + 1 }
}

function printableMatch(value) {
  return value
    .replaceAll('\r', '\\r')
    .replaceAll('\n', '\\n')
    .replaceAll('\0', '\\0')
    .slice(0, 160)
}

export function scanIdentityPath(displayPath, metadata) {
  const normalizedPath = normalizeIdentity(displayPath)
  const findings = []
  for (const signature of blockedSignatures) {
    const token = signatureText(signature)
    if (normalizedPath.includes(token)) {
      findings.push({
        ...metadata,
        kind: 'path',
        path: displayPath,
        signature: signature.id,
        token,
      })
    }
  }
  return findings
}

export function scanIdentityBuffer(content, displayPath, metadata) {
  const text = content.toString('latin1')
  const findings = []
  for (const signature of blockedSignatures) {
    const pattern = separatedPattern(signature)
    for (const match of text.matchAll(pattern)) {
      const offset = match.index ?? 0
      findings.push({
        ...metadata,
        kind: 'content',
        path: displayPath,
        signature: signature.id,
        token: signatureText(signature),
        offset,
        ...locationAt(text, offset),
        match: printableMatch(match[0]),
      })
    }
  }
  return findings
}

function isContained(root, candidate) {
  const relativePath = path.relative(root, candidate)
  return relativePath === '' || (!relativePath.startsWith(`..${path.sep}`) && relativePath !== '..' && !path.isAbsolute(relativePath))
}

function resolveContained(root, relativePath) {
  const absolutePath = path.resolve(root, ...relativePath.split('/'))
  if (!isContained(root, absolutePath)) {
    throw new Error(`Refusing path outside scan root: ${relativePath}`)
  }
  return absolutePath
}

function gitOutput(args, cwd, encoding = 'utf8') {
  return execFileSync('git', ['-C', cwd, ...args], {
    encoding,
    env: { ...process.env, GIT_OPTIONAL_LOCKS: '0' },
    maxBuffer: maxCommandOutput,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}

function collectRoleFiles(roleRoot) {
  const repositoryRoot = gitOutput(['rev-parse', '--show-toplevel'], roleRoot).trim()
  if (!isContained(repositoryRoot, roleRoot)) {
    throw new Error(`Role root is outside its Git repository: ${roleRoot}`)
  }
  const relativeRoleRoot = path.relative(repositoryRoot, roleRoot).split(path.sep).join('/')
  const output = gitOutput([
    'ls-files',
    '-z',
    '--cached',
    '--others',
    '--exclude-standard',
    '--',
    relativeRoleRoot,
  ], repositoryRoot, 'buffer')
  const files = output
    .toString('utf8')
    .split('\0')
    .filter(Boolean)
    .sort()
    .flatMap((displayPath) => {
      const absolutePath = resolveContained(repositoryRoot, displayPath)
      return fs.existsSync(absolutePath) ? [{ absolutePath, displayPath }] : []
    })
  return { repositoryRoot, files }
}

function npmInvocation() {
  if (process.platform !== 'win32') {
    return { command: 'npm', prefix: [] }
  }
  const candidates = [
    path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js'),
  ]
  if (process.env.npm_execpath && path.basename(process.env.npm_execpath).toLowerCase() === 'npm-cli.js') {
    candidates.push(process.env.npm_execpath)
  }
  try {
    const commandShims = execFileSync('where.exe', ['npm.cmd'], {
      encoding: 'utf8',
      maxBuffer: maxCommandOutput,
      stdio: ['ignore', 'pipe', 'ignore'],
    }).split(/\r?\n/).filter(Boolean)
    for (const commandShim of commandShims) {
      candidates.push(path.join(path.dirname(commandShim), 'node_modules', 'npm', 'bin', 'npm-cli.js'))
    }
  }
  catch {
    // The explicit candidates above still cover standard Node installations.
  }
  const npmCli = candidates.find(candidate => fs.existsSync(candidate))
  if (!npmCli) {
    throw new Error('Cannot locate npm-cli.js on Windows; install npm beside the active Node.js runtime')
  }
  return { command: process.execPath, prefix: [npmCli] }
}

function packageEntries(packageRoot) {
  const npm = npmInvocation()
  let output
  try {
    output = execFileSync(npm.command, [
      ...npm.prefix,
      'pack',
      '--dry-run',
      '--json',
      '--ignore-scripts',
    ], {
      cwd: packageRoot,
      encoding: 'utf8',
      env: { ...process.env, npm_config_ignore_scripts: 'true' },
      maxBuffer: maxCommandOutput,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
  }
  catch (error) {
    const stderr = error?.stderr?.toString?.().trim()
    throw new Error(`npm pack dry-run failed in ${packageRoot}${stderr ? `: ${stderr}` : ''}`)
  }

  let result
  try {
    result = JSON.parse(output)
  }
  catch (error) {
    throw new Error(`npm pack returned invalid JSON in ${packageRoot}: ${error.message}`)
  }
  if (!Array.isArray(result) || result.length !== 1 || !Array.isArray(result[0]?.files)) {
    throw new Error(`npm pack returned an unexpected manifest in ${packageRoot}`)
  }
  return result[0].files.map(file => file.path).sort()
}

function scanFiles(files, metadata) {
  const findings = []
  for (const file of files) {
    const stats = fs.lstatSync(file.absolutePath)
    if (stats.isSymbolicLink()) {
      throw new Error(`Refusing symbolic link in scan boundary: ${file.displayPath}`)
    }
    if (!stats.isFile()) {
      throw new Error(`Unsupported scan entry: ${file.displayPath}`)
    }
    findings.push(...scanIdentityPath(file.displayPath, metadata))
    findings.push(...scanIdentityBuffer(fs.readFileSync(file.absolutePath), file.displayPath, metadata))
  }
  return findings
}

function scanPublishPackage(roleRoot, directoryName) {
  const packageRoot = path.join(roleRoot, 'packages', directoryName)
  const manifest = JSON.parse(fs.readFileSync(path.join(packageRoot, 'package.json'), 'utf8'))
  const entries = packageEntries(packageRoot)
  const files = entries.map(displayPath => ({
    absolutePath: resolveContained(packageRoot, displayPath),
    displayPath,
  }))
  return {
    summary: { name: manifest.name, files: files.length },
    findings: scanFiles(files, { domain: 'package', package: manifest.name }),
  }
}

export function runIdentityBoundaryScan({
  roleRoot = defaultRoleRoot,
  scanSource = true,
  scanPackages = true,
} = {}) {
  const resolvedRoleRoot = path.resolve(roleRoot)
  const result = {
    status: 'pass',
    roleRoot: resolvedRoleRoot,
    signatures: blockedSignatures.map(signature => ({
      id: signature.id,
      token: signatureText(signature),
    })),
    scanned: { source: null, packages: [] },
    findings: [],
  }

  if (scanSource) {
    const source = collectRoleFiles(resolvedRoleRoot)
    result.scanned.source = { files: source.files.length }
    result.findings.push(...scanFiles(source.files, { domain: 'source' }))
  }

  if (scanPackages) {
    for (const directoryName of ['core', 'cli']) {
      const packageResult = scanPublishPackage(resolvedRoleRoot, directoryName)
      result.scanned.packages.push(packageResult.summary)
      result.findings.push(...packageResult.findings)
    }
  }

  result.status = result.findings.length === 0 ? 'pass' : 'fail'
  return result
}

function parseArgs(argv) {
  const options = {
    roleRoot: defaultRoleRoot,
    scanSource: true,
    scanPackages: true,
    json: false,
    help: false,
  }
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === '--source-only') {
      options.scanPackages = false
    }
    else if (argument === '--packages-only') {
      options.scanSource = false
    }
    else if (argument === '--json') {
      options.json = true
    }
    else if (argument === '--role-root') {
      const value = argv[index + 1]
      if (!value) {
        throw new Error(`${argument} requires a path`)
      }
      index += 1
      options.roleRoot = path.resolve(value)
    }
    else if (argument === '--help' || argument === '-h') {
      options.help = true
    }
    else {
      throw new Error(`Unknown option: ${argument}`)
    }
  }
  if (!options.scanSource && !options.scanPackages) {
    throw new Error('--source-only and --packages-only cannot be combined')
  }
  return options
}

function printHelp() {
  process.stdout.write([
    'verify-identity-boundary [options]',
    '',
    'Scans current role files and actual npm dry-run package entries for blocked legacy identities.',
    '',
    'Options:',
    '  --source-only       Scan Git tracked and untracked role files, excluding ignored files',
    '  --packages-only     Scan only the core and CLI npm dry-run package entries',
    '  --json              Print the complete machine-readable result',
    '  --role-root <path>  Override the role root (primarily for verification tests)',
    '  -h, --help          Show this help',
    '',
  ].join('\n'))
}

function printHumanResult(result) {
  if (result.status === 'pass') {
    process.stdout.write('Identity boundary scan passed.\n')
  }
  else {
    process.stderr.write(`Identity boundary scan failed with ${result.findings.length} finding(s).\n`)
  }
  if (result.scanned.source) {
    process.stdout.write(`  role source: ${result.scanned.source.files} file(s)\n`)
  }
  for (const packageSummary of result.scanned.packages) {
    process.stdout.write(`  ${packageSummary.name}: ${packageSummary.files} publish entry file(s)\n`)
  }
  for (const finding of result.findings) {
    const location = finding.line ? `:${finding.line}:${finding.column}` : ''
    const packageLabel = finding.package ? ` ${finding.package}` : ''
    process.stderr.write(
      `  [${finding.domain}${packageLabel}/${finding.kind}] ${finding.path}${location} `
      + `${finding.signature} (${finding.token})${finding.match ? ` match=${JSON.stringify(finding.match)}` : ''}\n`,
    )
  }
}

function isMainModule() {
  return process.argv[1] && path.resolve(process.argv[1]) === scriptPath
}

if (isMainModule()) {
  let options
  try {
    options = parseArgs(process.argv.slice(2))
    if (options.help) {
      printHelp()
    }
    else {
      const result = runIdentityBoundaryScan(options)
      if (options.json)
        process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
      else
        printHumanResult(result)
      if (result.status === 'fail')
        process.exitCode = 1
    }
  }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (options?.json) {
      process.stdout.write(`${JSON.stringify({ status: 'error', error: message }, null, 2)}\n`)
    }
    else {
      process.stderr.write(`Identity boundary scan error: ${message}\n`)
    }
    process.exitCode = 2
  }
}
