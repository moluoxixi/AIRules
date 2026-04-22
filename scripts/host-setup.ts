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
  projectHostById,
  rebuildVendorSkillLinks,
  runSkillSetupCommands,
  syncFirstPartyToHome,
  type InstallPaths
} from './lib/install.js';
import { verifyHost } from './lib/verify.js';
import { ALL_HOST_IDS } from '../constants/hosts.js';

interface Args {
  host: string;
  mode: string;
  home: string;
  skipVendors: boolean;
  help: boolean;
}

function printHelp() {
  const hostsLine = ALL_HOST_IDS.join('\n  ');
  console.log(`Usage: npx tsx scripts/host-setup.ts --host <name|all> [--mode <install|uninstall>] [--home <dir>] [--skip-vendors]

Hosts:
  all (安装到所有支持的代理)
  ${hostsLine}
`);
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    host: '',
    mode: 'install', // 默认安装
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

  // 执行各 skill 的安装前置命令
  runSkillSetupCommands(manifest);
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
    manifestPath: path.join(repoRoot, 'constants', 'skills.js')
  });

  const targets = args.host === 'all' ? ALL_HOST_IDS : [args.host];

  for (const host of targets) {
    try {
      const { success } = projectHostById(host, userHome, paths.moluoHome);
      if (success) {
        const baselineTarget = linkHostBaseline({
          moluoHome: paths.moluoHome,
          host: host,
          userHome
        });

        console.log(`[host] ${host} - 配置完成`);
        if (baselineTarget) {
          console.log(`[baseline] ${baselineTarget}`);
        }

        // 自动执行校验逻辑
        const verified = await verifyHost(host, paths.moluoHome);
        if (!verified) {
          console.error(`[error] ${host} 验证未通过，请检查上述错误信息。`);
          process.exitCode = 1; // 标记失败但继续下一个宿主
        }
      }
    } catch (error: any) {
      console.error(`[error] ${host} 安装过程中发生异常:`);
      console.error(error?.message || error);
      process.exitCode = 1;
    }
  }

  console.log(`\n[success] 安装/更新流程已完成。`);
  console.log(`[home] ${paths.moluoHome}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
