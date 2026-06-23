/**
 * Skill 触发索引共享模块。
 *
 * 解决的问题：部分宿主（如 Qoder）不实现 Claude Code 原生的 skill 自动发现
 * （progressive disclosure——扫描每个 SKILL.md frontmatter 的 description 注入常驻上下文，
 * 由模型按需触发）。这类宿主只读 baseline（AGENTS.md），skill 文件虽已投影到宿主 skills 目录，
 * 但 agent 看不到它们的存在与触发条件，导致 skill 从不触发。
 *
 * 解法：把「skill 名称 + 触发条件 + 读取路径」渲染成一张索引表，写进宿主必读的 baseline，
 * 用静态索引手动补齐自动发现。
 *
 * 两个消费方共用本模块，保证 build 期与 install 期生成的索引格式一致：
 * - 构建期 assemble-baseline.mjs：扫描第一方 skills/，把索引拼进 rules/AGENTS.md。
 * - 安装期 install 流程：vendor/skills/ 链接齐全后（含 superpowers/pm-skills 等外部 skill），
 *   扫描 vendor/skills/，把完整索引（含外部 skill）注入 vendor/AGENTS.md，再投影到各宿主。
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'

export const SKILL_INDEX_START = '<!-- AIRULES:SKILL-INDEX:START -->'
export const SKILL_INDEX_END = '<!-- AIRULES:SKILL-INDEX:END -->'
const SKILL_INDEX_HEADING = '## Skill 触发索引'

/** 从 SKILL.md frontmatter 读取 name 与 description（无 frontmatter 或缺字段则对应字段为 undefined）。 */
export function parseSkillFrontmatter(content) {
  const normalized = content.replace(/\r\n/g, '\n')
  if (!normalized.startsWith('---\n')) {
    return {}
  }
  const end = normalized.indexOf('\n---', 4)
  if (end === -1) {
    return {}
  }
  const fm = normalized.slice(4, end)
  const nameMatch = fm.match(/^name:(.*)$/m)
  const descMatch = fm.match(/^description:(.*)$/m)
  // (.*) 可能匹配空值（如 `description:` 后无内容），trim 后空串按缺失处理，使 name ?? dir 回退生效。
  const name = nameMatch ? nameMatch[1].trim() : ''
  const description = descMatch ? descMatch[1].trim() : ''
  return {
    name: name || undefined,
    description: description || undefined,
  }
}

/**
 * 扫描 skillsDir 下每个含 SKILL.md 的子目录，收集 { name, description }。
 * description 取 frontmatter 的单行内容；多行 description 仅取首行（索引为速览，全文仍读 SKILL.md）。
 * 缺 description 的 skill 一律跳过、不进索引（无触发词的条目对宿主无意义），不报错。
 */
function collectSkills(skillsDir) {
  const entries = readdirSync(skillsDir, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name)
    .sort()

  const skills = []
  for (const dir of entries) {
    const skillFile = path.join(skillsDir, dir, 'SKILL.md')
    if (!existsSync(skillFile)) {
      continue
    }
    const { name, description } = parseSkillFrontmatter(readFileSync(skillFile, 'utf8'))
    if (!description) {
      continue
    }
    skills.push({ name: name ?? dir, description })
  }
  return skills
}

/**
 * 渲染索引正文（含 START/END 标记包裹），可用于幂等替换 baseline 中的旧索引段。
 * 缺 frontmatter description 的 skill 统一过滤、不注入（build 期第一方与 install 期外部 skill 一致），不报错。
 *
 * @param {string} skillsDir 要扫描的 skills 根目录
 * @param {object} [options]
 * @param {string} [options.readPathHint] 提示 agent 去哪读 SKILL.md 全文，默认 'skills/<name>/SKILL.md'
 * @returns {string} 标记包裹的索引段；无可索引 skill 时返回空串
 */
export function renderSkillIndex(skillsDir, options = {}) {
  const { readPathHint = 'skills/<name>/SKILL.md' } = options
  if (!existsSync(skillsDir)) {
    return ''
  }

  const skills = collectSkills(skillsDir)
  if (skills.length === 0) {
    return ''
  }

  const rows = skills.map(s => `| \`${s.name}\` | ${s.description} |`)
  const body = [
    SKILL_INDEX_HEADING,
    '',
    '部分宿主（如 Qoder）不自动发现 skills，仅读取本 baseline。以下索引声明可用 skill 与触发条件；',
    `当任务命中某条触发条件时，先读取 \`${readPathHint}\` 全文再按其流程执行。`,
    '',
    '| Skill | 触发条件（何时使用） |',
    '|---|---|',
    ...rows,
  ].join('\n')

  return `${SKILL_INDEX_START}\n${body}\n${SKILL_INDEX_END}`
}

/**
 * 把索引段幂等写入/替换到 baselineText 中已有的 START..END 区块。
 * 若 baseline 无标记区块，则把索引追加到末尾；indexBlock 为空串时移除已有区块。
 *
 * @param {string} baselineText 现有 baseline 全文
 * @param {string} indexBlock renderSkillIndex 的返回值（含标记，或空串）
 * @returns {string} 注入/替换后的 baseline 全文
 */
export function upsertSkillIndex(baselineText, indexBlock) {
  const normalized = baselineText.replace(/\r\n/g, '\n')
  const startIdx = normalized.indexOf(SKILL_INDEX_START)
  const endIdx = normalized.indexOf(SKILL_INDEX_END)

  // 已有标记区块：整段替换或移除。
  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    const before = normalized.slice(0, startIdx).replace(/\n+$/, '')
    const after = normalized.slice(endIdx + SKILL_INDEX_END.length).replace(/^\n+/, '')
    if (!indexBlock) {
      return `${[before, after].filter(Boolean).join('\n\n')}\n`
    }
    return `${[before, indexBlock, after].filter(Boolean).join('\n\n')}\n`
  }

  // 无标记区块：空索引则原样返回，否则追加到末尾。
  if (!indexBlock) {
    return normalized.endsWith('\n') ? normalized : `${normalized}\n`
  }
  const trimmed = normalized.replace(/\n+$/, '')
  return `${trimmed}\n\n${indexBlock}\n`
}
