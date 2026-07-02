#!/usr/bin/env npx tsx
import os from 'node:os'
import path from 'node:path'
import { parseArgs as nodeParseArgs } from 'node:util'
import { ALL_HOST_IDS, HOST_IDS } from '../constants/hosts.js'
import { verifyHost } from './lib/verify.js'

async function main() {
  const result = nodeParseArgs({
    options: {
      'host': { type: 'string' },
      'home': { type: 'string' },
      'user-home': { type: 'string' },
    },
    strict: false,
  })

  const { values } = result
  const { host, home } = values as { host?: string, home?: string }
  const moluoHome = home ? path.resolve(home) : path.join(os.homedir(), '.moluoxixi')
  const userHome = values['user-home'] === undefined ? os.homedir() : path.resolve(String(values['user-home']))

  if (!host || (host !== 'all' && !HOST_IDS.includes(host))) {
    console.error(`Usage: npx tsx scripts/verify-host.ts --host <name|all> [--home <dir>] [--user-home <dir>]`)
    process.exit(1)
  }

  const targets = host === 'all' ? ALL_HOST_IDS : [host]
  let allPerfect = true

  for (const targetHost of targets) {
    const success = await verifyHost(targetHost, moluoHome, userHome)
    if (!success)
      allPerfect = false
  }

  if (allPerfect) {
    console.log('\n✅ [SUCCESS] 所有的验证检查均通过！所有链接均正确且有效。')
  }
  else {
    console.log('\n❌ [FAILURE] 部分验证检查未通过，请检查上述错误信息。')
    process.exit(1)
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
