import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'vitest'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')
const MAX_SKILL_LINES = 500
const DESCRIPTION_TRIGGER_PATTERN = /(用于|适用于|当|在.+时|开始前|完成后|明确要求|Use when|Triggers? on|when)/i

// 只校验本仓库第一方 skill；vendor/skills 由上游仓库维护。
const skillRoots = ['skills']

function splitFrontmatter(content: string, skillName: string) {
  const closedBeforeContent = content.indexOf('\n---\n', 4)
  const closedAtEnd = content.endsWith('\n---') ? content.length - 4 : -1
  const frontmatterEnd = closedBeforeContent === -1 ? closedAtEnd : closedBeforeContent

  assert.ok(content.startsWith('---\n'), `SKILL.md in ${skillName} must start with YAML frontmatter (---)`)
  assert.notEqual(frontmatterEnd, -1, `SKILL.md in ${skillName} must close YAML frontmatter with ---`)

  return content.slice(4, frontmatterEnd)
}

function normalizeYamlScalar(value: string) {
  const hasSingleQuotes = value.startsWith('\'') && value.endsWith('\'')
  const hasDoubleQuotes = value.startsWith('"') && value.endsWith('"')

  return hasSingleQuotes || hasDoubleQuotes ? value.slice(1, -1) : value
}

/**
 * 解析 SKILL.md 的最小 frontmatter 契约，正文格式由 skill 自己维护。
 */
function parseFrontmatter(yamlContent: string, skillName: string) {
  const fields = new Map<string, string>()

  for (const rawLine of yamlContent.split('\n')) {
    if (rawLine.startsWith(' ') || rawLine.startsWith('\t'))
      continue

    const line = rawLine.trim()
    if (!line || line.startsWith('#'))
      continue

    const separator = line.indexOf(':')
    assert.notEqual(separator, -1, `Invalid YAML line in ${skillName}: ${rawLine}`)

    const key = line.slice(0, separator).trim()
    const value = line.slice(separator + 1).trim()
    assert.ok(key, `YAML key cannot be empty in ${skillName}: ${rawLine}`)
    assert.ok(value, `YAML value cannot be empty in ${skillName}: ${rawLine}`)

    fields.set(key, normalizeYamlScalar(value))
  }

  return fields
}

describe('agent Skills Validation', () => {
  for (const root of skillRoots) {
    const fullRootPath = path.join(rootDir, root)

    if (!fs.existsSync(fullRootPath))
      continue

    const baseDirs = fs.readdirSync(fullRootPath, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name)

    if (baseDirs.length === 0)
      continue

    // Recursively collect real skill directories and treat folders without SKILL.md as namespaces.
    const skillsToTest: { name: string, path: string }[] = []
    const collectSkills = (dir: string, nameParts: string[]) => {
      const files = fs.readdirSync(dir)
      const skillMdFile = files.find(f => f.toLowerCase() === 'skill.md')

      if (skillMdFile) {
        skillsToTest.push({ name: nameParts.join('/'), path: dir })
        return
      }

      const subDirs = fs.readdirSync(dir, { withFileTypes: true })
        .filter(d => d.isDirectory() && !d.name.startsWith('.'))

      for (const sub of subDirs)
        collectSkills(path.join(dir, sub.name), [...nameParts, sub.name])
    }

    for (const dName of baseDirs) {
      if (!dName.startsWith('.'))
        collectSkills(path.join(fullRootPath, dName), [dName])
    }

    if (skillsToTest.length === 0)
      continue

    describe(`Checking root: ${root}`, () => {
      for (const skill of skillsToTest) {
        it(`Skill: ${skill.name}`, () => {
          // 1. SKILL.md naming (case insensitivity check)
          const files = fs.readdirSync(skill.path)
          const skillMdFile = files.find(f => f.toLowerCase() === 'skill.md')

          assert.ok(skillMdFile, `Missing SKILL.md in ${skill.name}`)
          assert.strictEqual(skillMdFile, 'SKILL.md', `SKILL.md filename must be uppercase in ${skill.name}, got "${skillMdFile}"`)

          const content = fs.readFileSync(path.join(skill.path, skillMdFile!), 'utf8').replace(/\r\n/g, '\n')
          const lineCount = content.endsWith('\n')
            ? content.split('\n').length - 1
            : content.split('\n').length
          assert.ok(lineCount <= MAX_SKILL_LINES, `SKILL.md in ${skill.name} must be ${MAX_SKILL_LINES} lines or fewer`)

          const yamlContent = splitFrontmatter(content, skill.name)
          const fields = parseFrontmatter(yamlContent, skill.name)
          const nameValue = fields.get('name')
          const descValue = fields.get('description')

          assert.ok(nameValue !== undefined, `Missing 'name' in YAML frontmatter of ${skill.name}`)

          assert.ok(nameValue.length > 0, `'name' in ${skill.name} cannot be empty`)
          if (descValue !== undefined) {
            assert.ok(descValue.length > 0, `'description' in ${skill.name} cannot be empty when present`)
            assert.match(
              descValue,
              DESCRIPTION_TRIGGER_PATTERN,
              `'description' in ${skill.name} must describe trigger timing or trigger scenarios when present`,
            )
          }
          assert.strictEqual(nameValue, path.basename(skill.path), `'name' in ${skill.name} must match its folder name`)
        })
      }
    })
  }
})
