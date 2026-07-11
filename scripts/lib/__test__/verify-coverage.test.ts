import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, it, vi } from 'vitest'
import { projectHostById } from '../install.js'
import { verifyHost } from '../verify.js'

const workspaceFolderPlaceholder = '$' + '{workspaceFolder}'

/**
 * 创建隔离的临时 home 目录，避免 verifyHost 读取真实用户目录。
 */
async function withTempHome<T>(run: (userHome: string, moluoHome: string) => T | Promise<T>): Promise<T> {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'airules-verify-'))
  const userHome = path.join(tmpDir, 'user')
  const moluoHome = path.join(userHome, '.moluoxixi')

  try {
    fs.mkdirSync(userHome, { recursive: true })
    vi.spyOn(os, 'homedir').mockReturnValue(userHome)
    return await run(userHome, moluoHome)
  }
  finally {
    vi.restoreAllMocks()
    fs.rmSync(tmpDir, { recursive: true, force: true })
  }
}

/**
 * 为指定 skill 创建 vendor 源目录。
 */
function createVendorSkill(moluoHome: string, skillName: string) {
  fs.mkdirSync(path.join(moluoHome, 'vendor', 'skills', skillName), { recursive: true })
}

/**
 * 写入中性 MCP 源，供 verifyHost 判断宿主 MCP 投影是否完整。
 */
function writeNeutralMcpSource(moluoHome: string) {
  fs.mkdirSync(path.join(moluoHome, 'vendor', 'mcp'), { recursive: true })
  fs.writeFileSync(path.join(moluoHome, 'vendor', 'mcp', 'mcp.json'), `${JSON.stringify({
    mcpServers: {
      codegraph: {
        command: 'codegraph',
        args: ['serve', '--mcp', '--path', workspaceFolderPlaceholder],
      },
    },
  }, null, 2)}\n`)
}

/**
 * 创建目录软链接，统一 Windows junction 与 POSIX dir symlink。
 */
function linkDir(source: string, target: string) {
  fs.mkdirSync(path.dirname(target), { recursive: true })
  fs.symlinkSync(source, target, process.platform === 'win32' ? 'junction' : 'dir')
}

afterEach(() => {
  vi.restoreAllMocks()
})

it('verifyHost - 未知宿主返回 false', async () => {
  await withTempHome(async (_userHome, moluoHome) => {
    assert.equal(await verifyHost('unknown', moluoHome), false)
  })
})

it('verifyHost - 宿主目录不存在时跳过但不视为失败', async () => {
  await withTempHome(async (_userHome, moluoHome) => {
    assert.equal(await verifyHost('codex', moluoHome), true)
  })
})

it('verifyHost - 宿主 skills 目录缺失时返回失败', async () => {
  await withTempHome(async (userHome, moluoHome) => {
    fs.mkdirSync(path.join(userHome, '.codex'), { recursive: true })

    assert.equal(await verifyHost('codex', moluoHome), false)
  })
})

it('verifyHost - Qoder 按旧方案要求 .qoder skills 链接完整，同时校验 SharedClientCache MCP', async () => {
  await withTempHome(async (userHome, moluoHome) => {
    const qoderHome = path.join(userHome, '.qoder')
    const qoderMcpHome = path.join(userHome, 'AppData', 'Roaming', 'Qoder', 'SharedClientCache')
    fs.mkdirSync(qoderHome, { recursive: true })
    fs.mkdirSync(qoderMcpHome, { recursive: true })
    createVendorSkill(moluoHome, 'api-docs')
    writeNeutralMcpSource(moluoHome)

    fs.writeFileSync(path.join(qoderMcpHome, 'mcp.json'), `${JSON.stringify({
      mcpServers: {
        codegraph: {
          command: 'user-custom-codegraph',
        },
      },
    }, null, 2)}\n`)

    assert.equal(await verifyHost('qoder', moluoHome, userHome), false)

    linkDir(
      path.join(moluoHome, 'vendor', 'skills', 'api-docs'),
      path.join(qoderHome, 'skills', 'api-docs'),
    )

    assert.equal(await verifyHost('qoder', moluoHome, userHome), true)
  })
})

it('verifyHost - MCP-only Trae Solo 使用 MCP 目录作为存在性依据', async () => {
  await withTempHome(async (userHome, moluoHome) => {
    const mcpHome = path.join(userHome, 'AppData', 'Roaming', 'TRAE SOLO', 'User')
    fs.mkdirSync(mcpHome, { recursive: true })
    createVendorSkill(moluoHome, 'api-docs')
    writeNeutralMcpSource(moluoHome)
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})

    assert.equal(await verifyHost('trae-solo', moluoHome), false)

    fs.writeFileSync(path.join(mcpHome, 'mcp.json'), `${JSON.stringify({
      inputs: [],
      mcpServers: {
        codegraph: {
          command: 'codegraph',
          args: ['serve', '--mcp', '--path', workspaceFolderPlaceholder],
        },
      },
    }, null, 2)}\n`)

    assert.equal(await verifyHost('trae-solo', moluoHome), true)
    assert.equal(warn.mock.calls.some(call => String(call[0]).includes('[SKIP]')), false)
    assert.equal(log.mock.calls.some(call => String(call[0]).includes('跳过 skills/agents 链接校验')), true)
  })
})

it('verifyHost - Trae 主目录缺失但 MCP 目录存在时仍校验 MCP', async () => {
  await withTempHome(async (userHome, moluoHome) => {
    const mcpHome = path.join(userHome, 'AppData', 'Roaming', 'Trae', 'User')
    fs.mkdirSync(mcpHome, { recursive: true })
    writeNeutralMcpSource(moluoHome)

    assert.equal(await verifyHost('trae', moluoHome), false)

    fs.writeFileSync(path.join(mcpHome, 'mcp.json'), `${JSON.stringify({
      inputs: [],
      mcpServers: {
        codegraph: {
          command: 'codegraph',
          args: ['serve', '--mcp', '--path', workspaceFolderPlaceholder],
        },
      },
    }, null, 2)}\n`)

    assert.equal(await verifyHost('trae', moluoHome), true)
  })
})

it('verifyHost - Qoder 用户同名 MCP server 不因缺少覆盖字段失败', async () => {
  await withTempHome(async (userHome, moluoHome) => {
    const qoderHome = path.join(userHome, '.qoder')
    const qoderMcpHome = path.join(userHome, 'AppData', 'Roaming', 'Qoder', 'SharedClientCache')
    fs.mkdirSync(qoderHome, { recursive: true })
    fs.mkdirSync(qoderMcpHome, { recursive: true })
    createVendorSkill(moluoHome, 'api-docs')
    writeNeutralMcpSource(moluoHome)
    linkDir(
      path.join(moluoHome, 'vendor', 'skills', 'api-docs'),
      path.join(qoderHome, 'skills', 'api-docs'),
    )

    fs.writeFileSync(path.join(qoderMcpHome, 'mcp.json'), `${JSON.stringify({
      mcpServers: {
        codegraph: {
          command: 'user-custom-codegraph',
        },
      },
    }, null, 2)}\n`)

    assert.equal(await verifyHost('qoder', moluoHome, userHome), true)
  })
})

it('verifyHost - Qoder host 存在但独立 MCP 目录缺失时失败', async () => {
  await withTempHome(async (userHome, moluoHome) => {
    createVendorSkill(moluoHome, 'api-docs')
    writeNeutralMcpSource(moluoHome)
    fs.mkdirSync(path.join(userHome, '.qoder'), { recursive: true })

    assert.equal(await verifyHost('qoder', moluoHome, userHome), false)
  })
})

it('verifyHost - Qoder 只有 SharedClientCache 存在但缺 .qoder 完整资源时失败', async () => {
  await withTempHome(async (userHome, moluoHome) => {
    const qoderMcpHome = path.join(userHome, 'AppData', 'Roaming', 'Qoder', 'SharedClientCache')
    fs.mkdirSync(qoderMcpHome, { recursive: true })
    createVendorSkill(moluoHome, 'api-docs')
    writeNeutralMcpSource(moluoHome)
    fs.writeFileSync(path.join(qoderMcpHome, 'mcp.json'), `${JSON.stringify({
      mcpServers: {
        codegraph: {
          command: 'user-custom-codegraph',
        },
      },
    }, null, 2)}\n`)

    assert.equal(await verifyHost('qoder', moluoHome, userHome), false)
  })
})

it('verifyHost - Codex TOML MCP 配置带 BOM 仍可解析', async () => {
  await withTempHome(async (userHome, moluoHome) => {
    fs.mkdirSync(path.join(userHome, '.codex', 'skills'), { recursive: true })
    writeNeutralMcpSource(moluoHome)
    fs.writeFileSync(
      path.join(userHome, '.codex', 'config.toml'),
      '\uFEFF[mcp_servers.codegraph]\ncommand = "user-custom-codegraph"\n',
    )

    assert.equal(await verifyHost('codex', moluoHome), true)
  })
})

it.each([
  { host: 'claude', homeDir: '.claude' },
  { host: 'codex', homeDir: '.codex' },
])('verifyHost - $host 精确 hook 投影通过', async ({ host, homeDir }) => {
  await withTempHome(async (userHome, moluoHome) => {
    const hostHome = path.join(userHome, homeDir)
    const vendorHooks = path.join(moluoHome, 'vendor', 'hooks')
    fs.mkdirSync(path.join(hostHome, 'skills'), { recursive: true })
    fs.mkdirSync(vendorHooks, { recursive: true })
    fs.writeFileSync(path.join(vendorHooks, 'dispatcher.mjs'), 'export {}\n')
    fs.writeFileSync(path.join(vendorHooks, 'hooks.json'), `${JSON.stringify({
      version: 1,
      hooks: [{ event: 'Stop', script: 'dispatcher.mjs', hosts: [host] }],
    })}\n`)

    assert.equal(projectHostById(host, userHome, moluoHome).success, true)
    assert.equal(await verifyHost(host, moluoHome, userHome), true)
  })
})

it('verifyHost - 角色 hook 清单声明的宿主脚本缺失时失败', async () => {
  await withTempHome(async (userHome, moluoHome) => {
    fs.mkdirSync(path.join(userHome, '.codex', 'skills'), { recursive: true })
    fs.mkdirSync(path.join(moluoHome, 'vendor', 'hooks'), { recursive: true })
    fs.writeFileSync(path.join(moluoHome, 'vendor', 'hooks', 'dispatcher.mjs'), 'export {}\n')
    fs.writeFileSync(path.join(moluoHome, 'vendor', 'hooks', 'hooks.json'), `${JSON.stringify({
      version: 1,
      hooks: [{ event: 'Stop', script: 'dispatcher.mjs' }],
    })}\n`)

    assert.equal(await verifyHost('codex', moluoHome), false)
  })
})

it('verifyHost - 角色 hook 脚本被篡改或 TOML 块不完整时失败', async () => {
  await withTempHome(async (userHome, moluoHome) => {
    const codexHome = path.join(userHome, '.codex')
    const vendorHooks = path.join(moluoHome, 'vendor', 'hooks')
    const hostScript = path.join(codexHome, 'hooks', 'dispatcher.mjs')
    fs.mkdirSync(path.join(codexHome, 'skills'), { recursive: true })
    fs.mkdirSync(vendorHooks, { recursive: true })
    fs.mkdirSync(path.dirname(hostScript), { recursive: true })
    fs.writeFileSync(path.join(vendorHooks, 'dispatcher.mjs'), 'export {}\n')
    fs.writeFileSync(path.join(vendorHooks, 'hooks.json'), `${JSON.stringify({ version: 1, hooks: [{ event: 'Stop', script: 'dispatcher.mjs' }] })}\n`)
    fs.writeFileSync(hostScript, 'tampered\n')
    fs.writeFileSync(path.join(codexHome, 'config.toml'), '# >>> AIRULES HOOK Stop dispatcher.mjs >>>\n')

    assert.equal(await verifyHost('codex', moluoHome), false)

    fs.writeFileSync(hostScript, 'export {}\n')
    assert.equal(await verifyHost('codex', moluoHome), false)
  })
})

it('verifyHost - JSON hook 配置根节点不是对象时返回失败', async () => {
  await withTempHome(async (userHome, moluoHome) => {
    const claudeHome = path.join(userHome, '.claude')
    const vendorHooks = path.join(moluoHome, 'vendor', 'hooks')
    const hostScript = path.join(claudeHome, 'hooks', 'dispatcher.mjs')
    fs.mkdirSync(path.join(claudeHome, 'skills'), { recursive: true })
    fs.mkdirSync(vendorHooks, { recursive: true })
    fs.mkdirSync(path.dirname(hostScript), { recursive: true })
    fs.writeFileSync(path.join(vendorHooks, 'dispatcher.mjs'), 'export {}\n')
    fs.writeFileSync(path.join(vendorHooks, 'hooks.json'), `${JSON.stringify({ version: 1, hooks: [{ event: 'Stop', script: 'dispatcher.mjs' }] })}\n`)
    fs.writeFileSync(hostScript, 'export {}\n')
    fs.writeFileSync(path.join(claudeHome, 'settings.json'), 'null\n')

    assert.equal(await verifyHost('claude', moluoHome), false)
  })
})

it('verifyHost - JSON hook 受管集合含重复条目时失败', async () => {
  await withTempHome(async (userHome, moluoHome) => {
    const claudeHome = path.join(userHome, '.claude')
    const vendorHooks = path.join(moluoHome, 'vendor', 'hooks')
    const hostScript = path.join(claudeHome, 'hooks', 'dispatcher.mjs')
    const command = `node "${hostScript}" --airules-managed-hook`
    fs.mkdirSync(path.join(claudeHome, 'skills'), { recursive: true })
    fs.mkdirSync(vendorHooks, { recursive: true })
    fs.mkdirSync(path.dirname(hostScript), { recursive: true })
    fs.writeFileSync(path.join(vendorHooks, 'dispatcher.mjs'), 'export {}\n')
    fs.writeFileSync(path.join(vendorHooks, 'hooks.json'), `${JSON.stringify({ version: 1, hooks: [{ event: 'Stop', script: 'dispatcher.mjs' }] })}\n`)
    fs.writeFileSync(hostScript, 'export {}\n')
    fs.writeFileSync(path.join(claudeHome, 'settings.json'), `${JSON.stringify({
      hooks: {
        Stop: [
          { hooks: [{ type: 'command', command }] },
          { hooks: [{ type: 'command', command }] },
        ],
      },
    }, null, 2)}\n`)

    assert.equal(await verifyHost('claude', moluoHome), false)
  })
})

it('verifyHost - JSON hook 含非规范管理标记命令时失败', async () => {
  await withTempHome(async (userHome, moluoHome) => {
    const claudeHome = path.join(userHome, '.claude')
    const foreignScript = path.join(userHome, 'outside', 'stale.mjs')
    fs.mkdirSync(path.join(claudeHome, 'skills'), { recursive: true })
    fs.writeFileSync(path.join(claudeHome, 'settings.json'), `${JSON.stringify({
      hooks: {
        Stop: [{ hooks: [{ type: 'command', command: `node "${foreignScript}" --airules-managed-hook --extra` }] }],
      },
    }, null, 2)}\n`)

    assert.equal(await verifyHost('claude', moluoHome), false)
  })
})

it('verifyHost - 空清单存在残留 TOML 受管块时失败', async () => {
  await withTempHome(async (userHome, moluoHome) => {
    const codexHome = path.join(userHome, '.codex')
    const hostScript = path.join(codexHome, 'hooks', 'stale.mjs')
    fs.mkdirSync(path.join(codexHome, 'skills'), { recursive: true })
    fs.writeFileSync(path.join(codexHome, 'config.toml'), [
      '# >>> AIRULES HOOK Stop stale.mjs >>>',
      '[[hooks.Stop]]',
      '',
      '[[hooks.Stop.hooks]]',
      'type = "command"',
      `command = 'node "${hostScript}" --airules-managed-hook'`,
      '',
      '# <<< AIRULES HOOK Stop stale.mjs <<<',
      '',
    ].join('\n'))

    assert.equal(await verifyHost('codex', moluoHome), false)
  })
})

it('verifyHost - 校验有效链接、物理目录和缺失技能', async () => {
  await withTempHome(async (userHome, moluoHome) => {
    createVendorSkill(moluoHome, 'linked')
    createVendorSkill(moluoHome, 'copied')
    createVendorSkill(moluoHome, 'missing')
    fs.writeFileSync(path.join(moluoHome, 'vendor', 'skills', '.gitignore'), 'ignored\n')

    const hostSkillsDir = path.join(userHome, '.codex', 'skills')
    linkDir(
      path.join(moluoHome, 'vendor', 'skills', 'linked'),
      path.join(hostSkillsDir, 'linked'),
    )
    fs.mkdirSync(path.join(hostSkillsDir, 'copied'), { recursive: true })

    assert.equal(await verifyHost('codex', moluoHome), false)
  })
})

it('verifyHost - 外部链接可访问时警告但仍视为有效', async () => {
  await withTempHome(async (userHome, moluoHome) => {
    createVendorSkill(moluoHome, 'external')
    const externalSource = path.join(userHome, 'outside-skill')
    fs.mkdirSync(externalSource, { recursive: true })

    linkDir(externalSource, path.join(userHome, '.codex', 'skills', 'external'))

    assert.equal(await verifyHost('codex', moluoHome), true)
  })
})

it('verifyHost - Hermes 宿主使用统一技能集合', async () => {
  await withTempHome(async (userHome, moluoHome) => {
    createVendorSkill(moluoHome, 'api-docs')

    linkDir(
      path.join(moluoHome, 'vendor', 'skills', 'api-docs'),
      path.join(userHome, 'AppData', 'Local', 'hermes', 'skills', 'api-docs'),
    )

    assert.equal(await verifyHost('hermes', moluoHome), true)
  })
})

it('verifyHost - 断开的技能软链接显式判定为失败', async () => {
  await withTempHome(async (userHome, moluoHome) => {
    createVendorSkill(moluoHome, 'broken')
    const missingSource = path.join(userHome, 'deleted-source')
    const brokenLink = path.join(userHome, '.codex', 'skills', 'broken')

    fs.mkdirSync(missingSource, { recursive: true })
    linkDir(missingSource, brokenLink)
    fs.rmSync(missingSource, { recursive: true, force: true })

    assert.equal(fs.lstatSync(brokenLink).isSymbolicLink(), true)
    assert.equal(await verifyHost('codex', moluoHome), false)
  })
})
