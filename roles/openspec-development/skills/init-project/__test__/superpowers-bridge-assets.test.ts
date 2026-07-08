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
const initProjectSkill = path.join(process.cwd(), 'roles', 'openspec-development', 'skills', 'init-project', 'SKILL.md')
const frontendSchemaSkillDir = path.join(process.cwd(), 'roles', 'openspec-development', 'skills', 'frontend-superpowers-bridge')
const openspecSkillsManifest = path.join(process.cwd(), 'roles', 'openspec-development', 'constants', 'skills.ts')

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

  it('init-project references keep frontend policy out of injected project rules', () => {
    const airulesBase = fs.readFileSync(path.join(referencesDir, 'airules-base.md'), 'utf8')
    const agentsBaseline = fs.readFileSync(path.join(referencesDir, 'agents.md'), 'utf8')
    const injectedRules = `${airulesBase}\n\n${agentsBaseline}`

    assert.deepEqual(fs.readdirSync(referencesDir).sort(), ['agents.md', 'airules-base.md'])
    assert.match(agentsBaseline, /Everything Claude Code \(ECC\) — Agent Instructions/)
    assert.match(agentsBaseline, /\| planner \| Implementation planning \|/)
    assert.doesNotMatch(injectedRules, /前端字段与组件评估纪律/)
    assert.doesNotMatch(injectedRules, /frontend-testing/)
    assert.doesNotMatch(agentsBaseline, /frontend-superpowers-bridge/)
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
      'planner',
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

  it('frontend-superpowers-bridge schema is selected by init-project, not exposed as a standalone skill', () => {
    const manifest = fs.readFileSync(openspecSkillsManifest, 'utf8')
    const skill = fs.readFileSync(initProjectSkill, 'utf8')

    assert.equal(fs.existsSync(path.join(frontendSchemaSkillDir, 'SKILL.md')), false)
    assert.doesNotMatch(manifest, /frontend-superpowers-bridge/)
    assert.match(skill, /前端项目/)
    assert.match(skill, /从克隆到的 `superpowers-bridge\/` 派生 `frontend-superpowers-bridge`/)
    assert.match(skill, /openspec schema validate <selected-schema>/)
  })
})
