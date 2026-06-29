import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { projectToHost } from '../install.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..', '..', '..')
const hookScriptSource = path.join(repoRoot, 'hooks', 'session-log.mjs')

/**
 * 为 hook 投影搭建隔离环境：~/.moluoxixi（含 vendor/skills 与 vendor/hooks/session-log.mjs
 * 中性源）+ 一个宿主 home。withHookScript=false 时不放脚本源，用于验证缺源 no-op。
 */
function setupEnv(options: { withHookScript?: boolean } = {}) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'airules-hook-'))
  const userHome = path.join(tmpDir, 'user')
  const moluoHome = path.join(userHome, '.moluoxixi')
  const hostHome = path.join(userHome, '.host')

  fs.mkdirSync(moluoHome, { recursive: true })
  fs.mkdirSync(hostHome, { recursive: true })
  fs.mkdirSync(path.join(moluoHome, 'vendor', 'skills'), { recursive: true })

  if (options.withHookScript ?? true) {
    const hooksDir = path.join(moluoHome, 'vendor', 'hooks')
    fs.mkdirSync(hooksDir, { recursive: true })
    // 用真实脚本源，保证测试与分发产物一致。
    fs.copyFileSync(hookScriptSource, path.join(hooksDir, 'session-log.mjs'))
  }

  return { tmpDir, userHome, moluoHome, hostHome }
}

function cleanup(tmpDir: string) {
  fs.rmSync(tmpDir, { recursive: true, force: true })
}

const jsonHook = { relDir: '.', fileName: 'settings.json', format: 'json' as const, event: 'Stop', scriptName: 'session-log.mjs' }
const tomlHook = { relDir: '.', fileName: 'config.toml', format: 'toml' as const, event: 'Stop', scriptName: 'session-log.mjs' }

function projectOnce(env: ReturnType<typeof setupEnv>, hooks: typeof jsonHook | typeof tomlHook) {
  projectToHost({
    userHome: env.userHome,
    moluoHome: env.moluoHome,
    hostHome: env.hostHome,
    hostBaselineFile: path.join(env.hostHome, 'AGENTS.md'),
    projectBaseline: false,
    projectSharedResources: false,
    hooksHome: env.hostHome,
    hooks,
  })
}
// PLACEHOLDER_TESTS
