#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import kleur from 'kleur'
import { HOST_IDS } from '../constants/hosts.js'
import {
  compareContractFiles,
  createContractErrorAudit,
  serializeContractAudit,
  writeContractAudit,
} from './lib/contract-diff.js'
import {
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
const PACKAGE_MANIFEST = JSON.parse(readFileSync(path.join(PACKAGE_ROOT, 'package.json'), 'utf8')) as {
  version?: unknown
}
const PACKAGE_VERSION = (() => {
  if (typeof PACKAGE_MANIFEST.version !== 'string' || !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/u.test(PACKAGE_MANIFEST.version)) {
    throw new Error(`Invalid package version in ${path.join(PACKAGE_ROOT, 'package.json')}`)
  }
  return PACKAGE_MANIFEST.version
})()
function printHelp() {
  console.log(`Usage:
  airules sync [--role <name>] [--host <name|all>] [--home <dir>] [--user-home <dir>] [--skip-vendors] [--no-verify]
  airules verify [--role <name>] [--host <name|all>] [--home <dir>] [--user-home <dir>]
  airules contract-diff --expected <openapi.json|yaml> --actual <openapi.json|yaml> [--output <audit.json>]
  airules --version

Commands:
  sync           同步远程 skills 到宿主
  verify         校验宿主 skills 链接完整性
  contract-diff  确定性比对两个 OpenAPI 3.x 契约

Selectable hosts:
  ${HOST_IDS.join(', ')}

The mandatory ~/.agents/skills shared layer is always synchronized and verified.
`)
}

function printContractDiffHelp() {
  console.log(`Usage:
  airules contract-diff --expected <file> --actual <file> [options]

Options:
  --capabilities              输出稳定的机器可读能力握手
  --output <file>             原子写入 JSON 审计报告
  --expected-label <name>     权威侧标签，默认 expected
  --actual-label <name>       被比对侧标签，默认 actual
  --expected-version <value>  权威侧不可变版本或 revision
  --actual-version <value>    被比对侧不可变版本或 revision

Exit codes:
  0  无阻断差异
  1  输入无效、不支持或引用无法解析
  2  存在阻断差异
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
      'no-verify': { type: 'boolean' },
      'repo-root': { type: 'string' },
      'role': { type: 'string' },
      'skip-vendors': { type: 'boolean' },
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
    role: values.role === undefined ? undefined : String(values.role),
    userHome: values['user-home'] === undefined ? undefined : String(values['user-home']),
  }
}

function parseContractDiffArgs(args: string[]) {
  return parseArgs({
    args,
    allowPositionals: false,
    options: {
      'actual': { type: 'string' },
      'actual-label': { type: 'string' },
      'actual-version': { type: 'string' },
      'capabilities': { type: 'boolean' },
      'expected': { type: 'string' },
      'expected-label': { type: 'string' },
      'expected-version': { type: 'string' },
      'help': { type: 'boolean', short: 'h' },
      'output': { type: 'string', short: 'o' },
    },
    strict: true,
  })
}

function preScanContractDiffPaths(args: string[]): { expected?: string, actual?: string, output?: string } {
  const found: Record<'expected' | 'actual' | 'output', string[]> = {
    expected: [],
    actual: [],
    output: [],
  }
  const names = new Map([
    ['--actual', 'actual'],
    ['--expected', 'expected'],
    ['--output', 'output'],
    ['-o', 'output'],
  ] as const)

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index]
    if (argument === '--') {
      break
    }
    const inline = /^--(actual|expected|output)=(.*)$/u.exec(argument)
    if (inline) {
      const [, name, value] = inline
      if (value !== '') {
        found[name as keyof typeof found].push(value)
      }
      continue
    }
    const name = names.get(argument as '--actual' | '--expected' | '--output' | '-o')
    const candidate = args[index + 1]
    if (name !== undefined && candidate !== undefined && candidate !== '' && !candidate.startsWith('-')) {
      found[name].push(candidate)
      index += 1
    }
  }

  const single = (values: string[]): string | undefined => values.length === 1 ? values[0] : undefined
  return {
    expected: single(found.expected),
    actual: single(found.actual),
    output: single(found.output),
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
    repoRoot: options.repoRoot,
    role: options.role,
    userHome: options.userHome,
  })

  console.log(kleur.green(`[verify] 通过: ${targets.join(', ')}`))
}

function runContractDiff(args: string[]) {
  const preScannedPaths = preScanContractDiffPaths(args)
  let parsed: ReturnType<typeof parseContractDiffArgs>
  try {
    parsed = parseContractDiffArgs(args)
  }
  catch (error) {
    const options = {
      expectedPath: preScannedPaths.expected ?? '<missing --expected>',
      actualPath: preScannedPaths.actual ?? '<missing --actual>',
    }
    let audit = createContractErrorAudit(options, error)
    if (preScannedPaths.output !== undefined) {
      try {
        writeContractAudit(
          preScannedPaths.output,
          audit,
          [preScannedPaths.expected, preScannedPaths.actual].filter((value): value is string => value !== undefined),
        )
      }
      catch (writeError) {
        audit = createContractErrorAudit(options, writeError)
      }
    }
    process.stdout.write(serializeContractAudit(audit))
    process.exitCode = 1
    return
  }
  const { values } = parsed
  if (values.help === true) {
    printContractDiffHelp()
    return
  }
  if (values.capabilities === true) {
    process.stdout.write(`${JSON.stringify({
      name: 'airules-contract-diff',
      report_version: 1,
      cli_version: PACKAGE_VERSION,
      exit_codes: { pass: 0, fail: 2, error: 1 },
    })}\n`)
    process.exitCode = 0
    return
  }

  const expectedPath = values.expected === undefined || values.expected === ''
    ? '<missing --expected>'
    : values.expected
  const actualPath = values.actual === undefined || values.actual === ''
    ? '<missing --actual>'
    : values.actual
  const expectedLabel = values['expected-label']?.trim() ? values['expected-label'] : undefined
  const actualLabel = values['actual-label']?.trim() ? values['actual-label'] : undefined
  const expectedVersion = values['expected-version']?.trim() ? values['expected-version'] : undefined
  const actualVersion = values['actual-version']?.trim() ? values['actual-version'] : undefined
  const options = {
    expectedPath,
    actualPath,
    expectedLabel,
    actualLabel,
    expectedVersion,
    actualVersion,
  }
  let audit
  let exitCode = 0
  try {
    if (values.expected === undefined || values.expected === '' || values.actual === undefined || values.actual === '') {
      throw new Error('contract-diff requires non-empty --expected and --actual paths')
    }
    const emptyMetadata = [
      ['--expected-label', values['expected-label']],
      ['--actual-label', values['actual-label']],
      ['--expected-version', values['expected-version']],
      ['--actual-version', values['actual-version']],
    ].find(([, value]) => typeof value === 'string' && value.trim() === '')
    if (emptyMetadata) {
      throw new Error(`contract-diff requires a non-empty ${emptyMetadata[0]} value`)
    }
    audit = compareContractFiles(options)
    exitCode = audit.status === 'fail' ? 2 : 0
  }
  catch (error) {
    audit = createContractErrorAudit(options, error)
    exitCode = 1
  }

  if (values.output !== undefined) {
    try {
      writeContractAudit(values.output, audit, [values.expected, values.actual].filter((value): value is string => value !== undefined && value !== ''))
    }
    catch (error) {
      audit = createContractErrorAudit(options, error)
      exitCode = 1
    }
  }
  process.stdout.write(serializeContractAudit(audit))
  process.exitCode = exitCode
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

  if (command === 'verify') {
    await runVerify(commandArgs)
    return
  }

  if (command === '--version') {
    console.log(PACKAGE_VERSION)
    return
  }

  if (command === 'contract-diff') {
    runContractDiff(commandArgs)
    return
  }

  throw new Error(`Unknown command: ${command}`)
}

main().catch((error) => {
  console.error(kleur.red(String(error)))
  process.exit(1)
})
