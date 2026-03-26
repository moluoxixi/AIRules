#!/usr/bin/env node
import { mkdirSync, existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { loadVendorManifest } from './lib/vendors.mjs';
import { ensureVendorRepo } from './lib/vendor-sync.mjs';

function printHelp() {
  console.log(`Usage: node scripts/sync-vendors.mjs [--home <dir>] [--manifest <file>]

Clone or update all vendor repositories declared in manifests/vendors.json.

Options:
  --home <dir>       Override the target ~/.moluoxixi root
  --manifest <file>  Override the vendor manifest path
  --help             Show this help text
`);
}

function parseArgs(argv) {
  const args = {
    home: path.join(os.homedir(), '.moluoxixi'),
    manifest: path.resolve('manifests/vendors.json'),
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

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  const manifest = loadVendorManifest(args.manifest);
  mkdirSync(args.home, { recursive: true });

  for (const vendor of Object.values(manifest.vendors ?? {})) {
    ensureVendorRepo(args.home, vendor);
  }
}

main();
