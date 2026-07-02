#!/usr/bin/env npx tsx
import os from 'node:os'
import path from 'node:path'

import kleur from 'kleur'
import { ALL_HOST_IDS, HOST_IDS } from '../constants/hosts.js'
import {
  ensureGlobalSkillLink,
  ensureInstallRoot,
  getDefaultInstallPaths,
  linkHostBaseline,
  projectHostById,
  rebuildVendorSkillLinks,
  runSkillSetupCommands,
  syncFirstPartySkillsToVendor,
  syncFirstPartyToHome,
} from './lib/install.js'
import { ensureVendorRepo } from './lib/vendor-sync.js'
import { loadVendorManifest } from './lib/vendors.js'
import { verifyHost } from './lib/verify.js'

interface Args {
  host: string
  mode: string
  home: string
  userHome?: string
  skipVendors: boolean
  help: boolean
}

function printHelp() {
  const hostsLine = HOST_IDS.join('\n  ')
  console.log(`Usage: npx tsx scripts/host-setup.ts --host <name|all> [--mode <install|upgrade>] [--home <dir>] [--user-home <dir>] [--skip-vendors]

Hosts:
  all (安装到所有支持的代理)
  ${hostsLine}
`)
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    host: '',
    mode: 'install', // 默认安装
    home: path.join(os.homedir(), '.moluoxixi'),
    skipVendors: false,
    help: false,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--help') {
      args.help = true
    }
    else if (arg === '--host') {
      args.host = argv[index + 1]
      index += 1
    }
    else if (arg === '--mode') {
      args.mode = argv[index + 1]
      index += 1
    }
    else if (arg === '--home') {
      args.home = argv[index + 1]
      index += 1
    }
    else if (arg === '--user-home') {
      args.userHome = argv[index + 1]
      index += 1
    }
    else if (arg === '--skip-vendors') {
      args.skipVendors = true
    }
    else {
      throw new Error(`Unknown argument: ${arg}`)
    }
  }

  return args
}

function assertRequiredArgs(args: Args) {
  if (!args.host) {
    throw new Error('Missing required --host argument')
  }

  if (!args.mode || !['install', 'upgrade'].includes(args.mode)) {
    throw new Error('Missing or invalid --mode argument (expected install or upgrade)')
  }
}

async function syncVendorsIfNeeded(homeDir: string, repoRoot: string, skipVendors: boolean) {
  if (skipVendors) {
    return
  }

  const manifest = await loadVendorManifest(path.join(repoRoot, 'constants', 'skills.js'))
  for (const vendor of Object.values(manifest.vendors ?? {})) {
    ensureVendorRepo(homeDir, vendor)
  }

  // 执行各 skill 的安装前置命令
  runSkillSetupCommands(manifest)
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (args.help) {
    printHelp()
    return
  }

  assertRequiredArgs(args)

  const repoRoot = process.cwd()
  const userHome = path.resolve(args.userHome ?? os.homedir())
  const paths = getDefaultInstallPaths(userHome)
  paths.moluoHome = path.resolve(args.home)
  paths.repoRoot = repoRoot

  ensureInstallRoot(paths)
  syncFirstPartyToHome(repoRoot, paths.moluoHome)
  await syncVendorsIfNeeded(paths.moluoHome, repoRoot, args.skipVendors)
  await rebuildVendorSkillLinks({
    homeDir: paths.moluoHome,
    manifestPath: path.join(repoRoot, 'constants', 'skills.js'),
  })
  // 第一方 skills 链路恒为 <repoRoot>/skills/* → <moluoHome>/vendor/skills/*，
  // 源与目标永不相同；即使 repoRoot === moluoHome（仓库装进 ~/.moluoxixi）也必须投影，
  // 否则第一方 skills 会被整体漏发。
  syncFirstPartySkillsToVendor(repoRoot, paths.moluoHome)
  syncFirstPartySkillsToVendor(path.join(paths.moluoHome, 'local'), paths.moluoHome)
  ensureGlobalSkillLink(paths)

  const targets = args.host === 'all' ? ALL_HOST_IDS : [args.host]
  const failedHosts: string[] = []
  const installErrors: string[] = []

  for (const host of targets) {
    try {
      const { success, baselineProjected } = projectHostById(host, userHome, paths.moluoHome)
      if (success) {
        const baselineTarget = baselineProjected
          ? linkHostBaseline({
              moluoHome: paths.moluoHome,
              host,
              userHome,
            })
          : undefined

        console.log(`[host] ${host} - 配置完成`)
        if (baselineTarget) {
          console.log(`[baseline] ${baselineTarget}`)
        }

        // 自动执行校验逻辑
        const verified = await verifyHost(host, paths.moluoHome, userHome)
        if (!verified) {
          failedHosts.push(host)
        }
      }
    }
    catch (error) {
      installErrors.push(host)
      console.error(`[error] ${host} 安装过程中发生异常:`)
      console.error(String(error))
    }
  }

  const allFailures = [...installErrors, ...failedHosts]
  const allPassed = allFailures.length === 0

  if (allPassed) {
    console.log(`\n${kleur.green('✅ 所有宿主验证通过，安装/更新流程已完成。')}`)
  }
  else {
    console.error(`\n${kleur.red('❌ 以下宿主未通过验证，请检查上述错误信息：')}`)
    for (const host of installErrors) {
      console.error(`  ${kleur.red(`• ${host} — 安装异常`)}`)
    }
    for (const host of failedHosts) {
      console.error(`  ${kleur.red(`• ${host} — 验证失败`)}`)
    }
    process.exitCode = 1
  }

  console.log(`[home] ${paths.moluoHome}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
