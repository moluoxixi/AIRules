import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { MoluoxixiContext } from '../skills/init-project/assets/hosts/opencode/lib/moluoxixi-context.js'
import { PLATFORM_ORDER } from '../skills/init-project/scripts/hosts/catalog.mjs'
import { buildPlan } from '../skills/init-project/scripts/plan.mjs'

const agentNames = [
  'moluoxixi-research',
  'moluoxixi-implement',
  'moluoxixi-check',
  'moluoxixi-frontend',
  'moluoxixi-backend',
  'moluoxixi-test',
  'moluoxixi-security',
  'moluoxixi-database',
]
const roleRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const projectedRoots = {
  claude: ['.claude/agents', '.md'],
  cursor: ['.cursor/agents', '.md'],
  opencode: ['.opencode/agents', '.md'],
  codex: ['.codex/agents', '.toml'],
  kiro: ['.kiro/agents', '.json'],
  gemini: ['.gemini/agents', '.md'],
  qoder: ['.qoder/agents', '.md'],
  codebuddy: ['.codebuddy/agents', '.md'],
  copilot: ['.github/agents', '.agent.md'],
  droid: ['.factory/droids', '.md'],
  pi: ['.pi/agents', '.md'],
  reasonix: ['.reasonix/skills', '/SKILL.md'],
  zcode: ['.zcode/agents', '.md'],
  trae: ['.trae/agents', '.md'],
  omp: ['.omp/agents', '.md'],
}

function agentPath(platform, name) {
  const [root, suffix] = projectedRoots[platform]
  return suffix.startsWith('/') ? path.posix.join(root, name, suffix.slice(1)) : path.posix.join(root, `${name}${suffix}`)
}

describe('professional sub-agent distribution', () => {
  it('projects workflow and optional professional agents to every capable host', () => {
    const plan = buildPlan(PLATFORM_ORDER, 'python3')
    for (const platform of Object.keys(projectedRoots)) {
      for (const name of agentNames)
        expect(plan.has(agentPath(platform, name)), `${platform} missing ${name}`).toBe(true)
    }
    for (const platform of ['kilo', 'antigravity', 'devin']) {
      expect([...plan.keys()].some(target => target.startsWith(`.${platform}/agents/`))).toBe(false)
    }
  })

  it('injects implementation or check context by specialist boundary', () => {
    const plan = buildPlan(PLATFORM_ORDER, 'python3')
    for (const platform of ['codex', 'gemini', 'qoder', 'copilot', 'pi', 'reasonix', 'zcode', 'trae']) {
      for (const name of ['moluoxixi-frontend', 'moluoxixi-backend', 'moluoxixi-database']) {
        const content = String(plan.get(agentPath(platform, name)).content)
        expect(content).toContain('## Required: Load Moluoxixi Context First')
        expect(content).toContain('/implement.jsonl')
      }
      for (const name of ['moluoxixi-test', 'moluoxixi-security']) {
        const content = String(plan.get(agentPath(platform, name)).content)
        expect(content).toContain('## Required: Load Moluoxixi Context First')
        expect(content).toContain('/check.jsonl')
      }
    }
  })

  it('keeps specialist authority below human review and knowledge promotion', () => {
    const plan = buildPlan(['claude', 'kiro', 'codex'], 'python3')
    for (const platform of ['claude', 'kiro', 'codex']) {
      for (const name of agentNames.slice(3)) {
        const content = String(plan.get(agentPath(platform, name)).content)
        expect(content).toContain('Work only when `status` is `in_progress`')
        expect(content).toContain('Do not create, approve, or apply knowledge proposals')
        expect(content).toContain('Do not run git commit, push, merge, reset, or checkout')
      }
    }
    const testAgent = String(plan.get(agentPath('claude', 'moluoxixi-test')).content)
    const securityAgent = String(plan.get(agentPath('claude', 'moluoxixi-security')).content)
    expect(testAgent).toContain('Do not modify production code')
    expect(securityAgent).toContain('research/security-review.md')
  })

  it('projects the formal-knowledge boundary into every implementation and check agent', () => {
    const plan = buildPlan(PLATFORM_ORDER, 'python3')
    for (const platform of Object.keys(projectedRoots)) {
      for (const name of agentNames.slice(1, 7)) {
        const content = String(plan.get(agentPath(platform, name)).content)
        expect(content, `${platform}/${name}`).toContain('## Formal Knowledge Boundary')
        expect(content).toContain('Do not edit `.moluoxixi/spec/`')
      }
    }
  })

  it('keeps OpenCode native context loading inside formal specs and current-task research', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'airules-opencode-context-'))
    try {
      const task = path.join(root, '.moluoxixi', 'tasks', 'sample')
      const spec = path.join(root, '.moluoxixi', 'spec', 'backend.md')
      const research = path.join(task, 'research', 'evidence.md')
      const proposal = path.join(root, '.moluoxixi', 'spec-proposals', 'content', 'pending.md')
      for (const target of [spec, research, proposal, path.join(root, 'README.md')]) {
        fs.mkdirSync(path.dirname(target), { recursive: true })
        fs.writeFileSync(target, `# ${path.basename(target)}\n`)
      }
      const manifest = path.join(task, 'implement.jsonl')
      fs.writeFileSync(manifest, [
        { file: '.moluoxixi/spec/backend.md' },
        { file: '.moluoxixi/tasks/sample/research/evidence.md' },
        { file: '.moluoxixi/spec-proposals/content/pending.md' },
        { file: 'README.md' },
        { file: '../outside.md' },
      ].map(entry => JSON.stringify(entry)).join('\n'))
      const entries = new MoluoxixiContext(root).readJsonlWithFiles(manifest)
      expect(entries.map(entry => entry.path)).toEqual([
        '.moluoxixi/spec/backend.md',
        '.moluoxixi/tasks/sample/research/evidence.md',
      ])
    }
    finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })

  it('keeps Pi-family native context consumers on the same reviewed roots', () => {
    for (const relativePath of [
      'skills/init-project/assets/hosts/pi/extensions/moluoxixi/index.ts.txt',
      'skills/init-project/assets/hosts/omp/extensions/moluoxixi/index.ts.txt',
    ]) {
      const content = fs.readFileSync(path.join(roleRoot, ...relativePath.split('/')), 'utf8')
      expect(content).toContain('function resolveCuratedContextFile')
      expect(content).toContain('join(workflowRoot, "spec")')
      expect(content).toContain('join(taskDir, "research")')
      expect(content).toContain('lstatSync')
      expect(content).toContain('isSymbolicLink()')
      expect(content.match(/resolveCuratedContextFile/gu)?.length).toBeGreaterThanOrEqual(2)
    }
    const openCodeContext = fs.readFileSync(path.join(
      roleRoot,
      'skills',
      'init-project',
      'assets',
      'hosts',
      'opencode',
      'lib',
      'moluoxixi-context.js',
    ), 'utf8')
    expect(openCodeContext).toContain('[workflowRoot, tasksPath, specPath, jsonlPath]')
    expect(openCodeContext).toContain('lstatSync(candidate).isSymbolicLink()')
  })
})
