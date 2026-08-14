import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { parseDocument } from 'yaml'
import { insertSyntheticTextPart } from '../skills/init-project/assets/hosts/opencode/lib/context-visibility.js'
import {
  ContextBudget,
  MoluoxixiContext,
} from '../skills/init-project/assets/hosts/opencode/lib/moluoxixi-context.js'
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
  it('quotes generated command frontmatter that contains YAML-significant colons', () => {
    const plan = buildPlan(['trae', 'omp'], 'python3')
    for (const target of [
      '.trae/commands/moluoxixi-finish-work.md',
      '.omp/commands/moluoxixi-finish-work.md',
    ]) {
      const content = String(plan.get(target).content)
      const frontmatter = content.match(/^---\n([\s\S]*?)\n---/u)
      expect(frontmatter, `missing frontmatter in ${target}`).not.toBeNull()
      const document = parseDocument(frontmatter[1])
      expect(document.errors, target).toHaveLength(0)
      expect(document.toJS()).toMatchObject({
        description: 'Wrap up the current session: quality gate, commit reminder, archive, journal.',
      })
      expect(frontmatter[1]).toContain('description: "Wrap up the current session:')
    }
    expect(String(plan.get('.omp/commands/moluoxixi-finish-work.md').content))
      .toContain('argument-hint: "[task-name]"')
  })

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
    for (const platform of ['gemini', 'qoder', 'copilot', 'pi', 'reasonix', 'zcode', 'trae']) {
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
    const codexImplement = String(plan.get(agentPath('codex', 'moluoxixi-implement')).content)
    expect(codexImplement).toContain('Moluoxixi Context Loading Protocol')
    expect(codexImplement).toContain('moluoxixi-hook-injected')
    expect(codexImplement).not.toContain('This host does not auto-inject task context')
  })

  it('keeps specialist authority below human review and knowledge promotion', () => {
    const plan = buildPlan(['claude', 'kiro', 'codex'], 'python3')
    for (const platform of ['claude', 'kiro', 'codex']) {
      for (const name of agentNames.slice(3)) {
        const content = String(plan.get(agentPath(platform, name)).content)
        expect(content.toLowerCase()).toContain('work only when `status` is `in_progress`')
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
      const limits = { max_file_bytes: 32768, max_artifact_bytes: 65536, max_total_bytes: 131072 }
      const blocks = new MoluoxixiContext(root).readJsonlWithFiles(
        manifest,
        limits,
        new ContextBudget(limits.max_total_bytes),
      )
      const context = blocks.join('\n')
      expect(context).toContain('.moluoxixi/spec/backend.md')
      expect(context).toContain('.moluoxixi/tasks/sample/research/evidence.md')
      expect(context).not.toContain('spec-proposals')
      expect(context).not.toContain('README.md')
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

  it('persists OpenCode context as synthetic parts without rewriting user text', () => {
    const userPart = {
      id: 'prt_000000000100abcdefghijklmn',
      sessionID: 'ses_1',
      messageID: 'msg_1',
      type: 'text',
      text: 'original prompt',
    }
    const parts = [userPart]
    const session = insertSyntheticTextPart(parts, 'session context', 'sessionStart')
    const workflow = insertSyntheticTextPart(parts, 'workflow context', 'workflowState')
    expect(userPart.text).toBe('original prompt')
    expect(session).toMatchObject({ synthetic: true, text: 'session context' })
    expect(workflow).toMatchObject({ synthetic: true, text: 'workflow context' })
    expect(parts.map(part => part.id)).toEqual([...parts.map(part => part.id)].sort())
  })

  it('projects native Codex hooks, shared Pi skills, and all shell-ticket bridges', () => {
    const plan = buildPlan(PLATFORM_ORDER, 'python3')
    expect(plan.has('.codex/hooks/inject-subagent-context.py')).toBe(true)
    expect(String(plan.get('.codex/hooks.json').content)).toContain('SubagentStart')
    expect(plan.has('.agents/skills/start/SKILL.md')).toBe(true)
    expect([...plan.keys()].some(target => target.startsWith('.pi/skills/'))).toBe(false)
    for (const hook of [
      '.gemini/hooks/inject-shell-session-context.py',
      '.qoder/hooks/inject-shell-session-context.py',
      '.codebuddy/hooks/inject-shell-session-context.py',
      '.factory/hooks/inject-shell-session-context.py',
      '.trae/hooks/inject-shell-session-context.py',
      '.zcode/hooks/inject-shell-session-context.py',
    ])
      expect(plan.has(hook), `missing ${hook}`).toBe(true)
  })

  it('preserves user-pinned Codex model keys during regeneration', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'airules-codex-model-'))
    try {
      const target = path.join(root, '.codex', 'agents', 'moluoxixi-implement.toml')
      fs.mkdirSync(path.dirname(target), { recursive: true })
      fs.writeFileSync(target, 'sandbox_mode = "workspace-write"\nmodel = "custom-model"\nmodel_reasoning_effort = "xhigh"\ndeveloper_instructions = """\nmodel = "ignore-me"\n"""\n')
      const plan = buildPlan(['codex'], 'python3', false, [], undefined, 'fullstack', { projectRoot: root })
      const content = String(plan.get('.codex/agents/moluoxixi-implement.toml').content)
      expect(content).toContain('model = "custom-model"')
      expect(content).toContain('model_reasoning_effort = "xhigh"')
      expect(content).not.toContain('model = "ignore-me"')
    }
    finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })

  it('keeps upstream scope discipline behind Moluoxixi planning and knowledge gates', () => {
    for (const base of [
      ['skills', 'init-project', 'assets', 'core', 'skills'],
      ['skills', 'init-project', 'assets', 'hosts', 'codex', 'skills'],
    ]) {
      const beforeDev = fs.readFileSync(path.join(roleRoot, ...base, 'before-dev', 'SKILL.md'), 'utf8')
      const check = fs.readFileSync(path.join(roleRoot, ...base, 'check', 'SKILL.md'), 'utf8')
      const brainstorm = fs.readFileSync(path.join(roleRoot, ...base, 'brainstorm', 'SKILL.md'), 'utf8')
      expect(beforeDev).toContain('state the change boundary')
      expect(check).toContain('Scope Discipline')
      expect(check).toContain('Do not edit formal specs directly')
      expect(brainstorm).toContain('Only a subsequent')
      expect(brainstorm).toContain('latest final planning summary')
      expect(brainstorm).toContain('execution-mode')
      expect(brainstorm).toContain('Complex tasks must have `prd.md`, `design.md`, and `implement.md`')
    }
  })
})
