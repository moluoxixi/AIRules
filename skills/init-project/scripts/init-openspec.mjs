#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'

// 在用户项目根初始化 OpenSpec 工作目录，落在 .airules/openspec/ 下。
// 设计依据（实测 OpenSpec 1.4.1）：
// - `openspec init <path> --tools none` 直接把 openspec 结构建到 <path>/openspec/，
//   不写机器级注册表、不污染宿主 agent 目录（--tools none）。
// - 后续 openspec 命令需在 .airules/（或其子目录）下执行才能定位该 store。
// - 用户若想要某宿主的 slash command，可自行 `openspec init .airules --tools <host>`。

const projectRoot = path.resolve(process.argv[2] ?? process.cwd())
const airulesDir = path.join(projectRoot, '.airules')
const openspecDir = path.join(airulesDir, 'openspec')

// Windows 上 openspec 是 .cmd shim，spawnSync 需经 shell 才能解析。
const isWindows = process.platform === 'win32'

function isOpenspecAvailable() {
  const lookup = isWindows ? 'where.exe' : 'which'
  const probe = spawnSync(lookup, ['openspec'], { stdio: 'ignore' })
  return probe.status === 0
}

if (!isOpenspecAvailable()) {
  console.log('[airules] MISSING: 未找到 openspec 命令。请先全局安装 @fission-ai/openspec（airules sync 会自动安装），再重跑本步骤。')
  process.exit(0)
}

if (existsSync(openspecDir)) {
  console.log(`[airules] OpenSpec store 已存在，跳过初始化：${openspecDir}`)
  process.exit(0)
}

// init 在项目根执行，path 参数指向 .airules；--tools none 不向宿主目录写 slash command。
const result = spawnSync('openspec', ['init', '.airules', '--tools', 'none'], {
  cwd: projectRoot,
  encoding: 'utf8',
  stdio: 'inherit',
  shell: isWindows,
})

if (result.error) {
  throw result.error
}

if (result.status !== 0) {
  throw new Error(`openspec init 失败（exit ${result.status}）；请检查 openspec 版本与项目目录权限。`)
}

console.log(`[airules] 已初始化 OpenSpec store：${openspecDir}`)
console.log('[airules] 提示：使用 openspec 命令（list / new change / archive 等）时，请在 .airules/ 目录下执行以定位该 store。')
