#!/usr/bin/env node
import os from 'node:os';
import path from 'node:path';

import { loadVendorManifest } from './lib/vendors.mjs';
import { ensureVendorRepo } from './lib/vendor-sync.mjs';
import {
  ensureInstallRoot,
  getDefaultInstallPaths,
  linkHostBaseline,
  projectToClaude,
  projectToCodex,
  projectToOpenCode,
  projectToQoder,
  projectToTare,
  rebuildVendorSkillLinks,
  syncFirstPartyToHome
} from './lib/install.mjs';

function printHelp() {
  console.log(`Usage: node scripts/host-setup.mjs --host <name> --mode <install|upgrade> [--home <dir>] [--skip-vendors]

Hosts:
  claude
  codex
  qoder
  tare
  opencode

Examples:
  node scripts/host-setup.mjs --host claude --mode install
  node scripts/host-setup.mjs --host codex --mode upgrade --home ~/.moluoxixi
`);
}

function parseArgs(argv) {
  const args = {
    host: '',
    mode: '',
    home: path.join(os.homedir(), '.moluoxixi'),
    skipVendors: false,
    help: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--help') {
      args.help = true;
    } else if (arg === '--host') {
      args.host = argv[index + 1];
      index += 1;
    } else if (arg === '--mode') {
      args.mode = argv[index + 1];
      index += 1;
    } else if (arg === '--home') {
      args.home = argv[index + 1];
      index += 1;
    } else if (arg === '--skip-vendors') {
      args.skipVendors = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return args;
}

function assertRequiredArgs(args) {
  if (!args.host) {
    throw new Error('Missing required --host argument');
  }

  if (!args.mode || !['install', 'upgrade'].includes(args.mode)) {
    throw new Error('Missing or invalid --mode argument (expected install or upgrade)');
  }
}

function syncVendorsIfNeeded(homeDir, repoRoot, skipVendors) {
  if (skipVendors) {
    return;
  }

  return loadVendorManifest(path.join(repoRoot, 'constants', 'skills.js')).then((manifest) => {
    for (const vendor of Object.values(manifest.vendors ?? {})) {
      ensureVendorRepo(homeDir, vendor);
    }
  });
}

function projectHost(args, paths) {
  switch (args.host) {
    case 'claude':
      projectToClaude({ moluoHome: paths.moluoHome, claudeHome: paths.claudeHome, userHome: paths.userHome });
      break;
    case 'codex':
      projectToCodex({
        moluoHome: paths.moluoHome,
        codexHome: paths.codexHome,
        userHome: paths.userHome
      });
      break;
    case 'qoder':
      projectToQoder({ moluoHome: paths.moluoHome, qoderHome: paths.qoderHome, userHome: paths.userHome });
      break;
    case 'tare':
      projectToTare({
        moluoHome: paths.moluoHome,
        tareHome: paths.tareHome,
        userHome: paths.userHome
      });
      break;
    case 'opencode':
      projectToOpenCode({
        moluoHome: paths.moluoHome,
        opencodeHome: paths.opencodeHome,
        userHome: paths.userHome
      });
      break;
    default:
      throw new Error(`Unknown host: ${args.host}`);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  assertRequiredArgs(args);

  const repoRoot = process.cwd();
  const userHome = path.dirname(path.resolve(args.home));
  const paths = getDefaultInstallPaths(userHome);
  paths.moluoHome = path.resolve(args.home);
  paths.repoRoot = paths.moluoHome;

  ensureInstallRoot(paths);
  syncFirstPartyToHome(repoRoot, paths.moluoHome);
  await syncVendorsIfNeeded(paths.moluoHome, repoRoot, args.skipVendors);
  await rebuildVendorSkillLinks({
    homeDir: paths.moluoHome,
    manifestPath: path.join(repoRoot, 'constants', 'skills.js')
  });

  projectHost(args, paths);
  const baselineTarget = linkHostBaseline({
    moluoHome: paths.moluoHome,
    host: args.host,
    userHome
  });

  console.log(`[host] ${args.host}`);
  console.log(`[mode] ${args.mode}`);
  console.log(`[home] ${paths.moluoHome}`);
  console.log(`[baseline] ${baselineTarget}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
