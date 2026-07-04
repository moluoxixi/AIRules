import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { describe, it } from 'vitest'

const assetDir = path.join(
  process.cwd(),
  'roles',
  'development',
  'skills',
  'init-project',
  'assets',
  'superpowers-bridge',
)
const projectSchemaDir = path.join(process.cwd(), 'openspec', 'schemas', 'superpowers-bridge')

function readAsset(...parts: string[]) {
  return fs.readFileSync(path.join(assetDir, ...parts), 'utf8')
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

describe('superpowers-bridge assets', () => {
  it('schema keeps upstream execution guardrails while using AIRules skill names', () => {
    const schema = readAsset('schema.yaml')

    assert.match(schema, /PRECHECK/)
    assert.match(schema, /brainstorming/)
    assert.match(schema, /writing-plans/)
    assert.match(schema, /using-git-worktrees/)
    assert.match(schema, /subagent-driven-development/)
    assert.match(schema, /test-driven-development/)
    assert.match(schema, /requesting-code-review/)
    assert.match(schema, /finishing-a-development-branch/)
    assert.match(schema, /verify\.md is produced AFTER the apply\s+phase/)
    assert.match(schema, /retrospective[\s\S]*BEFORE opening any PR/)
    assert.match(schema, /openspec archive -y/)
    assert.match(schema, /Superpowers skills installed/)
    assert.doesNotMatch(schema, /superpowers:/)
    assert.doesNotMatch(schema, /Superpowers plugin/)
  })

  it('templates stay domain-neutral before a specialized contract is approved', () => {
    const design = readAsset('templates', 'design.md')
    const verify = readAsset('templates', 'verify.md')

    assert.doesNotMatch(design, /Frontend Implementation Contract/)
    assert.doesNotMatch(design, /Field Usage Matrix/)
    assert.doesNotMatch(design, /API Field Comparison/)
    assert.doesNotMatch(design, /Component Plan/)
    assert.doesNotMatch(verify, /Frontend Design Contract Audit/)
  })

  it('current project OpenSpec schema mirrors the development init-project asset', () => {
    const assetFiles = listFiles(assetDir)
    const projectFiles = listFiles(projectSchemaDir)

    assert.deepEqual(projectFiles, assetFiles)
    for (const file of assetFiles) {
      assert.equal(
        fs.readFileSync(path.join(projectSchemaDir, file), 'utf8'),
        fs.readFileSync(path.join(assetDir, file), 'utf8'),
        file,
      )
    }
  })
})
