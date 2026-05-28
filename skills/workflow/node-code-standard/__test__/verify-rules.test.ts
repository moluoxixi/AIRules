import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { it } from 'vitest'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const skillRoot = path.resolve(__dirname, '..')
const projectRoot = path.resolve(skillRoot, '..', '..', '..')
const scriptPath = path.join(skillRoot, 'scripts', 'verify-rules.mjs')

function runScript(...args: string[]) {
  return execFileSync(process.execPath, [scriptPath, ...args], {
    cwd: projectRoot,
    encoding: 'utf8',
  })
}

it('verify-rules 校验自检和领域提升扫描', () => {
  assert.match(runScript(), /PASS node-code-standard self rules are valid/)
  assert.match(
    runScript(
      'hoist',
      '--target',
      'src/modules/orders/utils',
      '--uses',
      'src/modules/orders/create/service.ts',
      'src/modules/orders/update/service.ts',
      'src/modules/orders/delete/service.ts',
    ),
    /PASS backend hoist domain-boundary scan completed/,
  )

  const nestedHoistResult = spawnSync(process.execPath, [
    scriptPath,
    'hoist',
    '--target',
    'src/modules/orders/create/utils',
    '--uses',
    'src/modules/orders/create/service.ts',
    'src/modules/orders/update/service.ts',
    'src/modules/orders/delete/service.ts',
  ], { cwd: projectRoot, encoding: 'utf8' })
  assert.equal(nestedHoistResult.status, 1)
  assert.match(nestedHoistResult.stderr, /FAIL \[HOIST_BOUNDARY_RISK\]/)
  assert.doesNotMatch(nestedHoistResult.stdout, /PASS backend hoist domain-boundary scan completed/)
})
