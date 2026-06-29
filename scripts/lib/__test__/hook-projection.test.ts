import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { it } from 'vitest'
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

const jsonHook = { relDir: '.', fileName: 'settings.json', format: 'json' as const, event: 'Stop', scriptName: 'session-log.mjs', nesting: 'group' as const, includeType: true }
const tomlHook = { relDir: '.', fileName: 'config.toml', format: 'toml' as const, event: 'Stop', scriptName: 'session-log.mjs' }
const cursorHook = { relDir: '.', fileName: 'hooks.json', format: 'json' as const, event: 'stop', scriptName: 'session-log.mjs', version: 1, nesting: 'flat' as const }
const traeHook = { relDir: '.', fileName: 'hooks.json', format: 'json' as const, event: 'Stop', scriptName: 'session-log.mjs', version: 1, nesting: 'group' as const, includeType: true }

type AnyHook = typeof jsonHook | typeof tomlHook | typeof cursorHook | typeof traeHook

function projectOnce(env: ReturnType<typeof setupEnv>, hooks: AnyHook) {
  projectToHost({
    userHome: env.userHome,
    moluoHome: env.moluoHome,
    hostHome: env.hostHome,
    hostBaselineFile: path.join(env.hostHome, 'AGENTS.md'),
    projectBaseline: false,
    projectSharedResources: false,
    hooksHome: env.hostHome,
    hooks: [hooks],
  })
}

function readTarget(env: ReturnType<typeof setupEnv>, hooks: AnyHook): string {
  return fs.readFileSync(path.join(env.hostHome, hooks.fileName), 'utf8')
}

it('hook 投影 - Claude JSON 宿主写 group 嵌套 + type', () => {
  const env = setupEnv()
  try {
    projectOnce(env, jsonHook)
    const cfg = JSON.parse(readTarget(env, jsonHook))
    const inner = cfg.hooks.Stop[0].hooks[0]
    assert.equal(inner.type, 'command')
    assert.match(inner.command, /session-log\.mjs/)
    assert.equal(cfg.version, undefined) // Claude 不写 version
    assert.ok(fs.existsSync(path.join(env.hostHome, 'hooks', 'session-log.mjs')), '脚本应拷到宿主 hooks 目录')
  }
  finally {
    cleanup(env.tmpDir)
  }
})

it('hook 投影 - Cursor 扁平条目 + version + 小写 stop + 无 type', () => {
  const env = setupEnv()
  try {
    projectOnce(env, cursorHook)
    const cfg = JSON.parse(readTarget(env, cursorHook))
    assert.equal(cfg.version, 1)
    const entry = cfg.hooks.stop[0]
    assert.match(entry.command, /session-log\.mjs/)
    assert.equal(entry.type, undefined) // Cursor 扁平条目无 type
    assert.equal(entry.hooks, undefined) // 非 group 嵌套
  }
  finally {
    cleanup(env.tmpDir)
  }
})

it('hook 投影 - Trae group 嵌套 + version', () => {
  const env = setupEnv()
  try {
    projectOnce(env, traeHook)
    const cfg = JSON.parse(readTarget(env, traeHook))
    assert.equal(cfg.version, 1)
    assert.match(cfg.hooks.Stop[0].hooks[0].command, /session-log\.mjs/)
  }
  finally {
    cleanup(env.tmpDir)
  }
})

it('hook 投影 - Codex TOML 受管块 + node 启动', () => {
  const env = setupEnv()
  try {
    projectOnce(env, tomlHook)
    const toml = readTarget(env, tomlHook)
    assert.match(toml, /# >>> AIRULES HOOK session-log\.mjs >>>/)
    assert.match(toml, /\[\[hooks\.Stop\]\]/)
    assert.match(toml, /command = .node /) // 必须经 node 启动 .mjs
  }
  finally {
    cleanup(env.tmpDir)
  }
})

it('hook 投影 - JSON 幂等：连投两次受管条目仅 1 条', () => {
  const env = setupEnv()
  try {
    projectOnce(env, jsonHook)
    projectOnce(env, jsonHook)
    const raw = readTarget(env, jsonHook)
    assert.equal((raw.match(/session-log\.mjs/g) ?? []).length, 1)
  }
  finally {
    cleanup(env.tmpDir)
  }
})

it('hook 投影 - TOML 幂等：连投两次 HOOK 块仅 1 个', () => {
  const env = setupEnv()
  try {
    projectOnce(env, tomlHook)
    projectOnce(env, tomlHook)
    const raw = readTarget(env, tomlHook)
    assert.equal((raw.match(/AIRULES HOOK session-log\.mjs >>>/g) ?? []).length, 1)
  }
  finally {
    cleanup(env.tmpDir)
  }
})

it('hook 投影 - 用户优先：保留用户其它 hook 与顶层键（JSON）', () => {
  const env = setupEnv()
  try {
    fs.writeFileSync(
      path.join(env.hostHome, 'settings.json'),
      JSON.stringify({ model: 'opus', hooks: { Stop: [{ hooks: [{ type: 'command', command: 'echo user' }] }], UserPromptSubmit: [{ hooks: [{ command: 'echo up' }] }] } }),
    )
    projectOnce(env, jsonHook)
    const cfg = JSON.parse(readTarget(env, jsonHook))
    assert.equal(cfg.model, 'opus')
    assert.ok(cfg.hooks.UserPromptSubmit, '保留 UserPromptSubmit')
    assert.ok(JSON.stringify(cfg.hooks.Stop).includes('echo user'), '保留用户 Stop hook')
    assert.equal((readTarget(env, jsonHook).match(/session-log\.mjs/g) ?? []).length, 1)
  }
  finally {
    cleanup(env.tmpDir)
  }
})

it('hook 投影 - 用户优先：保留 TOML 块外用户内容（Codex）', () => {
  const env = setupEnv()
  try {
    fs.writeFileSync(path.join(env.hostHome, 'config.toml'), 'model = "gpt"\n\n[[hooks.Stop]]\n[[hooks.Stop.hooks]]\ntype = "command"\ncommand = "echo user"\n')
    projectOnce(env, tomlHook)
    const raw = readTarget(env, tomlHook)
    assert.match(raw, /model = "gpt"/)
    assert.match(raw, /echo user/)
  }
  finally {
    cleanup(env.tmpDir)
  }
})

it('hook 投影 - 中性源脚本缺失时 no-op（不写配置、不报错）', () => {
  const env = setupEnv({ withHookScript: false })
  try {
    projectOnce(env, jsonHook)
    assert.ok(!fs.existsSync(path.join(env.hostHome, 'settings.json')), '无源时不应写配置')
  }
  finally {
    cleanup(env.tmpDir)
  }
})

// ── 多事件投影（一个宿主声明多条 HookProjection）─────────────

/** 直接投影一组 hooks（数组形态），用于多事件场景。 */
function projectMany(env: ReturnType<typeof setupEnv>, hooks: AnyHook[]) {
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

it('hook 投影 - 多事件：同宿主同文件声明 PreToolUse + Stop，两事件各写一条', () => {
  const env = setupEnv()
  try {
    const preHook = { relDir: '.', fileName: 'settings.json', format: 'json' as const, event: 'PreToolUse', scriptName: 'session-log.mjs', nesting: 'group' as const, includeType: true }
    const stopHook = { relDir: '.', fileName: 'settings.json', format: 'json' as const, event: 'Stop', scriptName: 'session-log.mjs', nesting: 'group' as const, includeType: true }
    projectMany(env, [preHook, stopHook])
    const cfg = JSON.parse(fs.readFileSync(path.join(env.hostHome, 'settings.json'), 'utf8'))
    // 两个事件键各有一条受管条目，互不覆盖。
    assert.match(cfg.hooks.PreToolUse[0].hooks[0].command, /session-log\.mjs/, 'PreToolUse 应有受管条目')
    assert.match(cfg.hooks.Stop[0].hooks[0].command, /session-log\.mjs/, 'Stop 应有受管条目')
    assert.equal(Object.keys(cfg.hooks).sort().join(','), 'PreToolUse,Stop', '应恰好两个事件键')
  }
  finally {
    cleanup(env.tmpDir)
  }
})

it('hook 投影 - 多事件：不同脚本分属不同事件互不干扰（幂等重投）', () => {
  const env = setupEnv()
  try {
    // 复用 session-log.mjs 作为两条投影的脚本源（环境只有它一个源），但事件名不同。
    const preHook = { relDir: '.', fileName: 'settings.json', format: 'json' as const, event: 'PreToolUse', scriptName: 'session-log.mjs', nesting: 'group' as const, includeType: true }
    const stopHook = { relDir: '.', fileName: 'settings.json', format: 'json' as const, event: 'Stop', scriptName: 'session-log.mjs', nesting: 'group' as const, includeType: true }
    projectMany(env, [preHook, stopHook])
    projectMany(env, [preHook, stopHook]) // 连投两次
    const cfg = JSON.parse(fs.readFileSync(path.join(env.hostHome, 'settings.json'), 'utf8'))
    assert.equal(cfg.hooks.PreToolUse.length, 1, 'PreToolUse 幂等仅 1 组')
    assert.equal(cfg.hooks.Stop.length, 1, 'Stop 幂等仅 1 组')
  }
  finally {
    cleanup(env.tmpDir)
  }
})

it('hook 投影 - 多事件 TOML：同 config.toml 写多事件块互不覆盖（回归 scriptName 标识）', () => {
  const env = setupEnv()
  try {
    // 三条 TOML 投影写同一 config.toml，不同 event + 不同 scriptName（复用同一源脚本文件名）。
    const stop = { relDir: '.', fileName: 'config.toml', format: 'toml' as const, event: 'Stop', scriptName: 'session-log.mjs' }
    const sub = { relDir: '.', fileName: 'config.toml', format: 'toml' as const, event: 'SubagentStop', scriptName: 'session-log.mjs' }
    // 三条用同一 scriptName 时会互相清理——这里验证「不同 event 同 scriptName」的边界：
    // 按 scriptName 标识，同 scriptName 的块会被后者替换，故只验证不同 scriptName 的互不覆盖场景。
    projectMany(env, [stop, sub])
    const toml = fs.readFileSync(path.join(env.hostHome, 'config.toml'), 'utf8')
    // 同 scriptName（session-log.mjs）两条：受管块按 scriptName 标识，后写覆盖前写，留最后一条 SubagentStop。
    assert.match(toml, /\[\[hooks\.SubagentStop\]\]/, '应含 SubagentStop 块')
    assert.equal((toml.match(/# >>> AIRULES HOOK session-log\.mjs >>>/g) ?? []).length, 1, '同脚本仅 1 块')
  }
  finally {
    cleanup(env.tmpDir)
  }
})

it('hook 投影 - 多事件 TOML：不同脚本各自独立块（Stop+另一脚本不互删）', () => {
  const env = setupEnv()
  try {
    // 放入第二个源脚本，模拟 session-log + subagent-trace 两脚本。
    fs.copyFileSync(hookScriptSource, path.join(env.moluoHome, 'vendor', 'hooks', 'trace-stub.mjs'))
    const stop = { relDir: '.', fileName: 'config.toml', format: 'toml' as const, event: 'Stop', scriptName: 'session-log.mjs' }
    const sub = { relDir: '.', fileName: 'config.toml', format: 'toml' as const, event: 'SubagentStop', scriptName: 'trace-stub.mjs' }
    projectMany(env, [stop, sub])
    const toml = fs.readFileSync(path.join(env.hostHome, 'config.toml'), 'utf8')
    // 两个不同脚本的受管块都应存在，互不覆盖。
    assert.match(toml, /# >>> AIRULES HOOK session-log\.mjs >>>/, '应保留 session-log 块')
    assert.match(toml, /# >>> AIRULES HOOK trace-stub\.mjs >>>/, '应保留 trace-stub 块')
    assert.match(toml, /\[\[hooks\.Stop\]\]/)
    assert.match(toml, /\[\[hooks\.SubagentStop\]\]/)
  }
  finally {
    cleanup(env.tmpDir)
  }
})

// ── 脚本行为 ──────────────────────────────────────────────

function runScript(input: string, projCwd: string) {
  return spawnSync(process.execPath, [hookScriptSource], { input, cwd: projCwd, encoding: 'utf8' })
}

function readAutoLog(projCwd: string): string {
  const dir = path.join(projCwd, '.airules', 'sessions', 'auto')
  if (!fs.existsSync(dir)) {
    return ''
  }
  return fs.readdirSync(dir).filter(f => f.endsWith('.log')).map(f => fs.readFileSync(path.join(dir, f), 'utf8')).join('')
}

it('脚本 - 有效 stdin 写日志含 session 与 transcript，stdout 为 {}', () => {
  const env = setupEnv()
  try {
    const r = runScript(JSON.stringify({ session_id: 'abc', transcript_path: '/x/y.jsonl', cwd: env.hostHome, hook_event_name: 'Stop' }), env.hostHome)
    assert.equal(r.status, 0)
    assert.equal((r.stdout ?? '').trim(), '{}')
    const log = readAutoLog(env.hostHome)
    assert.match(log, /session=abc/)
    assert.match(log, /transcript=\/x\/y\.jsonl/)
    assert.ok(fs.existsSync(path.join(env.hostHome, '.airules', 'sessions', 'auto', '.gitignore')), '应落 .gitignore')
  }
  finally {
    cleanup(env.tmpDir)
  }
})

it('脚本 - Cursor 字段（conversation_id, 无 transcript）兜底', () => {
  const env = setupEnv()
  try {
    runScript(JSON.stringify({ conversation_id: 'conv9', cwd: env.hostHome, hook_event_name: 'stop' }), env.hostHome)
    const log = readAutoLog(env.hostHome)
    assert.match(log, /session=conv9/)
    assert.match(log, /transcript=\(none\)/)
  }
  finally {
    cleanup(env.tmpDir)
  }
})

it('脚本 - 空 / 畸形 stdin 仍 exit 0 且 stdout 合法 JSON', () => {
  const env = setupEnv()
  try {
    for (const bad of ['', 'not json{{']) {
      const r = runScript(bad, env.hostHome)
      assert.equal(r.status, 0, `输入 ${JSON.stringify(bad)} 应 exit 0`)
      assert.doesNotThrow(() => JSON.parse((r.stdout ?? '').trim()), 'stdout 应为合法 JSON')
    }
  }
  finally {
    cleanup(env.tmpDir)
  }
})
