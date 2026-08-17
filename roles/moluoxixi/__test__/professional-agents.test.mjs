import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { parseDocument } from 'yaml'
import { insertSyntheticTextPart } from '../packages/cli/src/templates/opencode/lib/context-visibility.js'
import {
  ContextBudget,
  TrellisContext as MoluoxixiContext,
} from '../packages/cli/src/templates/opencode/lib/trellis-context.js'
import { PLATFORM_ORDER } from '../skills/init-project/scripts/hosts/catalog.mjs'
import { buildPlan } from '../skills/init-project/scripts/plan.mjs'
import { readTemplateFile } from '../skills/init-project/scripts/templates.mjs'

const agentNames = [
  'moluoxixi-research',
  'moluoxixi-implement',
  'moluoxixi-check',
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
  grok: ['.grok/agents', '.md'],
  kimi: ['.kimi-code/agents', '.md'],
  pi: ['.pi/agents', '.md'],
  reasonix: ['.reasonix/skills', '/SKILL.md'],
  zcode: ['.zcode/agents', '.md'],
  trae: ['.trae/agents', '.md'],
  omp: ['.omp/agents', '.md'],
  snow: ['.snow/agents', '.md'],
}

const coreSkillRoots = {
  claude: '.claude/skills',
  cursor: '.cursor/skills',
  opencode: '.opencode/skills',
  codex: '.agents/skills',
  kilo: '.kilocode/skills',
  kiro: '.kiro/skills',
  gemini: '.agents/skills',
  antigravity: '.agent/skills',
  devin: '.devin/skills',
  qoder: '.qoder/skills',
  codebuddy: '.codebuddy/skills',
  copilot: '.github/skills',
  droid: '.factory/skills',
  dsh: '.agents/skills',
  pi: '.agents/skills',
  reasonix: '.reasonix/skills',
  zcode: '.zcode/skills',
  trae: '.trae/skills',
  omp: '.omp/skills',
  grok: '.grok/skills',
  kimi: '.agents/skills',
  snow: '.snow/skills',
}
const allPlatformPlan = buildPlan(PLATFORM_ORDER, 'python3')

function agentPath(platform, name) {
  const [root, suffix] = projectedRoots[platform]
  const projectedName = platform === 'reasonix' ? name.replace(/^moluoxixi-/u, '') : name
  return suffix.startsWith('/') ? path.posix.join(root, projectedName, suffix.slice(1)) : path.posix.join(root, `${projectedName}${suffix}`)
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

  it('projects the upstream workflow agents to every capable host', () => {
    const plan = allPlatformPlan
    for (const platform of Object.keys(projectedRoots)) {
      const expectedAgents = platform === 'reasonix' ? agentNames.slice(1) : agentNames
      for (const name of expectedAgents)
        expect(plan.has(agentPath(platform, name)), `${platform} missing ${name}`).toBe(true)
    }
    for (const platform of ['kilo', 'antigravity', 'devin']) {
      expect([...plan.keys()].some(target => target.startsWith(`.${platform}/agents/`))).toBe(false)
    }
  })

  it('injects implementation or check context by specialist boundary', () => {
    const plan = allPlatformPlan
    for (const platform of ['gemini', 'qoder', 'copilot', 'pi', 'reasonix', 'zcode', 'trae', 'grok', 'kimi']) {
      const implement = String(plan.get(agentPath(platform, 'moluoxixi-implement')).content)
      const check = String(plan.get(agentPath(platform, 'moluoxixi-check')).content)
      expect(implement).toContain('## Required: Load Moluoxixi Context First')
      expect(implement).toContain('/implement.jsonl')
      expect(check).toContain('## Required: Load Moluoxixi Context First')
      expect(check).toContain('/check.jsonl')
    }
    const codexImplement = String(plan.get(agentPath('codex', 'moluoxixi-implement')).content)
    expect(codexImplement).toContain('Moluoxixi Context Loading Protocol')
    expect(codexImplement).toContain('moluoxixi-hook-injected')
    expect(codexImplement).not.toContain('This host does not auto-inject task context')
  })

  it('keeps implementation and check authority below human review and knowledge promotion', () => {
    const plan = buildPlan(['claude', 'kiro', 'codex'], 'python3')
    for (const platform of ['claude', 'kiro', 'codex']) {
      for (const name of ['moluoxixi-implement', 'moluoxixi-check']) {
        const content = String(plan.get(agentPath(platform, name)).content)
        expect(content).toContain('## Formal Knowledge Boundary')
        expect(content).toContain('Do not edit `.moluoxixi/spec/`')
        expect(content).toContain('approve or apply knowledge proposals')
        expect(content).toContain('or commit changes')
      }
    }
  })

  it('projects the formal-knowledge boundary into every implementation and check agent', () => {
    const plan = allPlatformPlan
    for (const platform of Object.keys(projectedRoots)) {
      for (const name of agentNames.slice(1)) {
        const content = String(plan.get(agentPath(platform, name)).content)
        expect(content, `${platform}/${name}`).toContain('## Formal Knowledge Boundary')
        expect(content).toContain('Do not edit `.moluoxixi/spec/`')
      }
    }
  })

  it('keeps OpenCode native context loading bounded to valid manifest paths', () => {
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
      expect(context).toContain('spec-proposals')
      expect(context).toContain('README.md')
      expect(context).not.toContain('outside.md')
    }
    finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })

  it('keeps Pi-family and OpenCode native context consumers on the upstream budget contract', () => {
    const piContext = readTemplateFile('pi/extensions/trellis/index.ts.txt')
    expect(piContext).toContain('function readContextInjectionLimits')
    expect(piContext).toContain('function truncateUtf8')
    expect(piContext).toContain('function isBinaryContent')
    expect(piContext).toContain('function materializeFile')
    const ompContext = readTemplateFile('omp/extensions/trellis/index.ts.txt')
    expect(ompContext).toContain('function resolveTrustedRoots')
    expect(ompContext).toContain('function resolveProjectFile')
    expect(ompContext).toContain('lstatSync')
    const openCodeContext = readTemplateFile('opencode/lib/trellis-context.js')
    expect(openCodeContext).toContain('function readContextInjectionLimits')
    expect(openCodeContext).toContain('function truncateUtf8')
    expect(openCodeContext).toContain('function materializeFile')
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

  it('projects native Codex hooks, shared core skills, and all shell-ticket bridges', () => {
    const plan = allPlatformPlan
    expect(plan.has('.codex/hooks/inject-subagent-context.py')).toBe(true)
    expect(String(plan.get('.codex/hooks.json').content)).toContain('SubagentStart')
    expect(plan.has('.agents/skills/start/SKILL.md')).toBe(true)
    expect([...plan.keys()].some(target => target.startsWith('.codex/skills/'))).toBe(false)
    expect([...plan.keys()].some(target => !target.startsWith('.moluoxixi/runtime/update/') && target.endsWith('/SKILL.md.txt'))).toBe(false)
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

  it('restores bundled skill templates for every supported host', () => {
    expect(Object.keys(coreSkillRoots)).toEqual(PLATFORM_ORDER)
    const plan = allPlatformPlan

    for (const platform of PLATFORM_ORDER) {
      const skillEntry = `${coreSkillRoots[platform]}/before-dev/SKILL.md`
      expect(plan.has(skillEntry), `${platform} missing ${skillEntry}`).toBe(true)
      expect(String(plan.get(skillEntry).content), `${platform} has invalid before-dev skill frontmatter`).toMatch(/^name: before-dev$/mu)
    }

    const leakedTemplates = [...plan.keys()].filter(target =>
      !target.startsWith('.moluoxixi/runtime/update/') && target.endsWith('/SKILL.md.txt'),
    )
    expect(leakedTemplates).toEqual([])

    for (const platform of ['codex', 'gemini', 'pi']) {
      const isolatedPlan = buildPlan([platform], 'python3')
      const skillEntry = `${coreSkillRoots[platform]}/before-dev/SKILL.md`
      expect(isolatedPlan.has(skillEntry), `${platform} missing ${skillEntry} in isolation`).toBe(true)
      expect([...isolatedPlan.keys()].filter(target =>
        !target.startsWith('.moluoxixi/runtime/update/') && target.endsWith('/SKILL.md.txt'),
      ), `${platform} leaked bundled skill templates in isolation`).toEqual([])
    }
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
    const beforeDev = readTemplateFile('common/skills/before-dev.md')
    const check = readTemplateFile('common/skills/check.md')
    const brainstorm = readTemplateFile('common/skills/brainstorm.md')
    expect(beforeDev).toContain('state the change boundary')
    expect(check).toContain('Scope Discipline')
    expect(check).toContain('Do not edit formal specs directly')
    expect(brainstorm).toContain('Only a subsequent')
    expect(brainstorm).toContain('latest final planning summary')
    expect(brainstorm).toContain('execution-mode')
    expect(brainstorm).toContain('Complex tasks must have `prd.md`, `design.md`, and `implement.md`')
  })
})
