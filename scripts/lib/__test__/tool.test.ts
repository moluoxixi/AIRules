import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { it } from 'vitest'
import { addLocalSkill, getEccFallbackContract, resolveHostTargets, resolveToolPaths, syncToHosts } from '../tool.js'

function withTempDir<T>(prefix: string, run: (tmpDir: string) => T): T {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), prefix))

  try {
    return run(tmpDir)
  }
  finally {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  }
}

async function withTempDirAsync<T>(prefix: string, run: (tmpDir: string) => Promise<T>): Promise<T> {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), prefix))

  try {
    return await run(tmpDir)
  }
  finally {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  }
}

function writeFile(filePath: string, content: string) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, content)
}

function realLinkPath(linkPath: string) {
  return fs.realpathSync(linkPath).replace(/\\/g, '/')
}

it('tool - resolveHostTargets all 不默认包含 agentsmd 共享层', () => {
  assert.equal(resolveHostTargets('all').includes('agentsmd'), false)
  assert.deepEqual(resolveHostTargets('agentsmd'), ['agentsmd'])
})

it('tool - resolveToolPaths 支持显式区分 moluoHome 与 userHome', () => withTempDir('airules-tool-paths-', (tmpDir) => {
  const repoRoot = path.join(tmpDir, 'repo')
  const moluoHome = path.join(tmpDir, 'config', 'airules-home')
  const userHome = path.join(tmpDir, 'user')
  writeFile(path.join(repoRoot, 'roles', 'ecc-development', 'constants', 'skills.ts'), 'export const vendors = []\n')

  const paths = resolveToolPaths(repoRoot, moluoHome, userHome)

  assert.equal(paths.repoRoot, path.resolve(repoRoot))
  assert.equal(paths.moluoHome, path.resolve(moluoHome))
  assert.equal(paths.userHome, path.resolve(userHome))
}))

it('tool - resolveToolPaths 在 tsx 源码运行时优先使用 TypeScript manifest', () => withTempDir('airules-tool-source-manifest-', (tmpDir) => {
  const repoRoot = path.join(tmpDir, 'repo')
  const moluoHome = path.join(tmpDir, 'home')

  writeFile(path.join(repoRoot, 'roles', 'ecc-development', 'constants', 'skills.ts'), 'export const vendors = []\n')
  writeFile(path.join(repoRoot, 'dist', 'roles', 'ecc-development', 'constants', 'skills.js'), 'export const vendors = []\n')

  const paths = resolveToolPaths(repoRoot, moluoHome)

  assert.equal(paths.manifestPath, path.resolve(repoRoot, 'roles', 'ecc-development', 'constants', 'skills.ts'))
}))

it('tool - resolveToolPaths 在缺少 TypeScript manifest 时回退到 dist manifest', () => withTempDir('airules-tool-dist-manifest-', (tmpDir) => {
  const repoRoot = path.join(tmpDir, 'repo')
  const moluoHome = path.join(tmpDir, 'home')

  writeFile(path.join(repoRoot, 'dist', 'roles', 'ecc-development', 'constants', 'skills.js'), 'export const vendors = []\n')

  const paths = resolveToolPaths(repoRoot, moluoHome)

  assert.equal(paths.manifestPath, path.resolve(repoRoot, 'dist', 'roles', 'ecc-development', 'constants', 'skills.js'))
}))

it('tool - addLocalSkill 复制包含 SKILL.md 的本地 skill', () => withTempDir('airules-tool-add-', (tmpDir) => {
  const sourceDir = path.join(tmpDir, 'source-skill')
  const moluoHome = path.join(tmpDir, 'home')
  writeFile(path.join(sourceDir, 'SKILL.md'), '---\nname: source-skill\n---\n')

  const added = addLocalSkill({
    sourceDir,
    moluoHome,
    overwrite: false,
  })

  assert.equal(added.skillName, 'source-skill')
  assert.equal(
    fs.readFileSync(path.join(moluoHome, 'local', 'skills', 'source-skill', 'SKILL.md'), 'utf8'),
    '---\nname: source-skill\n---\n',
  )

  assert.throws(
    () => addLocalSkill({ sourceDir, moluoHome, overwrite: false }),
    /Skill already exists/,
  )

  writeFile(path.join(sourceDir, 'README.md'), 'updated\n')
  addLocalSkill({ sourceDir, moluoHome, overwrite: true })
  assert.equal(
    fs.readFileSync(path.join(moluoHome, 'local', 'skills', 'source-skill', 'README.md'), 'utf8'),
    'updated\n',
  )
}))

it('tool - addLocalSkill 拒绝缺少 SKILL.md 的目录', () => withTempDir('airules-tool-invalid-', (tmpDir) => {
  const sourceDir = path.join(tmpDir, 'invalid-skill')
  fs.mkdirSync(sourceDir, { recursive: true })

  assert.throws(
    () => addLocalSkill({
      sourceDir,
      moluoHome: path.join(tmpDir, 'home'),
      overwrite: false,
    }),
    /must contain SKILL.md/,
  )
}))

it('tool - syncToHosts 同步内置和用户自定义 skills 到宿主', async () => {
  await withTempDirAsync('airules-tool-sync-', async (tmpDir) => {
    const repoRoot = path.join(tmpDir, 'repo')
    const userHome = path.join(tmpDir, 'user')
    const moluoHome = path.join(userHome, '.moluoxixi')
    const codexHome = path.join(userHome, '.codex')

    writeFile(path.join(repoRoot, 'package.json'), '{"type":"module"}\n')
    writeFile(path.join(repoRoot, 'roles', 'openspec-development', 'constants', 'skills.js'), 'export const vendors = []\n')
    writeFile(path.join(repoRoot, 'roles', 'openspec-development', 'rules', 'AGENTS.md'), 'baseline\n')
    writeFile(path.join(repoRoot, 'roles', 'openspec-development', 'agents', 'demo-agent.md'), '---\nname: demo-agent\ndescription: Demo agent\n---\nDo work\n')
    writeFile(path.join(repoRoot, 'roles', 'common', 'skills', 'session-capture', 'SKILL.md'), 'common\n')
    writeFile(path.join(repoRoot, 'roles', 'openspec-development', 'skills', 'workflow', 'builtin-review', 'SKILL.md'), 'builtin\n')
    writeFile(path.join(moluoHome, 'local', 'skills', 'custom-review', 'SKILL.md'), 'custom\n')
    fs.mkdirSync(codexHome, { recursive: true })

    const result = await syncToHosts({
      repoRoot,
      home: moluoHome,
      userHome,
      host: 'codex',
      role: 'openspec-development',
      skipVendors: true,
      verify: false,
    })

    assert.deepEqual(result.projectedHosts, ['codex'])
    assert.deepEqual(result.skippedHosts, [])
    assert.equal(
      realLinkPath(path.join(moluoHome, 'vendor', 'skills', 'builtin-review')),
      realLinkPath(path.join(repoRoot, 'roles', 'openspec-development', 'skills', 'workflow', 'builtin-review')),
    )
    assert.equal(
      realLinkPath(path.join(moluoHome, 'vendor', 'skills', 'session-capture')),
      realLinkPath(path.join(repoRoot, 'roles', 'common', 'skills', 'session-capture')),
    )
    assert.equal(
      realLinkPath(path.join(moluoHome, 'vendor', 'skills', 'custom-review')),
      realLinkPath(path.join(moluoHome, 'local', 'skills', 'custom-review')),
    )
    assert.equal(fs.existsSync(path.join(moluoHome, 'skills')), false)
    assert.equal(fs.existsSync(path.join(moluoHome, 'agents')), false)
    assert.equal(fs.existsSync(path.join(moluoHome, 'mcp')), false)
    const codexAgentToml = fs.readFileSync(path.join(codexHome, 'agents', 'demo-agent.toml'), 'utf8')
    assert.ok(codexAgentToml.includes('name = "demo-agent"'))
    assert.ok(codexAgentToml.includes('developer_instructions'))
    assert.equal(fs.existsSync(path.join(codexHome, 'agents', 'demo-agent.md')), false)
    assert.equal(
      realLinkPath(path.join(codexHome, 'skills', 'custom-review')),
      realLinkPath(path.join(userHome, '.agents', 'skills', 'custom-review')),
    )
    assert.equal(fs.readFileSync(path.join(codexHome, 'AGENTS.md'), 'utf8'), 'baseline\n')
  })
})

it('tool - syncToHosts 支持只包含 skills 的 product 角色', async () => {
  await withTempDirAsync('airules-tool-product-role-', async (tmpDir) => {
    const repoRoot = path.join(tmpDir, 'repo')
    const userHome = path.join(tmpDir, 'user')
    const moluoHome = path.join(userHome, '.moluoxixi')
    const codexHome = path.join(userHome, '.codex')

    writeFile(path.join(repoRoot, 'package.json'), '{"type":"module"}\n')
    writeFile(path.join(repoRoot, 'roles', 'product', 'constants', 'skills.js'), 'export const vendors = []\n')
    writeFile(path.join(repoRoot, 'roles', 'openspec-development', 'rules', 'AGENTS.md'), 'openspec-development baseline\n')
    writeFile(path.join(repoRoot, 'roles', 'common', 'hooks', 'session-log.mjs'), 'process.stdout.write("{}")\n')
    writeFile(path.join(repoRoot, 'roles', 'common', 'skills', 'session-capture', 'SKILL.md'), 'common skill\n')
    writeFile(path.join(repoRoot, 'roles', 'product', 'skills', 'deliver-prd', 'SKILL.md'), 'product skill\n')
    writeFile(path.join(moluoHome, 'vendor', 'AGENTS.md'), 'stale baseline\n')
    fs.mkdirSync(codexHome, { recursive: true })

    const result = await syncToHosts({
      repoRoot,
      home: moluoHome,
      userHome,
      host: 'codex',
      role: 'product',
      skipVendors: true,
      verify: false,
    })

    assert.deepEqual(result.projectedHosts, ['codex'])
    assert.equal(fs.existsSync(path.join(moluoHome, 'vendor', 'AGENTS.md')), false)
    assert.equal(fs.existsSync(path.join(codexHome, 'AGENTS.md')), false)
    assert.equal(
      realLinkPath(path.join(moluoHome, 'vendor', 'skills', 'deliver-prd')),
      realLinkPath(path.join(repoRoot, 'roles', 'product', 'skills', 'deliver-prd')),
    )
    assert.equal(
      realLinkPath(path.join(moluoHome, 'vendor', 'skills', 'session-capture')),
      realLinkPath(path.join(repoRoot, 'roles', 'common', 'skills', 'session-capture')),
    )
    assert.equal(fs.existsSync(path.join(moluoHome, 'vendor', 'hooks', 'session-log.mjs')), true)
    assert.equal(
      realLinkPath(path.join(codexHome, 'skills', 'deliver-prd')),
      realLinkPath(path.join(userHome, '.agents', 'skills', 'deliver-prd')),
    )
  })
})

it('tool - ecc-development 只对 ECC 全局 target 使用官方 installer，项目级/未支持宿主走 AIRules fallback', async () => {
  await withTempDirAsync('airules-tool-ecc-role-', async (tmpDir) => {
    const repoRoot = path.join(tmpDir, 'repo')
    const userHome = path.join(tmpDir, 'user')
    const moluoHome = path.join(userHome, '.moluoxixi')
    const claudeHome = path.join(userHome, '.claude')
    const codexHome = path.join(userHome, '.codex')
    const qoderHome = path.join(userHome, '.qoder')
    const traeHome = path.join(userHome, '.trae')
    const traeCnHome = path.join(userHome, '.trae-cn')
    const traeSoloHome = path.join(userHome, '.trae-solo')
    const hermesHome = path.join(userHome, 'AppData', 'Local', 'hermes')
    const cursorHome = path.join(userHome, '.cursor')
    const opencodeHome = path.join(userHome, '.config', 'opencode')
    const officialInstalls: Array<{ host: string, target: string, profile: string, args: string[] }> = []

    writeFile(path.join(repoRoot, 'package.json'), '{"type":"module"}\n')
    writeFile(path.join(repoRoot, 'roles', 'ecc-development', 'constants', 'skills.js'), 'export const vendors = []\n')
    writeFile(path.join(repoRoot, 'roles', 'common', 'hooks', 'session-log.mjs'), 'process.stdout.write("{}")\n')
    writeFile(path.join(repoRoot, 'roles', 'common', 'skills', 'session-capture', 'SKILL.md'), 'common skill\n')
    writeFile(path.join(repoRoot, 'roles', 'ecc-development', 'agents', 'reviewer.toml'), [
      'model = "gpt-5.5"',
      'model_reasoning_effort = "high"',
      'sandbox_mode = "read-only"',
      '',
      'developer_instructions = """',
      'Review like an owner.',
      'Prioritize correctness, security, behavioral regressions, and missing tests.',
      'Lead with concrete findings and avoid style-only feedback unless it hides a real bug.',
      '"""',
      '',
    ].join('\n'))
    for (const hostHome of [claudeHome, codexHome, qoderHome, traeHome, traeCnHome, traeSoloHome, hermesHome, cursorHome, opencodeHome]) {
      fs.mkdirSync(hostHome, { recursive: true })
    }

    const result = await syncToHosts({
      repoRoot,
      home: moluoHome,
      userHome,
      host: 'all',
      role: 'ecc-development',
      skipVendors: false,
      verify: false,
      runOfficialEccInstall: (invocation) => {
        officialInstalls.push(invocation)
      },
    })

    assert.deepEqual(
      officialInstalls.map(invocation => ({
        host: invocation.host,
        target: invocation.target,
        profile: invocation.profile,
        args: invocation.args,
      })),
      [
        {
          host: 'claude',
          target: 'claude',
          profile: 'core',
          args: ['-y', '--package', 'ecc-universal', 'ecc', 'install', '--profile', 'core', '--target', 'claude'],
        },
        {
          host: 'codex',
          target: 'codex',
          profile: 'core',
          args: ['-y', '--package', 'ecc-universal', 'ecc', 'install', '--profile', 'core', '--target', 'codex'],
        },
        {
          host: 'opencode',
          target: 'opencode',
          profile: 'opencode',
          args: ['-y', '--package', 'ecc-universal', 'ecc', 'install', '--profile', 'opencode', '--target', 'opencode'],
        },
      ],
    )
    assert.deepEqual(result.officialInstalledHosts, ['claude', 'codex', 'opencode'])
    assert.deepEqual(result.projectedHosts, ['trae', 'trae-cn', 'qoder'])
    assert.equal(
      realLinkPath(path.join(qoderHome, 'skills', 'session-capture')),
      realLinkPath(path.join(repoRoot, 'roles', 'common', 'skills', 'session-capture')),
    )
    assert.equal(
      realLinkPath(path.join(traeHome, 'skills', 'session-capture')),
      realLinkPath(path.join(repoRoot, 'roles', 'common', 'skills', 'session-capture')),
    )
    assert.equal(
      realLinkPath(path.join(traeCnHome, 'skills', 'session-capture')),
      realLinkPath(path.join(repoRoot, 'roles', 'common', 'skills', 'session-capture')),
    )
    const expectedReviewerMarkdown = [
      '---',
      'name: reviewer',
      'model: gpt-5.5',
      'model_reasoning_effort: high',
      'sandbox_mode: read-only',
      '---',
      '',
      'Review like an owner.',
      'Prioritize correctness, security, behavioral regressions, and missing tests.',
      'Lead with concrete findings and avoid style-only feedback unless it hides a real bug.',
      '',
    ].join('\n')
    assert.equal(fs.readFileSync(path.join(qoderHome, 'agents', 'reviewer.md'), 'utf8'), expectedReviewerMarkdown)
    assert.equal(fs.readFileSync(path.join(traeHome, 'agents', 'reviewer.md'), 'utf8'), expectedReviewerMarkdown)
    assert.equal(fs.readFileSync(path.join(traeCnHome, 'agents', 'reviewer.md'), 'utf8'), expectedReviewerMarkdown)
    assert.equal(fs.existsSync(path.join(codexHome, 'agents', 'reviewer.md')), false)
    assert.equal(fs.existsSync(path.join(hermesHome, 'skills', 'session-capture')), false)
    assert.equal(fs.existsSync(path.join(traeSoloHome, 'skills', 'session-capture')), false)
    assert.equal(fs.existsSync(path.join(cursorHome, 'skills-cursor', 'session-capture')), false)
    assert.equal(fs.existsSync(path.join(codexHome, 'skills', 'session-capture')), false)
  })
})

it('tool - ecc-development fallback contract 在代码层裁剪官方安装面', () => {
  const qoder = getEccFallbackContract('qoder')
  const trae = getEccFallbackContract('trae')
  const traeCn = getEccFallbackContract('trae-cn')

  assert.equal(qoder?.hostHomeRequired, false)
  assert.equal(trae?.hostHomeRequired, true)
  assert.equal(traeCn?.hostHomeRequired, true)
  for (const contract of [qoder, trae, traeCn]) {
    assert.equal(contract?.markdownAgentsOnly, true)
    assert.equal(contract?.activeMcpSource, 'role-audited')
    assert.deepEqual(contract?.disabledSurfaces, [
      'rules-core',
      'commands-core',
      'hooks-runtime',
    ])
  }

  for (const unsupported of ['hermes', 'trae-solo', 'trae-solo-cn', 'cc-switch', 'qoderwork']) {
    assert.equal(getEccFallbackContract(unsupported), undefined)
  }
})

it('tool - ecc-development 的 Trae fallback 不允许退化成 MCP-only 安装', async () => {
  await withTempDirAsync('airules-tool-ecc-trae-mcp-only-', async (tmpDir) => {
    const repoRoot = path.join(tmpDir, 'repo')
    const userHome = path.join(tmpDir, 'user')
    const moluoHome = path.join(userHome, '.moluoxixi')
    const traeMcpHome = path.join(userHome, 'AppData', 'Roaming', 'Trae', 'User')

    writeFile(path.join(repoRoot, 'package.json'), '{"type":"module"}\n')
    writeFile(path.join(repoRoot, 'roles', 'ecc-development', 'constants', 'skills.js'), 'export const vendors = []\n')
    writeFile(path.join(repoRoot, 'roles', 'ecc-development', 'rules', 'AGENTS.md'), 'ecc baseline\n')
    writeFile(path.join(repoRoot, 'roles', 'common', 'skills', 'session-capture', 'SKILL.md'), 'common skill\n')
    writeFile(path.join(repoRoot, 'roles', 'ecc-development', 'mcp', 'mcp.json'), '{"mcpServers":{"demo":{"command":"demo"}}}\n')
    fs.mkdirSync(traeMcpHome, { recursive: true })

    const result = await syncToHosts({
      repoRoot,
      home: moluoHome,
      userHome,
      host: 'trae',
      role: 'ecc-development',
      skipVendors: true,
      verify: false,
    })

    assert.deepEqual(result.projectedHosts, [])
    assert.deepEqual(result.skippedHosts, ['trae'])
    assert.equal(fs.existsSync(path.join(userHome, '.trae', 'skills', 'session-capture')), false)
    assert.equal(fs.existsSync(path.join(traeMcpHome, 'mcp.json')), false)
  })
})

it('tool - syncToHosts 在源码安装目录缺少 dist 时可直接加载 TypeScript manifest', async () => {
  await withTempDirAsync('airules-tool-source-no-dist-', async (tmpDir) => {
    const repoRoot = path.join(tmpDir, 'repo')
    const userHome = path.join(tmpDir, 'user')
    const moluoHome = path.join(userHome, '.moluoxixi')
    const codexHome = path.join(userHome, '.codex')

    writeFile(path.join(repoRoot, 'package.json'), '{"type":"module"}\n')
    writeFile(path.join(repoRoot, 'roles', 'openspec-development', 'constants', 'skills.ts'), 'export const vendors = []\n')
    writeFile(path.join(repoRoot, 'roles', 'openspec-development', 'rules', 'AGENTS.md'), 'baseline\n')
    writeFile(path.join(repoRoot, 'roles', 'openspec-development', 'agents', 'demo-agent.md'), '---\nname: demo-agent\ndescription: Demo agent\n---\nDo work\n')
    writeFile(path.join(repoRoot, 'roles', 'common', 'skills', 'session-capture', 'SKILL.md'), 'common\n')
    writeFile(path.join(repoRoot, 'roles', 'openspec-development', 'skills', 'workflow', 'source-only', 'SKILL.md'), 'source-only\n')
    fs.mkdirSync(codexHome, { recursive: true })

    const result = await syncToHosts({
      repoRoot,
      home: moluoHome,
      userHome,
      host: 'codex',
      role: 'openspec-development',
      skipVendors: false,
      verify: false,
    })

    assert.deepEqual(result.projectedHosts, ['codex'])
    assert.equal(fs.existsSync(path.join(codexHome, 'agents', 'demo-agent.toml')), true)
    assert.equal(
      realLinkPath(path.join(codexHome, 'skills', 'source-only')),
      realLinkPath(path.join(userHome, '.agents', 'skills', 'source-only')),
    )
    assert.equal(
      realLinkPath(path.join(codexHome, 'skills', 'session-capture')),
      realLinkPath(path.join(userHome, '.agents', 'skills', 'session-capture')),
    )
  })
})

it('tool - syncToHosts 在安装目录即仓库根目录时仍从 vendor 投影第一方 skills', async () => {
  await withTempDirAsync('airules-tool-installed-repo-', async (tmpDir) => {
    const userHome = path.join(tmpDir, 'user')
    const moluoHome = path.join(userHome, '.moluoxixi')
    const codexHome = path.join(userHome, '.codex')
    const vendorRepoSkill = path.join(moluoHome, 'vendor', 'repos', 'moluoxixi', 'roles', 'openspec-development', 'skills', 'api-docs')

    writeFile(path.join(moluoHome, 'package.json'), '{"type":"module"}\n')
    writeFile(path.join(moluoHome, 'roles', 'openspec-development', 'constants', 'skills.js'), `
export const vendors = [
  {
    name: 'moluoxixi',
    official: true,
    source: 'https://example.test/AIRules.git',
    projections: [
      {
        kind: 'skills',
        sourceBaseDir: 'roles/openspec-development/skills',
        skills: ['api-docs'],
      },
    ],
  },
]
`)
    writeFile(path.join(moluoHome, 'roles', 'openspec-development', 'rules', 'AGENTS.md'), 'baseline\n')
    writeFile(path.join(moluoHome, 'roles', 'common', 'skills', 'session-capture', 'SKILL.md'), 'common\n')
    writeFile(path.join(vendorRepoSkill, 'SKILL.md'), 'vendor-source\n')
    fs.mkdirSync(codexHome, { recursive: true })

    await syncToHosts({
      repoRoot: moluoHome,
      home: moluoHome,
      userHome,
      host: 'codex',
      role: 'openspec-development',
      skipVendors: true,
      verify: false,
    })

    assert.equal(
      realLinkPath(path.join(moluoHome, 'vendor', 'skills', 'api-docs')),
      realLinkPath(vendorRepoSkill),
    )
    assert.equal(fs.existsSync(path.join(moluoHome, 'skills')), false)
    assert.equal(fs.existsSync(path.join(moluoHome, 'agents')), false)
    assert.equal(fs.existsSync(path.join(moluoHome, 'mcp')), false)
    assert.equal(
      realLinkPath(path.join(codexHome, 'skills', 'api-docs')),
      realLinkPath(vendorRepoSkill),
    )
    assert.equal(
      realLinkPath(path.join(codexHome, 'skills', 'session-capture')),
      realLinkPath(path.join(moluoHome, 'roles', 'common', 'skills', 'session-capture')),
    )
  })
})

it('tool - syncToHosts 在 workspace 第一方 vendor 且安装目录即仓库根目录时不漏发第一方 skills', async () => {
  // 回归用例：用户把仓库安装进 ~/.moluoxixi（repoRoot === moluoHome），
  // 且第一方 vendor 为 sourceMode:"workspace"（不克隆到 vendor/repos），
  // 此时第一方 skills 仅能经 syncFirstPartySkillsToVendor 从 repoRoot/roles/openspec-development/skills 投影到 vendor/skills。
  // 旧逻辑用 isSamePath(repoRoot, moluoHome) 守卫跳过该调用，导致第一方 skills 整体漏发。
  await withTempDirAsync('airules-tool-workspace-installed-', async (tmpDir) => {
    const userHome = path.join(tmpDir, 'user')
    const moluoHome = path.join(userHome, '.moluoxixi')
    const codexHome = path.join(userHome, '.codex')

    writeFile(path.join(moluoHome, 'package.json'), '{"type":"module"}\n')
    writeFile(path.join(moluoHome, 'roles', 'openspec-development', 'constants', 'skills.js'), `
export const vendors = [
  {
    name: 'moluoxixi',
    official: true,
    source: 'https://example.test/AIRules.git',
    sourceMode: 'workspace',
    projections: [
      {
        kind: 'skills',
        sourceBaseDir: 'roles/openspec-development/skills',
        skills: ['api-docs'],
      },
    ],
  },
]
`)
    writeFile(path.join(moluoHome, 'roles', 'openspec-development', 'rules', 'AGENTS.md'), 'baseline\n')
    writeFile(path.join(moluoHome, 'roles', 'common', 'skills', 'session-capture', 'SKILL.md'), 'common\n')
    // 第一方 skill 源直接位于 repoRoot/roles/openspec-development/skills，无 vendor/repos 克隆。
    const firstPartySkill = path.join(moluoHome, 'roles', 'openspec-development', 'skills', 'api-docs')
    writeFile(path.join(firstPartySkill, 'SKILL.md'), 'first-party-source\n')
    fs.mkdirSync(codexHome, { recursive: true })

    await syncToHosts({
      repoRoot: moluoHome,
      home: moluoHome,
      userHome,
      host: 'codex',
      role: 'openspec-development',
      skipVendors: true,
      verify: false,
    })

    // 第一方 skill 必须出现在 vendor/skills 并指回角色 skill 源目录。
    assert.equal(
      realLinkPath(path.join(moluoHome, 'vendor', 'skills', 'api-docs')),
      realLinkPath(firstPartySkill),
    )
    // 并最终投影到宿主。
    assert.equal(
      realLinkPath(path.join(codexHome, 'skills', 'api-docs')),
      realLinkPath(firstPartySkill),
    )
    assert.equal(
      realLinkPath(path.join(codexHome, 'skills', 'session-capture')),
      realLinkPath(path.join(moluoHome, 'roles', 'common', 'skills', 'session-capture')),
    )
  })
})
