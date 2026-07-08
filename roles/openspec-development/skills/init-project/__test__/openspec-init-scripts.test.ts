import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { it } from 'vitest'

const scriptsDir = path.join(process.cwd(), 'roles', 'openspec-development', 'skills', 'init-project', 'scripts')
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
const expectedProjectedBmadSkills = [
  'bmad-prd',
  'bmad-create-epics-and-stories',
  'bmad-generate-project-context',
  'bmad-shard-doc',
]

function withTempDir<T>(run: (tmpDir: string) => T): T {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'airules-openspec-'))
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

function writeFile(filePath: string, content: string) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, content)
}

function createSchemaSource(root: string) {
  const schemaRoot = path.join(root, 'schema-source', 'superpowers-bridge')
  writeFile(path.join(schemaRoot, 'schema.yaml'), 'name: superpowers-bridge\nversion: 1\nartifacts: []\n')
  writeFile(path.join(schemaRoot, 'templates', 'tasks.md'), '# Tasks\n')
  return schemaRoot
}

function createProjectedBmadSkills(root: string) {
  const skillsRoot = path.join(root, 'projected-skills')
  for (const skillName of expectedProjectedBmadSkills) {
    writeFile(path.join(skillsRoot, skillName, 'SKILL.md'), `---\nname: ${skillName}\n---\n`)
  }
  return skillsRoot
}

function createFakeGit(root: string, sourceRepo: string) {
  const binDir = path.join(root, 'git-bin')
  const logPath = path.join(root, 'git.log')
  fs.mkdirSync(binDir, { recursive: true })

  if (process.platform === 'win32') {
    fs.writeFileSync(
      path.join(binDir, 'git.cmd'),
      [
        '@echo off',
        'echo %*>>"%AIRULES_GIT_LOG%"',
        'if "%1"=="clone" (',
        '  xcopy "%AIRULES_FAKE_SCHEMA_REPO%" "%5%" /E /I /Y >nul',
        '  exit /b 0',
        ')',
        'exit /b 1',
        '',
      ].join('\r\n'),
    )
  }
  else {
    const shPath = path.join(binDir, 'git')
    fs.writeFileSync(
      shPath,
      [
        '#!/bin/sh',
        'printf "%s\\n" "$*" >> "$AIRULES_GIT_LOG"',
        'if [ "$1" = "clone" ]; then',
        '  mkdir -p "$5"',
        '  cp -R "$AIRULES_FAKE_SCHEMA_REPO/." "$5"',
        '  exit 0',
        'fi',
        'exit 1',
        '',
      ].join('\n'),
    )
    fs.chmodSync(shPath, 0o755)
  }

  return { binDir, logPath, sourceRepo }
}

function createFakeOpenSpec(root: string) {
  const binDir = path.join(root, 'bin')
  const logPath = path.join(root, 'openspec.log')
  fs.mkdirSync(binDir, { recursive: true })

  if (process.platform === 'win32') {
    const cmdPath = path.join(binDir, 'openspec.cmd')
    fs.writeFileSync(
      cmdPath,
      [
        '@echo off',
        'echo %*>>"%AIRULES_OPEN_SPEC_LOG%"',
        'if "%1"=="config" if "%2"=="path" echo %AIRULES_OPEN_SPEC_CONFIG%',
        'if "%1"=="schemas" echo superpowers-bridge',
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
        'if [ "$1" = "schemas" ]; then echo superpowers-bridge; fi',
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

it('spec-init - 只注入项目级 schema 与 knowledge，不手建 active/archive 生命周期目录', () => {
  withTempDir((root) => {
    const first = runSpecInit(root, {
      AIRULES_SKIP_OPENSPEC_VALIDATE: '1',
      AIRULES_OPENSPEC_SCHEMA_SOURCE_DIR: createSchemaSource(root),
      AIRULES_PROJECTED_BMAD_SKILLS_DIR: createProjectedBmadSkills(root),
      PATH: '',
      Path: '',
    })
    assert.equal(first.status, 0, first.stderr)

    assert.equal(fs.existsSync(path.join(root, 'openspec', 'schemas', 'superpowers-bridge', 'schema.yaml')), true)
    assert.equal(fs.existsSync(path.join(root, 'openspec', 'schemas', 'superpowers-bridge', 'templates', 'tasks.md')), true)
    assert.equal(fs.existsSync(path.join(root, 'knowledge', 'index.md')), true)
    assert.equal(fs.existsSync(path.join(root, 'openspec', 'specs')), false)
    assert.equal(fs.existsSync(path.join(root, 'openspec', 'changes')), false)
    assert.equal(fs.existsSync(path.join(root, 'openspec', 'config.yaml')), false)
    assert.equal(fs.existsSync(path.join(root, '.airules')), false)

    const second = runSpecInit(root, {
      AIRULES_SKIP_OPENSPEC_VALIDATE: '1',
      AIRULES_OPENSPEC_SCHEMA_SOURCE_DIR: createSchemaSource(root),
      AIRULES_PROJECTED_BMAD_SKILLS_DIR: createProjectedBmadSkills(root),
      PATH: '',
      Path: '',
    })
    assert.equal(second.status, 0, second.stderr)
    assert.match(second.stdout, /已存在，跳过/)
  })
})

it('spec-init - OpenSpec CLI 存在时初始化项目、校验 schema 并确认注册', () => {
  withTempDir((root) => {
    const { binDir, logPath } = createFakeOpenSpec(root)
    const schemaSource = createSchemaSource(root)
    const openSpecConfigPath = path.join(root, 'openspec-config', 'config.json')
    const nextPath = binDir
    const result = runSpecInit(root, {
      AIRULES_OPEN_SPEC_LOG: logPath,
      AIRULES_OPEN_SPEC_CONFIG: openSpecConfigPath,
      AIRULES_OPENSPEC_SCHEMA_SOURCE_DIR: schemaSource,
      AIRULES_PROJECTED_BMAD_SKILLS_DIR: createProjectedBmadSkills(root),
      PATH: nextPath,
      Path: nextPath,
    })

    assert.equal(result.status, 0, result.stderr)
    assert.match(result.stdout, /OpenSpec schema 已注册并通过校验：superpowers-bridge/)
    assert.match(
      fs.readFileSync(path.join(root, 'openspec', 'config.yaml'), 'utf8'),
      /^schema: superpowers-bridge$/m,
    )
    const calls = fs.readFileSync(logPath, 'utf8')
    assertFullOpenSpecWorkflowConfig(openSpecConfigPath, calls)
    assert.match(calls, /init .* --tools qoder --no-color/)
    assert.match(calls, /schema validate superpowers-bridge/)
    assert.match(calls, /^schemas$/m)
    assert.doesNotMatch(result.stdout, /bmad-method install/)
  })
})

it('spec-init - openspec/ 已存在时仍刷新 OpenSpec 宿主入口', () => {
  withTempDir((root) => {
    fs.mkdirSync(path.join(root, 'openspec'), { recursive: true })
    const { binDir, logPath } = createFakeOpenSpec(root)
    const schemaSource = createSchemaSource(root)
    const openSpecConfigPath = path.join(root, 'openspec-config', 'config.json')
    const nextPath = binDir
    const result = runSpecInit(root, {
      AIRULES_OPEN_SPEC_LOG: logPath,
      AIRULES_OPEN_SPEC_CONFIG: openSpecConfigPath,
      AIRULES_OPENSPEC_SCHEMA_SOURCE_DIR: schemaSource,
      AIRULES_PROJECTED_BMAD_SKILLS_DIR: createProjectedBmadSkills(root),
      PATH: nextPath,
      Path: nextPath,
    })

    assert.equal(result.status, 0, result.stderr)
    assert.match(
      fs.readFileSync(path.join(root, 'openspec', 'config.yaml'), 'utf8'),
      /^schema: superpowers-bridge$/m,
    )
    const calls = fs.readFileSync(logPath, 'utf8')
    assertFullOpenSpecWorkflowConfig(openSpecConfigPath, calls)
    assert.match(calls, /init .* --tools qoder --no-color/)
    assert.match(calls, /schema validate superpowers-bridge/)
    assert.match(calls, /^schemas$/m)
    assert.doesNotMatch(result.stdout, /bmad-method install/)
  })
})

it('spec-init - 按目标项目已有宿主目录安装 OpenSpec 入口', () => {
  withTempDir((root) => {
    fs.mkdirSync(path.join(root, '.claude'), { recursive: true })
    fs.mkdirSync(path.join(root, '.codex'), { recursive: true })
    const { binDir, logPath } = createFakeOpenSpec(root)
    const schemaSource = createSchemaSource(root)
    const openSpecConfigPath = path.join(root, 'openspec-config', 'config.json')
    const nextPath = binDir
    const result = runSpecInit(root, {
      AIRULES_OPEN_SPEC_LOG: logPath,
      AIRULES_OPEN_SPEC_CONFIG: openSpecConfigPath,
      AIRULES_OPENSPEC_SCHEMA_SOURCE_DIR: schemaSource,
      AIRULES_PROJECTED_BMAD_SKILLS_DIR: createProjectedBmadSkills(root),
      PATH: nextPath,
      Path: nextPath,
    })

    assert.equal(result.status, 0, result.stderr)
    const calls = fs.readFileSync(logPath, 'utf8')
    assertFullOpenSpecWorkflowConfig(openSpecConfigPath, calls)
    assert.match(calls, /init .* --tools claude,codex --no-color/)
    assert.doesNotMatch(result.stdout, /bmad-method install/)
  })
})

it('spec-init - 默认从 JiangWay/openspec-schemas 克隆 superpowers-bridge schema', () => {
  withTempDir((root) => {
    const fakeRepo = path.join(root, 'fake-openspec-schemas')
    writeFile(path.join(fakeRepo, 'superpowers-bridge', 'schema.yaml'), 'name: superpowers-bridge\nversion: 1\nartifacts: []\n')
    writeFile(path.join(fakeRepo, 'superpowers-bridge', 'templates', 'tasks.md'), '# Tasks\n')
    const fakeGit = createFakeGit(root, fakeRepo)
    const nextPath = `${fakeGit.binDir}${path.delimiter}${process.env.PATH ?? process.env.Path ?? ''}`

    const result = runSpecInit(root, {
      AIRULES_SKIP_OPENSPEC_VALIDATE: '1',
      AIRULES_FAKE_SCHEMA_REPO: fakeRepo,
      AIRULES_GIT_LOG: fakeGit.logPath,
      AIRULES_PROJECTED_BMAD_SKILLS_DIR: createProjectedBmadSkills(root),
      PATH: nextPath,
      Path: nextPath,
    })

    assert.equal(result.status, 0, result.stderr)
    assert.equal(fs.existsSync(path.join(root, 'openspec', 'schemas', 'superpowers-bridge', 'schema.yaml')), true)
    assert.equal(fs.existsSync(path.join(root, 'openspec', 'schemas', 'superpowers-bridge', 'templates', 'tasks.md')), true)

    const gitCalls = fs.readFileSync(fakeGit.logPath, 'utf8')
    assert.match(gitCalls, /clone --depth 1 https:\/\/github\.com\/JiangWay\/openspec-schemas\.git/)
  })
})

it('spec-init - 精选 BMAD projected skills 缺失时显式失败', () => {
  withTempDir((root) => {
    const result = runSpecInit(root, {
      AIRULES_SKIP_OPENSPEC_VALIDATE: '1',
      AIRULES_OPENSPEC_SCHEMA_SOURCE_DIR: createSchemaSource(root),
      AIRULES_PROJECTED_BMAD_SKILLS_DIR: path.join(root, 'missing-skills'),
      PATH: '',
      Path: '',
    })

    assert.notEqual(result.status, 0)
    assert.match(result.stderr, /MISSING BMAD projected skills/)
    assert.match(result.stderr, /bmad-prd/)
  })
})

it('spec-init - OpenSpec CLI 缺失时显式失败，不伪装为完整初始化', () => {
  withTempDir((root) => {
    const result = runSpecInit(root, {
      AIRULES_PROJECTED_BMAD_SKILLS_DIR: createProjectedBmadSkills(root),
      PATH: '',
      Path: '',
    })

    assert.notEqual(result.status, 0)
    assert.match(result.stderr, /MISSING openspec CLI/)
  })
})
