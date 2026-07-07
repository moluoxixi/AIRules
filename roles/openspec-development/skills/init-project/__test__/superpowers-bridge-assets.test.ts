import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { describe, it } from 'vitest'

const deprecatedLocalSchemaDir = path.join(
  process.cwd(),
  'roles',
  'openspec-development',
  'skills',
  'init-project',
  'assets',
  'superpowers-bridge',
)
const projectSchemaDir = path.join(process.cwd(), 'openspec', 'schemas', 'superpowers-bridge')
const referencesDir = path.join(process.cwd(), 'roles', 'openspec-development', 'skills', 'init-project', 'references')

function readReference(fileName: string) {
  return fs.readFileSync(path.join(referencesDir, fileName), 'utf8')
}

function listFiles(root: string, dir = root): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const absolutePath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      return listFiles(root, absolutePath)
    }
    return path.relative(root, absolutePath).replace(/\\/g, '/')
  }).sort()
}

describe('superpowers-bridge upstream schema', () => {
  it('does not keep a local superpowers-bridge schema copy under init-project assets', () => {
    assert.equal(fs.existsSync(deprecatedLocalSchemaDir), false)
  })

  it('optional frontend-only reference carries frontend field and component assessment policy', () => {
    const airulesBase = readReference('airules-base.md')
    const frontendOnly = readReference('frontend-only.md')

    assert.doesNotMatch(airulesBase, /前端字段与组件评估纪律/)
    assert.match(frontendOnly, /前端字段与组件评估纪律/)
    assert.match(frontendOnly, /UI 字段/)
    assert.match(frontendOnly, /API|接口/)
    assert.match(frontendOnly, /字段对比/)
    assert.match(frontendOnly, /组件复用/)
    assert.match(frontendOnly, /封装/)
    assert.match(frontendOnly, /MISSING blocked/)
    assert.match(frontendOnly, /frontend-testing/)
  })

  it('current project OpenSpec schema remains installed as a generated project schema', () => {
    const projectFiles = listFiles(projectSchemaDir)

    assert.equal(projectFiles.includes('schema.yaml'), true)
    assert.equal(projectFiles.includes('templates/tasks.md'), true)
  })
})
