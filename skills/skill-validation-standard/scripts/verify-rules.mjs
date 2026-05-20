#!/usr/bin/env node
/**
 * Skill 结构校验脚本 - 基于 Claude 官方 Skills 规范的硬约束检查
 *
 * 只覆盖可确定性判定的规则；内容质量由 AI 按 SKILL.md rubric 审查。
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ownRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const RESERVED_WORDS = ['anthropic', 'claude']
const NAME_MAX = 64
const DESC_MAX = 160
const DESC_MIN = 24
const BODY_LINE_LIMIT = 500
const FORBIDDEN_DOCS = new Set(['README.md', 'INSTALLATION_GUIDE.md', 'QUICK_REFERENCE.md', 'CHANGELOG.md'])

const errors = []
const warnings = []

function fail(msg) {
  errors.push(msg)
  console.log(`FAIL ${msg}`)
}

function warn(msg) {
  warnings.push(msg)
  console.log(`WARN ${msg}`)
}

function pass(msg) {
  console.log(`PASS ${msg}`)
}

function getOption(args, name) {
  const i = args.indexOf(name)
  if (i === -1) return undefined
  const v = args[i + 1]
  if (!v || v.startsWith('--')) {
    fail(`参数 ${name} 必须提供值`)
    return undefined
  }
  return v
}

function parseArgs(args) {
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--root') { i++; continue }
    fail(`未知参数：${args[i]}`)
  }
  const rootArg = getOption(args, '--root')
  return { root: rootArg ? path.resolve(process.cwd(), rootArg) : ownRoot }
}

function readFile(p) {
  return fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n')
}

function slash(p) {
  return p.split(path.sep).join('/')
}

function parseFrontmatter(content) {
  if (!content.startsWith('---\n')) {
    fail('SKILL.md 必须以 YAML frontmatter 开头')
    return { fields: new Map(), body: '' }
  }
  const end = content.indexOf('\n---\n', 4)
  if (end === -1) {
    fail('SKILL.md 缺少 YAML frontmatter 结束标记')
    return { fields: new Map(), body: '' }
  }
  pass('frontmatter valid')

  const fm = content.slice(4, end)
  const body = content.slice(end + 5).trim()
  const fields = new Map()

  for (const line of fm.split('\n')) {
    const m = /^([a-z][\w-]*): ?(.*)$/i.exec(line)
    if (m && m[2].trim()) fields.set(m[1], m[2].trim())
  }
  return { fields, body }
}

function listFiles(root) {
  const results = []
  for (const e of fs.readdirSync(root, { withFileTypes: true })) {
    if (e.name === '.git' || e.name === 'node_modules') continue
    const p = path.join(root, e.name)
    if (e.isDirectory()) results.push(...listFiles(p))
    else results.push(p)
  }
  return results
}

function mdLinks(content) {
  const links = []
  for (const m of content.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
    const t = m[1].trim()
    if (!t || t.startsWith('#') || t.startsWith('mailto:') || /^[a-z][a-z\d+.-]*:\/\//i.test(t)) continue
    links.push(t.split('#')[0])
  }
  return links.filter(Boolean)
}

function checkName(name, dirName) {
  if (!name) { fail('frontmatter 缺少 name'); return }
  if (name.length > NAME_MAX) { fail(`name 超过 ${NAME_MAX} 字符：${name.length}`); return }
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(name)) { fail('name 必须小写字母+数字+连字符'); return }
  if (RESERVED_WORDS.some(w => name.includes(w))) { fail(`name 不得包含保留词：${RESERVED_WORDS.join(', ')}`); return }
  if (/<[^>]+>/.test(name)) { fail('name 不得包含 XML 标签'); return }
  if (name !== dirName) { fail(`name 必须与目录名一致：期望 "${dirName}"，实际 "${name}"`); return }
  pass(`name: ${name} (${name.length} chars)`)
}

function checkDescription(desc) {
  if (!desc) { fail('frontmatter 缺少 description'); return }
  if (desc.length > DESC_MAX) { warn(`description ${desc.length} 字符，超过建议的 ${DESC_MAX} 字符`); return }
  if (desc.length < DESC_MIN) { fail(`description ${desc.length} 字符，过短无法提供可靠触发`); return }
  if (/<[^>]+>/.test(desc)) { fail('description 不得包含 XML 标签'); return }
  if (/(服务所有\s+skills|不属于|内部投影|安装投影|投影入口|分类自述|自身位置)/i.test(desc)) {
    fail('description 不得描述内部投影或自身位置')
    return
  }
  if (!/(用[于来]|适用于|当|when|Use when|在.+时|需要|生成|创建|修改|评审|校验|检查|debug|fix|review|create|edit|validate|Extract|Analyze|Process|Generate)/i.test(desc)) {
    fail('description 必须包含动作或场景关键词')
    return
  }
  pass(`description: ${desc.length} chars, contains action keywords`)
}

function checkBody(body) {
  if (!body || !/^#\s+/m.test(body)) { fail('frontmatter 后必须有 Markdown 正文（至少一个标题）'); return }
  const lines = body.split('\n').length
  if (lines > BODY_LINE_LIMIT) warn(`body: ${lines} lines exceeds ${BODY_LINE_LIMIT} line limit, consider splitting`)
  else pass(`body: ${lines} lines`)
}

function checkLinks(root, content) {
  const links = mdLinks(content)
  let valid = 0
  for (const link of links) {
    const target = path.resolve(root, link)
    if (!fs.existsSync(target)) fail(`link not found: ${link}`)
    else valid++
  }
  if (links.length > 0) pass(`links: ${valid} valid`)
}

function checkForbiddenDocs(root) {
  for (const f of listFiles(root)) {
    const name = path.basename(f)
    if (FORBIDDEN_DOCS.has(name)) fail(`禁止的杂项文档：${slash(path.relative(root, f))}`)
  }
  if (errors.length === 0 || !errors.some(e => e.includes('禁止的杂项文档'))) pass('no forbidden docs')
}

function checkDeepRefs(root, content) {
  const skillLinks = mdLinks(content)
  let hasDeep = false
  for (const link of skillLinks) {
    const target = path.resolve(root, link)
    if (!fs.existsSync(target) || !target.endsWith('.md')) continue
    const refContent = readFile(target)
    for (const nested of mdLinks(refContent)) {
      const nestedTarget = path.resolve(path.dirname(target), nested)
      if (!fs.existsSync(nestedTarget) || !nestedTarget.endsWith('.md')) continue
      const rel = slash(path.relative(root, nestedTarget))
      if (!skillLinks.includes(rel) && !skillLinks.includes(`./${rel}`)) {
        warn(`deep reference: ${slash(path.relative(root, target))} → ${nested}`)
        hasDeep = true
      }
    }
  }
  if (!hasDeep) pass('no deep references')
}

function checkBackslash(root) {
  let found = false
  for (const f of listFiles(root)) {
    if (!f.endsWith('.md')) continue
    if (/\]\([^)]*\\[^)]*\)/.test(readFile(f))) {
      warn(`${slash(path.relative(root, f))} 链接使用反斜杠，应统一正斜杠`)
      found = true
    }
  }
  if (!found) pass('no backslash paths')
}

function checkScripts(root) {
  const scriptsPath = path.join(root, 'scripts')
  if (!fs.existsSync(scriptsPath)) return
  let checked = 0
  for (const f of listFiles(scriptsPath)) {
    if (!/\.(mjs|js|cjs|ts|py|sh|ps1)$/.test(f)) continue
    const content = readFile(f)
    const name = path.basename(f)
    if (/verify|validate|check/.test(name)) {
      if (!/PASS /.test(content) || !/FAIL /.test(content)) {
        fail(`校验脚本缺少 PASS/FAIL 语义：${slash(path.relative(root, f))}`)
      }
      checked++
    }
  }
  if (checked > 0 && !errors.some(e => e.includes('PASS/FAIL'))) pass('script semantics valid')
}

function verify(root) {
  const skillPath = path.join(root, 'SKILL.md')
  if (!fs.existsSync(skillPath)) { fail('缺少 SKILL.md'); return }
  pass('SKILL.md exists')

  const content = readFile(skillPath)
  const { fields, body } = parseFrontmatter(content)
  const dirName = path.basename(root)

  checkName(fields.get('name'), dirName)
  checkDescription(fields.get('description'))
  checkBody(body)
  checkLinks(root, content)
  checkForbiddenDocs(root)
  checkDeepRefs(root, content)
  checkBackslash(root)
  checkScripts(root)

  console.log('────────────────────────────')
  if (errors.length > 0) {
    console.log(`FAIL ${errors.length} errors, ${warnings.length} warnings`)
    process.exitCode = 1
  } else {
    console.log('PASS skill is valid')
    console.log(`  name: ${fields.get('name')}`)
    console.log(`  root: ${root}`)
  }
}

verify(parseArgs(process.argv.slice(2)).root)
