#!/usr/bin/env node

import { spawnSync } from 'node:child_process'
import { createHash, randomUUID } from 'node:crypto'
import {
  chmodSync,
  copyFileSync,
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const PACKAGE_NAME = '@mindfoldhq/trellis'
const VERSION = '0.6.6'
const INTEGRITY = 'sha512-c9zdUbKT+agDPZ8Ro3dlq4WetluFAA60JmEx7CeJLKtdVslk0oR8m2e0GKry3kgXEgGkqYuE41FijR3+Axc5MA=='
const LICENSE = 'AGPL-3.0-only'
const MINIMUM_NODE = [18, 17, 0]
const MINIMUM_PYTHON = [3, 9, 0]
const LOCK_STALE_AFTER_MS = 5 * 60 * 1000
const scriptRoot = path.dirname(fileURLToPath(import.meta.url))
const skillRoot = path.resolve(scriptRoot, '..')
const lockRoot = path.join(skillRoot, 'assets', 'tool')
const COMMON_ARTIFACTS = [
  '.trellis/.developer',
  '.trellis/.version',
  '.trellis/config.yaml',
  '.trellis/scripts/task.py',
  '.trellis/tasks/00-bootstrap-guidelines/task.json',
  '.trellis/workflow.md',
  'AGENTS.md',
]
const PLATFORM_ARTIFACTS = {
  codex: [
    '.agents/skills/trellis-before-dev/SKILL.md',
    '.agents/skills/trellis-meta/SKILL.md',
    '.codex/agents/trellis-check.toml',
    '.codex/agents/trellis-implement.toml',
    '.codex/agents/trellis-research.toml',
    '.codex/config.toml',
    '.codex/hooks.json',
    '.codex/hooks/inject-workflow-state.py',
  ],
  claude: [
    '.claude/agents/trellis-check.md',
    '.claude/agents/trellis-implement.md',
    '.claude/agents/trellis-research.md',
    '.claude/commands/trellis/continue.md',
    '.claude/commands/trellis/finish-work.md',
    '.claude/hooks/inject-subagent-context.py',
    '.claude/hooks/inject-workflow-state.py',
    '.claude/hooks/session-start.py',
    '.claude/settings.json',
    '.claude/skills/trellis-before-dev/SKILL.md',
  ],
  cursor: [
    '.cursor/agents/trellis-check.md',
    '.cursor/agents/trellis-implement.md',
    '.cursor/agents/trellis-research.md',
    '.cursor/commands/trellis-continue.md',
    '.cursor/commands/trellis-finish-work.md',
    '.cursor/hooks.json',
    '.cursor/hooks/inject-shell-session-context.py',
    '.cursor/hooks/inject-subagent-context.py',
    '.cursor/hooks/session-start.py',
    '.cursor/skills/trellis-before-dev/SKILL.md',
  ],
}
const PROJECT_TRANSACTION_PATHS = {
  codex: ['.agents', '.codex'],
  claude: ['.claude'],
  cursor: ['.cursor'],
}

function fail(message) {
  throw new Error(message)
}

function readJson(file) {
  return JSON.parse(readFileSync(file, 'utf8').replace(/^\uFEFF/u, ''))
}

function normalizedFileHash(file) {
  const normalized = readFileSync(file, 'utf8').replace(/\r\n/gu, '\n')
  return createHash('sha256').update(normalized).digest('hex')
}

function parseVersion(value) {
  const match = /v?(\d+)\.(\d+)(?:\.(\d+))?/u.exec(value)
  return match ? [Number(match[1]), Number(match[2]), Number(match[3] ?? 0)] : undefined
}

function versionAtLeast(actual, minimum) {
  for (let index = 0; index < minimum.length; index += 1) {
    if (actual[index] > minimum[index])
      return true
    if (actual[index] < minimum[index])
      return false
  }
  return true
}

function requireNodeVersion() {
  const actual = parseVersion(process.versions.node)
  if (!actual || !versionAtLeast(actual, MINIMUM_NODE)) {
    fail(`Trellis requires Node.js >=18.17.0; current version is ${process.versions.node}`)
  }
}

function detectPython() {
  const candidates = process.platform === 'win32'
    ? [['python', ['--version']], ['python3', ['--version']], ['py', ['-3', '--version']]]
    : [['python3', ['--version']], ['python', ['--version']]]
  for (const [command, args] of candidates) {
    const result = spawnSync(command, args, { encoding: 'utf8', shell: false })
    if (result.status !== 0) {
      continue
    }
    const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`.trim()
    const version = parseVersion(output)
    if (version && versionAtLeast(version, MINIMUM_PYTHON)) {
      return { command: [command, ...args.slice(0, -1)].join(' '), version: version.join('.') }
    }
  }
  fail('Trellis requires Python >=3.9; no supported Python executable was found')
}

function validateLock() {
  const packageFile = path.join(lockRoot, 'package.json')
  const lockFile = path.join(lockRoot, 'package-lock.json')
  const packageJson = readJson(packageFile)
  const lock = readJson(lockFile)
  const entry = lock.packages?.[`node_modules/${PACKAGE_NAME}`]
  if (packageJson.dependencies?.[PACKAGE_NAME] !== VERSION || lock.packages?.['']?.dependencies?.[PACKAGE_NAME] !== VERSION) {
    fail(`Bundled Trellis dependency must be exactly ${VERSION}`)
  }
  if (entry?.version !== VERSION || entry?.integrity !== INTEGRITY || entry?.license !== LICENSE) {
    fail('Bundled Trellis package lock does not match the approved version, integrity, and license')
  }
  return { packageFile, lockFile, lockHash: normalizedFileHash(lockFile) }
}

function toolHome() {
  return process.env.AIRULES_TOOL_HOME
    ? path.resolve(process.env.AIRULES_TOOL_HOME)
    : path.join(os.homedir(), '.moluoxixi', 'tools')
}

function toolRoot() {
  return path.join(toolHome(), 'trellis', VERSION)
}

function packageBin(root) {
  const packageRoot = path.join(root, 'node_modules', ...PACKAGE_NAME.split('/'))
  const packageJson = readJson(path.join(packageRoot, 'package.json'))
  if (packageJson.version !== VERSION || packageJson.license !== LICENSE) {
    fail(`Installed Trellis package metadata does not match ${VERSION} (${LICENSE})`)
  }
  const bin = typeof packageJson.bin === 'string' ? packageJson.bin : packageJson.bin?.trellis
  if (typeof bin !== 'string') {
    fail('Installed Trellis package does not expose the trellis binary')
  }
  const target = path.resolve(packageRoot, bin)
  if (!existsSync(target) || !statSync(target).isFile()) {
    fail(`Installed Trellis binary is missing: ${target}`)
  }
  return target
}

function captureCliVersion(root) {
  return withIsolatedUserEnvironment('Trellis version check', (env) => {
    const result = spawnSync(process.execPath, [packageBin(root), '--version'], {
      encoding: 'utf8',
      env,
      shell: false,
    })
    if (result.status !== 0) {
      fail(`Pinned Trellis CLI version check failed: ${result.stderr ?? result.stdout ?? ''}`)
    }
    const value = String(result.stdout ?? '').trim()
    if (value !== VERSION) {
      fail(`Pinned Trellis CLI reported ${value || '<empty>'}; expected ${VERSION}`)
    }
    return value
  })
}

function installedTool() {
  const root = toolRoot()
  const markerFile = path.join(root, '.airules-tool.json')
  if (!existsSync(markerFile)) {
    fail('Pinned Trellis tool is not installed; run the install command first')
  }
  const marker = readJson(markerFile)
  const lock = validateLock()
  if (marker.package !== PACKAGE_NAME || marker.version !== VERSION || marker.lock_sha256 !== lock.lockHash) {
    fail('Installed Trellis cache marker does not match the bundled lock')
  }
  captureCliVersion(root)
  return { root, bin: packageBin(root) }
}

function npmExecutable() {
  return process.platform === 'win32' ? 'npm.cmd' : 'npm'
}

function runExternal(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    encoding: options.capture ? 'utf8' : undefined,
    env: options.env,
    shell: process.platform === 'win32' && command.endsWith('.cmd'),
    stdio: options.capture ? 'pipe' : 'inherit',
  })
  if (result.error) {
    throw result.error
  }
  if (result.status !== 0) {
    fail(`${command} ${args.join(' ')} failed with exit code ${result.status}`)
  }
  return result
}

function createGitGuard(root) {
  const bin = path.join(root, 'git-guard-bin')
  const marker = path.join(root, 'git-attempted.log')
  mkdirSync(bin, { recursive: true })
  const posixShim = path.join(bin, 'git')
  writeFileSync(posixShim, [
    '#!/bin/sh',
    'printf "blocked\\n" >> "$AIRULES_GIT_GUARD_MARKER"',
    'echo "AIRules blocked Git during Trellis initialization" >&2',
    'exit 97',
    '',
  ].join('\n'), 'utf8')
  chmodSync(posixShim, 0o755)
  writeFileSync(path.join(bin, 'git.cmd'), [
    '@echo off',
    '>>"%AIRULES_GIT_GUARD_MARKER%" echo blocked',
    'echo AIRules blocked Git during Trellis initialization 1>&2',
    'exit /b 97',
    '',
  ].join('\r\n'), 'utf8')
  return { bin, marker }
}

function isolatedUserEnvironment(root, options = {}) {
  const home = path.join(root, 'home')
  const appData = path.join(home, 'AppData', 'Roaming')
  const localAppData = path.join(home, 'AppData', 'Local')
  const xdgConfig = path.join(home, '.config')
  const xdgCache = path.join(home, '.cache')
  const xdgData = path.join(home, '.local', 'share')
  const xdgState = path.join(home, '.local', 'state')
  const temp = path.join(root, 'tmp')
  const npmCache = path.join(root, 'npm-cache')
  const pythonCache = path.join(root, 'python-cache')
  for (const directory of [home, appData, localAppData, xdgConfig, xdgCache, xdgData, xdgState, temp, npmCache, pythonCache]) {
    mkdirSync(directory, { recursive: true })
  }
  const env = {
    ...process.env,
    APPDATA: appData,
    CLAUDE_CONFIG_DIR: path.join(home, '.claude'),
    CODEX_HOME: path.join(home, '.codex'),
    GIT_CONFIG_GLOBAL: path.join(root, 'gitconfig'),
    GIT_CONFIG_NOSYSTEM: '1',
    HOME: home,
    LOCALAPPDATA: localAppData,
    NPM_CONFIG_CACHE: npmCache,
    NPM_CONFIG_PREFIX: path.join(root, 'npm-prefix'),
    NPM_CONFIG_USERCONFIG: path.join(root, 'npmrc'),
    PYTHONPYCACHEPREFIX: pythonCache,
    TEMP: temp,
    TMP: temp,
    TMPDIR: temp,
    USERPROFILE: home,
    XDG_CACHE_HOME: xdgCache,
    XDG_CONFIG_HOME: xdgConfig,
    XDG_DATA_HOME: xdgData,
    XDG_STATE_HOME: xdgState,
  }
  for (const key of Object.keys(env)) {
    if (key === 'GIT_CONFIG_COUNT' || /^GIT_CONFIG_(?:KEY|VALUE)_\d+$/u.test(key)) {
      delete env[key]
    }
  }
  let gitGuard
  if (options.guardGit) {
    gitGuard = createGitGuard(root)
    env.AIRULES_GIT_GUARD_MARKER = gitGuard.marker
    const pathKey = Object.keys(env).find(key => key.toLowerCase() === 'path') ?? 'PATH'
    env[pathKey] = `${gitGuard.bin}${path.delimiter}${env[pathKey] ?? ''}`
  }
  return { env, gitGuard }
}

function withIsolatedUserEnvironment(label, action, options = {}) {
  const root = mkdtempSync(path.join(os.tmpdir(), 'airules-trellis-user-'))
  try {
    const isolated = isolatedUserEnvironment(root, options)
    let actionError
    let result
    try {
      result = action(isolated.env)
    }
    catch (error) {
      actionError = error
    }
    if (isolated.gitGuard && existsSync(isolated.gitGuard.marker)) {
      fail(`${label} attempted to invoke Git; initialization was rejected before any commit could be created`)
    }
    if (actionError) {
      throw actionError
    }
    return result
  }
  finally {
    rmSync(root, { recursive: true, force: true })
  }
}

function lockOwner(lockDir) {
  try {
    const owner = readJson(path.join(lockDir, 'owner.json'))
    if (!Number.isSafeInteger(owner.pid) || owner.pid <= 0 || typeof owner.started_at !== 'string'
      || Number.isNaN(Date.parse(owner.started_at)) || typeof owner.token !== 'string' || owner.token.length < 16
      || typeof owner.hostname !== 'string' || owner.hostname.length === 0) {
      return undefined
    }
    return owner
  }
  catch {
    return undefined
  }
}

function processMayBeAlive(pid) {
  try {
    process.kill(pid, 0)
    return true
  }
  catch (error) {
    return error?.code !== 'ESRCH'
  }
}

function sameLockOwner(left, right) {
  return left?.pid === right?.pid && left?.started_at === right?.started_at
    && left?.token === right?.token && left?.hostname === right?.hostname
}

function recoverStaleLock(lockDir, label) {
  let directoryStat
  try {
    directoryStat = statSync(lockDir)
  }
  catch (error) {
    if (error?.code === 'ENOENT') {
      return true
    }
    throw error
  }
  const owner = lockOwner(lockDir)
  if (!owner) {
    fail(`${label} lock has missing or invalid owner metadata; refusing unsafe recovery: ${lockDir}`)
  }
  if (owner.hostname !== os.hostname()) {
    fail(`${label} may be active on host ${owner.hostname}; refusing cross-host recovery: ${lockDir}`)
  }
  const now = Date.now()
  const ownerAge = now - Date.parse(owner.started_at)
  const directoryAge = now - directoryStat.mtimeMs
  if (ownerAge < LOCK_STALE_AFTER_MS || directoryAge < LOCK_STALE_AFTER_MS || processMayBeAlive(owner.pid)) {
    fail(`${label} is already in progress (pid ${owner.pid} on ${owner.hostname}): ${lockDir}`)
  }

  const quarantine = `${lockDir}.stale-${randomUUID()}`
  try {
    renameSync(lockDir, quarantine)
  }
  catch (error) {
    if (error?.code === 'ENOENT') {
      return true
    }
    throw error
  }
  try {
    const movedOwner = lockOwner(quarantine)
    if (!sameLockOwner(owner, movedOwner) || processMayBeAlive(owner.pid)) {
      if (!existsSync(lockDir)) {
        renameSync(quarantine, lockDir)
      }
      fail(`${label} owner changed during stale recovery; no lock was removed`)
    }
    rmSync(quarantine, { recursive: true, force: true })
  }
  catch (error) {
    if (existsSync(quarantine) && !existsSync(lockDir)) {
      try {
        renameSync(quarantine, lockDir)
      }
      catch (restoreError) {
        throw new AggregateError(
          [error, restoreError],
          `${label} stale recovery failed and the original lock could not be restored`,
        )
      }
    }
    throw error
  }
  return true
}

function withDirectoryLock(lockDir, label, action) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      mkdirSync(lockDir)
      break
    }
    catch (error) {
      if (error?.code !== 'EEXIST') {
        throw error
      }
      recoverStaleLock(lockDir, label)
      if (attempt === 2) {
        fail(`${label} lock could not be acquired after stale recovery: ${lockDir}`)
      }
    }
  }
  const owner = {
    hostname: os.hostname(),
    pid: process.pid,
    started_at: new Date().toISOString(),
    token: randomUUID(),
  }
  let ownerWritten = false
  try {
    writeFileSync(path.join(lockDir, 'owner.json'), `${JSON.stringify(owner)}\n`, { encoding: 'utf8', flag: 'wx' })
    ownerWritten = true
    return action()
  }
  finally {
    const currentOwner = lockOwner(lockDir)
    if ((!ownerWritten && !currentOwner) || sameLockOwner(owner, currentOwner)) {
      rmSync(lockDir, { recursive: true, force: true })
    }
  }
}

function installTool() {
  requireNodeVersion()
  const lock = validateLock()
  const target = toolRoot()
  const parent = path.dirname(target)
  mkdirSync(parent, { recursive: true })
  return withDirectoryLock(path.join(parent, `.install-${VERSION}.lock`), 'Trellis tool installation', () => {
    if (existsSync(path.join(target, '.airules-tool.json'))) {
      try {
        return installedTool()
      }
      catch {
        // Rebuild a corrupted or mismatched cache below.
      }
    }

    const staging = mkdtempSync(path.join(parent, '.install-'))
    const backup = `${target}.backup-${process.pid}`
    try {
      copyFileSync(lock.packageFile, path.join(staging, 'package.json'))
      copyFileSync(lock.lockFile, path.join(staging, 'package-lock.json'))
      withIsolatedUserEnvironment('Trellis npm installation', env => runExternal(
        npmExecutable(),
        ['ci', '--ignore-scripts', '--omit=dev', '--no-audit', '--no-fund'],
        { cwd: staging, env },
      ))
      captureCliVersion(staging)
      writeFileSync(path.join(staging, '.airules-tool.json'), `${JSON.stringify({
        package: PACKAGE_NAME,
        version: VERSION,
        integrity: INTEGRITY,
        license: LICENSE,
        lock_sha256: lock.lockHash,
      }, null, 2)}\n`, 'utf8')

      if (existsSync(target)) {
        rmSync(backup, { recursive: true, force: true })
        renameSync(target, backup)
      }
      try {
        renameSync(staging, target)
      }
      catch (error) {
        if (existsSync(backup)) {
          renameSync(backup, target)
        }
        throw error
      }
      rmSync(backup, { recursive: true, force: true })
      return { root: target, bin: packageBin(target) }
    }
    finally {
      rmSync(staging, { recursive: true, force: true })
    }
  })
}

function parseOptions(args, schema) {
  const parsed = {}
  for (let index = 0; index < args.length; index += 1) {
    const token = args[index]
    if (!Object.hasOwn(schema, token)) {
      fail(`Unknown argument: ${token}`)
    }
    if (Object.hasOwn(parsed, token)) {
      fail(`Duplicate argument: ${token}`)
    }
    if (schema[token] === 'boolean') {
      parsed[token] = true
      continue
    }
    const value = args[index + 1]
    if (!value || value.startsWith('--')) {
      fail(`Missing value for ${token}`)
    }
    parsed[token] = value
    index += 1
  }
  return parsed
}

function required(options, name) {
  const value = options[name]
  if (typeof value !== 'string' || value.length === 0) {
    fail(`Missing required argument: ${name}`)
  }
  return value
}

function requireProject(value) {
  const requested = path.resolve(value)
  if (!existsSync(requested) || !statSync(requested).isDirectory()) {
    fail(`Project directory does not exist: ${requested}`)
  }
  return realpathSync(requested)
}

function pathEntryExists(target) {
  try {
    lstatSync(target)
    return true
  }
  catch (error) {
    if (error?.code === 'ENOENT') {
      return false
    }
    throw error
  }
}

function assertNoSymlinks(target, relativePath) {
  if (!pathEntryExists(target)) {
    return
  }
  const metadata = lstatSync(target)
  if (metadata.isSymbolicLink()) {
    fail(`Cannot transactionally initialize through a symbolic link: ${relativePath}`)
  }
  if (!metadata.isDirectory()) {
    return
  }
  for (const entry of readdirSync(target, { withFileTypes: true })) {
    assertNoSymlinks(path.join(target, entry.name), `${relativePath}/${entry.name}`)
  }
}

function projectTransactionPaths(platforms) {
  return [...new Set([
    '.trellis',
    '.gitignore',
    'AGENTS.md',
    ...platforms.flatMap(platform => PROJECT_TRANSACTION_PATHS[platform]),
  ])]
}

function copyEntry(source, destination) {
  mkdirSync(path.dirname(destination), { recursive: true })
  cpSync(source, destination, {
    recursive: true,
    errorOnExist: false,
    force: true,
    preserveTimestamps: true,
  })
}

function withProjectTransaction(project, platforms, action) {
  const relativePaths = projectTransactionPaths(platforms)
  const backupRoot = mkdtempSync(path.join(os.tmpdir(), 'airules-trellis-rollback-'))
  let snapshots
  try {
    snapshots = relativePaths.map((relativePath, index) => {
      const target = path.join(project, relativePath)
      assertNoSymlinks(target, relativePath)
      const existed = pathEntryExists(target)
      const backup = path.join(backupRoot, String(index))
      if (existed) {
        copyEntry(target, backup)
      }
      return { backup, existed, relativePath, target }
    })
  }
  catch (error) {
    rmSync(backupRoot, { recursive: true, force: true })
    throw error
  }
  let keepBackup = false
  try {
    return action()
  }
  catch (error) {
    try {
      for (const snapshot of snapshots) {
        rmSync(snapshot.target, { recursive: true, force: true })
        if (snapshot.existed) {
          copyEntry(snapshot.backup, snapshot.target)
        }
      }
    }
    catch (rollbackError) {
      keepBackup = true
      const original = error instanceof Error ? error.message : String(error)
      const rollback = rollbackError instanceof Error ? rollbackError.message : String(rollbackError)
      fail(`Trellis initialization failed (${original}) and rollback failed (${rollback}); recovery snapshot retained at ${backupRoot}`)
    }
    throw error
  }
  finally {
    if (!keepBackup) {
      rmSync(backupRoot, { recursive: true, force: true })
    }
  }
}

function expectedArtifacts(platforms) {
  return [...new Set([...COMMON_ARTIFACTS, ...platforms.flatMap(platform => PLATFORM_ARTIFACTS[platform])])]
}

function verifyPlatformArtifacts(project, platforms, developer) {
  const artifacts = expectedArtifacts(platforms)
  for (const relativePath of artifacts) {
    const target = path.join(project, relativePath)
    if (!pathEntryExists(target) || !lstatSync(target).isFile()) {
      fail(`Trellis initialization is missing the required ${platforms.join(',')} artifact: ${relativePath}`)
    }
  }
  const version = readFileSync(path.join(project, '.trellis', '.version'), 'utf8').trim()
  if (version !== VERSION) {
    fail(`Trellis initialization produced .trellis/.version=${version || '<empty>'}; expected ${VERSION}`)
  }
  const developerFile = readFileSync(path.join(project, '.trellis', '.developer'), 'utf8')
  const installedDeveloper = developerFile.split(/\r?\n/gu)
    .find(line => line.startsWith('name='))
    ?.slice('name='.length)
    .trim() ?? ''
  if (!installedDeveloper) {
    fail('Trellis initialization produced .trellis/.developer without a name entry')
  }
  if (developer && installedDeveloper !== developer) {
    fail(`Trellis initialization recorded developer ${installedDeveloper || '<empty>'}; expected ${developer}`)
  }
  for (const relativePath of ['.codex/hooks.json', '.claude/settings.json', '.cursor/hooks.json']) {
    if (artifacts.includes(relativePath)) {
      try {
        readJson(path.join(project, relativePath))
      }
      catch {
        fail(`Trellis initialization produced invalid JSON: ${relativePath}`)
      }
    }
  }
  return { artifacts, developer: installedDeveloper, platforms, version }
}

function parsePlatforms(value) {
  const platforms = value.split(',').map(platform => platform.trim()).filter(Boolean)
  if (platforms.length === 0 || new Set(platforms).size !== platforms.length
    || platforms.some(platform => !Object.hasOwn(PLATFORM_ARTIFACTS, platform))) {
    fail('Platform must be a unique comma-separated selection from codex, claude, cursor')
  }
  return platforms
}

function runCli(args, project, options = {}) {
  const tool = installedTool()
  return withIsolatedUserEnvironment(options.label ?? 'Trellis command', env => runExternal(
    process.execPath,
    [tool.bin, ...args],
    { cwd: project, env },
  ), { guardGit: options.guardGit === true })
}

function usage() {
  console.log(`Usage:
  trellis.mjs doctor
  trellis.mjs verify-lock
  trellis.mjs install --accept-agpl-3.0-only
  trellis.mjs version
  trellis.mjs init --project <path> --developer <id> --platform <codex,claude,cursor> --monorepo <yes|no>
  trellis.mjs verify-project --project <path> --platform <codex,claude,cursor>
  trellis.mjs update-dry-run --project <path>
  trellis.mjs uninstall-dry-run --project <path>`)
}

function main() {
  const [command = 'help', ...args] = process.argv.slice(2)
  if (command === 'help' || command === '--help' || command === '-h') {
    usage()
    return
  }
  if (command === 'doctor') {
    parseOptions(args, {})
    requireNodeVersion()
    const python = detectPython()
    const lock = validateLock()
    let installed = false
    try {
      installedTool()
      installed = true
    }
    catch {
      installed = false
    }
    console.log(JSON.stringify({ node: process.versions.node, python, lock_sha256: lock.lockHash, installed, version: VERSION }, null, 2))
    return
  }
  if (command === 'verify-lock') {
    parseOptions(args, {})
    const lock = validateLock()
    console.log(JSON.stringify({ package: PACKAGE_NAME, version: VERSION, integrity: INTEGRITY, license: LICENSE, lock_sha256: lock.lockHash }, null, 2))
    return
  }
  if (command === 'install') {
    const options = parseOptions(args, { '--accept-agpl-3.0-only': 'boolean' })
    if (options['--accept-agpl-3.0-only'] !== true) {
      fail('Explicit --accept-agpl-3.0-only is required before installing Trellis')
    }
    const tool = installTool()
    console.log(JSON.stringify({ installed: true, root: tool.root, version: VERSION, license: LICENSE }, null, 2))
    return
  }
  if (command === 'version') {
    parseOptions(args, {})
    console.log(captureCliVersion(installedTool().root))
    return
  }
  if (command === 'init') {
    const options = parseOptions(args, {
      '--project': 'string',
      '--developer': 'string',
      '--platform': 'string',
      '--monorepo': 'string',
    })
    requireNodeVersion()
    detectPython()
    const project = requireProject(required(options, '--project'))
    const developer = required(options, '--developer')
    if (!/^[A-Za-z0-9][\w.-]{0,63}$/u.test(developer)) {
      fail('Developer ID must be a safe identifier')
    }
    const platforms = parsePlatforms(required(options, '--platform'))
    const platformFlags = { codex: '--codex', claude: '--claude', cursor: '--cursor' }
    const monorepo = required(options, '--monorepo')
    if (monorepo !== 'yes' && monorepo !== 'no') {
      fail('Monorepo must be exactly yes or no')
    }
    const verification = withDirectoryLock(path.join(project, '.airules-trellis-init.lock'), 'Trellis initialization', () => {
      if (existsSync(path.join(project, '.trellis'))) {
        fail(`Project already contains .trellis/: ${project}`)
      }
      return withProjectTransaction(project, platforms, () => {
        runCli([
          'init',
          '-y',
          '-u',
          developer,
          '--workflow',
          'native',
          ...platforms.map(value => platformFlags[value]),
          monorepo === 'yes' ? '--monorepo' : '--no-monorepo',
        ], project, { guardGit: true, label: 'Trellis initialization' })
        return verifyPlatformArtifacts(project, platforms, developer)
      })
    })
    console.log(JSON.stringify({ initialized: true, git_invocations: 0, ...verification }, null, 2))
    return
  }
  if (command === 'verify-project') {
    const options = parseOptions(args, { '--project': 'string', '--platform': 'string' })
    const project = requireProject(required(options, '--project'))
    const platforms = parsePlatforms(required(options, '--platform'))
    console.log(JSON.stringify(verifyPlatformArtifacts(project, platforms), null, 2))
    return
  }
  if (command === 'update-dry-run' || command === 'uninstall-dry-run') {
    const options = parseOptions(args, { '--project': 'string' })
    const project = requireProject(required(options, '--project'))
    if (!existsSync(path.join(project, '.trellis'))) {
      fail(`Project does not contain .trellis/: ${project}`)
    }
    runCli([command === 'update-dry-run' ? 'update' : 'uninstall', '--dry-run'], project)
    return
  }
  fail(`Unknown command: ${command}`)
}

try {
  main()
}
catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
}
