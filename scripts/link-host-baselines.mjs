#!/usr/bin/env node
import os from 'node:os';
import path from 'node:path';
import { mkdirSync, rmSync, symlinkSync } from 'node:fs';

function printHelp() {
  console.log(`Usage: node scripts/link-host-baselines.mjs [--home <dir>] [--host <name>]

Create a host baseline file symlink from a single source file:
  <home>/AGENTS.md

Hosts:
  claude     -> ~/.claude/CLAUDE.md
  codex      -> ~/.codex/AGENTS.md
  qoder      -> ~/.qoder/AGENTS.md
  tare       -> ~/.tare/AGENTS.md
  opencode   -> ~/.config/opencode/AGENTS.md
  all        -> all hosts (default)
`);
}

function parseArgs(argv) {
  const args = {
    home: path.join(os.homedir(), '.moluoxixi'),
    host: 'all',
    help: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--help') {
      args.help = true;
    } else if (arg === '--home') {
      args.home = argv[index + 1];
      index += 1;
    } else if (arg === '--host') {
      args.host = argv[index + 1];
      index += 1;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return args;
}

function getTargets(userHome) {
  return {
    claude: path.join(userHome, '.claude', 'CLAUDE.md'),
    codex: path.join(userHome, '.codex', 'AGENTS.md'),
    qoder: path.join(userHome, '.qoder', 'AGENTS.md'),
    tare: path.join(userHome, '.tare', 'AGENTS.md'),
    opencode: path.join(userHome, '.config', 'opencode', 'AGENTS.md')
  };
}

function linkFile(source, target) {
  mkdirSync(path.dirname(target), { recursive: true });
  rmSync(target, { recursive: true, force: true });
  symlinkSync(source, target, 'file');
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  const source = path.join(path.resolve(args.home), 'AGENTS.md');
  const userHome = path.dirname(path.resolve(args.home));
  const targets = getTargets(userHome);
  const selectedHosts = args.host === 'all' ? Object.keys(targets) : [args.host];

  for (const host of selectedHosts) {
    if (!(host in targets)) {
      throw new Error(`Unknown host: ${host}`);
    }

    linkFile(source, targets[host]);
    console.log(`[link] ${targets[host]} -> ${source}`);
  }
}

main();
