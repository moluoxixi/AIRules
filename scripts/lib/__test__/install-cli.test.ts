import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, it } from 'vitest'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(currentDir, '../../..')
const tsxCli = path.join(repoRoot, 'node_modules', 'tsx', 'dist', 'cli.mjs')
const airulesCli = path.join(repoRoot, 'scripts', 'cli.ts')

function runCli(args: string[]) {
  return spawnSync(process.execPath, [tsxCli, airulesCli, ...args], {
    cwd: repoRoot,
    encoding: 'utf8',
  })
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
  const extra = runCli(['install', 'moluoxixi', 'trellis'])

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
