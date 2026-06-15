import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { it } from 'vitest'
import { projectToHost } from '../scripts/lib/install.js'

/**
 * 为 agent 格式门控 + MCP 多宿主投影搭建隔离环境。
 * 构造 ~/.moluoxixi（含 vendor/agents 与可选 vendor/mcp/mcp.json 中性源）与一个宿主 home。
 */
function setupEnv(options: { mcpServers?: Record<string, unknown>, withAgents?: boolean } = {}) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'airules-agentmcp-'))
  const userHome = path.join(tmpDir, 'user')
  const moluoHome = path.join(userHome, '.moluoxixi')
  const hostHome = path.join(userHome, '.host')

  fs.mkdirSync(moluoHome, { recursive: true })
  fs.mkdirSync(hostHome, { recursive: true })
  // 投影需要 vendor/skills 源存在（projectSkillsToHost 链路）
  fs.mkdirSync(path.join(moluoHome, 'vendor', 'skills'), { recursive: true })

  if (options.withAgents ?? true) {
    const agentsDir = path.join(moluoHome, 'vendor', 'agents')
    fs.mkdirSync(agentsDir, { recursive: true })
    fs.writeFileSync(path.join(agentsDir, 'demo-agent.md'), '---\nname: demo-agent\ndescription: x\nmodel: gpt-5\n---\nbody\n')
  }

  if (options.mcpServers) {
    fs.mkdirSync(path.join(moluoHome, 'vendor', 'mcp'), { recursive: true })
    fs.writeFileSync(
      path.join(moluoHome, 'vendor', 'mcp', 'mcp.json'),
      `${JSON.stringify({ mcpServers: options.mcpServers }, null, 2)}\n`,
    )
  }

  return { tmpDir, userHome, moluoHome, hostHome }
}

function cleanup(tmpDir: string) {
  fs.rmSync(tmpDir, { recursive: true, force: true })
}

const demoServers = {
  'demo-server': {
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-demo'],
    env: { DEMO_KEY: 'x' },
  },
}

it('agent 格式门控 - markdown 宿主软链 agents 目录', () => {
  const { tmpDir, userHome, moluoHome, hostHome } = setupEnv()
  try {
    projectToHost({
      userHome,
      moluoHome,
      hostHome,
      hostBaselineFile: path.join(hostHome, 'AGENTS.md'),
      projectBaseline: false,
      agentFormat: 'markdown',
    })
    const agentsTarget = path.join(hostHome, 'agents')
    assert.ok(fs.existsSync(agentsTarget), 'markdown 宿主应投影 agents')
    assert.ok(fs.existsSync(path.join(agentsTarget, 'demo-agent.md')), 'agent 文件应可访问')
  }
  finally {
    cleanup(tmpDir)
  }
})

it('agent 格式门控 - toml 宿主把 Markdown agents 转成 Codex TOML', () => {
  const { tmpDir, userHome, moluoHome, hostHome } = setupEnv()
  try {
    projectToHost({
      userHome,
      moluoHome,
      hostHome,
      hostBaselineFile: path.join(hostHome, 'AGENTS.md'),
      projectBaseline: false,
      agentFormat: 'toml',
    })
    const toml = fs.readFileSync(path.join(hostHome, 'agents', 'demo-agent.toml'), 'utf8')
    assert.ok(toml.includes('name = "demo-agent"'), 'Codex TOML 应写入 name')
    assert.ok(toml.includes('description = "x"'), 'Codex TOML 应写入 description')
    assert.ok(toml.includes('model = "gpt-5"'), 'Codex TOML 应写入 model')
    assert.ok(toml.includes(`developer_instructions = '''\nbody\n'''`), 'Codex TOML 应把正文写入 developer_instructions')
    assert.ok(!fs.existsSync(path.join(hostHome, 'agents', 'demo-agent.md')), 'Codex 不应安装 Markdown agent')
  }
  finally {
    cleanup(tmpDir)
  }
})

it('agent 格式门控 - agentsmd 宿主安装到 .agents/subagents', () => {
  const { tmpDir, userHome, moluoHome, hostHome } = setupEnv()
  try {
    projectToHost({
      userHome,
      moluoHome,
      hostHome,
      hostBaselineFile: path.join(hostHome, 'AGENTS.md'),
      projectBaseline: false,
      agentFormat: 'agentsmd',
    })
    const subagentsTarget = path.join(userHome, '.agents', 'subagents')
    assert.ok(fs.existsSync(path.join(userHome, '.agents', 'skills')), '.agents 应保留共享 skills')
    assert.ok(fs.existsSync(path.join(subagentsTarget, 'demo-agent.md')), '.agents 应投影到 subagents')
    assert.ok(!fs.existsSync(path.join(hostHome, 'agents')), '.agents host 不应额外生成 agents 目录')
  }
  finally {
    cleanup(tmpDir)
  }
})

it('agent 格式门控 - json 宿主跳过 agents 投影', () => {
  const { tmpDir, userHome, moluoHome, hostHome } = setupEnv()
  try {
    projectToHost({
      userHome,
      moluoHome,
      hostHome,
      hostBaselineFile: path.join(hostHome, 'AGENTS.md'),
      projectBaseline: false,
      agentFormat: 'json',
    })
    assert.ok(!fs.existsSync(path.join(hostHome, 'agents')), 'json 宿主不应投影 markdown agents')
  }
  finally {
    cleanup(tmpDir)
  }
})

it('mcp 投影 - JSON 宿主用 mcpServers 键写入', () => {
  const { tmpDir, userHome, moluoHome, hostHome } = setupEnv({ mcpServers: demoServers })
  try {
    projectToHost({
      userHome,
      moluoHome,
      hostHome,
      hostBaselineFile: path.join(hostHome, 'AGENTS.md'),
      projectBaseline: false,
      mcp: { relDir: '.', fileName: '.mcp.json', serversKey: 'mcpServers', format: 'json' },
    })
    const written = JSON.parse(fs.readFileSync(path.join(hostHome, '.mcp.json'), 'utf8'))
    assert.deepStrictEqual(written.mcpServers, demoServers, 'mcpServers 应写入 demo-server')
  }
  finally {
    cleanup(tmpDir)
  }
})

it('mcp 投影 - OpenCode 用 mcp 键且保留文件已有字段', () => {
  const { tmpDir, userHome, moluoHome, hostHome } = setupEnv({ mcpServers: demoServers })
  try {
    // 预置 opencode.json 含用户已有 model 字段，验证合并不覆盖
    fs.writeFileSync(
      path.join(hostHome, 'opencode.json'),
      `${JSON.stringify({ $schema: 'x', model: 'foo/bar' }, null, 2)}\n`,
    )
    projectToHost({
      userHome,
      moluoHome,
      hostHome,
      hostBaselineFile: path.join(hostHome, 'AGENTS.md'),
      projectBaseline: false,
      mcp: { relDir: '.', fileName: 'opencode.json', serversKey: 'mcp', format: 'json' },
    })
    const written = JSON.parse(fs.readFileSync(path.join(hostHome, 'opencode.json'), 'utf8'))
    assert.deepStrictEqual(written.mcp, demoServers, 'OpenCode 应用 mcp 键（非 mcpServers）')
    assert.strictEqual(written.mcpServers, undefined, '不应写 mcpServers 键')
    assert.strictEqual(written.model, 'foo/bar', '应保留用户已有 model 字段')
  }
  finally {
    cleanup(tmpDir)
  }
})

it('mcp 投影 - Codex 生成 TOML 托管块且幂等', () => {
  const { tmpDir, userHome, moluoHome, hostHome } = setupEnv({ mcpServers: demoServers })
  const baseArgs = {
    userHome,
    moluoHome,
    hostHome,
    hostBaselineFile: path.join(hostHome, 'AGENTS.md'),
    projectBaseline: false as const,
    mcp: { relDir: '.', fileName: 'config.toml', serversKey: 'mcp_servers', format: 'toml' as const },
  }
  try {
    // 预置已有 TOML 内容，验证保留
    fs.writeFileSync(path.join(hostHome, 'config.toml'), 'model = "gpt"\n')
    projectToHost(baseArgs)
    let toml = fs.readFileSync(path.join(hostHome, 'config.toml'), 'utf8')
    assert.ok(toml.includes('[mcp_servers.demo-server]'), '应生成 TOML 表块')
    assert.ok(toml.includes('command = "npx"'), '应写 command')
    assert.ok(toml.includes('model = "gpt"'), '应保留已有内容')

    // 再投影一次，托管块应只有一份（幂等）
    projectToHost(baseArgs)
    toml = fs.readFileSync(path.join(hostHome, 'config.toml'), 'utf8')
    assert.strictEqual(
      toml.split('# >>> AIRULES MCP >>>').length - 1,
      1,
      '重复投影 AIRULES 托管块应保持一份',
    )
  }
  finally {
    cleanup(tmpDir)
  }
})

it('mcp 投影 - 中性源缺失时 no-op（不写文件、不报错）', () => {
  const { tmpDir, userHome, moluoHome, hostHome } = setupEnv()
  try {
    projectToHost({
      userHome,
      moluoHome,
      hostHome,
      hostBaselineFile: path.join(hostHome, 'AGENTS.md'),
      projectBaseline: false,
      mcp: { relDir: '.', fileName: '.mcp.json', serversKey: 'mcpServers', format: 'json' },
    })
    assert.ok(!fs.existsSync(path.join(hostHome, '.mcp.json')), '无中性源时不应写 MCP 文件')
  }
  finally {
    cleanup(tmpDir)
  }
})

it('mcp 投影 - 空 mcpServers 视为无服务，no-op', () => {
  const { tmpDir, userHome, moluoHome, hostHome } = setupEnv({ mcpServers: {} })
  try {
    projectToHost({
      userHome,
      moluoHome,
      hostHome,
      hostBaselineFile: path.join(hostHome, 'AGENTS.md'),
      projectBaseline: false,
      mcp: { relDir: '.', fileName: '.mcp.json', serversKey: 'mcpServers', format: 'json' },
    })
    assert.ok(!fs.existsSync(path.join(hostHome, '.mcp.json')), '空服务表时不应写 MCP 文件')
  }
  finally {
    cleanup(tmpDir)
  }
})

it('mcp 投影 - JSON 宿主浅合并保留用户手写的其它 server', () => {
  const { tmpDir, userHome, moluoHome, hostHome } = setupEnv({ mcpServers: demoServers })
  try {
    fs.writeFileSync(
      path.join(hostHome, '.mcp.json'),
      `${JSON.stringify({ mcpServers: { 'user-server': { command: 'user' } } }, null, 2)}\n`,
    )
    projectToHost({
      userHome,
      moluoHome,
      hostHome,
      hostBaselineFile: path.join(hostHome, 'AGENTS.md'),
      projectBaseline: false,
      mcp: { relDir: '.', fileName: '.mcp.json', serversKey: 'mcpServers', format: 'json' },
    })
    const written = JSON.parse(fs.readFileSync(path.join(hostHome, '.mcp.json'), 'utf8'))
    assert.ok(written.mcpServers['user-server'], '应保留用户手写的 user-server')
    assert.ok(written.mcpServers['demo-server'], '应写入 AIRULES 的 demo-server')
  }
  finally {
    cleanup(tmpDir)
  }
})

it('mcp 投影 - JSON 宿主同名 server 用户优先，不覆盖用户配置', () => {
  const { tmpDir, userHome, moluoHome, hostHome } = setupEnv({ mcpServers: demoServers })
  try {
    // 用户已手写同名 demo-server，且参数与 AIRULES 源不同
    fs.writeFileSync(
      path.join(hostHome, '.mcp.json'),
      `${JSON.stringify({ mcpServers: { 'demo-server': { command: 'user-tuned', args: ['--custom'] } } }, null, 2)}\n`,
    )
    projectToHost({
      userHome,
      moluoHome,
      hostHome,
      hostBaselineFile: path.join(hostHome, 'AGENTS.md'),
      projectBaseline: false,
      mcp: { relDir: '.', fileName: '.mcp.json', serversKey: 'mcpServers', format: 'json' },
    })
    const written = JSON.parse(fs.readFileSync(path.join(hostHome, '.mcp.json'), 'utf8'))
    assert.strictEqual(written.mcpServers['demo-server'].command, 'user-tuned', '用户同名配置不应被覆盖')
    assert.deepStrictEqual(written.mcpServers['demo-server'].args, ['--custom'], '用户调过的参数应保留')
  }
  finally {
    cleanup(tmpDir)
  }
})

it('mcp 投影 - 宿主已有 JSON 损坏时抛带路径的明确错误', () => {
  const { tmpDir, userHome, moluoHome, hostHome } = setupEnv({ mcpServers: demoServers })
  try {
    fs.writeFileSync(path.join(hostHome, '.mcp.json'), '{ bad json,, }')
    assert.throws(
      () => projectToHost({
        userHome,
        moluoHome,
        hostHome,
        hostBaselineFile: path.join(hostHome, 'AGENTS.md'),
        projectBaseline: false,
        mcp: { relDir: '.', fileName: '.mcp.json', serversKey: 'mcpServers', format: 'json' },
      }),
      /宿主 MCP 配置解析失败.*\.mcp\.json/,
      '损坏 JSON 应抛出带文件路径的错误',
    )
  }
  finally {
    cleanup(tmpDir)
  }
})

it('mcp 投影 - 中性源损坏时抛带路径的明确错误', () => {
  const { tmpDir, userHome, moluoHome, hostHome } = setupEnv()
  try {
    fs.mkdirSync(path.join(moluoHome, 'vendor', 'mcp'), { recursive: true })
    fs.writeFileSync(path.join(moluoHome, 'vendor', 'mcp', 'mcp.json'), '{ not valid,, }')
    assert.throws(
      () => projectToHost({
        userHome,
        moluoHome,
        hostHome,
        hostBaselineFile: path.join(hostHome, 'AGENTS.md'),
        projectBaseline: false,
        mcp: { relDir: '.', fileName: '.mcp.json', serversKey: 'mcpServers', format: 'json' },
      }),
      /中性 MCP 源解析失败/,
      '损坏中性源应抛出明确错误',
    )
  }
  finally {
    cleanup(tmpDir)
  }
})

it('mcp 投影 - TOML 转义换行/特殊字符且键名安全', () => {
  const { tmpDir, userHome, moluoHome, hostHome } = setupEnv({
    mcpServers: {
      'srv.dot': {
        command: 'cmd',
        env: { TOKEN: 'line1\nline2\t"quoted"' },
      },
    },
  })
  try {
    projectToHost({
      userHome,
      moluoHome,
      hostHome,
      hostBaselineFile: path.join(hostHome, 'AGENTS.md'),
      projectBaseline: false,
      mcp: { relDir: '.', fileName: 'config.toml', serversKey: 'mcp_servers', format: 'toml' },
    })
    const toml = fs.readFileSync(path.join(hostHome, 'config.toml'), 'utf8')
    // 含点的 server 名应被引号键包裹
    assert.ok(toml.includes('[mcp_servers."srv.dot"]'), '含点的 name 应用引号键')
    // env 值的换行/制表/引号应被转义，文件中不应出现裸换行破坏 TOML
    assert.ok(toml.includes('\\n') && toml.includes('\\t') && toml.includes('\\"'), '特殊字符应被转义')
    assert.ok(!toml.includes('line1\nline2'), '不应出现裸换行')
  }
  finally {
    cleanup(tmpDir)
  }
})

it('mcp 投影 - TOML 托管块残缺（只剩 START）时清理不残留重复定义', () => {
  const { tmpDir, userHome, moluoHome, hostHome } = setupEnv({ mcpServers: demoServers })
  try {
    // 模拟上次写入被截断：只有 START + 残块，无 END
    fs.writeFileSync(
      path.join(hostHome, 'config.toml'),
      'model = "gpt"\n\n# >>> AIRULES MCP >>>\n[mcp_servers.demo-server]\ncommand = "old"\n',
    )
    projectToHost({
      userHome,
      moluoHome,
      hostHome,
      hostBaselineFile: path.join(hostHome, 'AGENTS.md'),
      projectBaseline: false,
      mcp: { relDir: '.', fileName: 'config.toml', serversKey: 'mcp_servers', format: 'toml' },
    })
    const toml = fs.readFileSync(path.join(hostHome, 'config.toml'), 'utf8')
    assert.strictEqual(
      (toml.match(/\[mcp_servers\.demo-server\]/g) ?? []).length,
      1,
      '截断残块清理后不应出现重复 demo-server 定义',
    )
    assert.ok(toml.includes('model = "gpt"'), '应保留块外用户内容')
    assert.ok(!toml.includes('command = "old"'), '残留的旧块内容应被清理')
  }
  finally {
    cleanup(tmpDir)
  }
})

it('mcp 投影 - Codex TOML 用户块外已声明 server 时不重复注入', () => {
  const { tmpDir, userHome, moluoHome, hostHome } = setupEnv({ mcpServers: demoServers })
  try {
    // 用户已在块外手写 demo-server，AIRULES 不应再注入同名
    fs.writeFileSync(
      path.join(hostHome, 'config.toml'),
      'model = "gpt"\n\n[mcp_servers.demo-server]\ncommand = "user-tuned"\n',
    )
    projectToHost({
      userHome,
      moluoHome,
      hostHome,
      hostBaselineFile: path.join(hostHome, 'AGENTS.md'),
      projectBaseline: false,
      mcp: { relDir: '.', fileName: 'config.toml', serversKey: 'mcp_servers', format: 'toml' },
    })
    const toml = fs.readFileSync(path.join(hostHome, 'config.toml'), 'utf8')
    assert.strictEqual(
      (toml.match(/\[mcp_servers\.demo-server\]/g) ?? []).length,
      1,
      '用户已声明 demo-server，不应重复注入',
    )
    assert.ok(toml.includes('command = "user-tuned"'), '应保留用户配置')
    assert.ok(!toml.includes('# >>> AIRULES MCP >>>'), '所有 server 都被用户声明时不写空托管块')
  }
  finally {
    cleanup(tmpDir)
  }
})

it('mcp 投影 - TOML 全部 server 被用户声明时清理旧 AIRULES 块', () => {
  const { tmpDir, userHome, moluoHome, hostHome } = setupEnv({ mcpServers: { 'demo-server': { command: 'x' } } })
  try {
    // 文件含用户块外声明 + 一个旧 AIRULES 托管块；同步后旧块应被清理且不重建空块
    fs.writeFileSync(
      path.join(hostHome, 'config.toml'),
      'model = "gpt"\n\n[mcp_servers.demo-server]\ncommand = "user-tuned"\n\n# >>> AIRULES MCP >>>\n[mcp_servers.stale]\ncommand = "old"\n# <<< AIRULES MCP <<<\n',
    )
    projectToHost({
      userHome,
      moluoHome,
      hostHome,
      hostBaselineFile: path.join(hostHome, 'AGENTS.md'),
      projectBaseline: false,
      mcp: { relDir: '.', fileName: 'config.toml', serversKey: 'mcp_servers', format: 'toml' },
    })
    const toml = fs.readFileSync(path.join(hostHome, 'config.toml'), 'utf8')
    assert.ok(!toml.includes('# >>> AIRULES MCP >>>'), '全跳过时旧 AIRULES 块应被清理且不重建')
    assert.ok(!toml.includes('stale'), '旧块内容应被移除')
    assert.ok(toml.includes('command = "user-tuned"'), '用户块外内容应保留')
  }
  finally {
    cleanup(tmpDir)
  }
})

it('mcp 投影 - TOML 探测引号键用户声明（含点的 server 名）', () => {
  const { tmpDir, userHome, moluoHome, hostHome } = setupEnv({ mcpServers: { 'srv.dot': { command: 'airules' } } })
  try {
    // 用户用引号键声明了含点的同名 server，AIRULES 不应重复注入
    fs.writeFileSync(
      path.join(hostHome, 'config.toml'),
      '[mcp_servers."srv.dot"]\ncommand = "user-tuned"\n',
    )
    projectToHost({
      userHome,
      moluoHome,
      hostHome,
      hostBaselineFile: path.join(hostHome, 'AGENTS.md'),
      projectBaseline: false,
      mcp: { relDir: '.', fileName: 'config.toml', serversKey: 'mcp_servers', format: 'toml' },
    })
    const toml = fs.readFileSync(path.join(hostHome, 'config.toml'), 'utf8')
    assert.strictEqual(
      (toml.match(/\[mcp_servers\."srv\.dot"\]/g) ?? []).length,
      1,
      '引号键用户声明应被探测，不重复注入',
    )
    assert.ok(toml.includes('command = "user-tuned"'), '用户引号键配置应保留')
    assert.ok(!toml.includes('# >>> AIRULES MCP >>>'), '唯一 server 被用户声明时不写空托管块')
  }
  finally {
    cleanup(tmpDir)
  }
})

it('mcp 投影 - 目标为软链接时不写穿到链接目标', () => {
  const { tmpDir, userHome, moluoHome, hostHome } = setupEnv({ mcpServers: demoServers })
  try {
    // 在 hostHome 外建一个"共享配置"真实文件，并让宿主 .mcp.json 软链到它
    const shared = path.join(tmpDir, 'shared-config.json')
    fs.writeFileSync(shared, `${JSON.stringify({ keep: 'me' }, null, 2)}\n`)
    const link = path.join(hostHome, '.mcp.json')
    try {
      fs.symlinkSync(shared, link, 'file')
    }
    catch {
      // Windows 无符号链接权限时跳过该用例（不影响其它断言）
      return
    }
    projectToHost({
      userHome,
      moluoHome,
      hostHome,
      hostBaselineFile: path.join(hostHome, 'AGENTS.md'),
      projectBaseline: false,
      mcp: { relDir: '.', fileName: '.mcp.json', serversKey: 'mcpServers', format: 'json' },
    })
    // 共享文件不应被污染
    const sharedAfter = JSON.parse(fs.readFileSync(shared, 'utf8'))
    assert.deepStrictEqual(sharedAfter, { keep: 'me' }, '链接目标共享文件不应被写穿污染')
    // 宿主 .mcp.json 应已是真实文件而非链接
    assert.ok(!fs.lstatSync(link).isSymbolicLink(), '宿主文件应被替换为真实文件')
  }
  finally {
    cleanup(tmpDir)
  }
})
