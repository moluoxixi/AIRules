#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { parse } from 'yaml'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const packageJson = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'))
const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'airules-packed-'))
const npmExecutable = process.platform === 'win32' ? 'npm.cmd' : 'npm'

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? repoRoot,
    encoding: 'utf8',
    env: process.env,
    shell: process.platform === 'win32' && command.endsWith('.cmd'),
    stdio: options.capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
  })
  if (result.error)
    throw result.error
  if (result.status !== 0) {
    throw new Error(
      `${command} ${args.join(' ')} failed (${result.status ?? 'unknown'}):\n${result.stderr || result.stdout || ''}`,
    )
  }
  return result.stdout?.trim() ?? ''
}

try {
  const packOutput = run(npmExecutable, [
    'pack',
    '--json',
    '--pack-destination',
    temporaryRoot,
  ], { capture: true })
  const packed = JSON.parse(packOutput)
  const filename = packed[0]?.filename
  if (typeof filename !== 'string')
    throw new Error(`npm pack did not return a tarball filename: ${packOutput}`)

  const consumerRoot = path.join(temporaryRoot, 'consumer')
  fs.mkdirSync(consumerRoot)
  fs.writeFileSync(path.join(consumerRoot, 'package.json'), '{"name":"airules-packed-consumer","private":true}\n')
  run(npmExecutable, [
    'install',
    '--ignore-scripts',
    '--no-audit',
    '--no-fund',
    path.join(temporaryRoot, filename),
  ], { cwd: consumerRoot })

  const airulesExecutable = path.join(
    consumerRoot,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'airules.cmd' : 'airules',
  )
  const version = run(airulesExecutable, ['--version'], { cwd: consumerRoot, capture: true })
  if (version !== packageJson.version)
    throw new Error(`Packed airules --version returned ${JSON.stringify(version)}, expected ${packageJson.version}`)
  const help = run(airulesExecutable, ['--help'], { cwd: consumerRoot, capture: true })
  if (!help.includes('airules install <role>'))
    throw new Error('Packed airules --help does not expose the role install command')

  const installedPackageRoot = path.join(consumerRoot, 'node_modules', packageJson.name)
  const hostDeclaration = path.join(installedPackageRoot, 'hosts', 'hosts.yaml')
  if (!fs.existsSync(hostDeclaration))
    throw new Error('Packed AIRules is missing the host YAML declaration')
  const { HOST_IDS, findHostConfig, resolveHostPaths } = await import(
    pathToFileURL(path.join(installedPackageRoot, 'dist', 'scripts', 'lib', 'hosts.js')).href,
  )
  const declaredHosts = parse(fs.readFileSync(hostDeclaration, 'utf8'))
  if (JSON.stringify(HOST_IDS) !== JSON.stringify(declaredHosts.hosts.map(host => host.id)))
    throw new Error('Packed AIRules host registry does not match its YAML declaration')
  if (!help.includes(HOST_IDS.join(', ')))
    throw new Error('Packed CLI help does not expose the declared host order')
  const hermes = findHostConfig('hermes desktop')
  if (!hermes || resolveHostPaths(hermes, consumerRoot).hostHome !== path.join(consumerRoot, 'AppData', 'Local', 'hermes'))
    throw new Error('Packed AIRules does not resolve declared host aliases and portable paths')
  if (fs.existsSync(path.join(installedPackageRoot, 'dist', 'constants', 'hosts.js')))
    throw new Error('Packed AIRules still contains the retired host constants module')
  const moluoxixiManifest = path.join(installedPackageRoot, 'roles', 'moluoxixi', 'role.yaml')
  if (!fs.existsSync(moluoxixiManifest))
    throw new Error('Packed AIRules is missing the Moluoxixi role YAML declaration')
  const trellisManifest = path.join(installedPackageRoot, 'roles', 'trellis', 'role.yaml')
  const capabilityDeclaration = path.join(installedPackageRoot, 'capabilities', 'common', 'capability.yaml')
  if (!fs.existsSync(trellisManifest) || !fs.existsSync(capabilityDeclaration))
    throw new Error('Packed AIRules is missing role or capability declarations')
  for (const manifestPath of [moluoxixiManifest, trellisManifest]) {
    // loadVendorManifest 直接读取 role.yaml，并按 capabilities 组合 vendors。
    const { loadVendorManifest } = await import(pathToFileURL(path.join(installedPackageRoot, 'dist', 'scripts', 'lib', 'vendors.js')).href)
    const loaded = await loadVendorManifest(manifestPath)
    const frontendVendor = loaded.vendors['anthropic-skills']
    if (frontendVendor?.revision !== '3b3fad96af16a10759d930941b4520ba0c40edae')
      throw new Error(`Packed role manifest does not pin frontend-design: ${manifestPath}`)
    const memoryVendor = loaded.vendors['hindsight-memory']
    if (memoryVendor?.revision !== '9269b88417ed263e5a8350f2e416ca2b322756b1')
      throw new Error(`Packed role manifest does not pin Hindsight documentation: ${manifestPath}`)
    const roleContract = parse(fs.readFileSync(manifestPath, 'utf8'))
    const roleVendorName = roleContract?.role_vendor?.name
    if (!roleVendorName)
      throw new Error(`Packed role YAML does not declare role_vendor.name: ${manifestPath}`)
    const roleLinks = loaded.vendors[roleVendorName]?.links ?? []
    for (const source of ['capabilities/common/skills', 'capabilities/common/mcps.json']) {
      if (!roleLinks.some(link => link.source === source))
        throw new Error(`Packed role manifest is missing shared capability assets: ${source}`)
    }
  }

  const fixtureRoot = path.join(temporaryRoot, 'fixture')
  const airulesHome = path.join(temporaryRoot, 'airules-home')
  const userHome = path.join(temporaryRoot, 'user')
  fs.mkdirSync(path.join(fixtureRoot, 'roles', 'smoke'), { recursive: true })
  fs.mkdirSync(path.join(userHome, '.codex'), { recursive: true })
  fs.writeFileSync(path.join(fixtureRoot, 'package.json'), '{"type":"module"}\n')
  fs.writeFileSync(path.join(fixtureRoot, 'roles', 'smoke', 'role.yaml'), `${[
    'schema_version: 1',
    'role_id: smoke',
    'hosts: [codex]',
  ].join('\n')}\n`)
  const installOutput = run(airulesExecutable, [
    'install',
    'smoke',
    '--repo-root',
    fixtureRoot,
    '--home',
    airulesHome,
    '--user-home',
    userHome,
    '--host',
    'codex',
    '--skip-vendors',
    '--no-verify',
  ], { cwd: consumerRoot, capture: true })
  if (!installOutput.includes('[install] smoke 完成: codex'))
    throw new Error(`Packed airules install did not complete the fixture role:\n${installOutput}`)
  if (!fs.existsSync(path.join(userHome, '.agents', 'skills')))
    throw new Error('Packed airules install did not create the global Agent skills projection')
  console.log(`Packed ${packageJson.name}@${packageJson.version} installs and runs successfully.`)
}
finally {
  fs.rmSync(temporaryRoot, { recursive: true, force: true })
}
