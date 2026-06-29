#!/usr/bin/env node
// AIRules 会话自动记录 Stop hook（跨宿主：Claude Code / Codex CLI）。
//
// 由宿主在每轮回答结束（Stop 事件）时调用，stdin 收一个 JSON 对象。
// 在当前工作目录下追加一行会话索引到 .airules/sessions/auto/<YYYY-MM-DD>.log。
//
// 设计红线：
// - 永不阻断对话：任何异常都吞掉并 exit 0。
// - 跨宿主 stdout：结束时打印一个空 JSON `{}`——Codex 的 Stop hook 要求 exit 0
//   时 stdout 为合法 JSON，Claude 容忍空输出，故二者通用。
// - 只记索引不记内容：写时间戳 + session_id + transcript 路径 + cwd，不读 transcript
//   正文、不回显敏感值（与 session-capture 写入边界一致）。
// - transcript_path 可能为 null（Codex 声明其 transcript 格式不稳定、可能缺失）：缺失记 (none)。

import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'

/** 读 stdin 全文（hook 输入）。失败返回空串。 */
function readStdin() {
  try {
    // 读文件描述符 0（stdin）直到 EOF；hook 输入通常很小。
    return readFileSync(0, 'utf8')
  }
  catch {
    return ''
  }
}

function main() {
  let payload = {}
  try {
    const raw = readStdin().trim()
    if (raw.length > 0) {
      payload = JSON.parse(raw)
    }
  }
  catch {
    payload = {}
  }

  try {
    const cwd = typeof payload.cwd === 'string' && payload.cwd.length > 0 ? payload.cwd : process.cwd()
    const sessionId = typeof payload.session_id === 'string' && payload.session_id.length > 0 ? payload.session_id : '(unknown)'
    const transcript = typeof payload.transcript_path === 'string' && payload.transcript_path.length > 0 ? payload.transcript_path : '(none)'
    const event = typeof payload.hook_event_name === 'string' && payload.hook_event_name.length > 0 ? payload.hook_event_name : 'Stop'

    const autoDir = path.join(cwd, '.airules', 'sessions', 'auto')
    mkdirSync(autoDir, { recursive: true })

    // 首次建目录时落一个 .gitignore：自动日志默认不入库。
    const gitignore = path.join(autoDir, '.gitignore')
    if (!existsSync(gitignore)) {
      writeFileSync(gitignore, '# AIRules 自动会话日志，默认不入库\n*.log\n', 'utf8')
    }

    const now = new Date()
    const date = now.toISOString().slice(0, 10)
    const line = `${now.toISOString()}\t${event}\tsession=${sessionId}\ttranscript=${transcript}\tcwd=${cwd}\n`
    appendFileSync(path.join(autoDir, `${date}.log`), line, 'utf8')
  }
  catch {
    // 写入失败也不阻断对话。
  }

  // 跨宿主收尾：stdout 必须是合法 JSON（Codex 要求；Claude 容忍）。
  process.stdout.write('{}')
  process.exit(0)
}

main()
