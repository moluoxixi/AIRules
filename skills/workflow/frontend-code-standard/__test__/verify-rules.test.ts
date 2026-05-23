import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
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

function writeFile(root: string, relativePath: string, content: string) {
  const target = path.join(root, relativePath)
  fs.mkdirSync(path.dirname(target), { recursive: true })
  fs.writeFileSync(target, content)
}

it('verify-rules 校验组件、模块和共享边界', () => {
  const componentRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'airules-component-'))
  const duplicateComponentRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'airules-component-dupe-'))
  const moduleRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'airules-module-'))
  const brokenModuleRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'airules-module-broken-'))

  writeFile(componentRoot, 'README.md', '# DataTable\n\n## Usage\n\nProps and Events are documented here.\n')
  writeFile(componentRoot, 'index.ts', 'export * from \'./src\'\n')
  writeFile(componentRoot, 'src/index.tsx', 'export function DataTable() { return null }\n')
  writeFile(componentRoot, 'src/utils/index.ts', 'export * from \'./format-column\'\n')
  writeFile(componentRoot, 'src/utils/format-column.ts', 'export function formatColumn() {}\n')

  writeFile(duplicateComponentRoot, 'README.md', '# DataTable\n\n## Usage\n\nProps and Events are documented here.\n')
  writeFile(duplicateComponentRoot, 'index.ts', 'export * from \'./src\'\n')
  writeFile(duplicateComponentRoot, 'index.js', 'export * from \'./src/index.js\'\n')
  writeFile(duplicateComponentRoot, 'src/index.vue', '<template />\n')

  writeFile(moduleRoot, 'index.vue', '<template />\n')
  writeFile(moduleRoot, 'api/index.ts', 'export * from \'./purchase-order-api\'\n')
  writeFile(moduleRoot, 'api/purchase-order-api.ts', 'export function getPurchaseOrder() {}\n')
  writeFile(moduleRoot, 'styles/index.scss', '.purchase-order {}\n')

  writeFile(brokenModuleRoot, 'index.vue', '<template />\n')
  writeFile(brokenModuleRoot, 'api/purchase-order-api.ts', 'export function getPurchaseOrder() {}\n')

  assert.match(runScript(), /PASS frontend-code-standard self rules are valid/)
  assert.match(runScript('component', '--root', componentRoot), /PASS frontend complex component package structure is valid/)
  assert.match(runScript('module', '--root', moduleRoot), /PASS frontend module structure is valid/)

  const duplicateResult = spawnSync(process.execPath, [
    scriptPath,
    'component',
    '--root',
    duplicateComponentRoot,
  ], { cwd: projectRoot, encoding: 'utf8' })
  assert.notEqual(duplicateResult.status, 0)
  assert.match(duplicateResult.stderr, /复杂组件包根目录公共入口 只能存在一个入口：index\.ts、index\.js/)

  const brokenModuleResult = spawnSync(process.execPath, [
    scriptPath,
    'module',
    '--root',
    brokenModuleRoot,
  ], { cwd: projectRoot, encoding: 'utf8' })
  assert.notEqual(brokenModuleResult.status, 0)
  assert.match(brokenModuleResult.stderr, /目录 api\/ 聚合入口 缺少唯一入口：index\.ts、index\.js/)

  assert.match(
    runScript(
      'hoist',
      '--target',
      'src/views/purchase-order/utils',
      '--uses',
      'src/views/purchase-order/create/index.tsx',
      'src/views/purchase-order/update/index.tsx',
      'src/views/purchase-order/detail/index.tsx',
    ),
    /PASS frontend hoist target stays within shared boundary/,
  )
  assert.match(
    runScript(
      'hoist',
      '--target',
      'src/views/purchase-order/utils',
      '--uses',
      'src/views/purchase-order/create/index.tsx',
      'src/views/purchase-order/update/index.tsx',
      '--stable-two-use',
    ),
    /PASS frontend hoist target stays within shared boundary/,
  )

  const prematureTwoUseHoistResult = spawnSync(process.execPath, [
    scriptPath,
    'hoist',
    '--target',
    'src/views/purchase-order/utils',
    '--uses',
    'src/views/purchase-order/create/index.tsx',
    'src/views/purchase-order/update/index.tsx',
  ], { cwd: projectRoot, encoding: 'utf8' })
  assert.notEqual(prematureTwoUseHoistResult.status, 0)
  assert.match(prematureTwoUseHoistResult.stderr, /至少需要 3 个明确使用点/)
  assert.match(prematureTwoUseHoistResult.stderr, /--stable-two-use/)

  const nestedHoistResult = spawnSync(process.execPath, [
    scriptPath,
    'hoist',
    '--target',
    'src/views/purchase-order/create/utils',
    '--uses',
    'src/views/purchase-order/create/index.tsx',
    'src/views/purchase-order/update/index.tsx',
    'src/views/purchase-order/detail/index.tsx',
  ], { cwd: projectRoot, encoding: 'utf8' })
  assert.notEqual(nestedHoistResult.status, 0)
  assert.match(nestedHoistResult.stderr, /抽离目标必须位于允许的共享边界目录/)
})
