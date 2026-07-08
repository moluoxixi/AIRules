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
const frontendProjectSchemaDir = path.join(process.cwd(), 'openspec', 'schemas', 'frontend-superpowers-bridge')
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

  it('frontend-superpowers-bridge schema carries frontend gates without modifying upstream bridge', () => {
    const frontendFiles = listFiles(frontendProjectSchemaDir)
    const upstreamSchema = fs.readFileSync(path.join(projectSchemaDir, 'schema.yaml'), 'utf8')
    const frontendSchema = fs.readFileSync(path.join(frontendProjectSchemaDir, 'schema.yaml'), 'utf8')
    const frontendReadme = fs.readFileSync(path.join(frontendProjectSchemaDir, 'README.md'), 'utf8')
    const frontendAdopter = fs.readFileSync(path.join(frontendProjectSchemaDir, 'templates', 'adopters', 'CLAUDE.md.fragment.md'), 'utf8')
    const frontendDesign = fs.readFileSync(path.join(frontendProjectSchemaDir, 'templates', 'design.md'), 'utf8')
    const frontendVerify = fs.readFileSync(path.join(frontendProjectSchemaDir, 'templates', 'verify.md'), 'utf8')

    assert.equal(frontendFiles.includes('schema.yaml'), true)
    assert.equal(frontendFiles.includes('templates/design.md'), true)
    assert.equal(frontendFiles.includes('templates/verify.md'), true)
    assert.match(frontendSchema, /^name: frontend-superpowers-bridge/m)
    assert.doesNotMatch(upstreamSchema, /^name: frontend-superpowers-bridge/m)
    assert.match(frontendSchema, /MISSING blocked/)
    assert.match(frontendSchema, /existing.*wrap existing.*new/s)
    assert.match(frontendSchema, /Frontend execution agent bridge/)
    assert.match(frontendReadme, /ECC Execution Agent Bridge/)
    assert.match(frontendAdopter, /ECC Execution Agents/)
    for (const agent of [
      'tdd-guide',
      'pr-test-analyzer',
      'e2e-runner',
      'code-reviewer',
      'typescript-reviewer',
      'react-reviewer',
      'vue-reviewer',
      'react-build-resolver',
      'build-error-resolver',
      'silent-failure-hunter',
    ]) {
      assert.match(frontendSchema, new RegExp(agent))
      assert.match(frontendReadme, new RegExp(agent))
      assert.match(frontendAdopter, new RegExp(agent))
    }
    assert.match(frontendDesign, /## Layout/)
    assert.match(frontendDesign, /## Fields/)
    assert.match(frontendDesign, /## Components/)
    assert.match(frontendDesign, /## States/)
    assert.match(frontendDesign, /## Frontend Test Matrix/)
    assert.match(frontendVerify, /## 5\. Frontend Design Gate/)
    assert.match(frontendVerify, /## 6\. Frontend Verification Evidence/)
  })
})
