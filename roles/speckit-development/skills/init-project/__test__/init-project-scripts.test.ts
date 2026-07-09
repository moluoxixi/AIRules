import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { it } from 'vitest'

const scriptsDir = path.join(process.cwd(), 'roles', 'speckit-development', 'skills', 'init-project', 'scripts')
const bridgeName = 'speckit-superpowers-bridge'
const bridgeReleaseUrl = 'https://github.com/lihan3238/speckit-superpowers-bridge/releases/latest/download/speckit-superpowers-bridge.zip'

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

function runScript(scriptName: string, projectRoot: string, env: NodeJS.ProcessEnv = {}) {
  return spawnSync(
    process.execPath,
    [path.join(scriptsDir, scriptName), projectRoot],
    {
      cwd: process.cwd(),
      encoding: 'utf8',
      env: {
        ...process.env,
        ...env,
      },
    },
  )
}

function createFakeSpecify(root: string) {
  const binDir = path.join(root, 'specify-bin')
  const logPath = path.join(root, 'specify.log')
  fs.mkdirSync(binDir, { recursive: true })

  if (process.platform === 'win32') {
    writeFile(
      path.join(binDir, 'specify.cmd'),
      [
        '@echo off',
        'echo %*>>"%AIRULES_SPECIFY_LOG%"',
        'if "%1"=="init" (',
        '  mkdir "%2\\.specify" 2>nul',
        '  exit /b 0',
        ')',
        'if "%1"=="extension" if "%2"=="add" (',
        '  mkdir "%CD%\\.specify\\extensions\\speckit-superpowers-bridge\\scripts\\powershell" 2>nul',
        '  mkdir "%CD%\\.agents\\skills\\speckit-superpowers-bridge" 2>nul',
        '  echo # fake readiness>"%CD%\\.specify\\extensions\\speckit-superpowers-bridge\\scripts\\powershell\\bridge-status.ps1"',
        '  echo Superpowers plugin installed, providing skills:>"%CD%\\.specify\\extensions\\speckit-superpowers-bridge\\README.md"',
        '  echo Run claude plugin list before use>>"%CD%\\.specify\\extensions\\speckit-superpowers-bridge\\README.md"',
        '  echo Requires Superpowers plugin installed>"%CD%\\.agents\\skills\\speckit-superpowers-bridge\\SKILL.md"',
        '  exit /b 0',
        ')',
        'exit /b 1',
        '',
      ].join('\r\n'),
    )
  }
  else {
    const shPath = path.join(binDir, 'specify')
    writeFile(
      shPath,
      [
        '#!/bin/sh',
        'printf "%s\\n" "$*" >> "$AIRULES_SPECIFY_LOG"',
        'if [ "$1" = "init" ]; then',
        '  mkdir -p "$2/.specify"',
        '  exit 0',
        'fi',
        'if [ "$1" = "extension" ] && [ "$2" = "add" ]; then',
        '  mkdir -p "$PWD/.specify/extensions/speckit-superpowers-bridge/scripts/bash"',
        '  mkdir -p "$PWD/.agents/skills/speckit-superpowers-bridge"',
        '  printf "#!/bin/sh\\nexit 0\\n" > "$PWD/.specify/extensions/speckit-superpowers-bridge/scripts/bash/bridge-status.sh"',
        '  printf "Superpowers plugin installed, providing skills:\\nRun claude plugin list before use\\n" > "$PWD/.specify/extensions/speckit-superpowers-bridge/README.md"',
        '  printf "Requires Superpowers plugin installed\\n" > "$PWD/.agents/skills/speckit-superpowers-bridge/SKILL.md"',
        '  chmod +x "$PWD/.specify/extensions/speckit-superpowers-bridge/scripts/bash/bridge-status.sh"',
        '  exit 0',
        'fi',
        'exit 1',
        '',
      ].join('\n'),
    )
    fs.chmodSync(shPath, 0o755)
  }

  return { binDir, logPath }
}

function createFakeCodeGraph(root: string) {
  const binDir = path.join(root, 'codegraph-bin')
  const logPath = path.join(root, 'codegraph.log')
  fs.mkdirSync(binDir, { recursive: true })

  if (process.platform === 'win32') {
    writeFile(
      path.join(binDir, 'codegraph.cmd'),
      [
        '@echo off',
        'echo %*>>"%AIRULES_CODEGRAPH_LOG%"',
        'exit /b 0',
        '',
      ].join('\r\n'),
    )
  }
  else {
    const shPath = path.join(binDir, 'codegraph')
    writeFile(
      shPath,
      [
        '#!/bin/sh',
        'printf "%s\\n" "$*" >> "$AIRULES_CODEGRAPH_LOG"',
        'exit 0',
        '',
      ].join('\n'),
    )
    fs.chmodSync(shPath, 0o755)
  }

  return { binDir, logPath }
}

function createFakeReadinessRunner(root: string) {
  const binDir = path.join(root, 'readiness-bin')
  const logPath = path.join(root, 'readiness.log')
  fs.mkdirSync(binDir, { recursive: true })

  if (process.platform === 'win32') {
    writeFile(
      path.join(binDir, 'powershell.cmd'),
      [
        '@echo off',
        'echo %*>>"%AIRULES_READINESS_LOG%"',
        'exit /b 0',
        '',
      ].join('\r\n'),
    )
  }
  else {
    const shPath = path.join(binDir, 'bash')
    writeFile(
      shPath,
      [
        '#!/bin/sh',
        'printf "%s\\n" "$*" >> "$AIRULES_READINESS_LOG"',
        'exit 0',
        '',
      ].join('\n'),
    )
    fs.chmodSync(shPath, 0o755)
  }

  return { binDir, logPath }
}

it('speckit inject-rules - 新建纯前端项目只注入 base 规则', () => {
  withTempDir('airules-speckit-rules-', (root) => {
    writeFile(
      path.join(root, 'package.json'),
      JSON.stringify({
        dependencies: {
          react: '^19.0.0',
        },
        devDependencies: {
          vite: '^7.0.0',
        },
      }),
    )

    const result = runScript('inject-rules.mjs', root)

    assert.equal(result.status, 0, result.stderr)
    const content = fs.readFileSync(path.join(root, 'AGENTS.md'), 'utf8')
    assert.match(content, /knowledge\/index\.md/)
    assert.match(content, /每次任务开始/)
    assert.match(content, /TC-<模块>-<序号>/)
    assert.doesNotMatch(content, /前端字段与组件评估纪律/)
    assert.doesNotMatch(content, /字段对比/)
    assert.doesNotMatch(content, /组件复用/)
    assert.doesNotMatch(content, /frontend-testing/)
  })
})

it('speckit spec-init - 完整运行 Spec Kit 初始化、bridge extension、CodeGraph 与 readiness', () => {
  withTempDir('airules-speckit-init-', (root) => {
    const specify = createFakeSpecify(root)
    const codegraph = createFakeCodeGraph(root)
    const readiness = createFakeReadinessRunner(root)
    const nextPath = [
      specify.binDir,
      codegraph.binDir,
      readiness.binDir,
      process.env.PATH ?? process.env.Path ?? '',
    ].join(path.delimiter)

    const result = runScript('spec-init.mjs', root, {
      AIRULES_SPECIFY_LOG: specify.logPath,
      AIRULES_CODEGRAPH_LOG: codegraph.logPath,
      AIRULES_READINESS_LOG: readiness.logPath,
      PATH: nextPath,
      Path: nextPath,
    })

    assert.equal(result.status, 0, result.stderr)

    const specifyCalls = fs.readFileSync(specify.logPath, 'utf8')
    assert.match(specifyCalls, /init .* --integration codex --force/)
    assert.match(
      specifyCalls,
      new RegExp(`extension add ${bridgeName} --from ${bridgeReleaseUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`),
    )

    const codegraphCalls = fs.readFileSync(codegraph.logPath, 'utf8')
    assert.match(codegraphCalls, /^init -i$/m)

    const readinessCalls = fs.readFileSync(readiness.logPath, 'utf8')
    assert.match(readinessCalls, /bridge-status\.(ps1|sh)/)

    const extensionReadme = fs.readFileSync(path.join(root, '.specify', 'extensions', bridgeName, 'README.md'), 'utf8')
    const peerSkill = fs.readFileSync(path.join(root, '.agents', 'skills', bridgeName, 'SKILL.md'), 'utf8')
    assert.doesNotMatch(extensionReadme, /Superpowers plugin|claude plugin list/)
    assert.doesNotMatch(peerSkill, /Superpowers plugin/)
    assert.match(extensionReadme, /AIRules projected skills/)
    assert.equal(fs.existsSync(path.join(root, 'knowledge', 'index.md')), true)
    assert.match(fs.readFileSync(path.join(root, 'knowledge', 'index.md'), 'utf8'), /每次任务开始/)
    assert.equal(fs.existsSync(path.join(root, '.specify', 'airules-schemas', 'frontend-superpowers-bridge', 'schema.yaml')), false)
  })
})

it('speckit spec-init - 前端项目安装 AIRules 前端 schema', () => {
  withTempDir('airules-speckit-frontend-schema-', (root) => {
    writeFile(
      path.join(root, 'package.json'),
      JSON.stringify({
        scripts: {
          dev: 'vite',
        },
        dependencies: {
          react: '^19.0.0',
        },
      }),
    )

    const specify = createFakeSpecify(root)
    const codegraph = createFakeCodeGraph(root)
    const readiness = createFakeReadinessRunner(root)
    const nextPath = [
      specify.binDir,
      codegraph.binDir,
      readiness.binDir,
      process.env.PATH ?? process.env.Path ?? '',
    ].join(path.delimiter)

    const result = runScript('spec-init.mjs', root, {
      AIRULES_SPECIFY_LOG: specify.logPath,
      AIRULES_CODEGRAPH_LOG: codegraph.logPath,
      AIRULES_READINESS_LOG: readiness.logPath,
      PATH: nextPath,
      Path: nextPath,
    })

    assert.equal(result.status, 0, result.stderr)
    assert.match(result.stdout, /已检测到前端项目/)

    const schemaPath = path.join(root, '.specify', 'airules-schemas', 'frontend-superpowers-bridge', 'schema.yaml')
    const schemaManifestPath = path.join(root, '.specify', 'airules-schema.yaml')
    assert.equal(fs.existsSync(schemaPath), true)
    assert.equal(fs.existsSync(path.join(root, '.specify', 'airules-schemas', 'frontend-superpowers-bridge', 'templates', 'tasks-template.md')), true)
    assert.equal(fs.existsSync(path.join(root, '.specify', 'airules-schemas', 'frontend-superpowers-bridge', 'commands', 'speckit.speckit-superpowers-bridge.execute.md')), true)
    assert.match(fs.readFileSync(schemaManifestPath, 'utf8'), /schema: frontend-superpowers-bridge/)

    const schema = fs.readFileSync(schemaPath, 'utf8')
    assert.match(schema, /lihan3238\/speckit-superpowers-bridge/)
    assert.match(schema, /\.specify\/templates\/tasks-template\.md/)
    assert.match(schema, /ecc_execution_agents/)
    assert.match(schema, /frontend-testing/)
    assert.doesNotMatch(schema, /openspec\/changes|artifacts:/)
    assert.doesNotMatch(schema, /Superpowers plugin|claude plugin|Skill tool/)
  })
})

it('speckit spec-init - specify CLI 缺失时显式失败', () => {
  withTempDir('airules-speckit-missing-', (root) => {
    const result = runScript('spec-init.mjs', root, {
      PATH: '',
      Path: '',
    })

    assert.notEqual(result.status, 0)
    assert.match(result.stderr, /MISSING specify CLI/)
  })
})
