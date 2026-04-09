#!/usr/bin/env node
import os from 'node:os';
import path from 'node:path';

import { rebuildVendorSkillLinks } from './lib/install.mjs';

const DEFAULT_MANIFEST_PATH = path.resolve('constants/skills.js');

function printHelp() {
  console.log(`Usage: node scripts/rebuild-links.mjs [--home <dir>] [--manifest <file>]

Rebuild the aggregated skill links under ~/.moluoxixi based on constants/skills.js.

Options:
  --home <dir>       Override the target ~/.moluoxixi root
  --manifest <file>  Override the vendor manifest path
  --help             Show this help text
`);
}

function parseArgs(argv) {
  const args = {
    home: path.join(os.homedir(), '.moluoxixi'),
    manifest: DEFAULT_MANIFEST_PATH,
    help: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--help') {
      args.help = true;
    } else if (arg === '--home') {
      args.home = argv[index + 1];
      index += 1;
    } else if (arg === '--manifest') {
      args.manifest = argv[index + 1];
      index += 1;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  const plan = await rebuildVendorSkillLinks({
    homeDir: args.home,
    manifestPath: args.manifest
  });

  for (const entry of plan) {
    console.log(`[vendor] ${entry.target} -> ${entry.source}`);
  }

  console.log(`[projection] ${path.join(args.home, 'skills')} <= ${path.join(args.home, 'vendor', 'skills')}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
