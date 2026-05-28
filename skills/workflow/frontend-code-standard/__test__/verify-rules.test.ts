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
  const privateComponentRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'airules-component-private-'))
  const missingReadmeComponentRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'airules-component-missing-readme-'))
  const missingTypesComponentRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'airules-component-missing-types-'))
  const missingTypeExportComponentRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'airules-component-missing-type-export-'))
  const wildcardComponentRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'airules-component-wildcard-'))
  const leafComponentRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'airules-leaf-component-'))
  const brokenLeafComponentRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'airules-leaf-component-broken-'))
  const moduleRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'airules-module-'))
  const brokenModuleRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'airules-module-broken-'))
  const nestedSrcModuleRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'airules-module-nested-src-'))
  const utilityRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'airules-utility-'))
  const brokenUtilityRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'airules-utility-broken-'))

  writeFile(componentRoot, 'README.md', '# DataTable\n\n## Usage\n\nProps and Events are documented here.\n')
  writeFile(componentRoot, 'index.ts', 'export { DataTable } from \'./src\'\nexport type * from \'./src/types\'\n')
  writeFile(componentRoot, 'src/index.tsx', 'export function DataTable() { return null }\n')
  writeFile(componentRoot, 'src/types/index.ts', 'export type * from \'./props\'\n')
  writeFile(componentRoot, 'src/types/props.ts', 'export interface DataTableProps {}\n')
  writeFile(componentRoot, 'src/utils/index.ts', 'export { formatColumn } from \'./format-column\'\n')
  writeFile(componentRoot, 'src/utils/format-column.ts', 'export function formatColumn() {}\n')

  writeFile(privateComponentRoot, 'index.ts', 'export { AuditDialog } from \'./src\'\nexport type * from \'./src/types\'\n')
  writeFile(privateComponentRoot, 'src/index.vue', '<template />\n')
  writeFile(privateComponentRoot, 'src/types/index.ts', 'export interface AuditDialogContract {}\n')

  writeFile(missingReadmeComponentRoot, 'index.ts', 'export { DataTable } from \'./src\'\n')
  writeFile(missingReadmeComponentRoot, 'src/index.tsx', 'export function DataTable() { return null }\n')

  writeFile(missingTypesComponentRoot, 'README.md', '# DataTable\n\n## Usage\n\nProps and Events are documented here.\n')
  writeFile(missingTypesComponentRoot, 'index.ts', 'export { DataTable } from \'./src\'\n')
  writeFile(missingTypesComponentRoot, 'src/index.tsx', 'export function DataTable() { return null }\n')

  writeFile(missingTypeExportComponentRoot, 'README.md', '# DataTable\n\n## Usage\n\nProps and Events are documented here.\n')
  writeFile(missingTypeExportComponentRoot, 'index.ts', 'export { DataTable } from \'./src\'\n')
  writeFile(missingTypeExportComponentRoot, 'src/index.tsx', 'export function DataTable() { return null }\n')
  writeFile(missingTypeExportComponentRoot, 'src/types/index.ts', 'export interface DataTableProps {}\n')

  writeFile(wildcardComponentRoot, 'README.md', '# DataTable\n\n## Usage\n\nProps and Events are documented here.\n')
  writeFile(wildcardComponentRoot, 'index.ts', 'export * from \'./src\'\n')
  writeFile(wildcardComponentRoot, 'src/index.vue', '<template />\n')

  writeFile(leafComponentRoot, 'StatusDot.vue', '<template />\n')
  writeFile(brokenLeafComponentRoot, 'UserPicker.vue', '<template />\n')
  writeFile(brokenLeafComponentRoot, 'types/props.ts', 'export interface UserPickerProps {}\n')

  writeFile(moduleRoot, 'index.vue', '<template />\n')
  writeFile(moduleRoot, 'api/index.ts', 'export { getPurchaseOrder } from \'./purchase-order-api\'\n')
  writeFile(moduleRoot, 'api/purchase-order-api.ts', 'export function getPurchaseOrder() {}\n')
  writeFile(moduleRoot, 'styles/index.scss', '.purchase-order {}\n')

  writeFile(brokenModuleRoot, 'index.vue', '<template />\n')
  writeFile(brokenModuleRoot, 'api/purchase-order-api.ts', 'export function getPurchaseOrder() {}\n')

  writeFile(nestedSrcModuleRoot, 'index.vue', '<template />\n')
  writeFile(nestedSrcModuleRoot, 'src/index.ts', 'export const internal = true\n')

  writeFile(utilityRoot, 'README.md', '# Formatters\n\n## Usage\n\nAPI docs.\n')
  writeFile(utilityRoot, 'package.json', '{ "name": "@demo/formatters", "sideEffects": false, "peerDependencies": { "vue": "^3.0.0" } }\n')
  writeFile(utilityRoot, 'index.ts', 'export { formatCurrency } from \'./src\'\n')
  writeFile(utilityRoot, 'src/index.ts', 'export { formatCurrency } from \'./format-currency\'\n')
  writeFile(utilityRoot, 'src/format-currency.ts', 'export function formatCurrency() { return \'\' }\n')

  writeFile(brokenUtilityRoot, 'README.md', '# Formatters\n\n## Usage\n\nAPI docs.\n')
  writeFile(brokenUtilityRoot, 'package.json', '{ "name": "@demo/formatters", "sideEffects": true }\n')
  writeFile(brokenUtilityRoot, 'index.ts', 'export { formatCurrency } from \'./src\'\n')
  writeFile(brokenUtilityRoot, 'src/index.ts', 'export { formatCurrency } from \'./format-currency\'\n')
  writeFile(brokenUtilityRoot, 'src/format-currency.ts', 'export function formatCurrency() { return \'\' }\n')

  assert.match(runScript(), /PASS frontend-code-standard self rules are valid/)
  assert.match(runScript('component', '--root', componentRoot), /PASS frontend complex component package structure is valid/)
  assert.match(runScript('component', '--root', privateComponentRoot, '--private'), /PASS frontend private complex component package structure is valid/)
  assert.match(runScript('leaf', '--root', path.join(leafComponentRoot, 'StatusDot.vue')), /PASS frontend private leaf component exception is valid/)
  assert.match(runScript('module', '--root', moduleRoot), /PASS frontend module structure is valid/)
  assert.match(runScript('utility', '--root', utilityRoot), /PASS frontend utility library structure is valid/)

  const missingReadmeResult = spawnSync(process.execPath, [
    scriptPath,
    'component',
    '--root',
    missingReadmeComponentRoot,
  ], { cwd: projectRoot, encoding: 'utf8' })
  assert.notEqual(missingReadmeResult.status, 0)
  assert.match(missingReadmeResult.stderr, /独立公共组件包根目录缺少 README\.md/)

  const missingTypesResult = spawnSync(process.execPath, [
    scriptPath,
    'component',
    '--root',
    missingTypesComponentRoot,
  ], { cwd: projectRoot, encoding: 'utf8' })
  assert.notEqual(missingTypesResult.status, 0)
  assert.match(missingTypesResult.stderr, /组件包缺少 src\/types\/ 类型契约目录/)

  const missingTypeExportResult = spawnSync(process.execPath, [
    scriptPath,
    'component',
    '--root',
    missingTypeExportComponentRoot,
  ], { cwd: projectRoot, encoding: 'utf8' })
  assert.notEqual(missingTypeExportResult.status, 0)
  assert.match(missingTypeExportResult.stderr, /根目录 index\.ts 必须通过 export type/)

  const wildcardResult = spawnSync(process.execPath, [
    scriptPath,
    'component',
    '--root',
    wildcardComponentRoot,
  ], { cwd: projectRoot, encoding: 'utf8' })
  assert.notEqual(wildcardResult.status, 0)
  assert.match(wildcardResult.stderr, /严禁使用 value wildcard export/)

  const brokenLeafResult = spawnSync(process.execPath, [
    scriptPath,
    'leaf',
    '--root',
    path.join(brokenLeafComponentRoot, 'UserPicker.vue'),
  ], { cwd: projectRoot, encoding: 'utf8' })
  assert.notEqual(brokenLeafResult.status, 0)
  assert.match(brokenLeafResult.stderr, /必须升级为 component-package/)

  const brokenModuleResult = spawnSync(process.execPath, [
    scriptPath,
    'module',
    '--root',
    brokenModuleRoot,
  ], { cwd: projectRoot, encoding: 'utf8' })
  assert.notEqual(brokenModuleResult.status, 0)
  assert.match(brokenModuleResult.stderr, /目录 api\/ 聚合入口 缺少唯一入口：index\.ts/)

  const nestedSrcModuleResult = spawnSync(process.execPath, [
    scriptPath,
    'module',
    '--root',
    nestedSrcModuleRoot,
  ], { cwd: projectRoot, encoding: 'utf8' })
  assert.notEqual(nestedSrcModuleResult.status, 0)
  assert.match(nestedSrcModuleResult.stderr, /单个模块不得再嵌套 src\/ 目录/)

  const brokenUtilityResult = spawnSync(process.execPath, [
    scriptPath,
    'utility',
    '--root',
    brokenUtilityRoot,
  ], { cwd: projectRoot, encoding: 'utf8' })
  assert.notEqual(brokenUtilityResult.status, 0)
  assert.match(brokenUtilityResult.stderr, /工具库 package\.json 必须声明 "sideEffects": false/)

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
