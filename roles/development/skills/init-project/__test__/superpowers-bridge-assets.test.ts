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
    assert.match(schema, /bmad-prd/)
    assert.match(schema, /bmad-create-epics-and-stories/)
    assert.match(schema, /bmad-shard-doc/)
    assert.match(schema, /gstack-qa-only/)
    assert.match(schema, /frontend-testing/)
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

  it('plan carries optional frontend planning notes without changing task split semantics', () => {
    const schema = readAsset('schema.yaml')
    const plan = readAsset('templates', 'plan.md')

    assert.match(schema, /If the implementation includes frontend UI work/)
    assert.match(schema, /planning aid, not the task split axis/)
    assert.match(schema, /Frontend Test Matrix/)
    assert.match(schema, /API missing fields MUST be marked MISSING blocked/)
    assert.match(plan, /## Frontend Planning Notes/)
    assert.match(plan, /### Layout/)
    assert.match(plan, /### Fields/)
    assert.match(plan, /Display Form/)
    assert.match(plan, /API Available/)
    assert.match(plan, /### Components/)
    assert.match(plan, /Existing \/ New/)
    assert.match(plan, /### States/)
    assert.match(plan, /### Frontend Test Matrix/)
    assert.match(plan, /Test Level/)
    assert.match(plan, /Viewport/)
    assert.match(plan, /Console \/ Network/)
  })

  it('schema and templates connect change units, scenarios and TC coverage', () => {
    const schema = readAsset('schema.yaml')
    const spec = readAsset('templates', 'spec.md')
    const plan = readAsset('templates', 'plan.md')
    const verify = readAsset('templates', 'verify.md')

    for (const content of [schema, spec, plan, verify]) {
      assert.match(content, /change_unit_id/)
    }
    assert.match(schema, /verify:scenario-coverage/)
    assert.match(schema, /covers: SCN-/)
    assert.match(spec, /SCN-<capability>-<NNN>/)
    assert.match(plan, /Scenario IDs/)
    assert.match(verify, /Scenario Coverage/)
    assert.match(verify, /knowledge\/测试/)
  })

  it('schema requires development document intake before planning or coding', () => {
    const schema = readAsset('schema.yaml')
    const intake = readAsset('templates', 'intake.md')

    assert.match(schema, /id: intake/)
    assert.match(schema, /Development document intake gate/)
    assert.match(schema, /Do NOT proceed to coding/)
    assert.match(schema, /MISSING blocked/)
    assert.match(schema, /bmad-prd/)
    assert.match(schema, /bmad-create-epics-and-stories/)
    assert.match(schema, /bmad-generate-project-context/)
    assert.match(schema, /requires:\n {6}- intake/)
    assert.match(intake, /## Document Package/)
    assert.match(intake, /## PRD Validation/)
    assert.match(intake, /## Development Readiness Decision/)
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
