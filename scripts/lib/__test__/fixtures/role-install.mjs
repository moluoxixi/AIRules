import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { parse, stringify } from 'yaml'

export function writeFile(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, content)
}

export function writeJson(file, value) {
  writeFile(file, `${JSON.stringify(value, null, 2)}\n`)
}

export function writeYaml(file, value) {
  writeFile(file, stringify(value))
}

export function createInstallSandbox(packageRoot) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'airules-role-install-'))
  const runtime = path.join(root, 'runtime')
  const home = path.join(root, 'home')
  const userHome = path.join(root, 'user')
  const prefix = path.join(root, 'npm-prefix')
  const env = {
    ...process.env,
    HOME: userHome,
    USERPROFILE: userHome,
    npm_config_prefix: prefix,
    npm_config_cache: path.join(root, 'npm-cache'),
    GIT_CONFIG_GLOBAL: path.join(root, 'gitconfig'),
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_TERMINAL_PROMPT: '0',
  }
  try {
    for (const directory of ['bin', 'dist/scripts', 'hosts', 'capabilities']) {
      const target = path.join(runtime, directory)
      fs.mkdirSync(path.dirname(target), { recursive: true })
      fs.cpSync(path.join(packageRoot, directory), target, { recursive: true })
    }
    fs.copyFileSync(path.join(packageRoot, 'package.json'), path.join(runtime, 'package.json'))
    const require = createRequire(path.join(packageRoot, 'package.json'))
    for (const dependency of ['yaml', 'kleur']) {
      let source = path.dirname(require.resolve(dependency))
      while (!fs.existsSync(path.join(source, 'package.json'))) {
        const parent = path.dirname(source)
        assert.notEqual(parent, source, `Cannot locate package root for ${dependency}`)
        source = parent
      }
      const target = path.join(runtime, 'node_modules', dependency)
      fs.mkdirSync(path.dirname(target), { recursive: true })
      fs.symlinkSync(source, target, process.platform === 'win32' ? 'junction' : 'dir')
    }
    writeFile(env.GIT_CONFIG_GLOBAL, '')
    fs.mkdirSync(path.join(userHome, '.claude'), { recursive: true })
    writeJson(path.join(userHome, '.claude.json'), { mcpServers: { unmanaged: { command: 'user-owned' } } })
    writeFile(path.join(userHome, '.codex', 'config.toml'), 'model = "keep-me"\n[mcp_servers.unmanaged]\ncommand = "user-owned"\n')
    writeJson(path.join(userHome, '.config', 'opencode', 'opencode.json'), {
      mcp: { unmanaged: { type: 'local', command: ['user-owned'] } },
    })
  }
  catch (error) {
    fs.rmSync(root, { recursive: true, force: true })
    throw error
  }

  function command(executable, args, cwd = root) {
    const result = spawnSync(executable, args, { cwd, env, encoding: 'utf8', timeout: 180_000, maxBuffer: 16 * 1024 * 1024 })
    if (result.error)
      throw result.error
    return result
  }

  function git(args, cwd = root) {
    const result = command('git', args, cwd)
    assert.equal(result.status, 0, `git ${args.join(' ')} failed:\n${result.stderr}`)
    return result.stdout.trim()
  }

  function cli(commandName = 'install', role = 'diamond') {
    return command(process.execPath, [
      path.join(runtime, 'bin', 'airules.js'),
      commandName,
      role,
      '--repo-root',
      runtime,
      '--home',
      home,
      '--user-home',
      userHome,
      '--host',
      'all',
    ])
  }

  return { root, runtime, home, userHome, prefix, env, command, git, cli }
}

export function createGitRemote(sandbox, name, populate) {
  const seed = path.join(sandbox.root, `${name}-seed`)
  const remote = path.join(sandbox.root, `${name}.git`)
  const source = `${sandbox.remoteUrl}/${name}.git`
  fs.mkdirSync(seed)
  sandbox.git(['init', '--initial-branch=main'], seed)
  sandbox.git(['config', 'user.email', 'ci@example.test'], seed)
  sandbox.git(['config', 'user.name', 'AIRules CI'], seed)
  sandbox.git(['config', 'core.autocrlf', 'false'], seed)
  populate(seed, source)
  sandbox.git(['add', '.'], seed)
  sandbox.git(['-c', 'commit.gpgsign=false', 'commit', '-m', 'install fixture'], seed)
  sandbox.git(['clone', '--bare', seed, remote])
  sandbox.git(['remote', 'add', 'origin', source], seed)
  return { seed, remote, source, revision: sandbox.git(['rev-parse', 'HEAD'], seed) }
}

export function commitRemote(sandbox, remote) {
  sandbox.git(['add', '.'], remote.seed)
  sandbox.git(['-c', 'commit.gpgsign=false', 'commit', '-m', 'update fixture'], remote.seed)
  sandbox.git(['push', remote.remote, 'main'], remote.seed)
  return sandbox.git(['rev-parse', 'HEAD'], remote.seed)
}

async function startGitServer(sandbox) {
  const listener = net.createServer()
  await new Promise((resolve, reject) => {
    listener.once('error', reject)
    listener.listen(0, '127.0.0.1', resolve)
  })
  const { port } = listener.address()
  await new Promise((resolve, reject) => listener.close(error => error ? reject(error) : resolve()))
  const logFile = path.join(sandbox.root, 'git-daemon.log')
  const log = fs.openSync(logFile, 'w')
  const daemon = spawn('git', [
    'daemon',
    '--verbose',
    '--export-all',
    '--listen=127.0.0.1',
    `--port=${port}`,
    `--base-path=${sandbox.root}`,
    sandbox.root,
  ], { cwd: sandbox.root, env: sandbox.env, stdio: ['ignore', 'ignore', log] })
  fs.closeSync(log)
  const exited = new Promise(resolve => daemon.once('close', resolve))
  const stop = async () => {
    if (daemon.exitCode === null) {
      if (process.platform === 'win32')
        sandbox.command('taskkill', ['/pid', String(daemon.pid), '/t', '/f'])
      else
        daemon.kill()
    }
    await exited
  }
  try {
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        clear()
        reject(new Error(`Fixture Git server startup timed out:\n${fs.readFileSync(logFile, 'utf8')}`))
      }, 10_000)
      const interval = setInterval(() => {
        if (fs.readFileSync(logFile, 'utf8').includes('Ready to rumble')) {
          clear()
          resolve()
        }
      }, 25)
      function clear() {
        clearTimeout(timeout)
        clearInterval(interval)
      }
      daemon.once('error', (error) => {
        clear()
        reject(error)
      })
      daemon.once('exit', (code) => {
        clear()
        reject(new Error(`Fixture Git server exited: ${code}`))
      })
    })
  }
  catch (error) {
    await stop()
    throw error
  }
  sandbox.remoteUrl = `git://127.0.0.1:${port}`
  return stop
}

export function installedSnapshot(sandbox) {
  const entries = []
  function visit(file) {
    const stats = fs.lstatSync(file, { throwIfNoEntry: false })
    if (!stats)
      return
    const key = path.relative(sandbox.root, file).replaceAll('\\', '/')
    if (stats.isSymbolicLink()) {
      entries.push([key, fs.readlinkSync(file)])
    }
    else if (stats.isDirectory()) {
      for (const child of fs.readdirSync(file).sort())
        visit(path.join(file, child))
    }
    else {
      entries.push([key, createHash('sha256').update(fs.readFileSync(file)).digest('hex')])
    }
  }
  for (const file of [
    path.join(sandbox.home, 'vendor', 'skills'),
    path.join(sandbox.home, 'vendor', 'mcps'),
    path.join(sandbox.home, 'roles'),
    path.join(sandbox.userHome, '.agents'),
    path.join(sandbox.userHome, '.claude.json'),
    path.join(sandbox.userHome, '.claude', 'skills'),
    path.join(sandbox.userHome, '.codex', 'config.toml'),
    path.join(sandbox.userHome, '.config', 'opencode', 'opencode.json'),
  ]) {
    visit(file)
  }
  return entries
}

export function assertInstalledHosts(sandbox, skills, servers) {
  assert.deepEqual(fs.readdirSync(path.join(sandbox.home, 'vendor', 'skills')).sort(), [...skills].sort())
  assert.deepEqual(fs.readdirSync(path.join(sandbox.userHome, '.agents', 'skills')).sort(), [...skills].sort())
  const claude = JSON.parse(fs.readFileSync(path.join(sandbox.userHome, '.claude.json'), 'utf8'))
  const codex = fs.readFileSync(path.join(sandbox.userHome, '.codex', 'config.toml'), 'utf8')
  const openCode = JSON.parse(fs.readFileSync(path.join(sandbox.userHome, '.config', 'opencode', 'opencode.json'), 'utf8'))
  assert.deepEqual(Object.keys(claude.mcpServers).sort(), [...servers, 'unmanaged'].sort())
  assert.deepEqual(Object.keys(openCode.mcp).sort(), [...servers, 'unmanaged'].sort())
  assert.deepEqual([...codex.matchAll(/^\[mcp_servers\.([^\]]+)\]$/gmu)].map(match => match[1]).sort(), [...servers, 'unmanaged'].sort())
  assert.equal(claude.mcpServers.unmanaged.command, 'user-owned')
  assert.equal(openCode.mcp.unmanaged.command[0], 'user-owned')
  assert.match(codex, /model = "keep-me"/u)
  for (const skill of skills) {
    const installed = path.join(sandbox.home, 'vendor', 'skills', skill, 'SKILL.md')
    assert.deepEqual(fs.readFileSync(path.join(sandbox.userHome, '.agents', 'skills', skill, 'SKILL.md')), fs.readFileSync(installed))
    assert.deepEqual(fs.readFileSync(path.join(sandbox.userHome, '.claude', 'skills', skill, 'SKILL.md')), fs.readFileSync(installed))
  }
  assert.equal(fs.existsSync(path.join(sandbox.userHome, '.codex', 'skills')), false)
  return { claude, codex, openCode }
}

function createDiamondFixture(sandbox) {
  const marker = path.join(sandbox.root, 'setup.jsonl')
  const setupScript = path.join(sandbox.root, 'setup.mjs')
  writeFile(setupScript, 'import fs from "node:fs"; fs.appendFileSync(process.argv[2], JSON.stringify(process.argv[3]) + "\\n");\n')
  const setup = label => ({ command: process.execPath, args: [setupScript, marker, label] })
  const localPackage = path.join(sandbox.root, 'setup-package')
  writeJson(path.join(localPackage, 'package.json'), {
    name: 'airules-install-fixture',
    version: '1.0.0',
    bin: { 'airules-install-fixture': 'cli.cjs' },
  })
  writeFile(path.join(localPackage, 'cli.cjs'), '#!/usr/bin/env node\nconsole.log("installed setup package")\n')
  const roleSetup = [setup('role'), {
    command: 'npm',
    args: ['install', '--global', '--prefix', sandbox.prefix, '--ignore-scripts', '--no-audit', '--no-fund', localPackage],
  }]
  const skillsRemote = createGitRemote(sandbox, 'skills', (seed) => {
    for (const name of ['shared', 'extra'])
      writeFile(path.join(seed, 'skills', 'methods', name, 'SKILL.md'), `---\nname: ${name}\ndescription: Install fixture\n---\n${name}\n`)
  })
  const server = { command: 'node', args: ['serve.mjs'], env: { MODE: 'fixture' } }
  const serverSetup = [setup('mcp')]
  const roleDefinitions = [
    ['base', [], ['install-base']],
    ['left', ['base'], ['install-left']],
    ['right', ['base'], ['install-base', 'install-right']],
    ['diamond', ['left', 'right'], ['install-base']],
  ]
  const rolesRemote = createGitRemote(sandbox, 'roles', (seed, source) => {
    for (const [role, parents, capabilities] of roleDefinitions) {
      const contract = {
        schema_version: 2,
        role_id: role,
        canonical_root: `roles/${role}`,
        extends_roles: parents,
        provides: { capabilities },
        installation: {
          hosts: role === 'diamond' ? ['claude', 'codex', 'opencode'] : ['cursor'],
          role_vendor: {
            name: `${role}-role`,
            source,
            setup: role === 'diamond' ? roleSetup : [{ command: 'parent-setup-must-not-run' }],
            projections: [{ kind: 'role-assets', source_dir: `roles/${role}` }],
          },
        },
      }
      writeYaml(path.join(seed, 'roles', role, 'role.yaml'), contract)
      writeYaml(path.join(sandbox.runtime, 'roles', role, 'role.yaml'), contract)
      writeFile(path.join(seed, 'roles', role, 'skills', `${role}-private`, 'SKILL.md'), `---\nname: ${role}-private\ndescription: Private fixture\n---\n`)
    }
    writeFile(path.join(seed, 'capabilities', 'install-base', 'skills', 'base-skill', 'SKILL.md'), '---\nname: base-skill\ndescription: Shared base\n---\n')
    writeJson(path.join(seed, 'capabilities', 'install-base', 'mcps.json'), { mcps: { memory: { mcp: server, setup: serverSetup } } })
    writeJson(path.join(seed, 'capabilities', 'install-left', 'mcps.json'), { mcps: {
      memory: { mcp: { env: server.env, args: server.args, command: server.command }, setup: serverSetup },
      left: { mcp: { command: 'left-server' } },
    } })
    writeJson(path.join(seed, 'capabilities', 'install-right', 'mcps.json'), { mcps: { right: { mcp: { command: 'right-server' } } } })
  })
  const supplier = projections => ({
    name: 'fixture-skills',
    source: skillsRemote.source,
    revision: skillsRemote.revision,
    setup: [setup('vendor')],
    projections,
  })
  const capability = (name, fields) => writeYaml(path.join(sandbox.runtime, 'capabilities', name, 'capability.yaml'), {
    schema_version: 1,
    capability_id: name,
    ...fields,
  })
  capability('install-base', {
    role_projections: [
      { kind: 'namespace', source_dir: 'skills', output: 'base' },
      { kind: 'mcp', source_file: 'mcps.json', output: 'mcps/base/mcp.json' },
    ],
    vendors: [supplier([{ kind: 'skills', source_base_dir: 'skills/methods', skills: [{ name: 'shared', setup: [setup('skill')] }] }])],
  })
  capability('install-left', { role_projections: [{ kind: 'mcp', source_file: 'mcps.json', output: 'mcps/left/mcp.json' }] })
  capability('install-right', {
    role_projections: [{ kind: 'mcp', source_file: 'mcps.json', output: 'mcps/right/mcp.json' }],
    vendors: [supplier([{ kind: 'namespace', source_dir: 'skills/methods', output: 'methods', setup: [setup('skill')] }])],
  })
  function pinRole(revision) {
    const contract = {
      schema_version: 2,
      role_id: 'diamond',
      canonical_root: 'roles/diamond',
      extends_roles: ['left', 'right'],
      provides: { capabilities: ['install-base'] },
      installation: { hosts: ['claude', 'codex', 'opencode'], role_vendor: {
        name: 'diamond-role',
        source: rolesRemote.source,
        revision,
        setup: roleSetup,
        projections: [{ kind: 'role-assets', source_dir: 'roles/diamond' }],
      } },
    }
    writeYaml(path.join(sandbox.runtime, 'roles', 'diamond', 'role.yaml'), contract)
  }
  pinRole(rolesRemote.revision)
  return { marker, server, rolesRemote, skillsRemote, pinRole }
}

const expectedSkills = ['base-skill', 'diamond-private', 'extra', 'shared']
const expectedServers = ['left', 'memory', 'right']

function installSuccess(sandbox, fixture) {
  assert.equal(fs.existsSync(sandbox.home), false, 'Installation must start without an AIRules home')
  const result = sandbox.cli()
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`)
  assert.match(result.stdout, /\[install\] diamond/u)
  const { claude, codex, openCode } = assertInstalledHosts(sandbox, expectedSkills, expectedServers)
  assert.deepEqual(claude.mcpServers.memory, { ...fixture.server, type: 'stdio' })
  assert.deepEqual(openCode.mcp.memory, { type: 'local', command: ['node', 'serve.mjs'], environment: { MODE: 'fixture' }, enabled: true })
  assert.match(codex, /command = "node"/u)
  assert.match(codex, /args = \["serve\.mjs"\]/u)
  assert.match(codex, /env = \{ MODE = "fixture" \}/u)
  for (const [name, source] of [
    ['shared', path.join(fixture.skillsRemote.seed, 'skills', 'methods', 'shared', 'SKILL.md')],
    ['diamond-private', path.join(fixture.rolesRemote.seed, 'roles', 'diamond', 'skills', 'diamond-private', 'SKILL.md')],
  ]) {
    assert.deepEqual(fs.readFileSync(path.join(sandbox.home, 'vendor', 'skills', name, 'SKILL.md')), fs.readFileSync(source))
  }
  assert.deepEqual(fs.readdirSync(path.join(sandbox.home, 'roles')), ['diamond'])
  assert.deepEqual(fs.readdirSync(path.join(sandbox.home, 'vendor', 'repos')).sort(), ['diamond-role', 'fixture-skills'])
  for (const [name, remote] of [['diamond-role', fixture.rolesRemote], ['fixture-skills', fixture.skillsRemote]])
    assert.equal(sandbox.git(['rev-parse', 'HEAD'], path.join(sandbox.home, 'vendor', 'repos', name)), remote.revision)
  assert.deepEqual(fs.readFileSync(fixture.marker, 'utf8').trim().split('\n').map(line => JSON.parse(line)).sort(), ['mcp', 'role', 'skill', 'vendor'])
  const globalPackage = path.join(sandbox.prefix, ...(process.platform === 'win32' ? [] : ['lib']), 'node_modules', 'airules-install-fixture')
  const installedPackage = sandbox.command(process.execPath, [path.join(globalPackage, 'cli.cjs')])
  assert.equal(installedPackage.status, 0, installedPackage.stderr)
  assert.equal(installedPackage.stdout.trim(), 'installed setup package')
  const files = ['base', 'left', 'right'].map(name => JSON.parse(fs.readFileSync(path.join(sandbox.home, 'vendor', 'mcps', name, 'mcp.json'), 'utf8')).mcpServers)
  assert.equal(files.filter(servers => Object.hasOwn(servers, 'memory')).length, 1)
  assert.deepEqual(files.find(servers => Object.hasOwn(servers, 'memory')).memory, fixture.server)
  const verify = sandbox.cli('verify')
  assert.equal(verify.status, 0, `${verify.stdout}\n${verify.stderr}`)
}

export const roleInstallScenarios = [
  ['downloads and installs a populated diamond, deduplicates setup, and preserves host settings', (sandbox, fixture) => {
    installSuccess(sandbox, fixture)
    const before = installedSnapshot(sandbox)
    const result = sandbox.cli()
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`)
    assert.deepEqual(installedSnapshot(sandbox), before)
    assert.deepEqual(fs.readFileSync(fixture.marker, 'utf8').trim().split('\n').map(line => JSON.parse(line)).sort(), ['mcp', 'mcp', 'role', 'role', 'skill', 'skill', 'vendor', 'vendor'])
  }],
  ...['skill', 'mcp'].map(kind => [`rejects a ${kind} conflict before setup and preserves the installed version`, (sandbox, fixture) => {
    installSuccess(sandbox, fixture)
    const before = installedSnapshot(sandbox)
    const setupBefore = fs.readFileSync(fixture.marker, 'utf8')
    if (kind === 'skill') {
      writeFile(path.join(fixture.rolesRemote.seed, 'roles', 'diamond', 'skills', 'shared', 'SKILL.md'), '---\nname: shared\ndescription: Conflicting private skill\n---\n')
    }
    else {
      writeJson(path.join(fixture.rolesRemote.seed, 'capabilities', 'install-left', 'mcps.json'), { mcps: { memory: { mcp: { command: 'incompatible' } } } })
    }
    fixture.pinRole(commitRemote(sandbox, fixture.rolesRemote))
    const result = sandbox.cli()
    assert.notEqual(result.status, 0)
    assert.match(result.stderr, kind === 'skill' ? /target conflict/iu : /conflicting connection or setup/u)
    assert.deepEqual(installedSnapshot(sandbox), before)
    assert.equal(fs.readFileSync(fixture.marker, 'utf8'), setupBefore)
  }]),
  ['preserves the installed version when a real setup process fails', (sandbox, fixture) => {
    installSuccess(sandbox, fixture)
    const before = installedSnapshot(sandbox)
    writeFile(path.join(fixture.rolesRemote.seed, 'roles', 'diamond', 'skills', 'diamond-private', 'SKILL.md'), '---\nname: diamond-private\ndescription: Uncommitted installation\n---\nupdated\n')
    fixture.pinRole(commitRemote(sandbox, fixture.rolesRemote))
    const contractPath = path.join(sandbox.runtime, 'roles', 'diamond', 'role.yaml')
    const failureScript = path.join(sandbox.root, 'fail.mjs')
    writeFile(failureScript, 'process.exit(7)\n')
    const contract = parse(fs.readFileSync(contractPath, 'utf8'))
    contract.installation.role_vendor.setup.unshift({ command: process.execPath, args: [failureScript] })
    writeYaml(contractPath, contract)
    const result = sandbox.cli()
    assert.notEqual(result.status, 0)
    assert.match(result.stderr, /setup/u)
    assert.deepEqual(installedSnapshot(sandbox), before)
  }],
]

export async function runRoleInstallScenario(packageRoot, scenario) {
  const sandbox = createInstallSandbox(packageRoot)
  let stopServer
  try {
    stopServer = await startGitServer(sandbox)
    const fixture = createDiamondFixture(sandbox)
    scenario(sandbox, fixture)
  }
  finally {
    await stopServer?.()
    fs.rmSync(sandbox.root, { recursive: true, force: true })
  }
}
