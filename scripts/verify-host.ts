#!/usr/bin/env npx tsx
import os from 'node:os';
import path from 'node:path';
import { parseArgs as nodeParseArgs } from 'node:util';
import { verifyHost } from './lib/verify.js';

const ALL_HOSTS = ['claude', 'codex', 'cursor', 'qoder', 'tare', 'opencode'];

async function main() {
  const result = nodeParseArgs({
    options: {
      host: { type: 'string' },
      home: { type: 'string' },
    },
    strict: false,
  });

  const { values } = result;
  const host = values.host;
  const moluoHome = values.home ? path.resolve(values.home) : path.join(os.homedir(), '.moluoxixi');

  if (!host || (host !== 'all' && !ALL_HOSTS.includes(host))) {
    console.error(`Usage: npx tsx scripts/verify-host.ts --host <name|all> [--home <dir>]`);
    process.exit(1);
  }

  const targets = host === 'all' ? ALL_HOSTS : [host];
  let allPerfect = true;

  for (const targetHost of targets) {
    const success = await verifyHost(targetHost, moluoHome);
    if (!success) allPerfect = false;
  }

  if (allPerfect) {
    console.log('\n✅ [SUCCESS] 所有的验证检查均通过！所有链接均正确且有效。');
  } else {
    console.log('\n❌ [FAILURE] 部分验证检查未通过，请检查上述错误信息。');
    process.exit(1);
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
