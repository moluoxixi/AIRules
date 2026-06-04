import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { it } from 'vitest'
import { findHostConfig, resolveHostPaths } from '../constants/hosts.js'
import {
  ensureGlobalSkillLink,
  ensureInstallRoot,
  getDefaultInstallPaths,
  isSamePath,
  linkHostBaseline,
  projectHostById,
  projectToHost,
  rebuildVendorSkillLinks,
  replaceWithSymlink,
  resolveSetupCommandExecutable,
  runSkillSetupCommands,
  shouldUseShellForSetupCommand,
  syncFirstPartySkillsToVendor,
  syncFirstPartyToHome,
} from '../scripts/lib/install.js'
import { buildLinkPlan } from '../scripts/lib/links.js'
import { getRepoRoot, loadVendorManifest, normalizePath, resolveHomePath, walkVendorTree } from '../scripts/lib/vendors.js'

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
  const missing = findHostConfig('missing-host')

  assert.ok(cursor)
  assert.ok(claude)
  assert.equal(missing, undefined)

  const cursorPaths = resolveHostPaths(cursor, 'C:/Users/example')
  assert.equal(normalizePath(cursorPaths.hostHome), 'C:/Users/example/.cursor')
  assert.equal(cursorPaths.skillsDirName, 'skills-cursor')

  const claudePaths = resolveHostPaths(claude, 'C:/Users/example')
  assert.equal(normalizePath(claudePaths.hostBaselineFile), 'C:/Users/example/.claude/CLAUDE.md')
  assert.equal(claudePaths.skillsDirName, 'skills')
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
  assert.ok(fs.existsSync(paths.globalAgentSkillsHome))

  const sourceSkill = path.join(paths.moluoHome, 'vendor', 'skills', 'skill-one')
  fs.mkdirSync(sourceSkill, { recursive: true })

  ensureGlobalSkillLink(paths)

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

it('install - 同步第一方文件并按宿主投影 baseline 与 skills', () => withTempDir('airules-project-', (tmpDir) => {
  const userHome = path.join(tmpDir, 'user')
  const repoRoot = path.join(tmpDir, 'repo')
  const moluoHome = path.join(userHome, '.moluoxixi')
  const hostHome = path.join(userHome, '.codex')
  const hostBaselineFile = path.join(hostHome, 'AGENTS.md')

  writeFile(path.join(repoRoot, 'rules', 'AGENTS.md'), 'baseline\n')
  writeFile(path.join(repoRoot, 'agents', 'helper.md'), 'agent\n')
  fs.mkdirSync(path.join(moluoHome, 'vendor', 'skills', 'skill-one'), { recursive: true })

  syncFirstPartyToHome(repoRoot, moluoHome)
  assert.equal(fs.readFileSync(path.join(moluoHome, 'vendor', 'AGENTS.md'), 'utf8'), 'baseline\n')
  assert.equal(fs.readFileSync(path.join(moluoHome, 'agents', 'helper.md'), 'utf8'), 'agent\n')

  projectToHost({ userHome, moluoHome, hostHome, hostBaselineFile })
  assert.equal(fs.readFileSync(hostBaselineFile, 'utf8'), 'baseline\n')
  assert.ok(fs.lstatSync(path.join(hostHome, 'skills', 'skill-one')).isSymbolicLink())
  assert.ok(fs.lstatSync(path.join(hostHome, 'agents')).isSymbolicLink())

  const codexBaseline = linkHostBaseline({ moluoHome, host: 'codex', userHome })
  assert.equal(codexBaseline, hostBaselineFile)
  assert.throws(
    () => linkHostBaseline({ moluoHome, host: 'unknown', userHome }),
    /Unknown host: unknown/,
  )
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

it('install - rebuildVendorSkillLinks 只链接存在的源并生成 gitignore', async () => {
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
        skills: ['existing', 'missing'],
      },
    ],
  },
]
`)

    const plan = await rebuildVendorSkillLinks({ homeDir, manifestPath })
    assert.equal(plan.length, 2)
    assert.ok(fs.lstatSync(path.join(homeDir, 'vendor', 'skills', 'existing')).isSymbolicLink())
    assert.equal(fs.existsSync(path.join(homeDir, 'vendor', 'skills', 'missing')), false)

    const gitignore = fs.readFileSync(path.join(homeDir, 'vendor', 'skills', '.gitignore'), 'utf8')
    assert.match(gitignore, /existing/)
    assert.doesNotMatch(gitignore, /missing/)
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

it('install - 第一方 skills 覆盖层只管理本地源链接', () => withTempDir('airules-first-party-', (tmpDir) => {
  const repoRoot = path.join(tmpDir, 'repo')
  const moluoHome = path.join(tmpDir, 'home')
  const localSkill = path.join(repoRoot, 'skills', 'workflow', 'local-review')
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

  syncFirstPartySkillsToVendor(repoRoot, moluoHome)

  assert.equal(
    realLinkPath(path.join(vendorSkillsDir, 'local-review')),
    realLinkPath(localSkill),
  )
  assert.equal(
    realLinkPath(path.join(vendorSkillsDir, 'remote-review')),
    realLinkPath(remoteSkill),
  )

  fs.rmSync(localSkill, { recursive: true, force: true })
  syncFirstPartySkillsToVendor(repoRoot, moluoHome)

  assert.equal(fs.existsSync(path.join(vendorSkillsDir, 'local-review')), false)
  assert.equal(
    realLinkPath(path.join(vendorSkillsDir, 'remote-review')),
    realLinkPath(remoteSkill),
  )
}))

it('install - 第一方 skills 覆盖层不跟随软链接来源', () => withTempDir('airules-first-party-symlink-', (tmpDir) => {
  const moluoHome = path.join(tmpDir, 'home')
  const localSkillsDir = path.join(moluoHome, 'skills')
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

  syncFirstPartySkillsToVendor(moluoHome, moluoHome)

  assert.equal(
    realLinkPath(path.join(vendorSkillsDir, 'real-local')),
    realLinkPath(realLocalSkill),
  )
  assert.equal(fs.existsSync(path.join(vendorSkillsDir, 'linked-source')), false)
}))

it('install - runSkillSetupCommands 执行 setup 成功命令', () => {
  const manifest = {
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
  const manifest = {
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
  const manifest = {
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
        projections: [],
      },
      {
        name: 'demo',
        source: 'https://example.test/two.git',
        projections: [],
      },
    ], [], {}),
    /在不同模块中的定义不一致/,
  )
})

it('vendors - 工具路径函数返回标准化路径', () => {
  assert.equal(normalizePath('a\\b\\c'), 'a/b/c')
  assert.equal(resolveHomePath('C:/Users/example', '.moluoxixi/vendor'), 'C:/Users/example/.moluoxixi/vendor')
  const vendorsModuleUrl = new URL('../scripts/lib/vendors.ts', import.meta.url).href
  assert.equal(normalizePath(getRepoRoot(vendorsModuleUrl)), normalizePath(process.cwd()))
})
