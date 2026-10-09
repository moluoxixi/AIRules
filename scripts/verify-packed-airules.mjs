#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { parse, stringify } from 'yaml'

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
  for (const relativePath of [
    'capabilities/common/capability.yaml',
    'capabilities/productivity/capability.yaml',
    'capabilities/common/skills/hindsight-memory/SKILL.md',
    'capabilities/common/skills/hindsight-memory/references/visualization.md',
    'capabilities/common/skills/hindsight-memory/assets/compose.yaml',
    'capabilities/common/skills/hindsight-memory/assets/hindsight.env.example',
  ]) {
    if (!fs.existsSync(path.join(installedPackageRoot, relativePath)))
      throw new Error(`Packed AIRules is missing a capability asset: ${relativePath}`)
  }

  const roles = fs.readdirSync(path.join(repoRoot, 'roles'))
    .filter(role => fs.existsSync(path.join(repoRoot, 'roles', role, 'role.yaml')))
  const { loadVendorManifest } = await import(pathToFileURL(path.join(installedPackageRoot, 'dist', 'scripts', 'lib', 'vendors.js')).href)
  const { roleOverlayOrder } = await import(pathToFileURL(path.join(installedPackageRoot, 'dist', 'scripts', 'lib', 'roles.js')).href)
  const { readRoleContract } = await import(pathToFileURL(path.join(installedPackageRoot, 'dist', 'scripts', 'lib', 'role-contract.js')).href)
  for (const role of roles) {
    const manifestPath = path.join(installedPackageRoot, 'roles', role, 'role.yaml')
    if (!fs.existsSync(manifestPath))
      throw new Error(`Packed AIRules is missing a role declaration: ${role}`)
    const lineage = await roleOverlayOrder(installedPackageRoot, role)
    const capabilities = new Set(lineage.flatMap((ancestor) => {
      const contract = readRoleContract(path.join(installedPackageRoot, 'roles', ancestor, 'role.yaml'))
      return contract.capabilities ?? []
    }))
    const loaded = await loadVendorManifest(manifestPath)
    if (capabilities.has('frontend') && loaded.vendors['anthropic-skills']?.revision !== '3b3fad96af16a10759d930941b4520ba0c40edae')
      throw new Error(`Packed role manifest does not pin frontend-design: ${manifestPath}`)
    if (capabilities.has('common') && loaded.vendors['hindsight-memory']?.revision !== '9269b88417ed263e5a8350f2e416ca2b322756b1')
      throw new Error(`Packed role manifest does not pin Hindsight documentation: ${manifestPath}`)
    for (const namespace of ['engineering', 'productivity']) {
      if (capabilities.has(namespace) && (loaded.vendors.mattpocock?.revision !== '8b78b531ab965735c5dc74f6f7a219e1e37326df'
        || !loaded.vendors.mattpocock.links.some(link => link.source === `skills/${namespace}`))) {
        throw new Error(`Packed role manifest is missing pinned ${namespace}: ${manifestPath}`)
      }
    }
    const roleContract = readRoleContract(manifestPath)
    const roleVendorName = roleContract.roleVendor?.name
    if (!roleVendorName)
      throw new Error(`Packed role YAML does not declare installation.role_vendor.name: ${manifestPath}`)
    const roleLinks = loaded.vendors[roleVendorName]?.links ?? []
    if (capabilities.has('common')) {
      for (const source of ['capabilities/common/skills', 'capabilities/common/mcps.json']) {
        if (!roleLinks.some(link => link.source === source))
          throw new Error(`Packed role manifest is missing shared capability assets: ${source}`)
      }
    }
    if (role === 'general' && (Object.keys(loaded.vendors).length !== 2
      || roleLinks.filter(link => link.kind === 'mcp-file').length !== 1)) {
      throw new Error('Packed general role includes unexpected vendors or MCP catalogs')
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

  const diamondRoles = [
    ['base', [], ['common']],
    ['left', ['base'], ['coding']],
    ['right', ['base'], ['common', 'frontend']],
    ['diamond', ['left', 'right'], ['common']],
  ]
  for (const [role, parents, capabilities] of diamondRoles) {
    const roleRoot = path.join(fixtureRoot, 'roles', role)
    fs.mkdirSync(roleRoot, { recursive: true })
    fs.writeFileSync(path.join(roleRoot, 'role.yaml'), stringify({
      schema_version: 2,
      role_id: role,
      extends_roles: parents,
      provides: { capabilities },
      installation: {
        hosts: [role === 'diamond' ? 'codex' : 'claude'],
        role_vendor: {
          name: `${role}-role`,
          source: 'https://example.test/roles.git',
          ...(role === 'diamond' ? {} : { setup: [{ command: 'parent-setup-must-not-run' }] }),
          projections: [{ kind: 'role-assets', source_dir: `roles/${role}` }],
        },
      },
    }))
  }
  const diamondOrder = await roleOverlayOrder(fixtureRoot, 'diamond')
  if (JSON.stringify(diamondOrder) !== JSON.stringify(['base', 'left', 'right', 'diamond']))
    throw new Error(`Packed v2 inheritance does not deduplicate the diamond: ${diamondOrder}`)
  const diamondManifest = path.join(fixtureRoot, 'roles', 'diamond', 'role.yaml')
  const diamond = await loadVendorManifest(diamondManifest)
  if (Object.keys(diamond.vendors).some(name => ['base-role', 'left-role', 'right-role'].includes(name))
    || JSON.stringify(diamond.hosts) !== JSON.stringify(['codex'])
    || diamond.vendors['diamond-role'].links.filter(link => link.source === 'capabilities/common/skills').length !== 1
    || diamond.vendors['diamond-role'].links.filter(link => link.source === 'capabilities/common/mcps.json').length !== 1) {
    throw new Error('Packed v2 inheritance duplicates shared capabilities or inherits parent installation settings')
  }

  // Exercise the packed CLI offline while leaving parent setup declarations in place.
  for (const [role] of diamondRoles) {
    const contractPath = path.join(fixtureRoot, 'roles', role, 'role.yaml')
    const contract = parse(fs.readFileSync(contractPath, 'utf8'))
    contract.provides.capabilities = []
    if (role === 'diamond')
      delete contract.installation.role_vendor
    fs.writeFileSync(contractPath, stringify(contract))
  }
  const diamondInstallOutput = run(airulesExecutable, [
    'install',
    'diamond',
    '--repo-root',
    fixtureRoot,
    '--home',
    airulesHome,
    '--user-home',
    userHome,
    '--host',
    'codex',
    '--no-verify',
  ], { cwd: consumerRoot, capture: true })
  if (!diamondInstallOutput.includes('[install] diamond 完成: codex'))
    throw new Error(`Packed v2 airules install did not complete the diamond fixture:\n${diamondInstallOutput}`)
  console.log(`Packed ${packageJson.name}@${packageJson.version} installs and runs successfully.`)
}
finally {
  fs.rmSync(temporaryRoot, { recursive: true, force: true })
}
