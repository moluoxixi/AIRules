#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { existsSync, statSync } from 'node:fs'
import path from 'node:path'

const projectRoot = path.resolve(process.argv[2] ?? process.cwd())
const integration = process.env.AIRULES_SPECKIT_INTEGRATION ?? 'codex'
const bridgeName = 'speckit-superpowers-bridge'
const bridgeReleaseUrl = 'https://github.com/lihan3238/speckit-superpowers-bridge/releases/latest/download/speckit-superpowers-bridge.zip'
const skipBridgeReadiness = process.env.AIRULES_SKIP_SPECKIT_BRIDGE_READINESS === '1'
const skipCodeGraph = process.env.AIRULES_SKIP_CODEGRAPH_INIT === '1'

function resolveCommand(candidates) {
  const pathValue = process.env.PATH ?? process.env.Path ?? ''

  for (const dir of pathValue.split(path.delimiter).filter(Boolean)) {
    for (const candidate of candidates) {
      const fullPath = path.join(dir, candidate)
      if (existsSync(fullPath) && statSync(fullPath).isFile()) {
        return fullPath
      }
    }
  }

  return null
}

function requireSpecifyCommand() {
  const command = resolveCommand(
    process.platform === 'win32'
      ? ['specify.cmd', 'specify.bat', 'specify.exe']
      : ['specify'],
  )
  if (!command) {
    throw new Error('MISSING specify CLI；请先安装 GitHub Spec Kit specify-cli，或先运行 AIRules speckit-development role setup。')
  }
  return command
}

function requireCodeGraphCommand() {
  const command = resolveCommand(
    process.platform === 'win32'
      ? ['codegraph.cmd', 'codegraph.bat', 'codegraph.exe']
      : ['codegraph'],
  )
  if (!command) {
    throw new Error('MISSING codegraph；请先安装 CodeGraph，或先运行 AIRules speckit-development role setup。')
  }
  return command
}

function requirePowerShellCommand() {
  const command = resolveCommand(['pwsh.cmd', 'pwsh.bat', 'pwsh.exe', 'powershell.cmd', 'powershell.bat', 'powershell.exe'])
  if (!command) {
    throw new Error('MISSING PowerShell；需要运行 speckit-superpowers-bridge readiness 脚本。')
  }
  return command
}

function runCommand(command, args) {
  const result = spawnSync(command, args, {
    cwd: projectRoot,
    encoding: 'utf8',
    shell: process.platform === 'win32' && /\.(?:cmd|bat)$/i.test(command),
  })
  if (result.error) {
    throw result.error
  }

  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed with exit ${result.status}\n${result.stdout ?? ''}${result.stderr ?? ''}`)
  }

  return {
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  }
}

function initializeSpecKit(command) {
  runCommand(command, ['init', projectRoot, '--integration', integration, '--force'])
  console.log(`[airules] 已运行 specify init --integration ${integration}`)
}

function installBridgeExtension(command) {
  runCommand(command, ['extension', 'add', bridgeName, '--from', bridgeReleaseUrl])
  console.log(`[airules] 已安装 Spec Kit extension：${bridgeName}`)
}

function initializeCodeGraph() {
  if (skipCodeGraph) {
    console.log('[airules] 已跳过 CodeGraph 初始化（AIRULES_SKIP_CODEGRAPH_INIT=1）')
    return
  }

  runCommand(requireCodeGraphCommand(), ['init', '-i'])
  console.log('[airules] 已运行 codegraph init -i')
}

function runBridgeReadiness() {
  if (skipBridgeReadiness) {
    console.log('[airules] 已跳过 bridge readiness（AIRULES_SKIP_SPECKIT_BRIDGE_READINESS=1）')
    return
  }

  const powershellScript = path.join(projectRoot, '.specify', 'extensions', bridgeName, 'scripts', 'powershell', 'bridge-status.ps1')
  const bashScript = path.join(projectRoot, '.specify', 'extensions', bridgeName, 'scripts', 'bash', 'bridge-status.sh')

  if (process.platform === 'win32' && existsSync(powershellScript)) {
    runCommand(requirePowerShellCommand(), ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', powershellScript, '-Readiness', '-Actor', 'codex'])
    console.log('[airules] Spec Kit bridge readiness 通过（powershell）')
    return
  }

  if (existsSync(bashScript)) {
    runCommand('bash', [bashScript, '--readiness', '--actor', 'codex'])
    console.log('[airules] Spec Kit bridge readiness 通过（bash）')
    return
  }

  throw new Error(`MISSING ${bridgeName} readiness script；extension 安装不完整。`)
}

const specifyCommand = requireSpecifyCommand()
initializeSpecKit(specifyCommand)
installBridgeExtension(specifyCommand)
initializeCodeGraph()
runBridgeReadiness()
