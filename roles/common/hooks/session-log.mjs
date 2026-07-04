#!/usr/bin/env node
// AIRules 会话自动记录 Stop hook（跨宿主：Claude Code / Codex CLI / Qoder / Trae / Cursor）。
//
// 由宿主在每轮回答结束（Stop / stop 事件）时调用，stdin 收一个 JSON 对象。
// 在当前工作目录下追加一行会话索引到 knowledge/sessions/auto/<YYYY-MM-DD>.log。
//
// 设计红线：
// - 永不阻断对话：任何异常都吞掉并 exit 0（含 stdout 写失败等收尾异常）。
// - 跨宿主 stdout：结束时打印一个空 JSON `{}`——Codex / Cursor 的 Stop hook 要求 exit 0
//   时 stdout 为合法 JSON，Claude 容忍空输出，故三者通用。
// - 只记索引不记内容：写时间戳 + session 标识 + transcript 路径 + cwd，不读 transcript
//   正文、不回显敏感值（与 session-capture 写入边界一致）。
// - 跨宿主字段兜底：session 标识取 session_id（Claude/Codex/Qoder/Trae）或 conversation_id
//   （Cursor）；transcript_path 仅部分宿主提供，缺失记 (none)。制表/换行做转义防日志行被伪造。

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

/** 返回参数里第一个非空字符串（用于跨宿主字段名兜底），都没有则 undefined。 */
function firstString(...values) {
  for (const v of values) {
    if (typeof v === 'string' && v.length > 0) {
      return v
    }
  }
  return undefined
}

/** 转义制表/换行/回车：日志行以 \t 分隔、\n 结尾，宿主字段含这些字符会伪造/截断行。 */
function sanitizeField(value) {
  return value.replace(/\t/g, '\\t').replace(/\r/g, '\\r').replace(/\n/g, '\\n')
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
    // session id 字段名跨宿主不同：Claude/Codex/Qoder/Trae 用 session_id；Cursor 用 conversation_id。
    const sessionId = firstString(payload.session_id, payload.conversation_id) ?? '(unknown)'
    // transcript_path 仅部分宿主提供（Claude/Codex/Qoder）；Cursor/Trae 无，记 (none)。
    const transcript = firstString(payload.transcript_path) ?? '(none)'
    const event = firstString(payload.hook_event_name) ?? 'Stop'

    const autoDir = path.join(cwd, 'knowledge', 'sessions', 'auto')
    mkdirSync(autoDir, { recursive: true })

    // 首次建目录时落一个 .gitignore：自动日志默认不入库。
    const gitignore = path.join(autoDir, '.gitignore')
    if (!existsSync(gitignore)) {
      writeFileSync(gitignore, '# AIRules 自动会话日志，默认不入库\n*.log\n', 'utf8')
    }

    const now = new Date()
    const date = now.toISOString().slice(0, 10)
    const line = `${now.toISOString()}\t${sanitizeField(event)}\tsession=${sanitizeField(sessionId)}\ttranscript=${sanitizeField(transcript)}\tcwd=${sanitizeField(cwd)}\n`
    appendFileSync(path.join(autoDir, `${date}.log`), line, 'utf8')
  }
  catch {
    // 写入失败也不阻断对话。
  }

  // 跨宿主收尾：stdout 必须是合法 JSON（Codex/Cursor 要求；Claude 容忍）。
  // 收尾本身也可能抛（如 stdout 管道已关闭 EPIPE）——吞掉，保证永远 exit 0。
  try {
    process.stdout.write('{}')
  }
  catch {
    // 忽略 stdout 写失败。
  }
  process.exit(0)
}

main()
