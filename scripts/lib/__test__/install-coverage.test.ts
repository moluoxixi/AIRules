import type { VendorManifest } from '../vendors.js'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { it } from 'vitest'
import { findHostConfig, HOST_IDS, resolveGlobalAgentSkillsPath, resolveHostId, resolveHostPaths } from '../../../constants/hosts.js'
import {
  cleanupLegacyHostSkillLinks,
  ensureGlobalSkillLink,
  ensureInstallRoot,
  getDefaultInstallPaths,
  isSamePath,
  projectHostById,
  projectSkillsToHost,
  projectToHost,
  readInstalledMcpServers,
  rebuildVendorSkillLinks,
  replaceWithSymlink,
  resolveSetupCommandExecutable,
  runSkillSetupCommands,
  shouldUseShellForSetupCommand,
  syncFirstPartySkillsToVendor,
} from '../install.js'
import { buildLinkPlan } from '../links.js'
import { roleOverlayOrder } from '../roles.js'
import {
  getRepoRoot,
  loadVendorManifest,
  normalizePath,
  resolveHomePath,
  rolePackageSetupCommands,
  walkVendorTree,
} from '../vendors.js'

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
  const opencode = findHostConfig('opencode')
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
  assert.ok(opencode)
  assert.equal(missing, undefined)
  assert.equal(HOST_IDS.includes('qoder-cli'), false)
  assert.equal(HOST_IDS.includes('agentsmd'), false)
  assert.equal(HOST_IDS.includes('cc-switch'), false)
  assert.equal(HOST_IDS.includes('hermes desktop'), false)
  assert.equal(resolveHostId('hermes desktop'), 'hermes')
  assert.equal(normalizePath(resolveGlobalAgentSkillsPath('C:/Users/example')), 'C:/Users/example/.agents/skills')

  const cursorPaths = resolveHostPaths(cursor, 'C:/Users/example')
  assert.equal(normalizePath(cursorPaths.hostHome), 'C:/Users/example/.cursor')
  assert.equal(cursorPaths.skillsDirName, 'skills-cursor')
  assert.equal(cursorPaths.projectSkills, false)

  const claudePaths = resolveHostPaths(claude, 'C:/Users/example')
  assert.equal(normalizePath(claudePaths.hostHome), 'C:/Users/example/.claude')
  assert.equal(normalizePath(claudePaths.mcpHome), 'C:/Users/example')
  assert.equal(claudePaths.skillsDirName, 'skills')
  assert.equal(claudePaths.mcp?.fileName, '.claude.json')
  assert.equal(claudePaths.mcp?.requireHostHome, true)

  const codexPaths = resolveHostPaths(findHostConfig('codex')!, 'C:/Users/example')
  assert.equal(codexPaths.projectSkills, false)

  const hermesPaths = resolveHostPaths(hermes, 'C:/Users/example')
  assert.equal(normalizePath(hermesPaths.hostHome), 'C:/Users/example/AppData/Local/hermes')
  assert.equal(hermesPaths.skillsDirName, 'skills')
  assert.equal(hermesPaths.projectSkills, false)
  assert.deepEqual(hermesPaths.excludedSkills, [])

  const traePaths = resolveHostPaths(trae, 'C:/Users/example')
  assert.equal(normalizePath(traePaths.hostHome), 'C:/Users/example/.trae')
  assert.equal(traePaths.projectSkills, false)

  const traeCnPaths = resolveHostPaths(traeCn, 'C:/Users/example')
  assert.equal(normalizePath(traeCnPaths.hostHome), 'C:/Users/example/.trae-cn')
  assert.equal(traeCnPaths.projectSkills, false)

  const traeSoloPaths = resolveHostPaths(traeSolo, 'C:/Users/example')
  assert.equal(normalizePath(traeSoloPaths.hostHome), 'C:/Users/example/.trae-solo')
  assert.equal(traeSoloPaths.projectSkills, false)

  const traeSoloCnPaths = resolveHostPaths(traeSoloCn, 'C:/Users/example')
  assert.equal(normalizePath(traeSoloCnPaths.hostHome), 'C:/Users/example/.trae-solo-cn')
  assert.equal(traeSoloCnPaths.projectSkills, false)

  const qoderPaths = resolveHostPaths(qoder, 'C:/Users/example')
  assert.equal(normalizePath(qoderPaths.hostHome), 'C:/Users/example/.qoder')
  assert.equal(qoderPaths.projectSkills, false)

  const qoderworkPaths = resolveHostPaths(qoderwork, 'C:/Users/example')
  assert.equal(qoderworkPaths.projectSkills, true)

  const openCodePaths = resolveHostPaths(opencode, 'C:/Users/example')
  assert.equal(openCodePaths.projectSkills, false)
  assert.equal(openCodePaths.mcp?.serverCommandFormat, 'command-array')
  assert.deepEqual(openCodePaths.mcp?.defaultTopLevel, { $schema: 'https://opencode.ai/config.json' })
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

it('install - 全局技能链接尊重调用方提供的 canonical 目标目录', () => withTempDir('airules-global-custom-', (tmpDir) => {
  const userHome = path.join(tmpDir, 'user')
  const paths = {
    ...getDefaultInstallPaths(userHome),
    globalAgentSkillsHome: path.join(tmpDir, 'custom-agents', 'skills'),
  }
  const sourceSkill = path.join(paths.moluoHome, 'vendor', 'skills', 'skill-one')
  fs.mkdirSync(sourceSkill, { recursive: true })

  ensureGlobalSkillLink(paths)

  assert.ok(fs.lstatSync(path.join(paths.globalAgentSkillsHome, 'skill-one')).isSymbolicLink())
  assert.equal(fs.existsSync(path.join(userHome, '.agents', 'skills', 'skill-one')), false)
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
    writeFile(path.join(repoRoot, 'roles', 'standalone-development', 'constants', 'skills.ts'), `
export const vendors = []
`)

    assert.deepEqual(
      await roleOverlayOrder(repoRoot, 'standalone-development'),
      ['standalone-development'],
    )
  })
})

it('roles - 声明 extendsRoles 的角色显式叠加 common', async () => {
  await withTempDirAsync('airules-role-extends-', async (tmpDir) => {
    const repoRoot = path.join(tmpDir, 'repo')

    writeFile(path.join(repoRoot, 'roles', 'common', 'constants', 'skills.ts'), `
export const vendors = []
`)
    writeFile(path.join(repoRoot, 'roles', 'extended-development', 'constants', 'skills.ts'), `
export const extendsRoles = ['common']
export const vendors = []
`)

    assert.deepEqual(
      await roleOverlayOrder(repoRoot, 'extended-development'),
      ['common', 'extended-development'],
    )
  })
})

it('install - 宿主级配置可通用排除不安装的技能', () => withTempDir('airules-host-exclude-', (tmpDir) => {
  const userHome = path.join(tmpDir, 'user')
  const moluoHome = path.join(userHome, '.moluoxixi')
  const hostHome = path.join(userHome, '.custom-agent')
  const vendorSkillsDir = path.join(moluoHome, 'vendor', 'skills')

  writeFile(path.join(moluoHome, 'vendor', 'AGENTS.md'), 'baseline\n')
  fs.mkdirSync(path.join(vendorSkillsDir, 'enabled-skill'), { recursive: true })
  fs.mkdirSync(path.join(vendorSkillsDir, 'disabled-skill'), { recursive: true })

  projectToHost({
    userHome,
    moluoHome,
    hostHome,
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

  fs.mkdirSync(path.join(userHome, '.codex'), { recursive: true })
  const projected = projectHostById('codex', userHome, moluoHome)
  assert.equal(projected.success, true)
  assert.equal(fs.existsSync(path.join(userHome, '.codex', 'skills', 'skill-one')), false)
  assert.ok(fs.lstatSync(path.join(userHome, '.agents', 'skills', 'skill-one')).isSymbolicLink())

  assert.throws(
    () => projectHostById('unknown', userHome, moluoHome),
    /Unknown host: unknown/,
  )
}))

it('install - Hermes 复用 canonical skills 并只清理旧 AIRules 链接', () => withTempDir('airules-hermes-host-', (tmpDir) => {
  const userHome = path.join(tmpDir, 'user')
  const moluoHome = path.join(userHome, '.moluoxixi')
  const hermesHome = path.join(userHome, 'AppData', 'Local', 'hermes')
  const vendorSkillsDir = path.join(moluoHome, 'vendor', 'skills')
  const linkType = process.platform === 'win32' ? 'junction' : 'dir'

  writeFile(path.join(moluoHome, 'vendor', 'AGENTS.md'), '# AIRules\n\n## 核心规则\n\n- 禁止错误绕行。\n')
  writeFile(path.join(hermesHome, 'SOUL.md'), '# Soul\n\n身份与人格描述。\n')
  fs.mkdirSync(path.join(vendorSkillsDir, 'api-docs'), { recursive: true })
  fs.mkdirSync(path.join(hermesHome, 'skills'), { recursive: true })
  fs.symlinkSync(path.join(vendorSkillsDir, 'api-docs'), path.join(hermesHome, 'skills', 'legacy-api-docs'), linkType)
  writeFile(path.join(hermesHome, 'skills', 'user-skill', 'SKILL.md'), 'user skill\n')

  const projected = projectHostById('hermes', userHome, moluoHome)

  assert.equal(projected.success, true)

  const soulPath = path.join(hermesHome, 'SOUL.md')
  assert.equal(fs.lstatSync(soulPath).isSymbolicLink(), false)
  const soul = fs.readFileSync(soulPath, 'utf8')
  assert.match(soul, /身份与人格描述。/)
  assert.equal(soul, '# Soul\n\n身份与人格描述。\n')

  assert.equal(fs.existsSync(path.join(hermesHome, 'skills', 'api-docs')), false)
  assert.equal(fs.existsSync(path.join(hermesHome, 'skills', 'legacy-api-docs')), false)
  assert.equal(fs.readFileSync(path.join(hermesHome, 'skills', 'user-skill', 'SKILL.md'), 'utf8'), 'user skill\n')
  assert.ok(fs.lstatSync(path.join(userHome, '.agents', 'skills', 'api-docs')).isSymbolicLink())
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
    const standaloneSkill = path.join(repoRoot, 'roles', 'standalone-development', 'skills', 'init-project')
    const extendedSkill = path.join(repoRoot, 'roles', 'extended-development', 'skills', 'init-project')
    const vendorSkillsDir = path.join(moluoHome, 'vendor', 'skills')

    writeFile(path.join(repoRoot, 'roles', 'common', 'constants', 'skills.ts'), `
export const vendors = []
`)
    writeFile(path.join(repoRoot, 'roles', 'standalone-development', 'constants', 'skills.ts'), `
export const vendors = []
`)
    writeFile(path.join(repoRoot, 'roles', 'extended-development', 'constants', 'skills.ts'), `
export const extendsRoles = ['common']
export const vendors = []
`)
    writeFile(path.join(commonSkill, 'SKILL.md'), 'common\n')
    writeFile(path.join(standaloneSkill, 'SKILL.md'), 'standalone\n')
    writeFile(path.join(extendedSkill, 'SKILL.md'), 'extended\n')

    await syncFirstPartySkillsToVendor(repoRoot, moluoHome, 'standalone-development')

    assert.equal(realLinkPath(path.join(vendorSkillsDir, 'init-project')), realLinkPath(standaloneSkill))
    assert.equal(fs.existsSync(path.join(vendorSkillsDir, 'handoff')), false)

    await syncFirstPartySkillsToVendor(repoRoot, moluoHome, 'extended-development')

    assert.equal(realLinkPath(path.join(vendorSkillsDir, 'init-project')), realLinkPath(extendedSkill))
    assert.equal(realLinkPath(path.join(vendorSkillsDir, 'handoff')), realLinkPath(commonSkill))
  })
})

it('install - 第一方 skills 覆盖层只管理本地源链接', async () => withTempDirAsync('airules-first-party-', async (tmpDir) => {
  const repoRoot = path.join(tmpDir, 'repo')
  const moluoHome = path.join(tmpDir, 'home')
  const localSkill = path.join(repoRoot, 'roles', 'extended-development', 'skills', 'workflow', 'local-review')
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
  writeFile(path.join(repoRoot, 'roles', 'extended-development', 'constants', 'skills.ts'), `
export const vendors = []
`)

  await syncFirstPartySkillsToVendor(repoRoot, moluoHome, 'extended-development')

  assert.equal(
    realLinkPath(path.join(vendorSkillsDir, 'local-review')),
    realLinkPath(localSkill),
  )
  assert.equal(
    realLinkPath(path.join(vendorSkillsDir, 'remote-review')),
    realLinkPath(remoteSkill),
  )

  fs.rmSync(localSkill, { recursive: true, force: true })
  await syncFirstPartySkillsToVendor(repoRoot, moluoHome, 'extended-development')

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

it('install - runSkillSetupCommands 从 MCP catalog 执行 setup', () => withTempDir('airules-mcp-setup-', (tmpDir) => {
  const marker = path.join(tmpDir, 'mcp-setup-ran.txt')
  const catalogPath = path.join(tmpDir, 'vendor', 'repos', 'demo', 'mcps', 'code', 'mcps.json')
  writeFile(catalogPath, JSON.stringify({
    mcps: {
      demo: {
        mcp: { command: 'demo' },
        setup: [{
          command: process.execPath,
          args: ['-e', 'require("node:fs").writeFileSync(process.argv[1], "ran")', marker],
        }],
      },
    },
  }))
  const manifest: VendorManifest = {
    version: 1,
    vendors: {
      demo: {
        repo: 'https://example.test/demo.git',
        cloneDir: 'vendor/repos/demo',
        links: [{
          kind: 'mcp-file',
          source: 'mcps/code/mcps.json',
          target: 'vendor/mcps/code/mcp.json',
        }],
      },
    },
  }

  runSkillSetupCommands(manifest, tmpDir)

  assert.equal(fs.readFileSync(marker, 'utf8'), 'ran')
}))

it('install - canonical skills 宿主只清理 AIRules 旧链接并保留用户内容', () => withTempDir('airules-canonical-host-', (tmpDir) => {
  const userHome = path.join(tmpDir, 'user')
  const moluoHome = path.join(userHome, '.moluoxixi')
  const hostSkills = path.join(userHome, '.codex', 'skills')
  const vendorSkill = path.join(moluoHome, 'vendor', 'skills', 'managed')
  const externalSkill = path.join(tmpDir, 'external', 'custom')
  fs.mkdirSync(vendorSkill, { recursive: true })
  fs.mkdirSync(externalSkill, { recursive: true })
  writeFile(path.join(hostSkills, 'user-file', 'SKILL.md'), 'user\n')
  fs.symlinkSync(vendorSkill, path.join(hostSkills, 'legacy-managed'), 'junction')
  fs.symlinkSync(externalSkill, path.join(hostSkills, 'user-link'), 'junction')
  fs.mkdirSync(path.join(userHome, '.agents', 'skills', 'canonical'), { recursive: true })
  fs.symlinkSync(path.join(userHome, '.agents', 'skills', 'canonical'), path.join(hostSkills, 'legacy-canonical'), 'junction')

  cleanupLegacyHostSkillLinks(hostSkills, userHome, moluoHome)

  assert.equal(fs.existsSync(path.join(hostSkills, 'legacy-managed')), false)
  assert.equal(fs.existsSync(path.join(hostSkills, 'legacy-canonical')), false)
  assert.ok(fs.existsSync(path.join(hostSkills, 'user-file', 'SKILL.md')))
  assert.ok(fs.lstatSync(path.join(hostSkills, 'user-link')).isSymbolicLink())
}))

it('install - 旧链接清理不遍历用户自有的宿主 skills 目录软链接', () => withTempDir('airules-canonical-host-link-', (tmpDir) => {
  const userHome = path.join(tmpDir, 'user')
  const moluoHome = path.join(userHome, '.moluoxixi')
  const externalSkills = path.join(tmpDir, 'external', 'skills')
  const hostSkills = path.join(userHome, '.codex', 'skills')
  const managedTarget = path.join(moluoHome, 'vendor', 'skills', 'managed')
  fs.mkdirSync(managedTarget, { recursive: true })
  fs.mkdirSync(externalSkills, { recursive: true })
  fs.symlinkSync(managedTarget, path.join(externalSkills, 'legacy-managed'), 'junction')
  fs.mkdirSync(path.dirname(hostSkills), { recursive: true })
  fs.symlinkSync(externalSkills, hostSkills, 'junction')

  cleanupLegacyHostSkillLinks(hostSkills, userHome, moluoHome)

  assert.ok(fs.lstatSync(hostSkills).isSymbolicLink())
  assert.ok(fs.lstatSync(path.join(externalSkills, 'legacy-managed')).isSymbolicLink())
}))

it('install - 拒绝空 MCP server 名称', () => withTempDir('airules-empty-mcp-name-', (tmpDir) => {
  const sourceFile = path.join(tmpDir, 'vendor', 'mcps', 'invalid', 'mcp.json')
  writeFile(sourceFile, '{"mcpServers":{"":{"command":"invalid"}}}\n')

  assert.throws(
    () => readInstalledMcpServers(tmpDir, ''),
    /MCP server name must be non-empty/u,
  )
}))

it('install - 拒绝共享 MCP 重名并允许角色覆盖共享配置', () => withTempDir('airules-mcp-overrides-', (tmpDir) => {
  writeFile(path.join(tmpDir, 'vendor', 'mcps', 'one', 'mcp.json'), '{"mcpServers":{"demo":{"command":"shared"}}}\n')
  writeFile(path.join(tmpDir, 'roles', 'alpha', 'mcp', 'mcp.json'), '{"mcpServers":{"demo":{"command":"role"}}}\n')

  assert.deepEqual(readInstalledMcpServers(tmpDir, 'alpha')?.demo, { command: 'role' })

  writeFile(path.join(tmpDir, 'vendor', 'mcps', 'two', 'mcp.json'), '{"mcpServers":{"demo":{"command":"duplicate"}}}\n')
  assert.throws(
    () => readInstalledMcpServers(tmpDir, 'alpha'),
    /Duplicate shared MCP server "demo"/u,
  )
}))

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
  const expectedDeclaredShimCommand = process.platform === 'win32' ? 'demo-cli.cmd' : 'demo-cli'
  const expectedShimShell = process.platform === 'win32'

  assert.equal(resolveSetupCommandExecutable('npm'), expectedNpmCommand)
  assert.equal(resolveSetupCommandExecutable('demo-cli', true), expectedDeclaredShimCommand)
  assert.equal(resolveSetupCommandExecutable('demo-cli'), 'demo-cli')
  assert.equal(resolveSetupCommandExecutable('node'), 'node')
  assert.equal(shouldUseShellForSetupCommand('npm'), expectedShimShell)
  assert.equal(shouldUseShellForSetupCommand('demo-cli', true), expectedShimShell)
  assert.equal(shouldUseShellForSetupCommand('demo-cli'), false)
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

it('install - 角色 npm package setup 使用结构化跨平台 argv', () => {
  withTempDir('airules-role-package-setup-', (tmpDir) => {
    const binDir = path.join(tmpDir, 'bin')
    const marker = path.join(tmpDir, 'npm-args.txt')
    fs.mkdirSync(binDir, { recursive: true })
    if (process.platform === 'win32') {
      writeFile(path.join(binDir, 'npm.cmd'), [
        '@echo off',
        'node -e "require(\'node:fs\').writeFileSync(process.env.AIRULES_SETUP_MARKER, JSON.stringify(process.argv.slice(1)))" %*',
      ].join('\r\n'))
    }
    else {
      const fakeNpm = path.join(binDir, 'npm')
      writeFile(fakeNpm, [
        '#!/usr/bin/env node',
        'require(\'node:fs\').writeFileSync(process.env.AIRULES_SETUP_MARKER, JSON.stringify(process.argv.slice(2)))',
      ].join('\n'))
      fs.chmodSync(fakeNpm, 0o755)
    }

    const previousPath = process.env.PATH
    const previousMarker = process.env.AIRULES_SETUP_MARKER
    process.env.PATH = `${binDir}${path.delimiter}${previousPath ?? ''}`
    process.env.AIRULES_SETUP_MARKER = marker
    try {
      runSkillSetupCommands({
        packages: [{
          name: '@scope/demo-cli',
          path: 'packages/cli',
          install: { kind: 'npm-global', version: 'next' },
        }],
        version: 1,
        vendors: {},
      })
    }
    finally {
      if (previousPath === undefined)
        delete process.env.PATH
      else
        process.env.PATH = previousPath
      if (previousMarker === undefined)
        delete process.env.AIRULES_SETUP_MARKER
      else
        process.env.AIRULES_SETUP_MARKER = previousMarker
    }

    assert.deepEqual(JSON.parse(fs.readFileSync(marker, 'utf8')), [
      'install',
      '--global',
      '@scope/demo-cli@next',
    ])
  })
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
  hosts: ['claude', 'codex'],
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
    assert.deepEqual(manifest.hosts, ['claude', 'codex'])
    assert.equal(Object.hasOwn(manifest.vendors.demo, 'official'), false)
    assert.equal(manifest.vendors.demo.links[0].kind, 'namespace-dir')

    const mcpManifest = path.join(tmpDir, 'mcp.mjs')
    writeFile(mcpManifest, `export const vendors = [{
      name: 'demo',
      source: 'https://example.test/demo.git',
      projections: [{ kind: 'mcp', sourceFile: 'mcps/code/mcps.json', output: 'mcps/code/mcp.json' }],
    }]\n`)
    assert.deepEqual((await loadVendorManifest(mcpManifest)).vendors.demo.links, [{
      kind: 'mcp-file',
      source: 'mcps/code/mcps.json',
      target: 'vendor/mcps/code/mcp.json',
    }])

    await assert.rejects(
      () => loadVendorManifest(invalidManifest),
      /must export a "vendors" object/,
    )

    const invalidHostsManifest = path.join(tmpDir, 'invalid-hosts.mjs')
    writeFile(invalidHostsManifest, `export const hosts = ['unknown']\nexport const vendors = []\n`)
    await assert.rejects(
      () => loadVendorManifest(invalidHostsManifest),
      /unknown host "unknown"/i,
    )

    const allHostsManifest = path.join(tmpDir, 'all-hosts.mjs')
    writeFile(allHostsManifest, `export const hosts = 'all'\nexport const vendors = []\n`)
    assert.deepEqual((await loadVendorManifest(allHostsManifest)).hosts, HOST_IDS)

    for (const reservedHost of ['agentsmd', 'cc-switch', 'hermes desktop']) {
      const reservedManifest = path.join(tmpDir, `${reservedHost.replaceAll(' ', '-')}.mjs`)
      writeFile(reservedManifest, `export const hosts = [${JSON.stringify(reservedHost)}]\nexport const vendors = []\n`)
      await assert.rejects(() => loadVendorManifest(reservedManifest), /unknown host/i)
    }
  })
})

it('vendors - 角色 package 配置归一化并拒绝非法声明', async () => {
  await withTempDirAsync('airules-package-manifest-', async (tmpDir) => {
    const validManifest = path.join(tmpDir, 'valid.mjs')
    writeFile(validManifest, `
export const vendors = []
export const packages = [
  { name: '@scope/core', path: 'packages/core' },
  { name: '@scope/cli', path: 'packages/cli', install: { kind: 'npm-global' } },
]
`)
    const manifest = await loadVendorManifest(validManifest)
    assert.deepEqual(manifest.packages, [
      { name: '@scope/core', path: 'packages/core' },
      { name: '@scope/cli', path: 'packages/cli', install: { kind: 'npm-global' } },
    ])
    assert.deepEqual(rolePackageSetupCommands(manifest.packages), [{
      command: 'npm',
      args: ['install', '--global', '@scope/cli@latest'],
    }])

    const invalidCases = [
      `export const vendors = []\nexport const packages = {}`,
      `export const vendors = []\nexport const packages = [{ name: 'Bad Name', path: 'packages/core' }]`,
      `export const vendors = []\nexport const packages = [{ name: '@scope/core', path: '../core' }]`,
      `export const vendors = []\nexport const packages = [{ name: '@scope/core', path: 'C:\\\\outside' }]`,
      `export const vendors = []\nexport const packages = [{ name: '@scope/core', path: 'core', install: { kind: 'shell' } }]`,
      `export const vendors = []\nexport const packages = [{ name: '@scope/core', path: 'core', install: { kind: 'npm-global', version: 'latest & whoami' } }]`,
      `export const vendors = []\nexport const packages = [{ name: '@scope/core', path: 'one' }, { name: '@scope/core', path: 'two' }]`,
    ]
    for (const [index, source] of invalidCases.entries()) {
      const manifestPath = path.join(tmpDir, `invalid-${index}.mjs`)
      writeFile(manifestPath, source)
      await assert.rejects(() => loadVendorManifest(manifestPath))
    }
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

  assert.equal(Object.hasOwn(merged.demo, 'official'), false)
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
