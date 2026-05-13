import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'vitest'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')

// Directories to check for skills
const skillRoots = ['skills', 'vendor/skills']

/**
 * 从简单 YAML frontmatter 中读取字段值，支持单行值和缩进的多行块。
 */
function readYamlField(lines: string[], key: string) {
  const fieldIndex = lines.findIndex(line => line.startsWith(`${key}:`))
  if (fieldIndex === -1)
    return undefined

  const inlineValue = lines[fieldIndex].slice(`${key}:`.length).trim()
  if (inlineValue)
    return inlineValue

  const blockLines: string[] = []
  for (const line of lines.slice(fieldIndex + 1)) {
    if (!line.startsWith(' ') && !line.startsWith('\t'))
      break
    const value = line.trim()
    if (value)
      blockLines.push(value)
  }

  return blockLines.join(' ').trim()
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

          // 2. Validate Metadata (name and description)
          // Extract YAML frontmatter (between --- and ---)
          const frontmatterEnd = content.indexOf('\n---\n', 4)
          const yamlMatch = content.startsWith('---\n') && frontmatterEnd !== -1
            ? content.slice(4, frontmatterEnd)
            : null
          assert.ok(yamlMatch, `SKILL.md in ${skill.name} must start with YAML frontmatter (---)`)

          const yamlContent = yamlMatch!
          const yamlLines = yamlContent.split('\n')
          const nameValue = readYamlField(yamlLines, 'name')
          const descValue = readYamlField(yamlLines, 'description')

          assert.ok(nameValue !== undefined, `Missing 'name' in YAML frontmatter of ${skill.name}`)
          assert.ok(descValue !== undefined, `Missing 'description' in YAML frontmatter of ${skill.name}`)

          assert.ok(nameValue.length > 0, `'name' in ${skill.name} cannot be empty`)
          assert.ok(descValue.length > 0, `'description' in ${skill.name} cannot be empty`)
        })
      }
    })
  }
})
