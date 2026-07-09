import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { it } from 'vitest'

const scriptsDir = path.join(process.cwd(), 'roles', 'product', 'skills', 'init-project', 'scripts')
const allOpenSpecWorkflows = [
  'propose',
  'explore',
  'new',
  'continue',
  'apply',
  'ff',
  'sync',
  'archive',
  'bulk-archive',
  'verify',
  'onboard',
]

function withTempDir<T>(run: (tmpDir: string) => T): T {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'airules-product-openspec-'))
  try {
    return run(tmpDir)
  }
  finally {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  }
}

function runSpecInit(projectRoot: string, env: NodeJS.ProcessEnv = {}) {
  return spawnSync(
    process.execPath,
    [path.join(scriptsDir, 'spec-init.mjs'), projectRoot],
    {
      encoding: 'utf8',
      env: {
        ...process.env,
        ...env,
      },
    },
  )
}

function createFakeBmad(root: string) {
  const binDir = path.join(root, 'bmad-bin')
  const logPath = path.join(root, 'bmad.log')
  fs.mkdirSync(binDir, { recursive: true })

  if (process.platform === 'win32') {
    fs.writeFileSync(
      path.join(binDir, 'bmad-method.cmd'),
      [
        '@echo off',
        'echo %*>>"%AIRULES_BMAD_LOG%"',
        'exit /b 0',
        '',
      ].join('\r\n'),
    )
  }
  else {
    const shPath = path.join(binDir, 'bmad-method')
    fs.writeFileSync(
      shPath,
      [
        '#!/bin/sh',
        'printf "%s\\n" "$*" >> "$AIRULES_BMAD_LOG"',
        'exit 0',
        '',
      ].join('\n'),
    )
    fs.chmodSync(shPath, 0o755)
  }

  return { binDir, logPath }
}

function createFakeOpenSpec(root: string) {
  const binDir = path.join(root, 'bin')
  const logPath = path.join(root, 'openspec.log')
  fs.mkdirSync(binDir, { recursive: true })

  if (process.platform === 'win32') {
    fs.writeFileSync(
      path.join(binDir, 'openspec.cmd'),
      [
        '@echo off',
        'echo %*>>"%AIRULES_OPEN_SPEC_LOG%"',
        'if "%1"=="config" if "%2"=="path" echo %AIRULES_OPEN_SPEC_CONFIG%',
        'if "%1"=="schemas" echo product-pm-bridge',
        'exit /b 0',
        '',
      ].join('\r\n'),
    )
  }
  else {
    const shPath = path.join(binDir, 'openspec')
    fs.writeFileSync(
      shPath,
      [
        '#!/bin/sh',
        'printf "%s\\n" "$*" >> "$AIRULES_OPEN_SPEC_LOG"',
        'if [ "$1" = "config" ] && [ "$2" = "path" ]; then echo "$AIRULES_OPEN_SPEC_CONFIG"; fi',
        'if [ "$1" = "schemas" ]; then echo product-pm-bridge; fi',
        'exit 0',
        '',
      ].join('\n'),
    )
    fs.chmodSync(shPath, 0o755)
  }

  return { binDir, logPath }
}

function assertFullOpenSpecWorkflowConfig(configPath: string, calls: string) {
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8')) as {
    profile?: string
    delivery?: string
    workflows?: string[]
  }

  assert.equal(config.profile, 'custom')
  assert.equal(config.delivery, 'both')
  assert.deepEqual(config.workflows, allOpenSpecWorkflows)
  assert.equal(config.workflows.includes('continue'), true)
  assert.match(calls, /^config path$/m)
}

it('product spec-init - 复制 product-pm-bridge schema 与 product knowledge 入口', () => {
  withTempDir((root) => {
    const first = runSpecInit(root, {
      AIRULES_SKIP_OPENSPEC_VALIDATE: '1',
      AIRULES_SKIP_BMAD_INSTALL: '1',
    })
    assert.equal(first.status, 0, first.stderr)

    assert.equal(fs.existsSync(path.join(root, 'openspec', 'schemas', 'product-pm-bridge', 'schema.yaml')), true)
    assert.equal(fs.existsSync(path.join(root, 'openspec', 'schemas', 'product-pm-bridge', 'templates', 'prd.md')), true)
    assert.equal(fs.existsSync(path.join(root, 'knowledge', 'index.md')), true)
    assert.match(fs.readFileSync(path.join(root, 'knowledge', 'index.md'), 'utf8'), /knowledge\/index\.md/)
    assert.match(fs.readFileSync(path.join(root, 'knowledge', 'index.md'), 'utf8'), /每次任务开始/)
    assert.equal(fs.existsSync(path.join(root, 'openspec', 'specs')), false)
    assert.equal(fs.existsSync(path.join(root, 'openspec', 'changes')), false)

    const second = runSpecInit(root, {
      AIRULES_SKIP_OPENSPEC_VALIDATE: '1',
      AIRULES_SKIP_BMAD_INSTALL: '1',
    })
    assert.equal(second.status, 0, second.stderr)
    assert.match(second.stdout, /已存在，跳过/)
  })
})

it('product spec-init - OpenSpec CLI 存在时初始化项目、校验 schema 并确认注册', () => {
  withTempDir((root) => {
    const { binDir, logPath } = createFakeOpenSpec(root)
    const fakeBmad = createFakeBmad(root)
    const openSpecConfigPath = path.join(root, 'openspec-config', 'config.json')
    const nextPath = `${binDir}${path.delimiter}${fakeBmad.binDir}${path.delimiter}${process.env.PATH ?? process.env.Path ?? ''}`
    const result = runSpecInit(root, {
      AIRULES_OPEN_SPEC_LOG: logPath,
      AIRULES_OPEN_SPEC_CONFIG: openSpecConfigPath,
      AIRULES_BMAD_LOG: fakeBmad.logPath,
      PATH: nextPath,
      Path: nextPath,
    })

    assert.equal(result.status, 0, result.stderr)
    assert.match(result.stdout, /OpenSpec schema 已注册并通过校验：product-pm-bridge/)
    assert.match(
      fs.readFileSync(path.join(root, 'openspec', 'config.yaml'), 'utf8'),
      /^schema: product-pm-bridge$/m,
    )
    const calls = fs.readFileSync(logPath, 'utf8')
    assertFullOpenSpecWorkflowConfig(openSpecConfigPath, calls)
    assert.match(calls, /init .* --tools qoder --no-color/)
    assert.match(calls, /schema validate product-pm-bridge/)
    assert.match(calls, /^schemas$/m)

    const bmadCalls = fs.readFileSync(fakeBmad.logPath, 'utf8')
    assert.match(bmadCalls, /install --directory .* --modules bmm --tools qoder --yes/)
  })
})
