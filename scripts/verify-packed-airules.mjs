#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

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
  const moluoxixiManifest = path.join(installedPackageRoot, 'dist', 'roles', 'moluoxixi', 'constants', 'skills.js')
  if (!fs.existsSync(moluoxixiManifest))
    throw new Error('Packed AIRules is missing the compiled Moluoxixi role package declaration')

  const fixtureRoot = path.join(temporaryRoot, 'fixture')
  const airulesHome = path.join(temporaryRoot, 'airules-home')
  const userHome = path.join(temporaryRoot, 'user')
  fs.mkdirSync(path.join(fixtureRoot, 'roles', 'smoke', 'constants'), { recursive: true })
  fs.mkdirSync(path.join(userHome, '.codex'), { recursive: true })
  fs.writeFileSync(path.join(fixtureRoot, 'package.json'), '{"type":"module"}\n')
  fs.writeFileSync(path.join(fixtureRoot, 'roles', 'smoke', 'constants', 'skills.js'), [
    'export const hosts = [\'codex\']',
    'export const vendors = []',
  ].join('\n'))
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
