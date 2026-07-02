import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { it } from 'vitest'

function withTempDir<T>(prefix: string, run: (tmpDir: string) => T): T {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), prefix))

  try {
    return run(tmpDir)
  }
  finally {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  }
}

function writeFile(filePath: string, content: string) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, content)
}

function assertNoTrailingBlankLine(filePath: string) {
  const content = fs.readFileSync(filePath, 'utf8')

  assert.equal(content.endsWith('\n'), true, `${filePath} must end with a newline`)
  assert.equal(content.endsWith('\n\n'), false, `${filePath} must not end with a blank line`)
}

function canCreateFileSymlink(): boolean {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'airules-symlink-support-'))

  try {
    writeFile(path.join(tmpDir, 'target.md'), 'target\n')
    fs.symlinkSync('target.md', path.join(tmpDir, 'link.md'), 'file')
    return fs.lstatSync(path.join(tmpDir, 'link.md')).isSymbolicLink()
  }
  catch {
    return false
  }
  finally {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  }
}

function runInjectRules(projectRoot: string) {
  return spawnSync(
    process.execPath,
    [
      path.join(process.cwd(), 'skills', 'init-project', 'scripts', 'inject-rules.mjs'),
      projectRoot,
    ],
    { cwd: process.cwd(), encoding: 'utf8' },
  )
}

function runLinkClaude(projectRoot: string) {
  return spawnSync(
    process.execPath,
    [
      path.join(process.cwd(), 'skills', 'init-project', 'scripts', 'link-claude.mjs'),
      projectRoot,
    ],
    { cwd: process.cwd(), encoding: 'utf8' },
  )
}

function runWikiInit(projectRoot: string, homeDir: string) {
  return spawnSync(
    process.execPath,
    [
      path.join(process.cwd(), 'skills', 'init-project', 'scripts', 'wiki-init.mjs'),
      projectRoot,
    ],
    {
      cwd: process.cwd(),
      encoding: 'utf8',
      env: {
        ...process.env,
        AIRULES_TEST_HOME: homeDir,
      },
    },
  )
}

it('inject-rules - 新建 AGENTS.md 注入项目规则与代码核心纪律', () => {
  withTempDir('airules-inject-new-', (tmpDir) => {
    const result = runInjectRules(tmpDir)

    assert.equal(result.status, 0, result.stderr)
    const agentsPath = path.join(tmpDir, 'AGENTS.md')
    const content = fs.readFileSync(agentsPath, 'utf8')

    assert.match(content, /# 项目规范/)
    assert.match(content, /# 代码实现核心纪律/)
    assert.match(content, /禁止错误绕行/)
    assertNoTrailingBlankLine(agentsPath)
  })
})

it('inject-rules - 已有内容时只追加 code-core，不重复 airules-base', () => {
  withTempDir('airules-inject-existing-', (tmpDir) => {
    const agentsPath = path.join(tmpDir, 'AGENTS.md')
    writeFile(agentsPath, '# 已有项目说明\n\n- 既有内容保留。\n')

    const result = runInjectRules(tmpDir)

    assert.equal(result.status, 0, result.stderr)
    const content = fs.readFileSync(agentsPath, 'utf8')

    assert.match(content, /# 已有项目说明/)
    assert.match(content, /# 代码实现核心纪律/)
    // 已有内容时不再注入项目规范骨架。
    assert.doesNotMatch(content, /## 项目自定义规范/)
  })
})

it('inject-rules - 重复标题触发停止并提示人工合并', () => {
  withTempDir('airules-inject-dup-', (tmpDir) => {
    const agentsPath = path.join(tmpDir, 'AGENTS.md')
    // 预置一个与 code-core 同名标题，制造重复。
    writeFile(agentsPath, '# 项目背景\n\n# 代码实现核心纪律\n\n- 旧内容。\n')

    const result = runInjectRules(tmpDir)

    assert.notEqual(result.status, 0)
    assert.match(result.stderr, /duplicate headings/i)
  })
})

it('inject-rules - 缺少项目根参数时报错', () => {
  const result = spawnSync(
    process.execPath,
    [path.join(process.cwd(), 'skills', 'init-project', 'scripts', 'inject-rules.mjs')],
    { cwd: process.cwd(), encoding: 'utf8' },
  )

  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /Usage: inject-rules\.mjs/)
})

it('link-claude - AGENTS.md 不存在时报错', () => {
  withTempDir('airules-link-missing-', (tmpDir) => {
    const result = runLinkClaude(tmpDir)

    assert.notEqual(result.status, 0)
    assert.match(result.stderr, /AGENTS\.md must exist before linking CLAUDE\.md/)
  })
})

it('link-claude - 建立 CLAUDE.md 指向 AGENTS.md（软链或硬链）', () => {
  withTempDir('airules-link-create-', (tmpDir) => {
    const agentsPath = path.join(tmpDir, 'AGENTS.md')
    writeFile(agentsPath, '# 项目规范\n\n- 规则。\n')

    const result = runLinkClaude(tmpDir)

    assert.equal(result.status, 0, result.stderr)
    const claudePath = path.join(tmpDir, 'CLAUDE.md')
    assert.equal(fs.existsSync(claudePath), true)

    if (canCreateFileSymlink()) {
      const stat = fs.lstatSync(claudePath)
      assert.equal(stat.isSymbolicLink(), true, 'CLAUDE.md 应为软链接')
      const target = path.resolve(path.dirname(claudePath), fs.readlinkSync(claudePath))
      assert.equal(target, path.resolve(agentsPath))
    }
    else {
      // Windows 无符号链接权限时回退硬链接：内容与 inode 相同。
      const agentsStat = fs.statSync(agentsPath)
      const claudeStat = fs.statSync(claudePath)
      assert.equal(claudeStat.ino, agentsStat.ino)
    }
  })
})

it('link-claude - 重复运行幂等（不报错）', () => {
  withTempDir('airules-link-idem-', (tmpDir) => {
    writeFile(path.join(tmpDir, 'AGENTS.md'), '# 项目规范\n\n- 规则。\n')

    const first = runLinkClaude(tmpDir)
    assert.equal(first.status, 0, first.stderr)
    const second = runLinkClaude(tmpDir)
    assert.equal(second.status, 0, second.stderr)
  })
})

it('link-claude - CLAUDE.md 已是非托管普通文件时停止', () => {
  withTempDir('airules-link-conflict-', (tmpDir) => {
    writeFile(path.join(tmpDir, 'AGENTS.md'), '# 项目规范\n\n- 规则。\n')
    writeFile(path.join(tmpDir, 'CLAUDE.md'), '# 用户自有内容\n')

    const result = runLinkClaude(tmpDir)

    assert.notEqual(result.status, 0)
    assert.match(result.stderr, /not managed by AIRules/)
  })
})

it('wiki-init - 项目存在 .qoder 时覆盖注入用户根 .qoder/AGENTS.md 到项目 .qoder/rules/AGENTS.md', () => {
  withTempDir('airules-qoder-rules-', (tmpDir) => {
    const homeDir = path.join(tmpDir, 'home')
    const projectRoot = path.join(tmpDir, 'project')
    const globalAgents = '# 全局 Qoder 规则\n\n- 来自用户根目录。\n'
    fs.mkdirSync(path.join(projectRoot, '.qoder'), { recursive: true })
    writeFile(path.join(homeDir, '.qoder', 'AGENTS.md'), globalAgents)
    writeFile(path.join(projectRoot, '.qoder', 'rules', 'AGENTS.md'), '# 旧项目规则\n')

    const result = runWikiInit(projectRoot, homeDir)

    assert.equal(result.status, 0, result.stderr)
    assert.equal(
      fs.readFileSync(path.join(projectRoot, '.qoder', 'rules', 'AGENTS.md'), 'utf8'),
      globalAgents,
    )
    assert.match(result.stdout, /已覆盖注入 \.qoder\/rules\/AGENTS\.md/)
  })
})

it('wiki-init - 项目不存在 .qoder 时不创建 Qoder rules 注入目录', () => {
  withTempDir('airules-qoder-rules-skip-', (tmpDir) => {
    const homeDir = path.join(tmpDir, 'home')
    const projectRoot = path.join(tmpDir, 'project')
    writeFile(path.join(homeDir, '.qoder', 'AGENTS.md'), '# 全局 Qoder 规则\n')

    const result = runWikiInit(projectRoot, homeDir)

    assert.equal(result.status, 0, result.stderr)
    assert.equal(fs.existsSync(path.join(projectRoot, '.qoder', 'rules')), false)
  })
})
