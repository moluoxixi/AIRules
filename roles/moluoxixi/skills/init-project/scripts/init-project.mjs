#!/usr/bin/env node

import { Buffer } from 'node:buffer'
import { spawnSync } from 'node:child_process'
import { createHash, randomUUID } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url))
const ROLE_ROOT = path.resolve(SCRIPT_DIR, '..', '..', '..')
const ASSET_ROOT = path.resolve(SCRIPT_DIR, '..', 'assets', 'trellis-v0.6.7')
const TEMPLATE_ROOT = path.join(ASSET_ROOT, 'templates')
const RUNTIME_ROOT = path.join(ROLE_ROOT, 'runtime')
const LOCAL_SKILLS_ROOT = fs.existsSync(path.join(ROLE_ROOT, 'skills', 'trellis-channel'))
  ? path.join(ROLE_ROOT, 'skills')
  : path.resolve(SCRIPT_DIR, '..', 'skills')
const PROJECT_ROOT_DIR = '.moluoxixi'
const MANIFEST_PATH = projectPath('airules-init-manifest.json')
const GENERATOR_VERSION = '1.0.0'
const TRELLIS_REVISION = 'e7c5ead4d0dfd717d11a40b6bc0c80d8af94c49a'

const PLATFORM_ORDER = [
  'claude',
  'cursor',
  'opencode',
  'codex',
  'kilo',
  'kiro',
  'gemini',
  'antigravity',
  'devin',
  'qoder',
  'codebuddy',
  'copilot',
  'droid',
  'pi',
  'reasonix',
  'zcode',
  'trae',
  'omp',
]

const PLATFORM_CONTEXT = {
  claude: context('/trellis:', 'Bash scripts or Task calls', 'Slash commands', true, true, 'claude'),
  cursor: context('/trellis-', 'Bash scripts or Task calls', 'Slash commands', true, true, 'cursor'),
  opencode: context('/trellis:', 'Bash scripts or Task calls', 'Slash commands', true, false, 'opencode'),
  codex: context('$', 'Bash scripts or tool calls', 'Skills', true, false, 'codex'),
  kilo: context('/trellis:', 'Bash scripts or file reads', 'Workflows', false, false, 'kilo'),
  kiro: context('$', 'Bash scripts or tool calls', 'Skills', true, true, 'kiro'),
  gemini: context('/trellis:', 'Bash scripts or tool calls', 'Slash commands', true, true, 'gemini'),
  antigravity: context('/', 'Bash scripts or file reads', 'Workflows', false, false, 'antigravity'),
  devin: context('/trellis-', 'Bash scripts or file reads', 'Workflows', false, false, 'devin'),
  qoder: context('$', 'Bash scripts or tool calls', 'Skills', true, true, 'qoder'),
  codebuddy: context('/trellis:', 'Bash scripts or Task calls', 'Slash commands', true, true, 'codebuddy'),
  copilot: context('/', 'Bash scripts or tool calls', 'Prompts', true, true, 'copilot'),
  droid: context('/trellis-', 'Bash scripts or Task calls', 'Slash commands', true, true, 'droid'),
  pi: context('/trellis-', 'Bash scripts or tool calls', 'Slash commands', true, true, 'pi'),
  reasonix: context('/skill trellis-', 'Bash scripts or tool calls', 'Skills', true, false, 'reasonix'),
  zcode: context('/trellis:', 'Bash scripts or Agent calls', 'Skills', true, false, 'zcode'),
  trae: context('/trellis-', 'Bash scripts or tool calls', 'Commands', true, true, 'trae'),
  omp: context('/trellis:', 'Bash scripts or Task calls', 'Slash commands', true, true, 'omp'),
}

const PLATFORM_DIRECT = {
  claude: ['claude', '.claude'],
  cursor: ['cursor', '.cursor'],
  opencode: ['opencode', '.opencode'],
  codex: ['codex', '.codex'],
  kiro: ['kiro', '.kiro'],
  gemini: ['gemini', '.gemini'],
  qoder: ['qoder', '.qoder'],
  codebuddy: ['codebuddy', '.codebuddy'],
  droid: ['droid', '.factory'],
  pi: ['pi', '.pi'],
  zcode: ['zcode', '.zcode'],
  trae: ['trae', '.trae'],
  omp: ['omp', '.omp'],
}

const PLATFORM_SKILLS_ROOT = {
  claude: '.claude/skills',
  cursor: '.cursor/skills',
  opencode: '.opencode/skills',
  kilo: '.kilocode/skills',
  gemini: '.agents/skills',
  antigravity: '.agent/skills',
  devin: '.devin/skills',
  qoder: '.qoder/skills',
  codebuddy: '.codebuddy/skills',
  copilot: '.github/skills',
  droid: '.factory/skills',
  pi: '.pi/skills',
  zcode: '.zcode/skills',
  trae: '.trae/skills',
  omp: '.omp/skills',
}

const SHARED_HOOKS = {
  claude: ['session-start.py', 'inject-workflow-state.py', 'inject-subagent-context.py'],
  cursor: ['session-start.py', 'inject-shell-session-context.py', 'inject-subagent-context.py'],
  codex: ['inject-workflow-state.py'],
  gemini: ['session-start.py', 'inject-workflow-state.py'],
  qoder: ['session-start.py', 'inject-workflow-state.py'],
  copilot: ['inject-workflow-state.py'],
  codebuddy: ['session-start.py', 'inject-workflow-state.py', 'inject-subagent-context.py'],
  droid: ['session-start.py', 'inject-workflow-state.py', 'inject-subagent-context.py'],
  kiro: ['session-start.py', 'inject-workflow-state.py', 'inject-subagent-context.py'],
  trae: ['session-start.py', 'inject-workflow-state.py'],
}

const HOOK_ROOTS = {
  claude: '.claude/hooks',
  cursor: '.cursor/hooks',
  codex: '.codex/hooks',
  gemini: '.gemini/hooks',
  qoder: '.qoder/hooks',
  copilot: '.github/copilot/hooks',
  codebuddy: '.codebuddy/hooks',
  droid: '.factory/hooks',
  kiro: '.kiro/hooks',
  trae: '.trae/hooks',
}

const SKILL_DESCRIPTIONS = {
  'before-dev': 'Loads the relevant Trellis specs and constraints before implementation. Use before editing code or starting a development task.',
  'brainstorm': 'Clarifies requirements and explores implementation approaches before coding. Use when a request is ambiguous or needs design decisions.',
  'break-loop': 'Analyzes recurring failures, captures root causes, and records prevention guidance. Use after repeated fixes or regressions.',
  'check': 'Verifies spec compliance, lint, type checking, tests, data flow, reuse, and consistency. Use before considering work complete.',
  'update-spec': `Records executable contracts and conventions in ${projectPath('spec')}. Use when durable project knowledge is discovered.`,
  'start': 'Initializes a Trellis work session by loading workflow, task, and project context. Use at the start of project work.',
  'continue': 'Resumes the active Trellis task at the correct workflow phase. Use after interruption or context loss.',
  'finish-work': 'Runs the completion workflow, records the session, and prepares the task for handoff or archival.',
}

function context(cmdRefPrefix, executorAI, userActionLabel, agentCapable, hasHooks, cliFlag) {
  return { cmdRefPrefix, executorAI, userActionLabel, agentCapable, hasHooks, cliFlag }
}

function sha256(content) {
  return createHash('sha256').update(content).digest('hex')
}

function toPosix(value) {
  return value.split(path.sep).join('/')
}

function projectPath(...segments) {
  return path.posix.join(PROJECT_ROOT_DIR, ...segments)
}

function parseArgs(argv) {
  const result = { dryRun: false, force: false, platforms: [], project: '.', python: process.platform === 'win32' ? 'python' : 'python3' }
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--force')
      result.force = true
    else if (arg === '--dry-run')
      result.dryRun = true
    else if (arg === '--project')
      result.project = requireValue(argv, ++index, arg)
    else if (arg === '--platform')
      result.platforms.push(...requireValue(argv, ++index, arg).split(','))
    else if (arg === '--python')
      result.python = requireValue(argv, ++index, arg)
    else if (arg === '--developer')
      result.developer = requireValue(argv, ++index, arg)
    else if (arg === '--help' || arg === '-h')
      result.help = true
    else throw new Error(`Unknown argument: ${arg}`)
  }
  return result
}

function requireValue(argv, index, flag) {
  const value = argv[index]
  if (!value || value.startsWith('--'))
    throw new Error(`${flag} requires a value`)
  return value
}

function printHelp() {
  process.stdout.write(`Usage: node init-project.mjs --project <path> --platform <id[,id...]> [options]\n\nPlatforms: ${PLATFORM_ORDER.join(', ')}, all\nOptions:\n  --developer <name>  Initialize local developer identity\n  --python <command>  Python 3.9+ command\n  --force             Replace conflicting managed files\n  --dry-run           Print the plan without writing\n`)
}

function normalizePlatforms(values) {
  const expanded = values.flatMap(value => value === 'all' ? PLATFORM_ORDER : [value === 'claude-code' ? 'claude' : value])
  const unique = [...new Set(expanded.filter(Boolean))]
  if (unique.length === 0)
    throw new Error('At least one --platform value is required')
  for (const platform of unique) {
    if (!PLATFORM_ORDER.includes(platform))
      throw new Error(`Unsupported platform: ${platform}`)
  }
  return PLATFORM_ORDER.filter(platform => unique.includes(platform))
}

function requirePython(command) {
  const probe = spawnSync(command, ['--version'], { encoding: 'utf8', windowsHide: true })
  const output = `${probe.stdout ?? ''}\n${probe.stderr ?? ''}`
  const match = output.match(/Python\s+(\d+)\.(\d+)/u)
  if (probe.error || probe.status !== 0 || !match)
    throw new Error(`Python command is unavailable: ${command}`)
  const major = Number(match[1])
  const minor = Number(match[2])
  if (major < 3 || (major === 3 && minor < 9))
    throw new Error(`Python 3.9+ is required; found ${match[0]}`)
}

function readText(...segments) {
  return fs.readFileSync(path.join(TEMPLATE_ROOT, ...segments), 'utf8')
}

function walkFiles(root) {
  const files = []
  function visit(current) {
    for (const entry of fs.readdirSync(current, { withFileTypes: true }).sort((left, right) => left.name < right.name ? -1 : left.name > right.name ? 1 : 0)) {
      const target = path.join(current, entry.name)
      if (entry.isDirectory())
        visit(target)
      else if (entry.isFile())
        files.push(target)
      else throw new Error(`Unsupported template entry: ${target}`)
    }
  }
  visit(root)
  return files
}

function resolveTemplate(content, ctx, pythonCommand, neutral = false) {
  let result = content.replaceAll('{{PYTHON_CMD}}', pythonCommand)
  if (ctx) {
    result = result.replace(/\{\{CMD_REF:(\w[\w-]*)\}\}/gu, (_match, name) => neutral ? `\`${name}\` (Trellis command)` : `${ctx.cmdRefPrefix}${name}`)
    result = result.replaceAll('{{EXECUTOR_AI}}', ctx.executorAI)
    result = result.replaceAll('{{USER_ACTION_LABEL}}', ctx.userActionLabel)
    result = result.replaceAll('{{CLI_FLAG}}', ctx.cliFlag)
    for (const flag of ['AGENT_CAPABLE', 'HAS_HOOKS']) {
      const enabled = flag === 'AGENT_CAPABLE' ? ctx.agentCapable : ctx.hasHooks
      result = result.replace(new RegExp(`\\{\\{#${flag}\\}\\}([\\s\\S]*?)\\{\\{/${flag}\\}\\}`, 'gu'), enabled ? '$1' : '')
      result = result.replace(new RegExp(`\\{\\{\\^${flag}\\}\\}([\\s\\S]*?)\\{\\{/${flag}\\}\\}`, 'gu'), enabled ? '' : '$1')
    }
    result = result.replace(/\n{3,}/gu, '\n\n')
  }
  if (pythonCommand !== 'python3') {
    result = result.split('\n').map(line => line.startsWith('#!') ? line : line.replaceAll('python3', pythonCommand)).join('\n')
  }
  return result
}

function wrapSkill(name, content) {
  const base = name.replace(/^trellis-/u, '')
  const description = SKILL_DESCRIPTIONS[base]
  if (!description)
    throw new Error(`Missing description for skill: ${name}`)
  return `---\nname: ${name}\ndescription: "${description}"\n---\n\n${content}`
}

function wrapCommand(name, content) {
  const description = {
    'start': 'Initialize a Trellis development session.',
    'continue': 'Resume work on the current task at the correct phase.',
    'finish-work': 'Wrap up the current session: quality gate, commit reminder, archive, journal.',
  }[name.replace(/^trellis-/u, '')]
  return `---\nname: ${name}\ndescription: ${description}\n---\n\n${content}`
}

function wrapOmpCommand(name, content) {
  const base = name.replace(/^trellis-/u, '')
  const description = {
    'start': 'Initialize a Trellis development session.',
    'continue': 'Resume work on the current task at the correct phase.',
    'finish-work': 'Wrap up the current session: quality gate, commit reminder, archive, journal.',
  }[base]
  const hint = base === 'finish-work' ? '\nargument-hint: [task-name]' : ''
  return `---\ndescription: ${description}${hint}\n---\n\n${content.replace(/^# [^\n]+\n\n/u, '')}`
}

function addPlan(plan, relativePath, content, options = {}) {
  const normalized = path.posix.normalize(relativePath.replace(/\\/gu, '/'))
  if (!normalized || normalized === '.' || path.posix.isAbsolute(normalized) || normalized === '..' || normalized.startsWith('../') || normalized.includes('\0')) {
    throw new Error(`Unsafe output path: ${relativePath}`)
  }
  const buffer = Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf8')
  const existing = plan.get(normalized)
  if (existing && !existing.content.equals(buffer))
    throw new Error(`Conflicting templates target ${normalized}`)
  plan.set(normalized, { content: buffer, executable: options.executable === true, merge: options.merge ?? 'replace', platform: options.platform ?? 'shared' })
}

function addTree(plan, sourceRoot, targetRoot, options = {}) {
  if (!fs.existsSync(sourceRoot))
    return
  for (const source of walkFiles(sourceRoot)) {
    let relative = toPosix(path.relative(sourceRoot, source))
    if (options.filter && !options.filter(relative))
      continue
    if (options.rename)
      relative = options.rename(relative)
    const target = path.posix.join(targetRoot, relative)
    const merge = options.merge ?? (/(^|\/)(settings|hooks)\.json$/u.test(target) || target.endsWith('/package.json') ? 'json' : target.endsWith('/config.toml') ? 'block-hash' : 'replace')
    const sourceContent = fs.readFileSync(source, 'utf8')
    const transformed = options.transform ? options.transform(relative, sourceContent) : sourceContent
    const resolved = options.context || options.python ? resolveTemplate(transformed, options.context, options.python) : transformed
    addPlan(plan, target, resolved, {
      executable: target.endsWith('.py') || target.endsWith('.mjs'),
      merge,
      platform: options.platform,
    })
  }
}

function localizeProjectRuntime(relativePath, content) {
  let localized = content
    .replaceAll('trellis channel', `node ${projectPath('runtime', 'trellis.mjs')} channel`)
    .replaceAll('trellis mem', `node ${projectPath('runtime', 'trellis.mjs')} mem`)
    .replaceAll('trellis workflow', `node ${projectPath('runtime', 'trellis.mjs')} workflow`)
    .replaceAll('trellis update', `node ${projectPath('runtime', 'trellis.mjs')} update`)
    .replaceAll('.trellis', PROJECT_ROOT_DIR)
  if (relativePath === 'common/session_context.py') {
    localized = localized.replace(
      /def _fetch_trellis_version_output\(\) -> str \| None:\n[\s\S]*?\n\ndef _extract_available_update_version/u,
      'def _fetch_trellis_version_output() -> str | None:\n    # AIRules updates are driven by the project-local runtime, never a global CLI.\n    return None\n\n\ndef _extract_available_update_version',
    )
  }
  return localized
}

function addSharedRuntime(plan, pythonCommand, developer) {
  addTree(plan, path.join(TEMPLATE_ROOT, 'trellis', 'scripts'), projectPath('scripts'), { python: pythonCommand, transform: localizeProjectRuntime })
  addTree(plan, path.join(TEMPLATE_ROOT, 'trellis', 'agents'), projectPath('agents'), { python: pythonCommand, transform: localizeProjectRuntime })
  addTree(plan, RUNTIME_ROOT, projectPath('runtime'), { merge: 'replace' })
  addPlan(plan, projectPath('runtime', 'update', 'scripts', 'init-project.mjs'), fs.readFileSync(path.join(SCRIPT_DIR, 'init-project.mjs')), { executable: true })
  addTree(plan, ASSET_ROOT, projectPath('runtime', 'update', 'assets', 'trellis-v0.6.7'), { merge: 'replace' })
  for (const skill of ['trellis-channel', 'trellis-meta', 'trellis-session-insight']) {
    addTree(plan, path.join(LOCAL_SKILLS_ROOT, skill), projectPath('runtime', 'update', 'skills', skill), { merge: 'replace', transform: localizeProjectRuntime })
  }
  addPlan(plan, projectPath('workflow.md'), resolveTemplate(localizeProjectRuntime('workflow.md', readText('trellis', 'workflow.md')), undefined, pythonCommand))
  addPlan(plan, projectPath('config.yaml'), localizeProjectRuntime('config.yaml', readText('trellis', 'config.yaml')))
  addPlan(plan, projectPath('.version'), '0.6.7-airules.1\n')
  addPlan(plan, projectPath('.gitignore'), readText('trellis', 'gitignore.txt'))
  addPlan(plan, projectPath('workspace', 'index.md'), resolveTemplate(localizeProjectRuntime('workspace-index.md', readText('markdown', 'workspace-index.md')), undefined, pythonCommand))
  addPlan(plan, projectPath('tasks', '.gitkeep'), '')
  for (const section of ['backend', 'frontend', 'guides']) {
    const root = path.join(TEMPLATE_ROOT, 'markdown', 'spec', section)
    addTree(plan, root, projectPath('spec', section), { rename: relative => relative.replace(/\.txt$/u, ''), transform: localizeProjectRuntime })
  }
  addPlan(plan, projectPath('LICENSE'), fs.readFileSync(path.join(ASSET_ROOT, 'legal', 'LICENSE')))
  addPlan(plan, projectPath('COPYRIGHT'), fs.readFileSync(path.join(ASSET_ROOT, 'legal', 'COPYRIGHT')))
  addPlan(plan, projectPath('THIRD_PARTY_NOTICES.md'), `# Third-Party Notices\n\nProject runtime templates are derived from Trellis v0.6.7, revision ${TRELLIS_REVISION}, and remain licensed under AGPL-3.0-only. AIRules replaced the upstream initializer with an independent project writer on 2026-07-16. See LICENSE and COPYRIGHT in this directory.\n`)
  addPlan(plan, 'AGENTS.md', localizeProjectRuntime('AGENTS.md', readText('markdown', 'agents.md')), { merge: 'block-trellis' })
  if (developer)
    addDeveloperFiles(plan, developer)
}

function addDeveloperFiles(plan, developer) {
  if (!/^[A-Za-z0-9][\w.-]{0,63}$/u.test(developer))
    throw new Error('Developer name must use 1-64 letters, digits, dots, underscores, or hyphens')
  addPlan(plan, projectPath('.developer'), `${developer}\n`)
  addPlan(plan, projectPath('workspace', developer, 'index.md'), `# ${developer} Workspace\n\n## Sessions\n\n- [journal-1.md](journal-1.md)\n`)
  addPlan(plan, projectPath('workspace', developer, 'journal-1.md'), `# ${developer} Journal\n\n`)
}

function commonTemplates(platform, pythonCommand) {
  const ctx = PLATFORM_CONTEXT[platform]
  const commands = walkFiles(path.join(TEMPLATE_ROOT, 'common', 'commands')).map(file => ({ name: path.basename(file, '.md'), content: localizeProjectRuntime(path.basename(file), resolveTemplate(fs.readFileSync(file, 'utf8'), ctx, pythonCommand)) }))
  const filtered = ctx.agentCapable && ctx.hasHooks && platform !== 'pi' ? commands.filter(command => command.name !== 'start') : commands
  const skills = walkFiles(path.join(TEMPLATE_ROOT, 'common', 'skills')).map(file => ({ name: path.basename(file, '.md'), content: localizeProjectRuntime(path.basename(file), resolveTemplate(fs.readFileSync(file, 'utf8'), ctx, pythonCommand, platform === 'gemini' || platform === 'codex')) }))
  return { commands: filtered, skills }
}

function addBundledSkills(plan, platform, root, pythonCommand) {
  const sourceRoot = path.join(TEMPLATE_ROOT, 'common', 'bundled-skills')
  for (const entry of fs.readdirSync(sourceRoot, { withFileTypes: true }).filter(entry => entry.isDirectory())) {
    const localRoot = path.join(LOCAL_SKILLS_ROOT, entry.name)
    const selectedRoot = fs.existsSync(localRoot) ? localRoot : path.join(sourceRoot, entry.name)
    addTree(plan, selectedRoot, path.posix.join(root, entry.name), {
      context: PLATFORM_CONTEXT[platform],
      platform,
      python: pythonCommand,
      transform: localizeProjectRuntime,
    })
  }
}

function addWorkflowSkills(plan, platform, root, pythonCommand, includeCommands = false, excluded = new Set()) {
  const templates = commonTemplates(platform, pythonCommand)
  const selected = includeCommands ? [...templates.commands, ...templates.skills] : templates.skills
  for (const template of selected) {
    const name = `trellis-${template.name}`
    if (excluded.has(name))
      continue
    addPlan(plan, `${root}/${name}/SKILL.md`, wrapSkill(name, template.content), { platform })
  }
  addBundledSkills(plan, platform, root, pythonCommand)
}

function commandTarget(platform, name) {
  return {
    claude: `.claude/commands/trellis/${name}.md`,
    cursor: `.cursor/commands/trellis-${name}.md`,
    opencode: `.opencode/commands/trellis/${name}.md`,
    kilo: `.kilocode/workflows/${name}.md`,
    antigravity: `.agent/workflows/${name}.md`,
    devin: `.devin/workflows/trellis-${name}.md`,
    qoder: `.qoder/commands/trellis-${name}.md`,
    codebuddy: `.codebuddy/commands/trellis/${name}.md`,
    copilot: `.github/prompts/${name}.prompt.md`,
    droid: `.factory/commands/trellis/${name}.md`,
    pi: `.pi/prompts/trellis-${name}.md`,
    zcode: `.zcode/commands/trellis/${name}.md`,
    trae: `.trae/commands/trellis-${name}.md`,
    omp: `.omp/commands/trellis-${name}.md`,
  }[platform]
}

function addDirectPlatformAssets(plan, platform, pythonCommand) {
  if (platform === 'copilot') {
    const root = path.join(TEMPLATE_ROOT, 'copilot')
    addPlan(plan, '.github/copilot-instructions.md', localizeProjectRuntime('copilot-instructions.md', resolveTemplate(fs.readFileSync(path.join(root, 'copilot-instructions.md'), 'utf8'), PLATFORM_CONTEXT.copilot, pythonCommand)), { merge: 'block-hash', platform })
    addTree(plan, path.join(root, 'hooks'), '.github/copilot/hooks', { python: pythonCommand, context: PLATFORM_CONTEXT.copilot, platform, transform: localizeProjectRuntime })
    const hookConfig = localizeProjectRuntime('hooks.json', resolveTemplate(fs.readFileSync(path.join(root, 'hooks.json'), 'utf8'), PLATFORM_CONTEXT.copilot, pythonCommand))
    addPlan(plan, '.github/copilot/hooks.json', hookConfig, { merge: 'json', platform })
    addPlan(plan, '.github/hooks/trellis.json', hookConfig, { merge: 'json', platform })
    addTree(plan, path.join(TEMPLATE_ROOT, 'cursor', 'agents'), '.github/agents', { python: pythonCommand, context: PLATFORM_CONTEXT.copilot, platform, rename: relative => relative.replace(/\.md$/u, '.agent.md'), transform: localizeProjectRuntime })
    return
  }
  if (platform === 'reasonix') {
    const agents = path.join(TEMPLATE_ROOT, 'reasonix', 'agents')
    for (const source of walkFiles(agents)) {
      const name = path.basename(source, '.md')
      addPlan(plan, `.reasonix/skills/${name}/SKILL.md`, localizeProjectRuntime(path.basename(source), resolveTemplate(fs.readFileSync(source, 'utf8'), PLATFORM_CONTEXT.reasonix, pythonCommand)), { platform })
    }
    return
  }
  const direct = PLATFORM_DIRECT[platform]
  if (!direct)
    return
  addTree(plan, path.join(TEMPLATE_ROOT, direct[0]), direct[1], {
    python: pythonCommand,
    context: PLATFORM_CONTEXT[platform],
    platform,
    transform: localizeProjectRuntime,
    filter: relative => platform !== 'claude' || relative !== 'hooks/statusline.py',
    rename: relative => relative.endsWith('.ts.txt') ? relative.slice(0, -4) : relative,
  })
}

function addPlatform(plan, platform, pythonCommand, skipSharedSkills = false) {
  addDirectPlatformAssets(plan, platform, pythonCommand)
  const ctx = PLATFORM_CONTEXT[platform]
  const templates = commonTemplates(platform, pythonCommand)
  if (platform === 'codex' || platform === 'kiro' || platform === 'reasonix') {
    const root = platform === 'codex' ? '.agents/skills' : platform === 'kiro' ? '.kiro/skills' : '.reasonix/skills'
    addWorkflowSkills(plan, platform, root, pythonCommand, true, platform === 'reasonix' ? new Set(['trellis-check', 'trellis-implement']) : new Set())
  }
  else {
    const skillsRoot = PLATFORM_SKILLS_ROOT[platform]
    if (skillsRoot && !skipSharedSkills)
      addWorkflowSkills(plan, platform, skillsRoot, pythonCommand)
    for (const command of templates.commands) {
      const target = commandTarget(platform, command.name)
      if (!target)
        continue
      let content = command.content
      if (platform === 'gemini')
        content = `description = "Trellis: ${command.name}"\n\nprompt = """\n${content}\n"""\n`
      else if (platform === 'qoder' || platform === 'trae')
        content = wrapCommand(`trellis-${command.name}`, content)
      else if (platform === 'omp')
        content = wrapOmpCommand(command.name, content)
      addPlan(plan, target, content, { platform })
    }
  }
  const hookNames = SHARED_HOOKS[platform] ?? []
  for (const hookName of hookNames) {
    addPlan(plan, `${HOOK_ROOTS[platform]}/${hookName}`, localizeProjectRuntime(hookName, resolveTemplate(readText('shared-hooks', hookName), ctx, pythonCommand)), { executable: true, platform })
  }
}

function buildPlan(platforms, pythonCommand, developer) {
  const plan = new Map()
  addSharedRuntime(plan, pythonCommand, developer)
  for (const platform of platforms) addPlatform(plan, platform, pythonCommand, platform === 'gemini' && platforms.includes('codex'))
  return plan
}

function readManifest(projectRoot) {
  const file = path.join(projectRoot, ...MANIFEST_PATH.split('/'))
  if (!fs.existsSync(file))
    return { schemaVersion: 1, generatorVersion: GENERATOR_VERSION, trellisRevision: TRELLIS_REVISION, entries: {} }
  const parsed = JSON.parse(fs.readFileSync(file, 'utf8'))
  if (parsed.schemaVersion !== 1 || typeof parsed.entries !== 'object' || parsed.entries === null || Array.isArray(parsed.entries))
    throw new Error(`Unsupported or malformed manifest: ${file}`)
  return parsed
}

function assertSafeProject(projectInput) {
  const absolute = path.resolve(projectInput)
  const stats = fs.lstatSync(absolute, { throwIfNoEntry: false })
  if (!stats?.isDirectory() || stats.isSymbolicLink())
    throw new Error(`Project root must be a plain directory: ${absolute}`)
  return fs.realpathSync(absolute)
}

function assertSafeTarget(projectRoot, relativePath) {
  let current = projectRoot
  for (const segment of relativePath.split('/')) {
    current = path.join(current, segment)
    const stats = fs.lstatSync(current, { throwIfNoEntry: false })
    if (stats?.isSymbolicLink())
      throw new Error(`Output path contains a symbolic link: ${relativePath}`)
  }
  const resolved = path.resolve(projectRoot, ...relativePath.split('/'))
  const relation = path.relative(projectRoot, resolved)
  if (!relation || relation === '..' || relation.startsWith(`..${path.sep}`) || path.isAbsolute(relation))
    throw new Error(`Output escapes project root: ${relativePath}`)
  return resolved
}

function mergeJson(current, template) {
  if (Array.isArray(current) && Array.isArray(template)) {
    const result = [...current]
    const known = new Set(result.map(value => JSON.stringify(value)))
    for (const value of template) {
      const key = JSON.stringify(value)
      if (!known.has(key))
        result.push(value)
    }
    return result
  }
  if (isObject(current) && isObject(template)) {
    const result = { ...current }
    for (const [key, value] of Object.entries(template)) result[key] = key in current ? mergeJson(current[key], value) : value
    return result
  }
  return current
}

function isObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function upsertBlock(current, template, kind) {
  const markers = kind === 'block-trellis'
    ? ['<!-- TRELLIS:START -->', '<!-- TRELLIS:END -->']
    : kind === 'block-hash' && template.trimStart().startsWith('#')
      ? ['# AIRULES:TRELLIS:START', '# AIRULES:TRELLIS:END']
      : ['<!-- AIRULES:TRELLIS:START -->', '<!-- AIRULES:TRELLIS:END -->']
  const managed = kind === 'block-trellis' ? template.trim() : `${markers[0]}\n${template.trim()}\n${markers[1]}`
  const start = current.indexOf(markers[0])
  const end = current.indexOf(markers[1])
  if ((start >= 0) !== (end >= 0) || (start >= 0 && current.includes(markers[0], start + markers[0].length)))
    throw new Error('Malformed or duplicate managed block')
  if (start < 0)
    return current.trim() ? `${current.replace(/\s*$/u, '')}\n\n${managed}\n` : `${managed}\n`
  if (end < start)
    throw new Error('Malformed managed block order')
  return `${current.slice(0, start)}${managed}${current.slice(end + markers[1].length)}`.replace(/\s*$/u, '\n')
}

function prepareOperations(projectRoot, plan, manifest, force) {
  const operations = []
  const result = { conflicts: [], created: [], preserved: [], unchanged: [], updated: [] }
  for (const [relativePath, item] of [...plan.entries()].sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)) {
    const target = assertSafeTarget(projectRoot, relativePath)
    const stats = fs.lstatSync(target, { throwIfNoEntry: false })
    if (stats && (!stats.isFile() || stats.isSymbolicLink())) {
      result.conflicts.push(relativePath)
      continue
    }
    const current = stats ? fs.readFileSync(target) : undefined
    let desired = item.content
    try {
      if (current && item.merge === 'json') {
        desired = Buffer.from(`${JSON.stringify(mergeJson(JSON.parse(current.toString('utf8')), JSON.parse(item.content.toString('utf8'))), null, 2)}\n`)
      }
      else if (item.merge.startsWith('block-')) {
        desired = Buffer.from(upsertBlock(current?.toString('utf8') ?? '', item.content.toString('utf8'), item.merge))
      }
    }
    catch (error) {
      if (!force) {
        result.conflicts.push(relativePath)
        continue
      }
    }
    const owned = manifest.entries[relativePath]
    if (!current) {
      operations.push({ ...item, desired, relativePath, target, status: 'created' })
      result.created.push(relativePath)
    }
    else if (current.equals(desired)) {
      result[owned ? 'unchanged' : 'preserved'].push(relativePath)
      operations.push({ ...item, desired, relativePath, target, status: owned ? 'unchanged' : 'preserved' })
    }
    else if (item.merge === 'json' || item.merge.startsWith('block-') || force || (owned && owned.baselineHash === sha256(current))) {
      operations.push({ ...item, desired, relativePath, target, status: 'updated' })
      result.updated.push(relativePath)
    }
    else {
      result.conflicts.push(relativePath)
    }
  }
  return { operations, result }
}

function ensureParent(target, projectRoot, createdDirs) {
  const parent = path.dirname(target)
  if (parent === projectRoot || fs.existsSync(parent))
    return
  ensureParent(parent, projectRoot, createdDirs)
  fs.mkdirSync(parent)
  createdDirs.push(parent)
}

function transactionalWrite(target, content, executable, projectRoot, createdDirs, journal) {
  ensureParent(target, projectRoot, createdDirs)
  const temp = `${target}.airules-new-${randomUUID()}`
  const backup = `${target}.airules-old-${randomUUID()}`
  const existed = fs.existsSync(target)
  const entry = { backup: existed ? backup : undefined, installed: false, moved: false, target }
  try {
    fs.writeFileSync(temp, content, { flag: 'wx', mode: executable ? 0o755 : 0o644 })
    journal.push(entry)
    if (existed) {
      fs.renameSync(target, backup)
      entry.moved = true
    }
    fs.renameSync(temp, target)
    entry.installed = true
  }
  catch (error) {
    fs.rmSync(temp, { force: true })
    throw error
  }
}

function rollback(journal, createdDirs) {
  const errors = []
  for (const entry of [...journal].reverse()) {
    try {
      if (entry.installed)
        fs.rmSync(entry.target, { force: true })
      if (entry.moved && entry.backup && fs.existsSync(entry.backup))
        fs.renameSync(entry.backup, entry.target)
    }
    catch (error) {
      errors.push(String(error))
    }
  }
  for (const directory of [...createdDirs].reverse()) {
    try {
      fs.rmdirSync(directory)
    }
    catch {}
  }
  return errors
}

function commit(projectRoot, operations, manifest, platforms) {
  const journal = []
  const createdDirs = []
  try {
    for (const operation of operations) {
      if (operation.status !== 'created' && operation.status !== 'updated')
        continue
      transactionalWrite(operation.target, operation.desired, operation.executable, projectRoot, createdDirs, journal)
    }
    const nextEntries = { ...manifest.entries }
    for (const operation of operations) {
      if (operation.status === 'preserved')
        continue
      if (operation.status === 'created' || operation.status === 'updated' || operation.status === 'unchanged') {
        nextEntries[operation.relativePath] = {
          baselineHash: sha256(operation.desired),
          mode: operation.merge,
          platform: operation.platform,
          templateHash: sha256(operation.content),
        }
      }
    }
    const nextManifest = Buffer.from(`${JSON.stringify({
      schemaVersion: 1,
      generatorVersion: GENERATOR_VERSION,
      trellisRevision: TRELLIS_REVISION,
      platforms: [...new Set([...(manifest.platforms ?? []), ...platforms])].sort(),
      entries: Object.fromEntries(Object.entries(nextEntries).sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)),
    }, null, 2)}\n`)
    const manifestTarget = assertSafeTarget(projectRoot, MANIFEST_PATH)
    transactionalWrite(manifestTarget, nextManifest, false, projectRoot, createdDirs, journal)
    for (const entry of journal) {
      if (entry.moved && entry.backup)
        fs.rmSync(entry.backup, { force: true })
    }
  }
  catch (error) {
    const rollbackErrors = rollback(journal, createdDirs)
    const suffix = rollbackErrors.length > 0 ? `; rollback errors: ${rollbackErrors.join('; ')}` : ''
    throw new Error(`Initialization failed and was rolled back: ${String(error)}${suffix}`)
  }
}

function main() {
  const options = parseArgs(process.argv.slice(2))
  if (options.help) {
    printHelp()
    return
  }
  const platforms = normalizePlatforms(options.platforms)
  const projectRoot = assertSafeProject(options.project)
  requirePython(options.python)
  const plan = buildPlan(platforms, options.python, options.developer)
  const manifest = readManifest(projectRoot)
  const prepared = prepareOperations(projectRoot, plan, manifest, options.force)
  const summary = {
    projectRoot,
    platforms,
    dryRun: options.dryRun,
    force: options.force,
    manifest: MANIFEST_PATH,
    ...prepared.result,
  }
  if (!options.dryRun)
    commit(projectRoot, prepared.operations, manifest, platforms)
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`)
  if (summary.conflicts.length > 0)
    process.exitCode = 2
}

try {
  main()
}
catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
}
