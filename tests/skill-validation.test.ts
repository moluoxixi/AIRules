import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'vitest'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')

// Directories to check for skills
const skillRoots = ['skills', 'vendor/skills']

describe('Agent Skills Validation', () => {
  for (const root of skillRoots) {
    const fullRootPath = path.join(rootDir, root)

    if (!fs.existsSync(fullRootPath))
      continue

    const baseDirs = fs.readdirSync(fullRootPath, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name)

    if (baseDirs.length === 0)
      continue

    // Collect all skills safely handling superpowers exceptional nesting
    const skillsToTest: { name: string, path: string }[] = []
    for (const dName of baseDirs) {
      if (dName.startsWith('.'))
        continue

      if (dName === 'superpowers') {
        const p = path.join(fullRootPath, dName)
        const subDirs = fs.readdirSync(p, { withFileTypes: true })
          .filter(d => d.isDirectory() && !d.name.startsWith('.'))
        for (const sub of subDirs) {
          skillsToTest.push({ name: `${dName}/${sub.name}`, path: path.join(p, sub.name) })
        }
      }
      else {
        skillsToTest.push({ name: dName, path: path.join(fullRootPath, dName) })
      }
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

          const content = fs.readFileSync(path.join(skill.path, skillMdFile!), 'utf8')

          // 2. Validate Metadata (name and description)
          // Extract YAML frontmatter (between --- and ---)
          const yamlMatch = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n/)
          assert.ok(yamlMatch, `SKILL.md in ${skill.name} must start with YAML frontmatter (---)`)

          const yamlContent = yamlMatch![1]
          const nameMatch = yamlContent.match(/^name:\s*(.+)$/m)
          const descMatch = yamlContent.match(/^description:\s*(.+)$/m)

          assert.ok(nameMatch, `Missing 'name' in YAML frontmatter of ${skill.name}`)
          assert.ok(descMatch, `Missing 'description' in YAML frontmatter of ${skill.name}`)

          const nameValue = nameMatch![1].trim()
          const descValue = descMatch![1].trim()

          assert.ok(nameValue.length > 0, `'name' in ${skill.name} cannot be empty`)
          assert.ok(descValue.length > 0, `'description' in ${skill.name} cannot be empty`)
        })
      }
    })
  }
})
