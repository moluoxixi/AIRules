import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, it } from 'vitest'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(currentDir, '../../..')
const tsxCli = path.join(repoRoot, 'node_modules', 'tsx', 'dist', 'cli.mjs')
const airulesCli = path.join(repoRoot, 'scripts', 'cli.ts')
const airulesWrapper = path.join(repoRoot, 'bin', 'airules.js')
const builtCli = path.join(repoRoot, 'dist', 'scripts', 'cli.js')

function runCli(args: string[]) {
  return spawnSync(process.execPath, [tsxCli, airulesCli, ...args], {
    cwd: repoRoot,
    encoding: 'utf8',
  })
}

function runGit(cwd: string, args: string[]): string {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' })
  if (result.status !== 0)
    throw new Error(`git ${args.join(' ')} failed: ${result.stderr}`)
  return result.stdout.trim()
}

function writeFile(filePath: string, content: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, content)
}

it('documents role-first install and verify commands', () => {
  const result = runCli(['--help'])

  expect(result.status).toBe(0)
  expect(result.stdout).toContain('airules install <role>')
  expect(result.stdout).toContain('airules verify <role>')
})

it.each(['install', 'sync', 'verify'])('%s rejects a missing role', (command) => {
  const result = runCli([command])

  expect(result.status).toBe(1)
  expect(result.stderr).toContain(`${command} requires a role`)
})

it('rejects duplicate and extra role arguments', () => {
  const duplicate = runCli(['install', 'moluoxixi', '--role', 'moluoxixi'])
  const extra = runCli(['install', 'moluoxixi', 'matt'])

  expect(duplicate.status).toBe(1)
  expect(duplicate.stderr).toContain('received the role twice')
  expect(extra.status).toBe(1)
  expect(extra.stderr).toContain('accepts exactly one role')
})

it('accepts help without a role', () => {
  const result = runCli(['install', '--help'])

  expect(result.status).toBe(0)
  expect(result.stdout).toContain('airules install <role>')
})

it.skipIf(!fs.existsSync(builtCli))('installs a pinned local role through the built CLI wrapper', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'airules-cli-install-'))
  try {
    const fixtureRoot = path.join(root, 'fixture')
    const homeDir = path.join(root, 'airules-home')
    const userHome = path.join(root, 'user')
    const vendorRoot = path.join(homeDir, 'vendor', 'repos', 'fixture')
    const vendorSource = 'https://fixture.invalid/vendor.git'

    writeFile(path.join(fixtureRoot, 'package.json'), '{"type":"module"}\n')
    writeFile(path.join(userHome, '.codex', '.keep'), '')
    writeFile(path.join(vendorRoot, 'roles', 'smoke', 'role.yaml'), 'role_id: smoke\ncanonical_root: roles/smoke\n')
    writeFile(path.join(vendorRoot, 'roles', 'smoke', 'constants', 'skills.ts'), 'export const vendors = []\n')
    writeFile(path.join(vendorRoot, 'roles', 'smoke', 'skills', 'smoke-skill', 'SKILL.md'), '---\nname: smoke-skill\ndescription: smoke\n---\n')
    runGit(vendorRoot, ['init'])
    runGit(vendorRoot, ['config', 'user.email', 'ci@example.test'])
    runGit(vendorRoot, ['config', 'user.name', 'AIRules CI'])
    runGit(vendorRoot, ['remote', 'add', 'origin', vendorSource])
    runGit(vendorRoot, ['add', '.'])
    runGit(vendorRoot, ['commit', '-m', 'fixture'])
    const revision = runGit(vendorRoot, ['rev-parse', 'HEAD'])

    writeFile(path.join(fixtureRoot, 'roles', 'smoke', 'constants', 'skills.js'), `
export const hosts = ['codex']
export const vendors = [{
  name: 'fixture',
  source: '${vendorSource}',
  revision: '${revision}',
  projections: [{ kind: 'role-assets', sourceDir: 'roles/smoke' }],
}]
`)

    const result = spawnSync(process.execPath, [
      airulesWrapper,
      'install',
      'smoke',
      '--repo-root',
      fixtureRoot,
      '--home',
      homeDir,
      '--user-home',
      userHome,
      '--host',
      'codex',
      '--skip-vendors',
    ], { cwd: repoRoot, encoding: 'utf8' })

    expect(result.status, result.stderr).toBe(0)
    expect(result.stdout).toContain('[update] Git checkout unavailable; using packaged AIRules')
    expect(result.stdout).toContain('[install] smoke 完成: codex')
    expect(fs.existsSync(path.join(homeDir, 'roles', 'smoke', 'skills', 'smoke-skill', 'SKILL.md'))).toBe(true)
    expect(fs.existsSync(path.join(userHome, '.agents', 'skills', 'smoke-skill', 'SKILL.md'))).toBe(true)
    expect(fs.existsSync(path.join(userHome, '.codex', 'skills', 'smoke-skill', 'SKILL.md'))).toBe(true)
  }
  finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})
