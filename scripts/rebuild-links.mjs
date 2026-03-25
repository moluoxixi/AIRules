#!/usr/bin/env node
import { mkdirSync, existsSync, rmSync, symlinkSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { buildLinkPlan } from './lib/links.mjs';
import { loadVendorManifest } from './lib/vendors.mjs';

function printHelp() {
  console.log(`Usage: node scripts/rebuild-links.mjs [--home <dir>] [--manifest <file>]

Rebuild the aggregated skill links under ~/.moluoxixi based on manifests/vendors.json.

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

function linkTypeForCurrentPlatform() {
  return process.platform === 'win32' ? 'junction' : 'dir';
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  const manifest = loadVendorManifest(args.manifest);
  const plan = buildLinkPlan(manifest, args.home);

  for (const entry of plan) {
    if (!existsSync(entry.source)) {
      console.warn(`[skip] missing source: ${entry.source}`);
      continue;
    }

    mkdirSync(path.dirname(entry.target), { recursive: true });
    rmSync(entry.target, { recursive: true, force: true });
    symlinkSync(entry.source, entry.target, linkTypeForCurrentPlatform());
    console.log(`[link] ${entry.target} -> ${entry.source}`);
  }
}

main();
