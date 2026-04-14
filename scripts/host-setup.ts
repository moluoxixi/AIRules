#!/usr/bin/env npx tsx
import os from 'node:os';
import path from 'node:path';

import { loadVendorManifest } from './lib/vendors.js';
import { ensureVendorRepo } from './lib/vendor-sync.js';
import {
  ensureInstallRoot,
  ensureGlobalSkillLink,
  getDefaultInstallPaths,
  linkHostBaseline,
  projectToHost,
  rebuildVendorSkillLinks,
  syncFirstPartyToHome,
  type InstallPaths
} from './lib/install.js';

interface Args {
  host: string;
  mode: string;
  home: string;
  skipVendors: boolean;
  help: boolean;
}

function printHelp() {
  console.log(`Usage: npx tsx scripts/host-setup.ts --host <name> --mode <install|upgrade> [--home <dir>] [--skip-vendors]

Hosts:
  claude
  codex
  cursor
  qoder
  tare
  opencode

Examples:
  npx tsx scripts/host-setup.ts --host claude --mode install
  npx tsx scripts/host-setup.ts --host codex --mode upgrade --home ~/.moluoxixi
`);
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
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

function assertRequiredArgs(args: Args) {
  if (!args.host) {
    throw new Error('Missing required --host argument');
  }

  if (!args.mode || !['install', 'upgrade'].includes(args.mode)) {
    throw new Error('Missing or invalid --mode argument (expected install or upgrade)');
  }
}

async function syncVendorsIfNeeded(homeDir: string, repoRoot: string, skipVendors: boolean) {
  if (skipVendors) {
    return;
  }

  const manifest = await loadVendorManifest(path.join(repoRoot, 'constants', 'skills.js'));
  for (const vendor of Object.values(manifest.vendors ?? {})) {
    ensureVendorRepo(homeDir, vendor);
  }
}

function projectHost(args: Args, paths: InstallPaths) {
  const hostConfig: Record<string, { hostHome: string, hostBaselineFile: string, customSkillsDirName?: string }> = {
    claude: { hostHome: paths.claudeHome, hostBaselineFile: paths.claudeBaselineFile },
    cursor: { hostHome: paths.cursorHome, hostBaselineFile: paths.cursorBaselineFile, customSkillsDirName: 'cursor-skills' },
    codex: { hostHome: paths.codexHome, hostBaselineFile: paths.codexBaselineFile },
    qoder: { hostHome: paths.qoderHome, hostBaselineFile: paths.qoderBaselineFile },
    tare: { hostHome: paths.tareHome, hostBaselineFile: paths.tareBaselineFile },
    opencode: { hostHome: paths.opencodeHome, hostBaselineFile: paths.opencodeBaselineFile }
  };

  const config = hostConfig[args.host];
  if (!config) {
    throw new Error(`Unknown host: ${args.host}`);
  }

  projectToHost({
    userHome: paths.userHome,
    moluoHome: paths.moluoHome,
    hostHome: config.hostHome,
    hostBaselineFile: config.hostBaselineFile,
    customSkillsDirName: config.customSkillsDirName
  });
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
  paths.repoRoot = repoRoot;

  ensureInstallRoot(paths);
  ensureGlobalSkillLink(paths);
  syncFirstPartyToHome(repoRoot, paths.moluoHome);
  await syncVendorsIfNeeded(paths.moluoHome, repoRoot, args.skipVendors);
  await rebuildVendorSkillLinks({
    homeDir: paths.moluoHome,
    repoRoot,
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
