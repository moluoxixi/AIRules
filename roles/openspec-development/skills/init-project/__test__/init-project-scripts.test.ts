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
      path.join(process.cwd(), 'roles', 'openspec-development', 'skills', 'init-project', 'scripts', 'inject-rules.mjs'),
      projectRoot,
    ],
    { cwd: process.cwd(), encoding: 'utf8' },
  )
}

function runLinkClaude(projectRoot: string) {
  return spawnSync(
    process.execPath,
    [
      path.join(process.cwd(), 'roles', 'openspec-development', 'skills', 'init-project', 'scripts', 'link-claude.mjs'),
      projectRoot,
    ],
    { cwd: process.cwd(), encoding: 'utf8' },
  )
}

it('inject-rules - 新建 AGENTS.md 时注入测试用例 ID 基线', () => {
  withTempDir('airules-inject-new-', (tmpDir) => {
    const result = runInjectRules(tmpDir)

    assert.equal(result.status, 0, result.stderr)
    const agentsPath = path.join(tmpDir, 'AGENTS.md')
    const content = fs.readFileSync(agentsPath, 'utf8')

    assert.match(content, /AIRULES:BEGIN init-project-rules/)
    assert.match(content, /TC-<模块>-<序号>/)
    assert.match(content, /knowledge\/测试\/<模块>\.md/)
    assert.doesNotMatch(content, /docs\/test\/<模块>\.md/)
    assert.doesNotMatch(content, /前端字段与组件评估纪律/)
  })
})
it('inject-rules - 纯前端项目按需注入前端专用规则', () => {
  withTempDir('airules-inject-frontend-', (tmpDir) => {
    writeFile(
      path.join(tmpDir, 'package.json'),
      JSON.stringify({
        dependencies: {
          vue: '^3.5.0',
        },
        devDependencies: {
          vite: '^7.0.0',
        },
      }),
    )

    const result = runInjectRules(tmpDir)

    assert.equal(result.status, 0, result.stderr)
    const content = fs.readFileSync(path.join(tmpDir, 'AGENTS.md'), 'utf8')

    assert.match(content, /AIRULES:BEGIN init-project-rules/)
    assert.match(content, /TC-<模块>-<序号>/)
    assert.match(content, /前端字段与组件评估纪律/)
    assert.match(content, /字段对比/)
    assert.match(content, /组件复用/)
    assert.match(content, /frontend-testing/)
  })
})
it('inject-rules - 混合全栈项目不默认注入前端专用规则', () => {
  withTempDir('airules-inject-mixed-', (tmpDir) => {
    writeFile(
      path.join(tmpDir, 'package.json'),
      JSON.stringify({
        dependencies: {
          express: '^5.0.0',
          react: '^19.0.0',
        },
        devDependencies: {
          vite: '^7.0.0',
        },
      }),
    )

    const result = runInjectRules(tmpDir)

    assert.equal(result.status, 0, result.stderr)
    const content = fs.readFileSync(path.join(tmpDir, 'AGENTS.md'), 'utf8')

    assert.match(content, /TC-<模块>-<序号>/)
    assert.doesNotMatch(content, /前端字段与组件评估纪律/)
  })
})
it('inject-rules - 规则源为空且已有内容时不追加托管块', () => {
  withTempDir('airules-inject-existing-', (tmpDir) => {
    const agentsPath = path.join(tmpDir, 'AGENTS.md')
    const originalContent = '# 已有项目说明\n\n- 既有内容保留。\n'
    writeFile(agentsPath, originalContent)

    const result = runInjectRules(tmpDir)

    assert.equal(result.status, 0, result.stderr)
    const content = fs.readFileSync(agentsPath, 'utf8')

    assert.equal(content, originalContent)
  })
})
it('inject-rules - 规则源为空时移除旧托管块并保留用户内容', () => {
  withTempDir('airules-inject-replace-', (tmpDir) => {
    const agentsPath = path.join(tmpDir, 'AGENTS.md')
    writeFile(
      agentsPath,
      [
        '# 用户规则',
        '',
        '- 保留。',
        '',
        '<!-- AIRULES:BEGIN init-project-rules -->',
        '# 旧托管规则',
        '',
        '- 应被替换。',
        '<!-- AIRULES:END init-project-rules -->',
        '',
      ].join('\n'),
    )

    const result = runInjectRules(tmpDir)

    assert.equal(result.status, 0, result.stderr)
    const content = fs.readFileSync(agentsPath, 'utf8')

    assert.equal(content, '# 用户规则\n\n- 保留。')
    assert.doesNotMatch(content, /# 旧托管规则/)
    assert.doesNotMatch(content, /AIRULES:BEGIN init-project-rules/)
    assert.doesNotMatch(content, /AIRULES:END init-project-rules/)
  })
})

it('inject-rules - 缺少项目根参数时报错', () => {
  const result = spawnSync(
    process.execPath,
    [path.join(process.cwd(), 'roles', 'openspec-development', 'skills', 'init-project', 'scripts', 'inject-rules.mjs')],
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
