import type { VendorManifest } from '../vendors.js'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { it } from 'vitest'
import { ALL_HOST_IDS, findHostConfig, HOST_IDS, resolveHostPaths } from '../../../constants/hosts.js'
import {
  ensureGlobalSkillLink,
  ensureInstallRoot,
  getDefaultInstallPaths,
  isSamePath,
  linkHostBaseline,
  projectHostById,
  projectSkillsToHost,
  projectToHost,
  rebuildVendorSkillLinks,
  replaceWithSymlink,
  resolveSetupCommandExecutable,
  runSkillSetupCommands,
  shouldUseShellForSetupCommand,
  syncFirstPartySkillsToVendor,
  syncFirstPartyToHome,
} from '../install.js'
import { buildLinkPlan } from '../links.js'
import { roleOverlayOrder } from '../roles.js'
import { getRepoRoot, loadVendorManifest, normalizePath, resolveHomePath, walkVendorTree } from '../vendors.js'

/**
 * 创建临时目录并保证用例结束后彻底清理。
 */
function withTempDir<T>(prefix: string, run: (tmpDir: string) => T): T {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), prefix))

  try {
    return run(tmpDir)
  }
  finally {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  }
}

/**
 * 创建异步测试用临时目录，等待用例结束后再执行清理。
 */
async function withTempDirAsync<T>(prefix: string, run: (tmpDir: string) => Promise<T>): Promise<T> {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), prefix))

  try {
    return await run(tmpDir)
  }
  finally {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  }
}

/**
 * 写入文件并自动创建父目录，减少测试准备代码噪音。
 */
function writeFile(filePath: string, content: string) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, content)
}

/**
 * 解析软链接目标，统一 Windows junction 与普通 symlink 的路径比较。
 */
function realLinkPath(linkPath: string) {
  return fs.realpathSync(linkPath).replace(/\\/g, '/')
}

const workspaceFolderPlaceholder = '$' + '{workspaceFolder}'

it('hosts - 解析默认和自定义宿主路径', () => {
  const cursor = findHostConfig('cursor')
  const claude = findHostConfig('claude')
  const hermes = findHostConfig('hermes')
  const trae = findHostConfig('trae')
  const traeCn = findHostConfig('trae-cn')
  const traeSolo = findHostConfig('trae-solo')
  const traeSoloCn = findHostConfig('trae-solo-cn')
  const qoder = findHostConfig('qoder')
  const qoderwork = findHostConfig('qoderwork')
  const missing = findHostConfig('missing-host')

  assert.ok(cursor)
  assert.ok(claude)
  assert.ok(hermes)
  assert.ok(trae)
  assert.ok(traeCn)
  assert.ok(traeSolo)
  assert.ok(traeSoloCn)
  assert.ok(qoder)
  assert.ok(qoderwork)
  assert.equal(missing, undefined)
  assert.equal(HOST_IDS.includes('qoder-cli'), false)
  assert.equal(ALL_HOST_IDS.includes('qoder-cli'), false)

  const cursorPaths = resolveHostPaths(cursor, 'C:/Users/example')
  assert.equal(normalizePath(cursorPaths.hostHome), 'C:/Users/example/.cursor')
  assert.equal(cursorPaths.skillsDirName, 'skills-cursor')

  const claudePaths = resolveHostPaths(claude, 'C:/Users/example')
  assert.equal(normalizePath(claudePaths.hostBaselineFile), 'C:/Users/example/.claude/CLAUDE.md')
  assert.equal(claudePaths.skillsDirName, 'skills')

  const hermesPaths = resolveHostPaths(hermes, 'C:/Users/example')
  assert.equal(normalizePath(hermesPaths.hostHome), 'C:/Users/example/AppData/Local/hermes')
  assert.equal(normalizePath(hermesPaths.hostBaselineFile), 'C:/Users/example/AppData/Local/hermes/SOUL.md')
  assert.equal(hermesPaths.skillsDirName, 'skills')
  assert.equal(hermesPaths.projectBaseline, true)
  assert.equal(hermesPaths.baselineMode, 'append')
  assert.deepEqual(hermesPaths.excludedSkills, [])

  const traePaths = resolveHostPaths(trae, 'C:/Users/example')
  assert.equal(normalizePath(traePaths.mcpHome), 'C:/Users/example/AppData/Roaming/Trae/User')
  assert.deepEqual(traePaths.mcp?.defaultTopLevel, { inputs: [] })
  assert.equal(traePaths.includeNativeTomlAgentsAsMarkdown, true)

  const traeCnPaths = resolveHostPaths(traeCn, 'C:/Users/example')
  assert.equal(normalizePath(traeCnPaths.mcpHome), 'C:/Users/example/AppData/Roaming/Trae CN/User')
  assert.equal(traeCnPaths.includeNativeTomlAgentsAsMarkdown, true)

  const traeSoloPaths = resolveHostPaths(traeSolo, 'C:/Users/example')
  assert.equal(normalizePath(traeSoloPaths.mcpHome), 'C:/Users/example/AppData/Roaming/TRAE SOLO/User')
  assert.equal(traeSoloPaths.projectSharedResources, false)
  assert.equal(traeSoloPaths.projectBaseline, false)

  const traeSoloCnPaths = resolveHostPaths(traeSoloCn, 'C:/Users/example')
  assert.equal(normalizePath(traeSoloCnPaths.mcpHome), 'C:/Users/example/AppData/Roaming/TRAE SOLO CN/User')
  assert.equal(traeSoloCnPaths.projectSharedResources, false)
  assert.equal(traeSoloCnPaths.projectBaseline, false)

  const qoderPaths = resolveHostPaths(qoder, 'C:/Users/example')
  assert.equal(normalizePath(qoderPaths.hostHome), 'C:/Users/example/.qoder')
  assert.equal(normalizePath(qoderPaths.mcpHome), 'C:/Users/example/AppData/Roaming/Qoder/SharedClientCache')
  assert.equal(normalizePath(qoderPaths.hostBaselineFile), 'C:/Users/example/.qoder/AGENTS.md')
  assert.equal(qoderPaths.projectSharedResources, true)
  assert.equal(qoderPaths.projectBaseline, true)
  assert.equal(qoderPaths.includeNativeTomlAgentsAsMarkdown, true)
  assert.equal(qoder.mcpHomeImpliesHostHome, true)
  assert.deepEqual(qoderPaths.mcp?.serverOverrides?.codegraph, { type: 'stdio' })
  assert.deepEqual(qoderPaths.hookAdapter, {
    relDir: '.',
    fileName: 'settings.json',
    format: 'json',
    nesting: 'group',
    includeType: true,
  })

  const qoderworkPaths = resolveHostPaths(qoderwork, 'C:/Users/example')
  assert.equal(qoderworkPaths.mcp, undefined)
})

it('links - 构建按目标路径排序的绝对链接计划', () => {
  const plan = buildLinkPlan({
    version: 1,
    vendors: {
      demo: {
        repo: 'https://example.test/demo.git',
        cloneDir: 'vendor/repos/demo',
        links: [
          { kind: 'skill', source: 'skills/zeta', target: 'vendor/skills/zeta' },
          { kind: 'skill', source: 'skills/alpha', target: 'vendor/skills/alpha' },
        ],
      },
    },
  }, 'C:/home')

  assert.deepEqual(
    plan.map(entry => ({
      vendorId: entry.vendorId,
      source: entry.source,
      target: entry.target,
    })),
    [
      {
        vendorId: 'demo',
        source: 'C:/home/vendor/repos/demo/skills/alpha',
        target: 'C:/home/vendor/skills/alpha',
      },
      {
        vendorId: 'demo',
        source: 'C:/home/vendor/repos/demo/skills/zeta',
        target: 'C:/home/vendor/skills/zeta',
      },
    ],
  )
})

it('install - 初始化安装目录并同步全局技能链接', () => withTempDir('airules-install-', (tmpDir) => {
  const userHome = path.join(tmpDir, 'user')
  const paths = getDefaultInstallPaths(userHome)

  ensureInstallRoot(paths)
  assert.ok(fs.existsSync(paths.moluoHome))
  assert.ok(fs.existsSync(path.join(paths.moluoHome, 'vendor', 'repos')))
  assert.equal(fs.existsSync(path.join(paths.moluoHome, 'skills')), false)
  assert.ok(fs.existsSync(paths.globalAgentSkillsHome))

  const sourceSkill = path.join(paths.moluoHome, 'vendor', 'skills', 'skill-one')
  fs.mkdirSync(sourceSkill, { recursive: true })

  ensureGlobalSkillLink(paths)

  assert.equal(fs.existsSync(path.join(paths.moluoHome, 'skills')), false)

  const globalSkill = path.join(paths.globalAgentSkillsHome, 'skill-one')
  assert.ok(fs.lstatSync(globalSkill).isSymbolicLink())
  assert.equal(realLinkPath(globalSkill), realLinkPath(sourceSkill))
}))

it('install - 全局技能链接从嵌套源目录展平到叶子 skill 名', () => withTempDir('airules-global-flat-', (tmpDir) => {
  const userHome = path.join(tmpDir, 'user')
  const paths = getDefaultInstallPaths(userHome)

  ensureInstallRoot(paths)
  const nestedSkill = path.join(paths.moluoHome, 'vendor', 'skills', 'workflow', 'review', 'namespace-review')
  writeFile(path.join(nestedSkill, 'SKILL.md'), 'review\n')

  ensureGlobalSkillLink(paths)

  assert.equal(fs.existsSync(path.join(paths.moluoHome, 'skills')), false)

  const globalSkill = path.join(paths.globalAgentSkillsHome, 'namespace-review')
  assert.ok(fs.lstatSync(globalSkill).isSymbolicLink())
  assert.equal(realLinkPath(globalSkill), realLinkPath(nestedSkill))
  assert.equal(fs.existsSync(path.join(paths.globalAgentSkillsHome, 'workflow')), false)
}))

it('install - replaceWithSymlink 跳过同路径、复用正确链接并替换错误目标', () => withTempDir('airules-link-', (tmpDir) => {
  const source = path.join(tmpDir, 'source')
  const target = path.join(tmpDir, 'target')
  const other = path.join(tmpDir, 'other')
  fs.mkdirSync(source, { recursive: true })
  fs.mkdirSync(other, { recursive: true })

  assert.equal(isSamePath(`${source}${path.sep}`, source), true)
  assert.equal(isSamePath('', source), false)

  replaceWithSymlink(source, source, 'junction')
  assert.equal(fs.lstatSync(source).isDirectory(), true)

  replaceWithSymlink(source, target, 'junction')
  assert.ok(fs.lstatSync(target).isSymbolicLink())

  const before = fs.readlinkSync(target)
  replaceWithSymlink(source, target, 'junction')
  assert.equal(fs.readlinkSync(target), before)

  replaceWithSymlink(other, target, 'junction')
  assert.equal(realLinkPath(target), realLinkPath(other))
}))

it('roles - 未声明继承的角色不隐式叠加 common', async () => {
  await withTempDirAsync('airules-role-overlay-', async (tmpDir) => {
    const repoRoot = path.join(tmpDir, 'repo')

    writeFile(path.join(repoRoot, 'roles', 'common', 'constants', 'skills.ts'), `
export const vendors = []
`)
    writeFile(path.join(repoRoot, 'roles', 'trellis-development', 'constants', 'skills.ts'), `
export const vendors = []
`)

    assert.deepEqual(
      await roleOverlayOrder(repoRoot, 'trellis-development'),
      ['trellis-development'],
    )
  })
})

it('roles - 声明 extendsRoles 的角色显式叠加 common', async () => {
  await withTempDirAsync('airules-role-extends-', async (tmpDir) => {
    const repoRoot = path.join(tmpDir, 'repo')

    writeFile(path.join(repoRoot, 'roles', 'common', 'constants', 'skills.ts'), `
export const vendors = []
`)
    writeFile(path.join(repoRoot, 'roles', 'openspec-development', 'constants', 'skills.ts'), `
export const extendsRoles = ['common']
export const vendors = []
`)

    assert.deepEqual(
      await roleOverlayOrder(repoRoot, 'openspec-development'),
      ['common', 'openspec-development'],
    )
  })
})

it('install - 同步第一方文件并按宿主投影 baseline 与 skills', async () => withTempDirAsync('airules-project-', async (tmpDir) => {
  const userHome = path.join(tmpDir, 'user')
  const repoRoot = path.join(tmpDir, 'repo')
  const moluoHome = path.join(userHome, '.moluoxixi')
  const hostHome = path.join(userHome, '.codex')
  const hostBaselineFile = path.join(hostHome, 'AGENTS.md')

  writeFile(path.join(repoRoot, 'roles', 'common', 'constants', 'skills.ts'), `
export const vendors = []
`)
  writeFile(path.join(repoRoot, 'roles', 'openspec-development', 'constants', 'skills.ts'), `
export const extendsRoles = ['common']
export const vendors = []
`)
  writeFile(path.join(repoRoot, 'roles', 'common', 'hooks', 'session-log.mjs'), 'hook\n')
  writeFile(path.join(repoRoot, 'roles', 'openspec-development', 'rules', 'AGENTS.md'), 'baseline\n')
  writeFile(path.join(repoRoot, 'roles', 'openspec-development', 'agents', 'helper.md'), 'agent\n')
  fs.mkdirSync(path.join(moluoHome, 'vendor', 'skills', 'skill-one'), { recursive: true })

  await syncFirstPartyToHome(repoRoot, moluoHome, 'openspec-development')
  assert.equal(fs.readFileSync(path.join(moluoHome, 'vendor', 'AGENTS.md'), 'utf8'), 'baseline\n')
  assert.equal(fs.readFileSync(path.join(moluoHome, 'vendor', 'agents', 'helper.md'), 'utf8'), 'agent\n')
  assert.equal(fs.readFileSync(path.join(moluoHome, 'vendor', 'hooks', 'session-log.mjs'), 'utf8'), 'hook\n')
  assert.equal(fs.existsSync(path.join(moluoHome, 'agents')), false)
  assert.equal(fs.existsSync(path.join(moluoHome, 'skills')), false)

  projectToHost({ userHome, moluoHome, hostHome, hostBaselineFile })
  assert.equal(fs.readFileSync(hostBaselineFile, 'utf8'), 'baseline\n')
  assert.ok(fs.lstatSync(path.join(hostHome, 'skills', 'skill-one')).isSymbolicLink())
  assert.equal(fs.readFileSync(path.join(hostHome, 'agents', 'helper.md'), 'utf8'), 'agent\n')
  assert.equal(fs.existsSync(path.join(hostHome, 'agents', 'helper.md')), true)

  const codexBaseline = linkHostBaseline({ moluoHome, host: 'codex', userHome })
  assert.equal(codexBaseline, hostBaselineFile)
  assert.equal(linkHostBaseline({ moluoHome, host: 'agentsmd', userHome }), undefined)
  assert.equal(fs.existsSync(path.join(userHome, '.agents', 'AGENTS.md')), false)
  assert.throws(
    () => linkHostBaseline({ moluoHome, host: 'unknown', userHome }),
    /Unknown host: unknown/,
  )
}))

it('install - 宿主级配置可通用排除不安装的技能', () => withTempDir('airules-host-exclude-', (tmpDir) => {
  const userHome = path.join(tmpDir, 'user')
  const moluoHome = path.join(userHome, '.moluoxixi')
  const hostHome = path.join(userHome, '.custom-agent')
  const hostBaselineFile = path.join(hostHome, 'AGENTS.md')
  const vendorSkillsDir = path.join(moluoHome, 'vendor', 'skills')

  writeFile(path.join(moluoHome, 'vendor', 'AGENTS.md'), 'baseline\n')
  fs.mkdirSync(path.join(vendorSkillsDir, 'enabled-skill'), { recursive: true })
  fs.mkdirSync(path.join(vendorSkillsDir, 'disabled-skill'), { recursive: true })

  projectToHost({
    userHome,
    moluoHome,
    hostHome,
    hostBaselineFile,
    excludedSkills: ['disabled-skill'],
  })

  assert.ok(fs.lstatSync(path.join(hostHome, 'skills', 'enabled-skill')).isSymbolicLink())
  assert.equal(fs.existsSync(path.join(hostHome, 'skills', 'disabled-skill')), false)
  assert.ok(fs.lstatSync(path.join(userHome, '.agents', 'skills', 'disabled-skill')).isSymbolicLink())
}))

it('install - projectHostById 跳过缺失宿主并处理未知宿主错误', () => withTempDir('airules-host-', (tmpDir) => {
  const userHome = path.join(tmpDir, 'user')
  const moluoHome = path.join(userHome, '.moluoxixi')
  writeFile(path.join(moluoHome, 'vendor', 'AGENTS.md'), 'baseline\n')
  fs.mkdirSync(path.join(moluoHome, 'vendor', 'skills', 'skill-one'), { recursive: true })

  const skipped = projectHostById('codex', userHome, moluoHome)
  assert.equal(skipped.success, false)
  assert.equal(normalizePath(skipped.hostBaselineFile), normalizePath(path.join(userHome, '.codex', 'AGENTS.md')))

  fs.mkdirSync(path.join(userHome, '.codex'), { recursive: true })
  const projected = projectHostById('codex', userHome, moluoHome)
  assert.equal(projected.success, true)
  assert.ok(fs.lstatSync(path.join(userHome, '.codex', 'skills', 'skill-one')).isSymbolicLink())

  assert.throws(
    () => projectHostById('unknown', userHome, moluoHome),
    /Unknown host: unknown/,
  )
}))

it('install - Trae 宿主 home 缺失但真实 MCP 目录存在时仍投影 codegraph MCP', () => withTempDir('airules-trae-mcp-', (tmpDir) => {
  const userHome = path.join(tmpDir, 'user')
  const moluoHome = path.join(userHome, '.moluoxixi')
  const traeMcpHome = path.join(userHome, 'AppData', 'Roaming', 'Trae', 'User')

  writeFile(path.join(moluoHome, 'vendor', 'mcp', 'mcp.json'), `${JSON.stringify({
    mcpServers: {
      codegraph: {
        command: 'codegraph',
        args: ['serve', '--mcp', '--path', workspaceFolderPlaceholder],
      },
    },
  }, null, 2)}\n`)
  fs.mkdirSync(traeMcpHome, { recursive: true })

  const projected = projectHostById('trae', userHome, moluoHome)

  assert.equal(projected.success, true)
  assert.equal(projected.baselineProjected, false)
  assert.equal(fs.existsSync(path.join(userHome, '.trae')), false)

  const written = JSON.parse(fs.readFileSync(path.join(traeMcpHome, 'mcp.json'), 'utf8'))
  assert.deepEqual(written.inputs, [])
  assert.deepEqual(written.mcpServers.codegraph, {
    command: 'codegraph',
    args: ['serve', '--mcp', '--path', workspaceFolderPlaceholder],
  })
}))

it('install - Trae Solo 只投影 MCP，不写 baseline、skills 或 agents', () => withTempDir('airules-trae-solo-mcp-', (tmpDir) => {
  const userHome = path.join(tmpDir, 'user')
  const moluoHome = path.join(userHome, '.moluoxixi')
  const soloHostHome = path.join(userHome, '.trae-solo')
  const soloMcpHome = path.join(userHome, 'AppData', 'Roaming', 'TRAE SOLO', 'User')

  writeFile(path.join(moluoHome, 'vendor', 'mcp', 'mcp.json'), `${JSON.stringify({
    mcpServers: {
      codegraph: {
        command: 'codegraph',
        args: ['serve', '--mcp', '--path', workspaceFolderPlaceholder],
      },
    },
  }, null, 2)}\n`)
  fs.mkdirSync(soloMcpHome, { recursive: true })

  const projected = projectHostById('trae-solo', userHome, moluoHome)

  assert.equal(projected.success, true)
  assert.equal(projected.baselineProjected, false)
  assert.equal(fs.existsSync(soloHostHome), false)
  assert.equal(fs.existsSync(path.join(soloMcpHome, 'skills')), false)
  assert.equal(fs.existsSync(path.join(soloMcpHome, 'agents')), false)
  assert.equal(fs.existsSync(path.join(soloMcpHome, 'AGENTS.md')), false)

  const written = JSON.parse(fs.readFileSync(path.join(soloMcpHome, 'mcp.json'), 'utf8'))
  assert.deepEqual(written.inputs, [])
  assert.deepEqual(written.mcpServers.codegraph, {
    command: 'codegraph',
    args: ['serve', '--mcp', '--path', workspaceFolderPlaceholder],
  })
}))

it('install - Qoder 投影全局 AGENTS、skills、agents、Stop hook 与 SharedClientCache MCP', () => withTempDir('airules-qoder-mcp-', (tmpDir) => {
  const userHome = path.join(tmpDir, 'user')
  const moluoHome = path.join(userHome, '.moluoxixi')
  const qoderHome = path.join(userHome, '.qoder')
  const qoderMcpHome = path.join(userHome, 'AppData', 'Roaming', 'Qoder', 'SharedClientCache')
  const vendorSkillsDir = path.join(moluoHome, 'vendor', 'skills')

  writeFile(path.join(moluoHome, 'vendor', 'AGENTS.md'), '# AIRules\n\n## Core\n\n- Keep rules linked.\n')
  fs.mkdirSync(path.join(vendorSkillsDir, 'api-docs'), { recursive: true })
  writeFile(path.join(moluoHome, 'vendor', 'agents', 'demo-agent.md'), '---\nname: demo-agent\ndescription: demo\n---\nbody\n')
  writeFile(path.join(moluoHome, 'vendor', 'hooks', 'session-log.mjs'), 'process.stdout.write("{}")\n')
  writeFile(path.join(moluoHome, 'vendor', 'hooks', 'hooks.json'), `${JSON.stringify({
    version: 1,
    hooks: [{ event: 'Stop', script: 'session-log.mjs', hosts: ['qoder'] }],
  })}\n`)
  writeFile(path.join(moluoHome, 'vendor', 'mcp', 'mcp.json'), `${JSON.stringify({
    mcpServers: {
      codegraph: {
        command: 'codegraph',
        args: ['serve', '--mcp', '--path', workspaceFolderPlaceholder],
      },
    },
  }, null, 2)}\n`)
  fs.mkdirSync(qoderHome, { recursive: true })
  fs.mkdirSync(qoderMcpHome, { recursive: true })
  writeFile(path.join(qoderHome, 'settings.json'), `${JSON.stringify({
    hooks: {
      Stop: [
        { hooks: [{ type: 'command', command: 'echo user-stop' }] },
      ],
    },
  }, null, 2)}\n`)

  const projected = projectHostById('qoder', userHome, moluoHome)

  assert.equal(projected.success, true)
  assert.equal(projected.baselineProjected, true)
  assert.equal(fs.existsSync(path.join(qoderHome, 'AGENTS.md')), true)
  assert.equal(realLinkPath(path.join(qoderHome, 'skills', 'api-docs')), normalizePath(path.join(vendorSkillsDir, 'api-docs')))
  assert.equal(fs.existsSync(path.join(qoderHome, 'agents', 'demo-agent.md')), true)
  assert.equal(fs.existsSync(path.join(qoderMcpHome, 'AGENTS.md')), false)
  assert.equal(fs.existsSync(path.join(qoderMcpHome, 'skills')), false)
  assert.equal(fs.existsSync(path.join(qoderMcpHome, 'agents')), false)
  const settings = JSON.parse(fs.readFileSync(path.join(qoderHome, 'settings.json'), 'utf8'))
  assert.deepEqual(Object.keys(settings.hooks).sort(), ['Stop'])
  const stopCommands = settings.hooks.Stop.flatMap((group: { hooks: Array<{ command: string }> }) => group.hooks.map(h => h.command))
  assert.equal(stopCommands.includes('echo user-stop'), true)
  assert.equal(stopCommands.filter((command: string) => command.includes('session-log.mjs')).length, 1)
  assert.equal(stopCommands.some((command: string) => command.includes('--airules-host=')), false)

  const written = JSON.parse(fs.readFileSync(path.join(qoderMcpHome, 'mcp.json'), 'utf8'))
  assert.deepEqual(written.mcpServers.codegraph, {
    type: 'stdio',
    command: 'codegraph',
    args: ['serve', '--mcp', '--path', workspaceFolderPlaceholder],
  })
}))

it('install - 本地角色 hook 清单无效时保留上一版 vendor hooks', async () => withTempDirAsync('airules-invalid-local-hooks-', async (tmpDir) => {
  const repoRoot = path.join(tmpDir, 'repo')
  const moluoHome = path.join(tmpDir, 'home')

  writeFile(path.join(repoRoot, 'roles', 'alpha', 'constants', 'skills.ts'), 'export const vendors = []\n')
  writeFile(path.join(repoRoot, 'roles', 'alpha', 'hooks', 'hooks.json'), `${JSON.stringify({
    version: 1,
    hooks: [{ event: 'Stop', script: 'missing.mjs' }],
  })}\n`)
  writeFile(path.join(moluoHome, 'vendor', 'hooks', 'stable.mjs'), 'export const stable = true\n')

  await assert.rejects(
    syncFirstPartyToHome(repoRoot, moluoHome, 'alpha'),
    /script does not exist/i,
  )
  assert.equal(fs.readFileSync(path.join(moluoHome, 'vendor', 'hooks', 'stable.mjs'), 'utf8'), 'export const stable = true\n')
}))

it('install - 角色 hook 清单按事件分发并保留用户 hook', () => withTempDir('airules-role-hook-dispatch-', (tmpDir) => {
  const userHome = path.join(tmpDir, 'user')
  const moluoHome = path.join(userHome, '.moluoxixi')
  const claudeHome = path.join(userHome, '.claude')

  writeFile(path.join(moluoHome, 'vendor', 'hooks', 'workflow-dispatcher.mjs'), 'process.stdout.write("{}")\n')
  writeFile(path.join(moluoHome, 'vendor', 'hooks', 'hooks.json'), `${JSON.stringify({
    version: 1,
    hooks: [
      { event: 'PreToolUse', script: 'workflow-dispatcher.mjs', hosts: ['claude'] },
      { event: 'Stop', script: 'workflow-dispatcher.mjs' },
    ],
  }, null, 2)}\n`)
  writeFile(path.join(claudeHome, 'settings.json'), `${JSON.stringify({
    hooks: { Stop: [{ hooks: [{ type: 'command', command: 'echo user-stop' }] }] },
  }, null, 2)}\n`)

  const projected = projectHostById('claude', userHome, moluoHome)

  assert.equal(projected.success, true)
  const settings = JSON.parse(fs.readFileSync(path.join(claudeHome, 'settings.json'), 'utf8'))
  assert.deepEqual(Object.keys(settings.hooks).sort(), ['PreToolUse', 'Stop'])
  assert.match(settings.hooks.PreToolUse[0].hooks[0].command, /workflow-dispatcher\.mjs/)
  assert.equal(JSON.stringify(settings.hooks.Stop).includes('echo user-stop'), true)
  assert.equal(JSON.stringify(settings.hooks.Stop).includes('workflow-dispatcher.mjs'), true)
  assert.equal(fs.existsSync(path.join(claudeHome, 'hooks', 'workflow-dispatcher.mjs')), true)
}))

it('install - 角色 hook 清单收敛删除旧受管事件但保留用户同目录脚本', () => withTempDir('airules-role-hook-reconcile-', (tmpDir) => {
  const userHome = path.join(tmpDir, 'user')
  const moluoHome = path.join(userHome, '.moluoxixi')
  const claudeHome = path.join(userHome, '.claude')
  const vendorHooks = path.join(moluoHome, 'vendor', 'hooks')
  const manifestFile = path.join(vendorHooks, 'hooks.json')

  writeFile(path.join(vendorHooks, 'dispatcher.mjs'), 'process.stdout.write("{}")\n')
  writeFile(manifestFile, `${JSON.stringify({ version: 1, hooks: [{ event: 'PreToolUse', script: 'dispatcher.mjs' }] })}\n`)
  fs.mkdirSync(claudeHome, { recursive: true })
  projectHostById('claude', userHome, moluoHome)

  const customScript = path.join(claudeHome, 'hooks', 'custom.mjs')
  writeFile(customScript, 'export const user = true\n')
  const first = JSON.parse(fs.readFileSync(path.join(claudeHome, 'settings.json'), 'utf8'))
  first.hooks.Stop = [{ hooks: [{ type: 'command', command: `node "${customScript}"` }] }]
  first.hooks.EmptyUserEvent = [{ matcher: 'never', hooks: [] }]
  fs.writeFileSync(path.join(claudeHome, 'settings.json'), `${JSON.stringify(first, null, 2)}\n`)

  writeFile(manifestFile, `${JSON.stringify({ version: 1, hooks: [{ event: 'Stop', script: 'dispatcher.mjs' }] })}\n`)
  projectHostById('claude', userHome, moluoHome)

  const settings = JSON.parse(fs.readFileSync(path.join(claudeHome, 'settings.json'), 'utf8'))
  assert.equal(settings.hooks.PreToolUse, undefined)
  assert.equal(JSON.stringify(settings.hooks.Stop).includes('--airules-managed-hook'), true)
  assert.equal(JSON.stringify(settings.hooks.Stop).includes('custom.mjs'), true)
  assert.deepEqual(settings.hooks.EmptyUserEvent, [{ matcher: 'never', hooks: [] }])
  assert.equal(fs.existsSync(customScript), true)
}))

it('install - JSON 同事件相似脚本名不会互相误删', () => withTempDir('airules-role-hook-similar-names-', (tmpDir) => {
  const userHome = path.join(tmpDir, 'user')
  const moluoHome = path.join(userHome, '.moluoxixi')
  const claudeHome = path.join(userHome, '.claude')
  const vendorHooks = path.join(moluoHome, 'vendor', 'hooks')

  writeFile(path.join(vendorHooks, 'a.mjs'), 'export {}\n')
  writeFile(path.join(vendorHooks, 'ba.mjs'), 'export {}\n')
  writeFile(path.join(vendorHooks, 'hooks.json'), `${JSON.stringify({
    version: 1,
    hooks: [{ event: 'Stop', script: 'ba.mjs' }, { event: 'Stop', script: 'a.mjs' }],
  })}\n`)
  fs.mkdirSync(claudeHome, { recursive: true })

  projectHostById('claude', userHome, moluoHome)

  const settings = JSON.parse(fs.readFileSync(path.join(claudeHome, 'settings.json'), 'utf8'))
  const commands = settings.hooks.Stop.flatMap((group: { hooks: Array<{ command: string }> }) => group.hooks.map(hook => hook.command))
  assert.equal(commands.filter((command: string) => command.includes('a.mjs')).length, 2)
  assert.equal(commands.some((command: string) => command.includes('ba.mjs')), true)
  assert.equal(commands.some((command: string) => /[\\/]a\.mjs"/u.test(command)), true)
}))

it('install - Qoder 只有 SharedClientCache 存在时仍创建 .qoder 完整投影', () => withTempDir('airules-qoder-mcp-only-', (tmpDir) => {
  const userHome = path.join(tmpDir, 'user')
  const moluoHome = path.join(userHome, '.moluoxixi')
  const qoderHome = path.join(userHome, '.qoder')
  const qoderMcpHome = path.join(userHome, 'AppData', 'Roaming', 'Qoder', 'SharedClientCache')
  const vendorSkillsDir = path.join(moluoHome, 'vendor', 'skills')

  writeFile(path.join(moluoHome, 'vendor', 'AGENTS.md'), '# AIRules\n')
  fs.mkdirSync(path.join(vendorSkillsDir, 'api-docs'), { recursive: true })
  writeFile(path.join(moluoHome, 'vendor', 'agents', 'demo-agent.md'), '---\nname: demo-agent\ndescription: demo\n---\nbody\n')
  writeFile(path.join(moluoHome, 'vendor', 'hooks', 'session-log.mjs'), 'process.stdout.write("{}")\n')
  writeFile(path.join(moluoHome, 'vendor', 'hooks', 'hooks.json'), `${JSON.stringify({
    version: 1,
    hooks: [{ event: 'Stop', script: 'session-log.mjs', hosts: ['qoder'] }],
  })}\n`)
  writeFile(path.join(moluoHome, 'vendor', 'mcp', 'mcp.json'), `${JSON.stringify({
    mcpServers: {
      codegraph: {
        command: 'codegraph',
        args: ['serve', '--mcp', '--path', workspaceFolderPlaceholder],
      },
    },
  }, null, 2)}\n`)
  fs.mkdirSync(qoderMcpHome, { recursive: true })

  const projected = projectHostById('qoder', userHome, moluoHome)

  assert.equal(projected.success, true)
  assert.equal(projected.baselineProjected, true)
  assert.equal(fs.existsSync(path.join(qoderHome, 'AGENTS.md')), true)
  assert.equal(fs.existsSync(path.join(qoderHome, 'skills', 'api-docs')), true)
  assert.equal(fs.existsSync(path.join(qoderHome, 'agents', 'demo-agent.md')), true)
  const settings = JSON.parse(fs.readFileSync(path.join(qoderHome, 'settings.json'), 'utf8'))
  assert.deepEqual(Object.keys(settings.hooks).sort(), ['Stop'])
}))

it('install - Hermes 宿主投影使用统一技能集合', () => withTempDir('airules-hermes-host-', (tmpDir) => {
  const userHome = path.join(tmpDir, 'user')
  const moluoHome = path.join(userHome, '.moluoxixi')
  const hermesHome = path.join(userHome, 'AppData', 'Local', 'hermes')
  const vendorSkillsDir = path.join(moluoHome, 'vendor', 'skills')
  const linkType = process.platform === 'win32' ? 'junction' : 'dir'

  writeFile(path.join(moluoHome, 'vendor', 'AGENTS.md'), '# AIRules\n\n## 核心规则\n\n- 禁止错误绕行。\n')
  // 预置真实 SOUL.md 身份内容，验证 append 模式不覆盖
  writeFile(path.join(hermesHome, 'SOUL.md'), '# Soul\n\n身份与人格描述。\n')
  fs.mkdirSync(path.join(vendorSkillsDir, 'api-docs'), { recursive: true })
  fs.mkdirSync(path.join(hermesHome, 'skills'), { recursive: true })
  fs.symlinkSync(path.join(tmpDir, 'stale-skill'), path.join(hermesHome, 'skills', 'stale-skill'), linkType)

  const projected = projectHostById('hermes', userHome, moluoHome)

  assert.equal(projected.success, true)
  assert.equal(normalizePath(projected.hostBaselineFile), normalizePath(path.join(hermesHome, 'SOUL.md')))

  // SOUL.md 仍是真实文件而非软链接，原有身份内容保留，红线托管块被追加
  const soulPath = path.join(hermesHome, 'SOUL.md')
  assert.equal(fs.lstatSync(soulPath).isSymbolicLink(), false)
  const soul = fs.readFileSync(soulPath, 'utf8')
  assert.match(soul, /身份与人格描述。/)
  assert.match(soul, /<!-- AIRULES:BASELINE:START -->/)
  assert.match(soul, /<!-- AIRULES:BASELINE:END -->/)
  assert.match(soul, /禁止错误绕行。/)

  assert.ok(fs.lstatSync(path.join(hermesHome, 'skills', 'api-docs')).isSymbolicLink())
  assert.equal(fs.existsSync(path.join(hermesHome, 'skills', 'stale-skill')), false)
  assert.ok(fs.lstatSync(path.join(userHome, '.agents', 'skills', 'api-docs')).isSymbolicLink())
}))

it('install - Hermes append 基线幂等：重复投影只保留一份托管块', () => withTempDir('airules-hermes-idem-', (tmpDir) => {
  const userHome = path.join(tmpDir, 'user')
  const moluoHome = path.join(userHome, '.moluoxixi')
  const hermesHome = path.join(userHome, 'AppData', 'Local', 'hermes')

  writeFile(path.join(moluoHome, 'vendor', 'AGENTS.md'), '# AIRules\n\n- 禁止错误绕行。\n')
  writeFile(path.join(hermesHome, 'SOUL.md'), '# Soul\n\n身份内容。\n')

  const target = linkHostBaseline({ moluoHome, host: 'hermes', userHome })
  assert.ok(target)
  const first = fs.readFileSync(target, 'utf8')
  linkHostBaseline({ moluoHome, host: 'hermes', userHome })
  linkHostBaseline({ moluoHome, host: 'hermes', userHome })
  const third = fs.readFileSync(target, 'utf8')

  // 多次注入内容稳定，托管块只出现一次
  assert.equal(first, third)
  assert.equal((third.match(/<!-- AIRULES:BASELINE:START -->/g) ?? []).length, 1)
  assert.equal((third.match(/<!-- AIRULES:BASELINE:END -->/g) ?? []).length, 1)
  assert.match(third, /身份内容。/)
}))

it('install - rebuildVendorSkillLinks 链接存在的源并生成 gitignore', async () => {
  await withTempDirAsync('airules-rebuild-', async (tmpDir) => {
    const homeDir = path.join(tmpDir, 'home')
    const manifestPath = path.join(tmpDir, 'manifest.mjs')
    const existingSource = path.join(homeDir, 'vendor', 'repos', 'demo', 'skills', 'existing')
    fs.mkdirSync(existingSource, { recursive: true })
    writeFile(manifestPath, `
export const vendors = [
  {
    name: 'demo',
    official: true,
    source: 'https://example.test/demo.git',
    projections: [
      {
        kind: 'skills',
        sourceBaseDir: 'skills',
        skills: ['existing'],
      },
    ],
  },
]
`)

    const plan = await rebuildVendorSkillLinks({ homeDir, manifestPath })
    assert.equal(plan.length, 1)
    assert.ok(fs.lstatSync(path.join(homeDir, 'vendor', 'skills', 'existing')).isSymbolicLink())

    const gitignore = fs.readFileSync(path.join(homeDir, 'vendor', 'skills', '.gitignore'), 'utf8')
    assert.match(gitignore, /existing/)
  })
})

it('install - rebuildVendorSkillLinks 递归展开 namespace 为扁平 vendor skills', async () => {
  await withTempDirAsync('airules-rebuild-flat-', async (tmpDir) => {
    const homeDir = path.join(tmpDir, 'home')
    const manifestPath = path.join(tmpDir, 'manifest.mjs')
    const workflowRoot = path.join(homeDir, 'vendor', 'repos', 'demo', 'skills', 'workflow')
    const reviewSkill = path.join(workflowRoot, 'review', 'namespace-review')
    const validationSkill = path.join(workflowRoot, 'quality', 'skill-validation-standard')

    writeFile(path.join(reviewSkill, 'SKILL.md'), 'review\n')
    writeFile(path.join(validationSkill, 'SKILL.md'), 'validation\n')
    writeFile(path.join(workflowRoot, 'README.md'), 'namespace docs\n')
    writeFile(manifestPath, `
export const vendors = [
  {
    name: 'demo',
    official: true,
    source: 'https://example.test/demo.git',
    projections: [
      {
        kind: 'namespace',
        sourceDir: 'skills/workflow',
        output: 'workflow',
      },
    ],
  },
]
`)

    const plan = await rebuildVendorSkillLinks({ homeDir, manifestPath })
    assert.equal(plan.length, 1)
    assert.ok(fs.lstatSync(path.join(homeDir, 'vendor', 'skills', 'namespace-review')).isSymbolicLink())
    assert.ok(fs.lstatSync(path.join(homeDir, 'vendor', 'skills', 'skill-validation-standard')).isSymbolicLink())
    assert.equal(fs.existsSync(path.join(homeDir, 'vendor', 'skills', 'workflow')), false)
    assert.equal(
      realLinkPath(path.join(homeDir, 'vendor', 'skills', 'namespace-review')),
      realLinkPath(reviewSkill),
    )

    const gitignore = fs.readFileSync(path.join(homeDir, 'vendor', 'skills', '.gitignore'), 'utf8')
    assert.match(gitignore, /namespace-review/)
    assert.match(gitignore, /skill-validation-standard/)
    assert.doesNotMatch(gitignore, /^workflow$/m)
  })
})

it('install - 第一方 skills 覆盖层按 manifest 继承关系选择 common', async () => {
  await withTempDirAsync('airules-first-party-extends-', async (tmpDir) => {
    const repoRoot = path.join(tmpDir, 'repo')
    const moluoHome = path.join(tmpDir, 'home')
    const commonSkill = path.join(repoRoot, 'roles', 'common', 'skills', 'handoff')
    const trellisSkill = path.join(repoRoot, 'roles', 'trellis-development', 'skills', 'init-project')
    const openspecSkill = path.join(repoRoot, 'roles', 'openspec-development', 'skills', 'init-project')
    const vendorSkillsDir = path.join(moluoHome, 'vendor', 'skills')

    writeFile(path.join(repoRoot, 'roles', 'common', 'constants', 'skills.ts'), `
export const vendors = []
`)
    writeFile(path.join(repoRoot, 'roles', 'trellis-development', 'constants', 'skills.ts'), `
export const vendors = []
`)
    writeFile(path.join(repoRoot, 'roles', 'openspec-development', 'constants', 'skills.ts'), `
export const extendsRoles = ['common']
export const vendors = []
`)
    writeFile(path.join(commonSkill, 'SKILL.md'), 'common\n')
    writeFile(path.join(trellisSkill, 'SKILL.md'), 'trellis\n')
    writeFile(path.join(openspecSkill, 'SKILL.md'), 'openspec\n')

    await syncFirstPartySkillsToVendor(repoRoot, moluoHome, 'trellis-development')

    assert.equal(realLinkPath(path.join(vendorSkillsDir, 'init-project')), realLinkPath(trellisSkill))
    assert.equal(fs.existsSync(path.join(vendorSkillsDir, 'handoff')), false)

    await syncFirstPartySkillsToVendor(repoRoot, moluoHome, 'openspec-development')

    assert.equal(realLinkPath(path.join(vendorSkillsDir, 'init-project')), realLinkPath(openspecSkill))
    assert.equal(realLinkPath(path.join(vendorSkillsDir, 'handoff')), realLinkPath(commonSkill))
  })
})

it('install - 第一方 skills 覆盖层只管理本地源链接', async () => withTempDirAsync('airules-first-party-', async (tmpDir) => {
  const repoRoot = path.join(tmpDir, 'repo')
  const moluoHome = path.join(tmpDir, 'home')
  const localSkill = path.join(repoRoot, 'roles', 'openspec-development', 'skills', 'workflow', 'local-review')
  const vendorSkillsDir = path.join(moluoHome, 'vendor', 'skills')
  const remoteSkill = path.join(moluoHome, 'vendor', 'repos', 'demo', 'skills', 'remote-review')

  writeFile(path.join(localSkill, 'SKILL.md'), 'local\n')
  writeFile(path.join(remoteSkill, 'SKILL.md'), 'remote\n')
  fs.mkdirSync(vendorSkillsDir, { recursive: true })
  fs.symlinkSync(
    remoteSkill,
    path.join(vendorSkillsDir, 'remote-review'),
    process.platform === 'win32' ? 'junction' : 'dir',
  )
  writeFile(path.join(repoRoot, 'roles', 'openspec-development', 'constants', 'skills.ts'), `
export const vendors = []
`)

  await syncFirstPartySkillsToVendor(repoRoot, moluoHome, 'openspec-development')

  assert.equal(
    realLinkPath(path.join(vendorSkillsDir, 'local-review')),
    realLinkPath(localSkill),
  )
  assert.equal(
    realLinkPath(path.join(vendorSkillsDir, 'remote-review')),
    realLinkPath(remoteSkill),
  )

  fs.rmSync(localSkill, { recursive: true, force: true })
  await syncFirstPartySkillsToVendor(repoRoot, moluoHome, 'openspec-development')

  assert.equal(fs.existsSync(path.join(vendorSkillsDir, 'local-review')), false)
  assert.equal(
    realLinkPath(path.join(vendorSkillsDir, 'remote-review')),
    realLinkPath(remoteSkill),
  )
}))

it('install - 第一方 skills 覆盖层不跟随软链接来源', async () => withTempDirAsync('airules-first-party-symlink-', async (tmpDir) => {
  const moluoHome = path.join(tmpDir, 'home')
  const localSourceRoot = path.join(tmpDir, 'local-root')
  const localSkillsDir = path.join(localSourceRoot, 'skills')
  const vendorSkillsDir = path.join(moluoHome, 'vendor', 'skills')
  const realLocalSkill = path.join(localSkillsDir, 'real-local')
  const linkedSourceSkill = path.join(tmpDir, 'agents', 'skills', 'linked-source')

  writeFile(path.join(realLocalSkill, 'SKILL.md'), 'local\n')
  writeFile(path.join(linkedSourceSkill, 'SKILL.md'), 'linked\n')
  fs.mkdirSync(localSkillsDir, { recursive: true })
  replaceWithSymlink(
    linkedSourceSkill,
    path.join(localSkillsDir, 'linked-source'),
    process.platform === 'win32' ? 'junction' : 'dir',
  )

  await syncFirstPartySkillsToVendor(localSourceRoot, moluoHome)

  assert.equal(
    realLinkPath(path.join(vendorSkillsDir, 'real-local')),
    realLinkPath(realLocalSkill),
  )
  assert.equal(fs.existsSync(path.join(vendorSkillsDir, 'linked-source')), false)
}))

it('install - 宿主投影跳过循环来源链接并自愈目标死链', () => withTempDir('airules-cyclic-skill-', (tmpDir) => {
  const userHome = path.join(tmpDir, 'user')
  const moluoHome = path.join(userHome, '.moluoxixi')
  const vendorSkillsDir = path.join(moluoHome, 'vendor', 'skills')
  const agentsSkillsDir = path.join(userHome, '.agents', 'skills')
  const claudeSkillsDir = path.join(userHome, '.claude', 'skills')
  const linkType = process.platform === 'win32' ? 'junction' : 'dir'

  fs.mkdirSync(vendorSkillsDir, { recursive: true })
  fs.mkdirSync(agentsSkillsDir, { recursive: true })
  fs.mkdirSync(claudeSkillsDir, { recursive: true })

  const vendorLink = path.join(vendorSkillsDir, 'loop-skill')
  const agentLink = path.join(agentsSkillsDir, 'loop-skill')

  fs.symlinkSync(agentLink, vendorLink, linkType)
  fs.symlinkSync(vendorLink, agentLink, linkType)

  assert.throws(
    () => fs.statSync(vendorLink),
    /ELOOP|too many symbolic links/i,
  )

  projectSkillsToHost(userHome, moluoHome, claudeSkillsDir)

  assert.equal(fs.existsSync(agentLink), false)
  assert.equal(fs.existsSync(path.join(claudeSkillsDir, 'loop-skill')), false)
}))

it('install - runSkillSetupCommands 执行 setup 成功命令', () => {
  const manifest: VendorManifest = {
    version: 1,
    vendors: {
      demo: {
        repo: 'https://example.test/demo.git',
        cloneDir: 'vendor/repos/demo',
        links: [
          {
            kind: 'skill',
            source: 'skills/demo',
            target: 'vendor/skills/demo',
            setup: [
              { command: 'node', args: ['-e', 'process.exit(0)'] },
            ],
          },
          {
            kind: 'skill',
            source: 'skills/plain',
            target: 'vendor/skills/plain',
          },
        ],
      },
    },
  }

  assert.doesNotThrow(() => runSkillSetupCommands(manifest))
})

it('install - runSkillSetupCommands 支持已存在命令时跳过 setup', () => {
  const manifest: VendorManifest = {
    version: 1,
    vendors: {
      demo: {
        repo: 'https://example.test/demo.git',
        cloneDir: 'vendor/repos/demo',
        setup: [
          {
            command: 'node',
            args: ['-e', 'process.exit(9)'],
            skipIfCommandAvailable: 'node',
          },
        ],
        links: [],
      },
    },
  }

  assert.doesNotThrow(() => runSkillSetupCommands(manifest))
})

it('install - setup 命令在 Windows 下使用 cmd shim', () => {
  const expectedNpmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm'
  const expectedCodegraphCommand = process.platform === 'win32' ? 'codegraph.cmd' : 'codegraph'
  const expectedShimShell = process.platform === 'win32'

  assert.equal(resolveSetupCommandExecutable('npm'), expectedNpmCommand)
  assert.equal(resolveSetupCommandExecutable('codegraph'), expectedCodegraphCommand)
  assert.equal(resolveSetupCommandExecutable('node'), 'node')
  assert.equal(shouldUseShellForSetupCommand('npm'), expectedShimShell)
  assert.equal(shouldUseShellForSetupCommand('codegraph'), expectedShimShell)
  assert.equal(shouldUseShellForSetupCommand('node'), false)
})

it('install - runSkillSetupCommands 保留供应商级 setup 失败语义', () => {
  const manifest: VendorManifest = {
    version: 1,
    vendors: {
      demo: {
        repo: 'https://example.test/demo.git',
        cloneDir: 'vendor/repos/demo',
        setup: [
          { command: 'node', args: ['-e', 'process.exit(4)'] },
        ],
        links: [],
      },
    },
  }

  assert.throws(
    () => runSkillSetupCommands(manifest),
    /安装前置命令失败/,
  )
})

it('install - runSkillSetupCommands 保留 setup 失败语义', () => {
  const manifest: VendorManifest = {
    version: 1,
    vendors: {
      demo: {
        repo: 'https://example.test/demo.git',
        cloneDir: 'vendor/repos/demo',
        setup: [
          { command: 'node', args: ['-e', 'process.exit(0)'] },
        ],
        links: [
          {
            kind: 'skill',
            source: 'skills/demo',
            target: 'vendor/skills/demo',
            setup: [
              { command: 'node', args: ['-e', 'process.exit(3)'] },
            ],
          },
        ],
      },
    },
  }

  assert.throws(
    () => runSkillSetupCommands(manifest),
    /安装前置命令失败/,
  )
})

it('vendors - loadVendorManifest 支持默认导出并显式拒绝无效清单', async () => {
  await withTempDirAsync('airules-manifest-', async (tmpDir) => {
    const validManifest = path.join(tmpDir, 'valid.mjs')
    const invalidManifest = path.join(tmpDir, 'invalid.mjs')

    writeFile(validManifest, `
export default {
  vendors: [
    {
      name: 'demo',
      official: false,
      source: 'https://example.test/demo.git',
      projections: [
        {
          kind: 'namespace',
          sourceDir: 'skills',
          output: 'demo',
        },
      ],
    },
  ],
}
`)
    writeFile(invalidManifest, `export default null`)

    const manifest = await loadVendorManifest(validManifest)
    assert.equal(manifest.version, 1)
    assert.equal(manifest.vendors.demo.official, false)
    assert.equal(manifest.vendors.demo.links[0].kind, 'namespace-dir')

    await assert.rejects(
      () => loadVendorManifest(invalidManifest),
      /must export a "vendors" object/,
    )
  })
})

it('vendors - 合并重复供应商、拒绝本地供应商和未知 projection', () => {
  const merged: Record<string, any> = {}
  walkVendorTree([
    {
      group: [
        {
          name: 'demo',
          official: false,
          source: 'https://example.test/demo.git',
          projections: [{ kind: 'skills', sourceBaseDir: 'skills', skills: ['a'] }],
        },
        {
          name: 'demo',
          official: true,
          source: 'https://example.test/demo.git',
          projections: [{ kind: 'skills', sourceBaseDir: 'skills', skills: ['b'] }],
        },
      ],
    },
  ], [], merged)

  assert.equal(merged.demo.official, true)
  assert.deepEqual(merged.demo.links.map((link: any) => link.target), [
    'vendor/skills/a',
    'vendor/skills/b',
  ])

  assert.throws(
    () => walkVendorTree([{
      name: 'local',
      local: true,
      source: 'file:///local',
      projections: [],
    }], [], {}),
    /暂不支持本地供应商实体/,
  )

  assert.throws(
    () => walkVendorTree([{
      name: 'demo',
      source: 'https://example.test/demo.git',
      projections: [{ kind: 'unknown' }],
    }], [], {}),
    /存在未知 projection 类型: unknown/,
  )

  assert.throws(
    () => walkVendorTree([
      {
        name: 'demo',
        source: 'https://example.test/one.git',
        projections: [{ kind: 'skills', sourceBaseDir: 'skills', skills: ['a'] }],
      },
      {
        name: 'demo',
        source: 'https://example.test/two.git',
        projections: [{ kind: 'skills', sourceBaseDir: 'skills', skills: ['b'] }],
      },
    ], [], {}),
    /在不同模块中的定义不一致/,
  )
})

it('vendors - 工具路径函数返回标准化路径', () => {
  assert.equal(normalizePath('a\\b\\c'), 'a/b/c')
  assert.equal(resolveHomePath('C:/Users/example', '.moluoxixi/vendor'), 'C:/Users/example/.moluoxixi/vendor')
  const vendorsModuleUrl = new URL('../vendors.ts', import.meta.url).href
  assert.equal(normalizePath(getRepoRoot(vendorsModuleUrl)), normalizePath(process.cwd()))
})
