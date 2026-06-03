#!/usr/bin/env node
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import kleur from 'kleur'
import {
  addLocalSkill,
  getDefaultMoluoHome,
  syncToHosts,
  verifyHosts,
} from './lib/tool.js'

function findPackageRoot(fromFileUrl: string): string {
  let currentDir = path.dirname(fileURLToPath(fromFileUrl))

  while (!existsSync(path.join(currentDir, 'package.json'))) {
    const parentDir = path.dirname(currentDir)
    if (parentDir === currentDir) {
      throw new Error(`Unable to locate package.json from ${fromFileUrl}`)
    }

    currentDir = parentDir
  }

  return currentDir
}

const PACKAGE_ROOT = findPackageRoot(import.meta.url)

function printHelp() {
  console.log(`Usage:
  airules sync [--host <name|all>] [--home <dir>] [--user-home <dir>] [--skip-vendors] [--no-verify]
  airules add <skill-dir> [--name <skill-name>] [--host <name|all>] [--home <dir>] [--user-home <dir>] [--overwrite] [--skip-sync] [--sync-vendors]
  airules verify [--host <name|all>] [--home <dir>] [--user-home <dir>]

Commands:
  sync      同步内置、用户自定义和第三方 skills 到宿主
  add       添加包含 SKILL.md 的本地 skill 目录，并默认同步到宿主
  verify    校验宿主 skills 链接完整性
`)
}

function parseCommandArgs(args: string[]) {
  return parseArgs({
    args,
    allowPositionals: true,
    options: {
      'help': { type: 'boolean', short: 'h' },
      'home': { type: 'string' },
      'host': { type: 'string' },
      'name': { type: 'string' },
      'overwrite': { type: 'boolean' },
      'no-verify': { type: 'boolean' },
      'repo-root': { type: 'string' },
      'skip-sync': { type: 'boolean' },
      'skip-vendors': { type: 'boolean' },
      'sync-vendors': { type: 'boolean' },
      'user-home': { type: 'string' },
    },
    strict: true,
  })
}

function commonOptions(values: Record<string, string | boolean | undefined>) {
  return {
    home: String(values.home ?? getDefaultMoluoHome()),
    host: String(values.host ?? 'all'),
    repoRoot: String(values['repo-root'] ?? PACKAGE_ROOT),
    userHome: values['user-home'] === undefined ? undefined : String(values['user-home']),
  }
}

async function runSync(args: string[]) {
  const { values } = parseCommandArgs(args)
  if (values.help === true) {
    printHelp()
    return
  }

  const options = commonOptions(values)
  const result = await syncToHosts({
    ...options,
    skipVendors: values['skip-vendors'] === true,
    verify: values['no-verify'] !== true,
  })

  console.log(kleur.green(`[sync] 完成: ${result.projectedHosts.join(', ') || '无宿主投影'}`))
  console.log(`[home] ${result.moluoHome}`)
  if (result.skippedHosts.length > 0) {
    console.log(`[skip] 宿主目录不存在: ${result.skippedHosts.join(', ')}`)
  }
}

async function runAdd(args: string[]) {
  const { positionals, values } = parseCommandArgs(args)
  if (values.help === true) {
    printHelp()
    return
  }

  const options = commonOptions(values)
  const sourceDir = positionals[0]
  if (sourceDir === undefined) {
    throw new Error('Missing <skill-dir> for add command')
  }

  const added = addLocalSkill({
    sourceDir,
    moluoHome: options.home,
    name: values.name === undefined ? undefined : String(values.name),
    overwrite: values.overwrite === true,
  })

  console.log(kleur.green(`[add] ${added.skillName} -> ${added.targetDir}`))

  if (values['skip-sync'] === true) {
    return
  }

  const result = await syncToHosts({
    ...options,
    skipVendors: values['sync-vendors'] !== true,
    verify: values['no-verify'] !== true,
  })

  console.log(kleur.green(`[sync] 完成: ${result.projectedHosts.join(', ') || '无宿主投影'}`))
  if (result.skippedHosts.length > 0) {
    console.log(`[skip] 宿主目录不存在: ${result.skippedHosts.join(', ')}`)
  }
}

async function runVerify(args: string[]) {
  const { values } = parseCommandArgs(args)
  if (values.help === true) {
    printHelp()
    return
  }

  const options = commonOptions(values)
  const targets = await verifyHosts({
    home: options.home,
    host: options.host,
  })

  console.log(kleur.green(`[verify] 通过: ${targets.join(', ')}`))
}

async function main() {
  const [command, ...commandArgs] = process.argv.slice(2)

  if (command === undefined || command === 'help' || command === '--help' || command === '-h') {
    printHelp()
    return
  }

  if (command === 'sync') {
    await runSync(commandArgs)
    return
  }

  if (command === 'add') {
    await runAdd(commandArgs)
    return
  }

  if (command === 'verify') {
    await runVerify(commandArgs)
    return
  }

  throw new Error(`Unknown command: ${command}`)
}

main().catch((error) => {
  console.error(kleur.red(String(error)))
  process.exit(1)
})
