import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { it } from 'vitest'
import { roleInstallScenarios, runRoleInstallScenario } from './fixtures/role-install.mjs'

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const builtCli = path.join(packageRoot, 'dist', 'scripts', 'cli.js')

for (const [name, scenario] of roleInstallScenarios) {
  it.skipIf(!fs.existsSync(builtCli))(name, async () => {
    await runRoleInstallScenario(packageRoot, scenario)
  }, 90_000)
}
