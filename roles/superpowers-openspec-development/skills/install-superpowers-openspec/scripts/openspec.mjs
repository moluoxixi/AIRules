#!/usr/bin/env node

import { spawnSync } from 'node:child_process'
import { createHash, randomUUID } from 'node:crypto'
import {
  copyFileSync,
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

const PACKAGE_NAME = '@fission-ai/openspec'
const VERSION = '1.6.0'
const INTEGRITY = 'sha512-7yFTQ3hrrk11mQ2ACClNv2gtAN0o116vCgwoiQKmreoB6ambSnrZh7wf2FNFoSDBXHBi9iiCQ7G16fG71ZNppA=='
const LICENSE = 'MIT'
const MINIMUM_NODE = [20, 19, 0]
const LOCK_STALE_AFTER_MS = 30 * 60 * 1000
const SUPERPOWERS_SKILLS = [
  'brainstorming',
  'dispatching-parallel-agents',
  'executing-plans',
  'finishing-a-development-branch',
  'receiving-code-review',
  'requesting-code-review',
  'subagent-driven-development',
  'systematic-debugging',
  'test-driven-development',
  'using-git-worktrees',
  'using-superpowers',
  'verification-before-completion',
  'writing-plans',
  'writing-skills',
]
const RUN_GLOBAL_FLAGS = new Set(['--no-color'])
const RUN_COMMANDS = new Set([
  'archive',
  'instructions',
  'list',
  'new',
  'schemas',
  'show',
  'status',
  'sync',
  'templates',
  'validate',
])
const scriptRoot = path.dirname(fileURLToPath(import.meta.url))
const skillRoot = path.resolve(scriptRoot, '..')
const lockRoot = path.join(skillRoot, 'assets', 'tool')

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
    fail(`OpenSpec requires Node.js >=20.19.0; current version is ${process.versions.node}`)
  }
}

function validateLock() {
  const packageFile = path.join(lockRoot, 'package.json')
  const lockFile = path.join(lockRoot, 'package-lock.json')
  const packageJson = readJson(packageFile)
  const lock = readJson(lockFile)
  const entry = lock.packages?.[`node_modules/${PACKAGE_NAME}`]
  if (packageJson.dependencies?.[PACKAGE_NAME] !== VERSION || lock.packages?.['']?.dependencies?.[PACKAGE_NAME] !== VERSION) {
    fail(`Bundled OpenSpec dependency must be exactly ${VERSION}`)
  }
  if (entry?.version !== VERSION || entry?.integrity !== INTEGRITY || entry?.license !== LICENSE) {
    fail('Bundled OpenSpec package lock does not match the approved version, integrity, and license')
  }
  return { packageFile, lockFile, lockHash: normalizedFileHash(lockFile) }
}

function toolHome() {
  return process.env.AIRULES_TOOL_HOME
    ? path.resolve(process.env.AIRULES_TOOL_HOME)
    : path.join(os.homedir(), '.moluoxixi', 'tools')
}

function toolRoot() {
  return path.join(toolHome(), 'openspec', VERSION)
}

function packageBin(root) {
  const packageRoot = path.join(root, 'node_modules', ...PACKAGE_NAME.split('/'))
  const packageJson = readJson(path.join(packageRoot, 'package.json'))
  if (packageJson.version !== VERSION || packageJson.license !== LICENSE) {
    fail(`Installed OpenSpec package metadata does not match ${VERSION} (${LICENSE})`)
  }
  const bin = typeof packageJson.bin === 'string' ? packageJson.bin : packageJson.bin?.openspec
  if (typeof bin !== 'string') {
    fail('Installed OpenSpec package does not expose the openspec binary')
  }
  const target = path.resolve(packageRoot, bin)
  if (!existsSync(target) || !statSync(target).isFile()) {
    fail(`Installed OpenSpec binary is missing: ${target}`)
  }
  return target
}

function captureCliVersion(root) {
  const result = spawnSync(process.execPath, [packageBin(root), '--version'], {
    encoding: 'utf8',
    env: isolatedUserEnvironment(),
    shell: false,
  })
  if (result.status !== 0) {
    fail(`Pinned OpenSpec CLI version check failed: ${result.stderr ?? result.stdout ?? ''}`)
  }
  const value = String(result.stdout ?? '').trim()
  if (value !== VERSION) {
    fail(`Pinned OpenSpec CLI reported ${value || '<empty>'}; expected ${VERSION}`)
  }
  return value
}

function installedTool() {
  const root = toolRoot()
  const markerFile = path.join(root, '.airules-tool.json')
  if (!existsSync(markerFile)) {
    fail('Pinned OpenSpec tool is not installed; run the install command first')
  }
  const marker = readJson(markerFile)
  const lock = validateLock()
  if (marker.package !== PACKAGE_NAME || marker.version !== VERSION || marker.lock_sha256 !== lock.lockHash) {
    fail('Installed OpenSpec cache marker does not match the bundled lock')
  }
  captureCliVersion(root)
  return { root, bin: packageBin(root) }
}

function npmExecutable() {
  return process.platform === 'win32' ? 'npm.cmd' : 'npm'
}

function isolatedUserEnvironment() {
  const root = path.join(toolHome(), '.runtime', 'openspec', VERSION)
  const values = {
    HOME: path.join(root, 'home'),
    USERPROFILE: path.join(root, 'home'),
    APPDATA: path.join(root, 'appdata'),
    LOCALAPPDATA: path.join(root, 'local-appdata'),
    XDG_CONFIG_HOME: path.join(root, 'xdg-config'),
    XDG_CACHE_HOME: path.join(root, 'xdg-cache'),
    XDG_DATA_HOME: path.join(root, 'xdg-data'),
    XDG_STATE_HOME: path.join(root, 'xdg-state'),
    npm_config_cache: path.join(root, 'npm-cache'),
    npm_config_userconfig: path.join(root, 'npmrc'),
    npm_config_update_notifier: 'false',
    OPENSPEC_TELEMETRY: '0',
    DO_NOT_TRACK: '1',
  }
  const isolatedKeys = new Set(Object.keys(values).map(key => key.toUpperCase()))
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !isolatedKeys.has(key.toUpperCase())))
  const directories = [
    values.HOME,
    values.APPDATA,
    values.LOCALAPPDATA,
    values.XDG_CONFIG_HOME,
    values.XDG_CACHE_HOME,
    values.XDG_DATA_HOME,
    values.XDG_STATE_HOME,
    values.npm_config_cache,
  ]
  for (const directory of directories) {
    mkdirSync(directory, { recursive: true })
  }
  return { ...env, ...values }
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

function readDirectoryLockOwner(lockDir) {
  try {
    const owner = readJson(path.join(lockDir, 'owner.json'))
    if (!Number.isSafeInteger(owner.pid) || owner.pid <= 0
      || typeof owner.token !== 'string' || owner.token.length < 16
      || typeof owner.started_at !== 'string'
      || typeof owner.hostname !== 'string') {
      return undefined
    }
    return owner
  }
  catch {
    return undefined
  }
}

function sameDirectoryLockOwner(left, right) {
  return left?.pid === right?.pid
    && left?.token === right?.token
    && left?.started_at === right?.started_at
    && left?.hostname === right?.hostname
}

function pidIsDefinitelyMissing(pid) {
  try {
    process.kill(pid, 0)
    return false
  }
  catch (error) {
    return error?.code === 'ESRCH'
  }
}

function requireRecoverableLockOwner(owner, lockDir, label) {
  const startedAt = Date.parse(owner?.started_at ?? '')
  const oldEnough = Number.isFinite(startedAt) && Date.now() - startedAt >= LOCK_STALE_AFTER_MS
  if (!owner || owner.hostname !== os.hostname() || !oldEnough || !pidIsDefinitelyMissing(owner.pid)) {
    fail(`${label} is already in progress: ${lockDir}`)
  }
}

function removeOwnedRecoveryClaim(lockDir, recoveryToken) {
  const recoveryFile = path.join(lockDir, 'recovery.json')
  try {
    const claim = readJson(recoveryFile)
    if (claim.recovery_token === recoveryToken) {
      rmSync(recoveryFile, { force: true })
    }
  }
  catch {
    // Never remove a recovery claim whose token cannot be verified.
  }
}

function reclaimStaleDirectoryLock(lockDir, label) {
  const owner = readDirectoryLockOwner(lockDir)
  requireRecoverableLockOwner(owner, lockDir, label)

  const recoveryToken = randomUUID()
  const recoveryFile = path.join(lockDir, 'recovery.json')
  try {
    writeFileSync(recoveryFile, `${JSON.stringify({
      owner_token: owner.token,
      recovery_token: recoveryToken,
      pid: process.pid,
      hostname: os.hostname(),
      started_at: new Date().toISOString(),
    })}\n`, { encoding: 'utf8', flag: 'wx' })
  }
  catch (error) {
    if (error?.code === 'EEXIST' || error?.code === 'ENOENT') {
      fail(`${label} is already in progress: ${lockDir}`)
    }
    throw error
  }

  let quarantine
  try {
    const currentOwner = readDirectoryLockOwner(lockDir)
    if (!sameDirectoryLockOwner(currentOwner, owner)) {
      fail(`${label} lock owner changed during stale recovery: ${lockDir}`)
    }
    requireRecoverableLockOwner(currentOwner, lockDir, label)

    quarantine = `${lockDir}.stale-${recoveryToken}`
    renameSync(lockDir, quarantine)
    const movedOwner = readDirectoryLockOwner(quarantine)
    const movedClaim = readJson(path.join(quarantine, 'recovery.json'))
    if (!sameDirectoryLockOwner(movedOwner, owner) || movedClaim.recovery_token !== recoveryToken) {
      if (!existsSync(lockDir)) {
        renameSync(quarantine, lockDir)
        quarantine = undefined
      }
      fail(`${label} lock changed during stale recovery; refusing to remove it`)
    }
    rmSync(quarantine, { recursive: true })
    quarantine = undefined
  }
  catch (error) {
    if (quarantine && existsSync(quarantine) && !existsSync(lockDir)) {
      try {
        renameSync(quarantine, lockDir)
        quarantine = undefined
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
  finally {
    if (!quarantine && existsSync(lockDir)) {
      removeOwnedRecoveryClaim(lockDir, recoveryToken)
    }
  }
}

function acquireDirectoryLock(lockDir, label) {
  const owner = {
    pid: process.pid,
    token: randomUUID(),
    hostname: os.hostname(),
    started_at: new Date().toISOString(),
  }
  try {
    mkdirSync(lockDir)
  }
  catch (error) {
    if (error?.code !== 'EEXIST') {
      throw error
    }
    reclaimStaleDirectoryLock(lockDir, label)
    try {
      mkdirSync(lockDir)
    }
    catch (retryError) {
      if (retryError?.code === 'EEXIST') {
        fail(`${label} is already in progress: ${lockDir}`)
      }
      throw retryError
    }
  }
  try {
    writeFileSync(path.join(lockDir, 'owner.json'), `${JSON.stringify(owner)}\n`, { encoding: 'utf8', flag: 'wx' })
  }
  catch (error) {
    rmSync(lockDir, { recursive: true, force: true })
    throw error
  }
  return owner
}

function releaseDirectoryLock(lockDir, label, owner) {
  const currentOwner = readDirectoryLockOwner(lockDir)
  if (!sameDirectoryLockOwner(currentOwner, owner)) {
    fail(`${label} lock ownership changed; refusing to remove it: ${lockDir}`)
  }
  rmSync(lockDir, { recursive: true })
}

function withDirectoryLock(lockDir, label, action) {
  const owner = acquireDirectoryLock(lockDir, label)
  try {
    return action()
  }
  finally {
    releaseDirectoryLock(lockDir, label, owner)
  }
}

function installTool() {
  requireNodeVersion()
  const lock = validateLock()
  const target = toolRoot()
  const parent = path.dirname(target)
  mkdirSync(parent, { recursive: true })
  return withDirectoryLock(path.join(parent, `.install-${VERSION}.lock`), 'OpenSpec tool installation', () => {
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
      runExternal(npmExecutable(), ['ci', '--ignore-scripts', '--omit=dev', '--no-audit', '--no-fund'], {
        cwd: staging,
        env: isolatedUserEnvironment(),
      })
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

function requireChangeId(value) {
  if (!/^[a-z0-9][a-z0-9-]{0,62}$/u.test(value)) {
    fail('OpenSpec change ID must be a lowercase safe identifier')
  }
  return value
}

function runCli(args, project) {
  const tool = installedTool()
  runExternal(process.execPath, [tool.bin, ...args], { cwd: project, env: isolatedUserEnvironment() })
}

function verifyGeneratedLedger(root) {
  const requiredDirectories = [
    path.join(root, 'specs'),
    path.join(root, 'changes'),
    path.join(root, 'changes', 'archive'),
  ]
  const config = path.join(root, 'config.yaml')
  if (requiredDirectories.some(directory => !existsSync(directory) || !statSync(directory).isDirectory())) {
    fail('OpenSpec staging did not generate the required specs/changes/archive directories')
  }
  if (!existsSync(config) || !statSync(config).isFile()) {
    fail('OpenSpec staging did not generate config.yaml')
  }
}

function superpowersInventory() {
  const skillsRoot = path.dirname(skillRoot)
  const realSkillsRoot = realpathSync(skillsRoot)
  const missing = []
  const unsafe = []
  for (const name of SUPERPOWERS_SKILLS) {
    const directory = path.join(skillsRoot, name)
    const skillFile = path.join(directory, 'SKILL.md')
    const directoryStat = lstatSync(directory, { throwIfNoEntry: false })
    const fileStat = lstatSync(skillFile, { throwIfNoEntry: false })
    if (!directoryStat || !fileStat) {
      missing.push(name)
      continue
    }
    if (!directoryStat.isDirectory() || directoryStat.isSymbolicLink()
      || !fileStat.isFile() || fileStat.isSymbolicLink()) {
      unsafe.push(name)
      continue
    }
    let realDirectory
    let realSkillFile
    try {
      realDirectory = realpathSync(directory)
      realSkillFile = realpathSync(skillFile)
    }
    catch {
      unsafe.push(name)
      continue
    }
    const directoryRelative = path.relative(realSkillsRoot, realDirectory)
    const fileRelative = path.relative(realSkillsRoot, realSkillFile)
    const withinSkillsRoot = relative => relative.length > 0
      && relative !== '..'
      && !relative.startsWith(`..${path.sep}`)
      && !path.isAbsolute(relative)
    if (!withinSkillsRoot(directoryRelative) || !withinSkillsRoot(fileRelative)) {
      unsafe.push(name)
    }
  }
  return { expected: SUPERPOWERS_SKILLS.length, missing, unsafe }
}

function requireSuperpowersInventory() {
  const inventory = superpowersInventory()
  if (inventory.missing.length > 0 || inventory.unsafe.length > 0) {
    fail(`Superpowers role projection is incomplete or shadowed. Remove same-name ~/.moluoxixi/local/skills overrides, then run airules sync --host all --role superpowers-openspec-development. Missing: ${inventory.missing.join(', ') || '<none>'}. Unsafe: ${inventory.unsafe.join(', ') || '<none>'}`)
  }
  return inventory
}

function validateRunArguments(cliArgs) {
  let commandIndex = 0
  while (RUN_GLOBAL_FLAGS.has(cliArgs[commandIndex])) {
    commandIndex += 1
  }
  const command = cliArgs[commandIndex]
  if (!command || command.startsWith('-') || !RUN_COMMANDS.has(command)) {
    fail(`OpenSpec run command is not permitted: ${command ?? '<missing>'}`)
  }
  if (command === 'new' && cliArgs[commandIndex + 1] !== 'change') {
    fail(`OpenSpec run subcommand is not permitted: new ${cliArgs[commandIndex + 1] ?? '<missing>'}`)
  }
  return { command, writesProject: command === 'new' || command === 'archive' || command === 'sync' }
}

function withProjectWriteLock(project, action) {
  return withDirectoryLock(path.join(project, '.airules-openspec-write.lock'), 'OpenSpec project mutation', action)
}

function usage() {
  console.log(`Usage:
  openspec.mjs doctor
  openspec.mjs verify-lock
  openspec.mjs install
  openspec.mjs version
  openspec.mjs init-ledger --project <path>
  openspec.mjs new-change --project <path> --name <change-id>
  openspec.mjs status --project <path> --change <change-id>
  openspec.mjs instructions-apply --project <path> --change <change-id>
  openspec.mjs validate --project <path>
  openspec.mjs run --project <path> -- <safe OpenSpec arguments>`)
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
    const lock = validateLock()
    let installed = false
    try {
      installedTool()
      installed = true
    }
    catch {
      installed = false
    }
    const superpowers = superpowersInventory()
    console.log(JSON.stringify({
      node: process.versions.node,
      lock_sha256: lock.lockHash,
      installed,
      version: VERSION,
      superpowers,
    }, null, 2))
    if (superpowers.missing.length > 0 || superpowers.unsafe.length > 0) {
      fail('Superpowers role projection is incomplete or shadowed; remove same-name ~/.moluoxixi/local/skills overrides and rerun the role sync')
    }
    return
  }
  if (command === 'verify-lock') {
    parseOptions(args, {})
    const lock = validateLock()
    console.log(JSON.stringify({ package: PACKAGE_NAME, version: VERSION, integrity: INTEGRITY, license: LICENSE, lock_sha256: lock.lockHash }, null, 2))
    return
  }
  if (command === 'install') {
    parseOptions(args, {})
    requireSuperpowersInventory()
    const tool = installTool()
    console.log(JSON.stringify({ installed: true, root: tool.root, version: VERSION, license: LICENSE }, null, 2))
    return
  }
  if (command === 'version') {
    parseOptions(args, {})
    console.log(captureCliVersion(installedTool().root))
    return
  }

  requireSuperpowersInventory()

  if (command === 'run') {
    const separator = args.indexOf('--')
    if (separator === -1) {
      fail('run requires -- before the OpenSpec arguments')
    }
    const options = parseOptions(args.slice(0, separator), { '--project': 'string' })
    const cliArgs = args.slice(separator + 1)
    if (cliArgs.length === 0) {
      fail('run requires at least one OpenSpec argument')
    }
    const runPolicy = validateRunArguments(cliArgs)
    const project = requireProject(required(options, '--project'))
    if (!existsSync(path.join(project, 'openspec'))) {
      fail(`Project does not contain openspec/: ${project}`)
    }
    if (runPolicy.writesProject) {
      withProjectWriteLock(project, () => runCli(cliArgs, project))
    }
    else {
      runCli(cliArgs, project)
    }
    return
  }

  const options = parseOptions(args, command === 'new-change'
    ? { '--project': 'string', '--name': 'string' }
    : command === 'status' || command === 'instructions-apply'
      ? { '--project': 'string', '--change': 'string' }
      : { '--project': 'string' })
  const project = requireProject(required(options, '--project'))

  if (command === 'init-ledger') {
    const target = path.join(project, 'openspec')
    withDirectoryLock(path.join(project, '.airules-openspec-init.lock'), 'OpenSpec ledger initialization', () => {
      if (lstatSync(target, { throwIfNoEntry: false })) {
        fail(`Project already contains openspec/: ${project}`)
      }
      const staging = mkdtempSync(path.join(project, '.airules-openspec-init-'))
      try {
        runCli(['init', staging, '--tools', 'none', '--profile', 'core'], project)
        const entries = readdirSync(staging).sort()
        if (entries.length !== 1 || entries[0] !== 'openspec') {
          fail(`OpenSpec staging produced unexpected top-level entries: ${entries.join(', ')}`)
        }
        const source = path.join(staging, 'openspec')
        verifyGeneratedLedger(source)
        if (lstatSync(target, { throwIfNoEntry: false })) {
          fail(`Project openspec/ appeared during staging: ${project}`)
        }
        renameSync(source, target)
      }
      finally {
        rmSync(staging, { recursive: true, force: true })
      }
    })
    return
  }
  if (!existsSync(path.join(project, 'openspec'))) {
    fail(`Project does not contain openspec/: ${project}`)
  }
  if (command === 'new-change') {
    withProjectWriteLock(project, () => {
      runCli(['new', 'change', requireChangeId(required(options, '--name')), '--json'], project)
    })
    return
  }
  if (command === 'status') {
    runCli(['status', '--change', requireChangeId(required(options, '--change')), '--json'], project)
    return
  }
  if (command === 'instructions-apply') {
    runCli(['instructions', 'apply', '--change', requireChangeId(required(options, '--change')), '--json'], project)
    return
  }
  if (command === 'validate') {
    runCli(['validate', '--all', '--strict', '--json', '--no-interactive'], project)
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
