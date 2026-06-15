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

function runInjectRules(projectRoot: string, ...references: string[]) {
  return spawnSync(
    process.execPath,
    [
      path.join(process.cwd(), 'skills', 'init-project', 'scripts', 'inject-rules.mjs'),
      projectRoot,
      ...references,
    ],
    {
      cwd: process.cwd(),
      encoding: 'utf8',
    },
  )
}

function runLinkClaude(projectRoot: string) {
  return spawnSync(
    process.execPath,
    [
      path.join(process.cwd(), 'skills', 'init-project', 'scripts', 'link-claude.mjs'),
      projectRoot,
    ],
    {
      cwd: process.cwd(),
      encoding: 'utf8',
    },
  )
}

function runGit(projectRoot: string, ...args: string[]) {
  return spawnSync('git', args, {
    cwd: projectRoot,
    encoding: 'utf8',
  })
}

function runScaffoldDocs(projectRoot: string, ...stacks: string[]) {
  return spawnSync(
    process.execPath,
    [
      path.join(process.cwd(), 'skills', 'init-project', 'scripts', 'scaffold-docs.mjs'),
      projectRoot,
      ...stacks,
    ],
    {
      cwd: process.cwd(),
      encoding: 'utf8',
    },
  )
}

function runVerifyKnowledgeSources(...args: string[]) {
  return spawnSync(
    process.execPath,
    [
      path.join(process.cwd(), 'scripts', 'verify-knowledge-sources.mjs'),
      ...args,
    ],
    {
      cwd: process.cwd(),
      encoding: 'utf8',
    },
  )
}

function runDetectStack(projectRoot: string) {
  return spawnSync(
    process.execPath,
    [
      path.join(process.cwd(), 'skills', 'init-project', 'scripts', 'detect-stack.mjs'),
      projectRoot,
    ],
    {
      cwd: process.cwd(),
      encoding: 'utf8',
    },
  )
}

function isManagedClaudeLink(agentsPath: string, claudePath: string): boolean {
  const claudeStats = fs.lstatSync(claudePath)

  if (claudeStats.isSymbolicLink()) {
    const linkedPath = path.resolve(path.dirname(claudePath), fs.readlinkSync(claudePath))
    return linkedPath === path.resolve(agentsPath)
  }

  const agentsStats = fs.statSync(agentsPath)
  return agentsStats.dev === claudeStats.dev && agentsStats.ino === claudeStats.ino
}

const symlinkIt = canCreateFileSymlink() ? it : it.skip

it('init-project inject-rules - AGENTS.md 不存在时创建聚合规则文件', () => withTempDir('airules-inject-create-', (tmpDir) => {
  const projectRoot = path.join(tmpDir, 'project')
  const referenceFile = path.join(tmpDir, 'frontend.md')

  fs.mkdirSync(projectRoot, { recursive: true })
  writeFile(referenceFile, '# Frontend Rules\n\nfrontend body\n')

  const result = runInjectRules(projectRoot, referenceFile)
  const agentsContent = fs.readFileSync(path.join(projectRoot, 'AGENTS.md'), 'utf8')

  assert.equal(result.status, 0, result.stderr)
  assert.equal(agentsContent.startsWith('# 项目规范\n\n## 项目自定义规范\n'), true)
  assert.match(agentsContent, /# 项目知识源读取规范/)
  assert.match(agentsContent, /# Frontend Rules\n\nfrontend body/)
}))

it('init-project inject-rules - AGENTS.md 已存在且无重复标题时追加规则', () => withTempDir('airules-inject-append-', (tmpDir) => {
  const projectRoot = path.join(tmpDir, 'project')
  const referenceFile = path.join(tmpDir, 'node.md')
  const agentsPath = path.join(projectRoot, 'AGENTS.md')

  writeFile(agentsPath, '# Existing Project Rules\n\nexisting body\n')
  writeFile(referenceFile, '# Node Rules\n\nnode body\n')

  const result = runInjectRules(projectRoot, referenceFile)
  const agentsContent = fs.readFileSync(agentsPath, 'utf8')

  assert.equal(result.status, 0, result.stderr)
  assert.equal(agentsContent.startsWith('# Existing Project Rules\n\nexisting body\n\n# 变更分级与确认门禁\n'), true)
  assert.doesNotMatch(agentsContent, /## 项目自定义规范/)
  assert.match(agentsContent, /# 变更分级与确认门禁/)
  assert.match(agentsContent, /# 项目知识源读取规范/)
  assert.match(agentsContent, /# Node Rules\n\nnode body/)
}))

it('init-project inject-rules - AGENTS.md 标题重复时停止写入并要求 AI 审查', () => withTempDir('airules-inject-duplicate-', (tmpDir) => {
  const projectRoot = path.join(tmpDir, 'project')
  const agentsPath = path.join(projectRoot, 'AGENTS.md')
  const originalContent = '# 项目知识源读取规范\n\nexisting project knowledge rules\n'

  writeFile(agentsPath, originalContent)

  const result = runInjectRules(projectRoot)

  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /Duplicate AGENTS\.md headings detected/)
  assert.match(result.stderr, /项目知识源读取规范/)
  assert.equal(fs.readFileSync(agentsPath, 'utf8'), originalContent)
}))

it('init-project inject-rules - 带 ruleScope frontmatter 的规范复制到 .airules/rules 并渲染路由表（不 inline 正文）', () => withTempDir('airules-inject-routed-', (tmpDir) => {
  const projectRoot = path.join(tmpDir, 'project')
  const scopedRef = path.join(tmpDir, 'references', 'frontend', 'demo-scoped.md')
  const agentsPath = path.join(projectRoot, 'AGENTS.md')

  fs.mkdirSync(projectRoot, { recursive: true })
  writeFile(
    scopedRef,
    [
      '---',
      'ruleScope: demo-scoped',
      'globs:',
      '  - "**/*.demo"',
      'description: 编辑 demo 文件时遵循',
      'loadTiming: 写 demo 前',
      '---',
      '# Demo Scoped Rules',
      '',
      'scoped body line',
      '',
    ].join('\n'),
  )

  const result = runInjectRules(projectRoot, scopedRef)
  const agentsContent = fs.readFileSync(agentsPath, 'utf8')
  const copiedPath = path.join(projectRoot, '.airules', 'rules', 'frontend', 'demo-scoped.md')

  assert.equal(result.status, 0, result.stderr)
  // 规范文件被复制到 .airules/rules 下，且剥除 frontmatter 只留正文
  assert.equal(fs.existsSync(copiedPath), true, 'scoped rule must be copied into .airules/rules')
  const copiedContent = fs.readFileSync(copiedPath, 'utf8')
  assert.match(copiedContent, /# Demo Scoped Rules\n\nscoped body line/)
  assert.doesNotMatch(copiedContent, /ruleScope:/, 'copied file must not retain frontmatter')
  // AGENTS.md 只出现路由表行，不 inline 规范正文
  assert.match(agentsContent, /## 场景规范路由/)
  assert.match(agentsContent, /编辑 demo 文件时遵循/)
  assert.match(agentsContent, /`\.airules\/rules\/frontend\/demo-scoped\.md`/)
  assert.match(agentsContent, /`\*\*\/\*\.demo`/)
  assert.doesNotMatch(agentsContent, /scoped body line/, 'scoped rule body must NOT be inlined into AGENTS.md')
}))

it('init-project inject-rules - 无 frontmatter 的额外规范仍 inline 且不生成路由表', () => withTempDir('airules-inject-plain-', (tmpDir) => {
  const projectRoot = path.join(tmpDir, 'project')
  const plainRef = path.join(tmpDir, 'plain.md')

  fs.mkdirSync(projectRoot, { recursive: true })
  writeFile(plainRef, '# Plain Extra Rules\n\nplain inline body\n')

  const result = runInjectRules(projectRoot, plainRef)
  const agentsContent = fs.readFileSync(agentsPath(projectRoot), 'utf8')

  assert.equal(result.status, 0, result.stderr)
  assert.match(agentsContent, /# Plain Extra Rules\n\nplain inline body/)
  assert.doesNotMatch(agentsContent, /## 场景规范路由/, 'no scoped rule means no routing table')
  assert.equal(fs.existsSync(path.join(projectRoot, '.airules')), false, 'no .airules dir without scoped rules')
}))

function agentsPath(projectRoot: string): string {
  return path.join(projectRoot, 'AGENTS.md')
}

it('init-project detect-stack - 普通前端项目不识别为组件库', () => withTempDir('airules-detect-frontend-', (tmpDir) => {
  const projectRoot = path.join(tmpDir, 'project')

  writeFile(path.join(projectRoot, 'package.json'), JSON.stringify({
    dependencies: {
      '@vitejs/plugin-vue': '^6.0.0',
      'vite': '^7.0.0',
      'vue': '^3.5.0',
    },
    scripts: {
      dev: 'vite',
    },
  }))
  writeFile(path.join(projectRoot, 'index.html'), '<div id="app"></div>\n')

  const result = runDetectStack(projectRoot)
  const output = JSON.parse(result.stdout)

  assert.equal(result.status, 0, result.stderr)
  assert.deepEqual(output.stacks, ['frontend', 'vue'])
  assert.deepEqual(output.references, ['frontend/code.md', 'frontend/vue.md'])
}))

it('init-project detect-stack - 使用外部组件库的前端项目识别为组件消费方', () => withTempDir('airules-detect-component-consumer-', (tmpDir) => {
  const projectRoot = path.join(tmpDir, 'project')

  writeFile(path.join(projectRoot, 'package.json'), JSON.stringify({
    dependencies: {
      '@vitejs/plugin-vue': '^6.0.0',
      'element-plus': '^3.0.0',
      'vite': '^7.0.0',
      'vue': '^3.5.0',
    },
    scripts: {
      dev: 'vite',
    },
  }))
  writeFile(path.join(projectRoot, 'index.html'), '<div id="app"></div>\n')

  const result = runDetectStack(projectRoot)
  const output = JSON.parse(result.stdout)

  assert.equal(result.status, 0, result.stderr)
  assert.deepEqual(output.stacks, ['frontend', 'component-consumer', 'vue'])
  assert.deepEqual(output.references, ['frontend/code.md', 'frontend/components.md', 'frontend/vue.md'])
  assert.equal(
    output.evidence.some((entry: { stack: string, signal: string }) =>
      entry.stack === 'component-consumer' && entry.signal === 'component library dependency "element-plus"',
    ),
    true,
  )
}))

it('init-project detect-stack - React 前端项目不注入 Vue 规范', () => withTempDir('airules-detect-react-frontend-', (tmpDir) => {
  const projectRoot = path.join(tmpDir, 'project')

  writeFile(path.join(projectRoot, 'package.json'), JSON.stringify({
    dependencies: {
      '@vitejs/plugin-react': '^5.0.0',
      'react': '^19.0.0',
      'react-dom': '^19.0.0',
      'vite': '^7.0.0',
    },
    scripts: {
      dev: 'vite',
    },
  }))
  writeFile(path.join(projectRoot, 'index.html'), '<div id="root"></div>\n')

  const result = runDetectStack(projectRoot)
  const output = JSON.parse(result.stdout)

  assert.equal(result.status, 0, result.stderr)
  assert.deepEqual(output.stacks, ['frontend'])
  assert.deepEqual(output.references, ['frontend/code.md'])
}))

it('init-project detect-stack - vitest 脚本不误判为 Vite 前端项目', () => withTempDir('airules-detect-vitest-tooling-', (tmpDir) => {
  const projectRoot = path.join(tmpDir, 'project')

  writeFile(path.join(projectRoot, 'package.json'), JSON.stringify({
    name: 'tooling-project',
    scripts: {
      coverage: 'vitest run --coverage',
      test: 'vitest run',
    },
    devDependencies: {
      typescript: '^6.0.0',
      vitest: '^4.0.0',
    },
  }))

  const result = runDetectStack(projectRoot)
  const output = JSON.parse(result.stdout)

  assert.equal(result.status, 0, result.stderr)
  assert.deepEqual(output.stacks, [])
  assert.deepEqual(output.references, [])
}))

it('init-project detect-stack - 普通前端项目包含 lib 路径时不误判为组件库', () => withTempDir('airules-detect-frontend-lib-alias-', (tmpDir) => {
  const projectRoot = path.join(tmpDir, 'project')

  writeFile(path.join(projectRoot, 'package.json'), JSON.stringify({
    dependencies: {
      '@vitejs/plugin-vue': '^6.0.0',
      'vite': '^7.0.0',
      'vue': '^3.5.0',
    },
    scripts: {
      build: 'vite build',
      dev: 'vite',
    },
  }))
  writeFile(
    path.join(projectRoot, 'vite.config.ts'),
    'export default { build: { rollupOptions: {} }, resolve: { alias: { "@lib": "/src/lib" } } }\n',
  )
  writeFile(path.join(projectRoot, 'src', 'index.ts'), 'export { request } from "./lib/request"\n')

  const result = runDetectStack(projectRoot)
  const output = JSON.parse(result.stdout)

  assert.equal(result.status, 0, result.stderr)
  assert.deepEqual(output.stacks, ['frontend', 'vue'])
  assert.deepEqual(output.references, ['frontend/code.md', 'frontend/vue.md'])
}))

it('init-project detect-stack - 组件库项目识别为 component-library', () => withTempDir('airules-detect-component-library-', (tmpDir) => {
  const projectRoot = path.join(tmpDir, 'project')

  writeFile(path.join(projectRoot, 'package.json'), JSON.stringify({
    name: '@demo/ui-components',
    exports: {
      '.': {
        import: './dist/index.js',
        types: './dist/index.d.ts',
      },
    },
    peerDependencies: {
      vue: '^3.5.0',
    },
    devDependencies: {
      '@vitejs/plugin-vue': '^6.0.0',
      'vite': '^7.0.0',
      'vue': '^3.5.0',
    },
    scripts: {
      build: 'vite build',
    },
  }))
  writeFile(path.join(projectRoot, 'vite.config.ts'), 'export default { build: { lib: { entry: "src/index.ts" } } }\n')
  writeFile(path.join(projectRoot, 'src', 'index.ts'), 'export { default as DemoButton } from "./components/DemoButton.vue"\n')

  const result = runDetectStack(projectRoot)
  const output = JSON.parse(result.stdout)

  assert.equal(result.status, 0, result.stderr)
  assert.deepEqual(output.stacks, ['frontend', 'component-library', 'vue'])
  assert.deepEqual(output.references, ['frontend/code.md', 'frontend/out-components.md', 'frontend/vue.md'])
}))

it('init-project detect-stack - monorepo 子包组件库识别为 component-library', () => withTempDir('airules-detect-monorepo-component-library-', (tmpDir) => {
  const projectRoot = path.join(tmpDir, 'project')
  const packageRoot = path.join(projectRoot, 'packages', 'button')

  writeFile(path.join(projectRoot, 'package.json'), JSON.stringify({
    private: true,
    workspaces: [
      'packages/*',
    ],
  }))
  writeFile(path.join(projectRoot, 'pnpm-workspace.yaml'), 'packages:\n  - "packages/*"\n')
  writeFile(path.join(packageRoot, 'package.json'), JSON.stringify({
    name: '@demo/button',
    peerDependencies: {
      vue: '^3.5.0',
    },
  }))
  writeFile(path.join(packageRoot, 'src', 'index.ts'), 'export { default as DemoButton } from "./DemoButton.vue"\n')

  const result = runDetectStack(projectRoot)
  const output = JSON.parse(result.stdout)

  assert.equal(result.status, 0, result.stderr)
  assert.deepEqual(output.stacks, ['frontend', 'component-library', 'vue'])
  assert.match(output.projectRoots.join('\n'), /packages\/button/)
  assert.match(JSON.stringify(output.evidence), /workspace package exposes public source entry and framework peerDependency/)
}))

it('init-project detect-stack - monorepo 同时识别前端后端和组件库子项目', () => withTempDir('airules-detect-mixed-monorepo-', (tmpDir) => {
  const projectRoot = path.join(tmpDir, 'project')
  const webRoot = path.join(projectRoot, 'apps', 'web')
  const apiRoot = path.join(projectRoot, 'apps', 'api')
  const uiRoot = path.join(projectRoot, 'packages', 'ui')

  writeFile(path.join(projectRoot, 'package.json'), JSON.stringify({
    private: true,
    workspaces: [
      'apps/*',
      'packages/*',
    ],
  }))
  writeFile(path.join(webRoot, 'package.json'), JSON.stringify({
    dependencies: {
      '@vitejs/plugin-vue': '^6.0.0',
      'vite': '^7.0.0',
      'vue': '^3.5.0',
    },
    scripts: {
      dev: 'vite',
    },
  }))
  writeFile(path.join(webRoot, 'index.html'), '<div id="app"></div>\n')
  writeFile(path.join(apiRoot, 'package.json'), JSON.stringify({
    dependencies: {
      '@nestjs/common': '^11.0.0',
      '@nestjs/core': '^11.0.0',
    },
    scripts: {
      build: 'nest build',
    },
  }))
  writeFile(path.join(apiRoot, 'src', 'main.ts'), 'import { NestFactory } from "@nestjs/core"\n')
  writeFile(path.join(uiRoot, 'package.json'), JSON.stringify({
    name: '@demo/ui',
    peerDependencies: {
      vue: '^3.5.0',
    },
  }))
  writeFile(path.join(uiRoot, 'src', 'index.ts'), 'export { default as UiButton } from "./UiButton.vue"\n')

  const result = runDetectStack(projectRoot)
  const output = JSON.parse(result.stdout)
  const projectStacks = Object.fromEntries(output.projects.map((project: { root: string, stacks: string[] }) => [project.root, project.stacks]))

  assert.equal(result.status, 0, result.stderr)
  assert.deepEqual(output.stacks, ['frontend', 'component-library', 'vue', 'nestjs'])
  assert.deepEqual(output.references, ['frontend/code.md', 'frontend/out-components.md', 'frontend/vue.md', 'backend/out-api.md', 'backend/nestjs.md'])
  assert.deepEqual(projectStacks['apps/web'], ['frontend', 'vue'])
  assert.deepEqual(projectStacks['apps/api'], ['nestjs'])
  assert.deepEqual(projectStacks['packages/ui'], ['frontend', 'component-library', 'vue'])
}))

it('init-project detect-stack - package.json workspaces 显式发现深层组件库子项目', () => withTempDir('airules-detect-package-workspaces-', (tmpDir) => {
  const projectRoot = path.join(tmpDir, 'project')
  const uiRoot = path.join(projectRoot, 'domains', 'commerce', 'frontend', 'packages', 'ui')

  writeFile(path.join(projectRoot, 'package.json'), JSON.stringify({
    private: true,
    workspaces: [
      'domains/*/frontend/packages/*',
    ],
  }))
  writeFile(path.join(uiRoot, 'package.json'), JSON.stringify({
    name: '@demo/ui',
    peerDependencies: {
      vue: '^3.5.0',
    },
  }))
  writeFile(path.join(uiRoot, 'src', 'index.ts'), 'export { default as UiButton } from "./UiButton.vue"\n')

  const result = runDetectStack(projectRoot)
  const output = JSON.parse(result.stdout)
  const projectStacks = Object.fromEntries(output.projects.map((project: { root: string, stacks: string[] }) => [project.root, project.stacks]))

  assert.equal(result.status, 0, result.stderr)
  assert.equal(output.monorepo, true)
  assert.match(output.workspacePatterns.join('\n'), /domains\/\*\/frontend\/packages\/\*/)
  assert.deepEqual(projectStacks['domains/commerce/frontend/packages/ui'], ['frontend', 'component-library', 'vue'])
}))

it('init-project detect-stack - pnpm-workspace 显式发现深层 NestJS 子项目', () => withTempDir('airules-detect-pnpm-workspace-', (tmpDir) => {
  const projectRoot = path.join(tmpDir, 'project')
  const apiRoot = path.join(projectRoot, 'platform', 'domains', 'purchase', 'services', 'api')

  writeFile(path.join(projectRoot, 'pnpm-workspace.yaml'), 'packages:\n  - "platform/*/*/*/*"\n')
  writeFile(path.join(apiRoot, 'package.json'), JSON.stringify({
    dependencies: {
      '@nestjs/common': '^11.0.0',
      '@nestjs/core': '^11.0.0',
    },
  }))
  writeFile(path.join(apiRoot, 'src', 'main.ts'), 'import { NestFactory } from "@nestjs/core"\n')

  const result = runDetectStack(projectRoot)
  const output = JSON.parse(result.stdout)
  const projectStacks = Object.fromEntries(output.projects.map((project: { root: string, stacks: string[] }) => [project.root, project.stacks]))

  assert.equal(result.status, 0, result.stderr)
  assert.equal(output.monorepo, true)
  assert.match(output.workspacePatterns.join('\n'), /platform\/\*\/\*\/\*\/\*/)
  assert.deepEqual(projectStacks['platform/domains/purchase/services/api'], ['nestjs'])
}))

it('init-project detect-stack - NestJS 项目注入后端文档规范', () => withTempDir('airules-detect-nestjs-', (tmpDir) => {
  const projectRoot = path.join(tmpDir, 'project')

  writeFile(path.join(projectRoot, 'package.json'), JSON.stringify({
    dependencies: {
      '@nestjs/common': '^11.0.0',
      '@nestjs/core': '^11.0.0',
    },
    scripts: {
      build: 'nest build',
    },
  }))
  writeFile(path.join(projectRoot, 'src', 'main.ts'), 'import { NestFactory } from "@nestjs/core"\n')

  const result = runDetectStack(projectRoot)
  const output = JSON.parse(result.stdout)

  assert.equal(result.status, 0, result.stderr)
  assert.deepEqual(output.stacks, ['nestjs'])
  assert.deepEqual(output.references, ['backend/out-api.md', 'backend/nestjs.md'])
}))

it('init-project scaffold-docs - 普通前端项目不创建组件库文档目录', () => withTempDir('airules-docs-frontend-', (tmpDir) => {
  const projectRoot = path.join(tmpDir, 'project')

  fs.mkdirSync(projectRoot, { recursive: true })

  const result = runScaffoldDocs(projectRoot, 'frontend')

  assert.equal(result.status, 0, result.stderr)
  assert.equal(fs.existsSync(path.join(projectRoot, 'docs', 'architecture', 'index.md')), true)
  assert.equal(fs.existsSync(path.join(projectRoot, 'docs', 'architecture', 'overview.md')), true)
  assert.equal(fs.existsSync(path.join(projectRoot, 'docs', 'architecture', 'decisions', 'index.md')), true)
  assert.equal(fs.existsSync(path.join(projectRoot, 'docs', 'api', 'index.md')), true)
  assert.equal(fs.existsSync(path.join(projectRoot, 'docs', 'api', '_protocol.md')), true)
  assert.equal(fs.existsSync(path.join(projectRoot, 'docs', 'components')), false)
  assert.equal(fs.existsSync(path.join(projectRoot, 'docs', 'other', 'index.md')), true)
  assert.equal(fs.existsSync(path.join(projectRoot, 'docs', 'prds', 'index.md')), true)
  assert.equal(fs.existsSync(path.join(projectRoot, 'docs', 'test', 'index.md')), true)
  assert.equal(fs.existsSync(path.join(projectRoot, 'docs', 'map.md')), true)
  assert.equal(fs.existsSync(path.join(projectRoot, 'docs', 'api', '采购订单.md')), false)
  assert.match(fs.readFileSync(path.join(projectRoot, 'docs', 'api', '_protocol.md'), 'utf8'), /错误响应/)
  assert.doesNotMatch(fs.readFileSync(path.join(projectRoot, 'docs', 'api', '_protocol.md'), 'utf8'), /api-protocol-version/)
  assert.equal(fs.existsSync(path.join(projectRoot, 'docs', 'api', '_protocol.upgrade-report.md')), false)
  assert.match(fs.readFileSync(path.join(projectRoot, 'docs', 'architecture', 'overview.md'), 'utf8'), /模块边界/)
  assert.match(fs.readFileSync(path.join(projectRoot, 'docs', 'map.md'), 'utf8'), /docs\/architecture/)
  assert.doesNotMatch(fs.readFileSync(path.join(projectRoot, 'docs', 'map.md'), 'utf8'), /docs\/components/)
  assert.match(fs.readFileSync(path.join(projectRoot, 'docs', 'map.md'), 'utf8'), /docs\/other/)
}))

it('init-project scaffold-docs - 创建项目级知识源注册表', () => withTempDir('airules-docs-knowledge-sources-', (tmpDir) => {
  const projectRoot = path.join(tmpDir, 'project')

  fs.mkdirSync(projectRoot, { recursive: true })
  writeFile(path.join(projectRoot, 'README.md'), '# Project\n')

  const result = runScaffoldDocs(projectRoot, 'frontend')
  const registryPath = path.join(projectRoot, 'airules.knowledge.json')
  const verify = runVerifyKnowledgeSources(registryPath)
  const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'))

  assert.equal(result.status, 0, result.stderr)
  assert.equal(fs.existsSync(registryPath), true)
  assert.equal(verify.status, 0, verify.stderr)
  assert.deepEqual(
    registry.sources.map((source: any) => source.id),
    ['repo-overview', 'repo-docs'],
  )
  assert.deepEqual(registry.sources[0].include, ['README.md', 'README-zh.md', 'AGENTS.md', 'CLAUDE.md'])
  assert.deepEqual(registry.sources[1].include, ['docs/**'])
  assert.match(fs.readFileSync(path.join(projectRoot, 'docs', 'map.md'), 'utf8'), /airules\.knowledge\.json/)
}))

it('init-project scaffold-docs - 组件库项目不创建旧 components 文档目录', () => withTempDir('airules-docs-component-library-', (tmpDir) => {
  const projectRoot = path.join(tmpDir, 'project')

  fs.mkdirSync(projectRoot, { recursive: true })

  const result = runScaffoldDocs(projectRoot, 'frontend', 'component-library')

  assert.equal(result.status, 0, result.stderr)
  assert.equal(fs.existsSync(path.join(projectRoot, 'docs', 'components')), false)
  assert.doesNotMatch(fs.readFileSync(path.join(projectRoot, 'docs', 'map.md'), 'utf8'), /docs\/components/)
}))

it('init-project scaffold-docs - 组件消费方创建 components 文档目录与索引', () => withTempDir('airules-docs-component-consumer-', (tmpDir) => {
  const projectRoot = path.join(tmpDir, 'project')

  fs.mkdirSync(projectRoot, { recursive: true })

  const result = runScaffoldDocs(projectRoot, 'frontend', 'component-consumer')

  assert.equal(result.status, 0, result.stderr)
  assert.equal(fs.existsSync(path.join(projectRoot, 'docs', 'components', 'index.md')), true)
  assert.match(fs.readFileSync(path.join(projectRoot, 'docs', 'components', 'index.md'), 'utf8'), /外部组件库文档索引/)
  assert.match(fs.readFileSync(path.join(projectRoot, 'docs', 'map.md'), 'utf8'), /docs\/components/)
  assert.doesNotMatch(fs.readFileSync(path.join(projectRoot, 'docs', 'map.md'), 'utf8'), /docs\/out-components\/index\.md/)
}))

it('init-project scaffold-docs - 后端项目不创建 components 目录', () => withTempDir('airules-docs-backend-', (tmpDir) => {
  const projectRoot = path.join(tmpDir, 'project')

  fs.mkdirSync(projectRoot, { recursive: true })

  const result = runScaffoldDocs(projectRoot, 'nestjs')

  assert.equal(result.status, 0, result.stderr)
  assert.equal(fs.existsSync(path.join(projectRoot, 'docs', 'architecture', 'index.md')), true)
  assert.equal(fs.existsSync(path.join(projectRoot, 'docs', 'architecture', 'overview.md')), true)
  assert.equal(fs.existsSync(path.join(projectRoot, 'docs', 'architecture', 'decisions', 'index.md')), true)
  assert.equal(fs.existsSync(path.join(projectRoot, 'docs', 'api', 'index.md')), true)
  assert.equal(fs.existsSync(path.join(projectRoot, 'docs', 'api', '_protocol.md')), true)
  assert.equal(fs.existsSync(path.join(projectRoot, 'docs', 'components')), false)
  assert.equal(fs.existsSync(path.join(projectRoot, 'docs', 'other', 'index.md')), true)
  assert.equal(fs.existsSync(path.join(projectRoot, 'docs', 'prds', 'index.md')), true)
  assert.equal(fs.existsSync(path.join(projectRoot, 'docs', 'test', 'index.md')), true)
  assert.match(fs.readFileSync(path.join(projectRoot, 'docs', 'map.md'), 'utf8'), /docs\/architecture/)
  assert.match(fs.readFileSync(path.join(projectRoot, 'docs', 'map.md'), 'utf8'), /docs\/other/)
  assert.doesNotMatch(fs.readFileSync(path.join(projectRoot, 'docs', 'map.md'), 'utf8'), /docs\/components/)
}))

it('init-project scaffold-docs - 标准模板文件不生成末尾空行', () => withTempDir('airules-docs-trailing-blank-', (tmpDir) => {
  const projectRoot = path.join(tmpDir, 'project')

  fs.mkdirSync(projectRoot, { recursive: true })

  const result = runScaffoldDocs(projectRoot, 'frontend', 'component-library')

  assert.equal(result.status, 0, result.stderr)
  for (const relativePath of [
    'docs/architecture/index.md',
    'docs/architecture/overview.md',
    'docs/architecture/decisions/index.md',
    'docs/api/index.md',
    'docs/api/_protocol.md',
    'docs/other/index.md',
    'docs/prds/index.md',
    'docs/test/index.md',
    'docs/map.md',
  ]) {
    assertNoTrailingBlankLine(path.join(projectRoot, relativePath))
  }
}))

it('init-project scaffold-docs - 已有 components 目录时归档为旧来源', () => withTempDir('airules-docs-existing-components-', (tmpDir) => {
  const projectRoot = path.join(tmpDir, 'project')
  const componentsIndexPath = path.join(projectRoot, 'docs', 'components', 'index.md')
  const originalComponentsIndex = '# Existing Components\n\nkeep component docs\n'

  writeFile(componentsIndexPath, originalComponentsIndex)

  const result = runScaffoldDocs(projectRoot, 'nestjs')
  const mapContent = fs.readFileSync(path.join(projectRoot, 'docs', 'map.md'), 'utf8')

  assert.equal(result.status, 0, result.stderr)
  assert.equal(fs.existsSync(componentsIndexPath), false)
  assert.equal(
    fs.readFileSync(path.join(projectRoot, 'docs', 'other', 'imported', 'components', 'index.md'), 'utf8'),
    originalComponentsIndex,
  )
  assert.doesNotMatch(mapContent, /docs\/components/)
}))

it('init-project scaffold-docs - 组件消费方保留已有 components 目录作为外部组件来源', () => withTempDir('airules-docs-existing-consumer-components-', (tmpDir) => {
  const projectRoot = path.join(tmpDir, 'project')
  const componentsIndexPath = path.join(projectRoot, 'docs', 'components', 'index.md')
  const originalComponentsIndex = '# Existing External Components\n\nkeep external component docs\n'

  writeFile(componentsIndexPath, originalComponentsIndex)

  const result = runScaffoldDocs(projectRoot, 'frontend', 'component-consumer')
  const mapContent = fs.readFileSync(path.join(projectRoot, 'docs', 'map.md'), 'utf8')

  assert.equal(result.status, 0, result.stderr)
  assert.equal(fs.readFileSync(componentsIndexPath, 'utf8'), originalComponentsIndex)
  assert.equal(fs.existsSync(path.join(projectRoot, 'docs', 'other', 'imported', 'components')), false)
  assert.match(mapContent, /components\/index\.md/)
}))

it('init-project scaffold-docs - 已有未归类 docs 时移动到 other imported 并登记索引', () => withTempDir('airules-docs-existing-other-', (tmpDir) => {
  const projectRoot = path.join(tmpDir, 'project')

  writeFile(path.join(projectRoot, 'docs', 'legacy.md'), '# Legacy Docs\n')
  writeFile(path.join(projectRoot, 'docs', 'old-guides', 'README.md'), '# Old Guides\n')

  const result = runScaffoldDocs(projectRoot, 'frontend')
  const otherIndex = fs.readFileSync(path.join(projectRoot, 'docs', 'other', 'index.md'), 'utf8')

  assert.equal(result.status, 0, result.stderr)
  assert.equal(fs.existsSync(path.join(projectRoot, 'docs', 'legacy.md')), false)
  assert.equal(fs.existsSync(path.join(projectRoot, 'docs', 'old-guides')), false)
  assert.equal(fs.existsSync(path.join(projectRoot, 'docs', 'other', 'imported', 'legacy.md')), true)
  assert.equal(fs.existsSync(path.join(projectRoot, 'docs', 'other', 'imported', 'old-guides', 'README.md')), true)
  assert.match(otherIndex, /imported\/legacy\.md/)
  assert.match(otherIndex, /imported\/old-guides/)
}))

it('init-project scaffold-docs - 保留 docs superpowers 特殊目录且不归档到 other', () => withTempDir('airules-docs-superpowers-', (tmpDir) => {
  const projectRoot = path.join(tmpDir, 'project')
  const superpowersPath = path.join(projectRoot, 'docs', 'superpowers', 'README.md')

  writeFile(superpowersPath, '# Superpowers\n')

  const result = runScaffoldDocs(projectRoot, 'frontend')

  assert.equal(result.status, 0, result.stderr)
  assert.equal(fs.existsSync(superpowersPath), true)
  assert.equal(fs.existsSync(path.join(projectRoot, 'docs', 'other', 'imported', 'superpowers')), false)
  assert.doesNotMatch(fs.readFileSync(path.join(projectRoot, 'docs', 'other', 'index.md'), 'utf8'), /superpowers/)
}))

it('init-project scaffold-docs - 已有 other 索引时追加缺失的未归类文档登记', () => withTempDir('airules-docs-existing-other-index-', (tmpDir) => {
  const projectRoot = path.join(tmpDir, 'project')
  const otherIndexPath = path.join(projectRoot, 'docs', 'other', 'index.md')
  const originalOtherIndex = '# Custom Other Index\n\n| [legacy.md](../legacy.md) | file | old entry | MISSING classification |\n'

  writeFile(path.join(projectRoot, 'docs', 'legacy.md'), '# Legacy Docs\n')
  writeFile(otherIndexPath, originalOtherIndex)

  const result = runScaffoldDocs(projectRoot, 'frontend')
  const otherIndex = fs.readFileSync(otherIndexPath, 'utf8')

  assert.equal(result.status, 0, result.stderr)
  assert.equal(otherIndex.startsWith(originalOtherIndex), true)
  assert.match(otherIndex, /imported\/legacy\.md/)
  assert.equal(fs.existsSync(path.join(projectRoot, 'docs', 'other', 'imported', 'legacy.md')), true)
}))

it('init-project scaffold-docs - 首次接入已有 map 时保留并追加标准入口', () => withTempDir('airules-docs-existing-map-', (tmpDir) => {
  const projectRoot = path.join(tmpDir, 'project')
  const mapPath = path.join(projectRoot, 'docs', 'map.md')
  const componentsIndexPath = path.join(projectRoot, 'docs', 'components', 'index.md')
  const originalMap = '# Existing Map\n\nkeep custom map\n'

  writeFile(mapPath, originalMap)
  writeFile(componentsIndexPath, '# Existing Components\n')

  const result = runScaffoldDocs(projectRoot, 'nestjs')
  const mapContent = fs.readFileSync(mapPath, 'utf8')

  assert.equal(result.status, 0, result.stderr)
  assert.equal(fs.existsSync(path.join(projectRoot, 'docs', 'other', 'imported', 'map.md')), false)
  assert.equal(fs.existsSync(path.join(projectRoot, 'docs', 'other', 'imported', 'components', 'index.md')), true)
  assert.equal(mapContent.startsWith(originalMap), true)
  assert.match(mapContent, /## AIRules 文档入口补充/)
  assert.doesNotMatch(mapContent, /components\/index\.md/)
  assert.match(mapContent, /other\/index\.md/)
}))

it('init-project scaffold-docs - 已初始化项目重复执行时不覆盖用户内容', () => withTempDir('airules-docs-existing-', (tmpDir) => {
  const projectRoot = path.join(tmpDir, 'project')
  const apiIndexPath = path.join(projectRoot, 'docs', 'api', 'index.md')
  const originalContent = '# Existing API Index\n\nkeep me\n'

  writeFile(path.join(projectRoot, 'docs', 'map.md'), '# 项目文档地图\n\nexisting standard map\n')
  writeFile(path.join(projectRoot, 'docs', 'api', '_protocol.md'), '# 全局接口协议\n')
  writeFile(apiIndexPath, originalContent)

  const result = runScaffoldDocs(projectRoot, 'frontend')

  assert.equal(result.status, 0, result.stderr)
  assert.equal(fs.readFileSync(apiIndexPath, 'utf8'), originalContent)
  assert.equal(fs.readFileSync(path.join(projectRoot, 'docs', 'api', '_protocol.md'), 'utf8'), '# 全局接口协议\n')
  assert.equal(fs.existsSync(path.join(projectRoot, 'docs', 'api', '_protocol.upgrade-report.md')), false)
  assert.equal(fs.existsSync(path.join(projectRoot, 'docs', 'architecture', 'overview.md')), true)
  assert.equal(fs.existsSync(path.join(projectRoot, 'docs', 'components')), false)
  assert.equal(fs.existsSync(path.join(projectRoot, 'docs', 'other', 'index.md')), true)
}))

it('init-project scaffold-docs - 旧文档归档目标冲突时停止且不移动源文件', () => withTempDir('airules-docs-import-collision-', (tmpDir) => {
  const projectRoot = path.join(tmpDir, 'project')

  writeFile(path.join(projectRoot, 'docs', 'legacy.md'), '# Legacy Docs\n')
  writeFile(path.join(projectRoot, 'docs', 'other', 'imported', 'legacy.md'), '# Imported Legacy Docs\n')

  const result = runScaffoldDocs(projectRoot, 'frontend')

  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /Imported docs target already exists/)
  assert.equal(fs.existsSync(path.join(projectRoot, 'docs', 'legacy.md')), true)
  assert.equal(fs.readFileSync(path.join(projectRoot, 'docs', 'other', 'imported', 'legacy.md'), 'utf8'), '# Imported Legacy Docs\n')
}))

it('init-project link-claude - 创建 AGENTS.md 到 CLAUDE.md 的托管链接并支持重复执行', () => withTempDir('airules-link-claude-', (tmpDir) => {
  const projectRoot = path.join(tmpDir, 'project')
  const agentsPath = path.join(projectRoot, 'AGENTS.md')
  const claudePath = path.join(projectRoot, 'CLAUDE.md')

  writeFile(agentsPath, '# Project Rules\n')

  const firstRun = runLinkClaude(projectRoot)

  assert.equal(firstRun.status, 0, firstRun.stderr)
  assert.equal(fs.readFileSync(claudePath, 'utf8'), '# Project Rules\n')
  assert.equal(isManagedClaudeLink(agentsPath, claudePath), true)

  const secondRun = runLinkClaude(projectRoot)

  assert.equal(secondRun.status, 0, secondRun.stderr)
  assert.equal(isManagedClaudeLink(agentsPath, claudePath), true)
}))

it('init-project link-claude - Git 项目内启用本地 core.symlinks', () => withTempDir('airules-link-claude-git-', (tmpDir) => {
  const projectRoot = path.join(tmpDir, 'project')
  const agentsPath = path.join(projectRoot, 'AGENTS.md')

  fs.mkdirSync(projectRoot, { recursive: true })
  assert.equal(runGit(projectRoot, 'init').status, 0)
  writeFile(agentsPath, '# Project Rules\n')

  const result = runLinkClaude(projectRoot)
  const symlinksConfig = runGit(projectRoot, 'config', '--get', 'core.symlinks')

  assert.equal(result.status, 0, result.stderr)
  assert.equal(symlinksConfig.status, 0, symlinksConfig.stderr)
  assert.equal(symlinksConfig.stdout.trim(), 'true')
}))

it('init-project link-claude - 已存在非托管 CLAUDE.md 时停止并提示用户处理', () => withTempDir('airules-link-claude-existing-file-', (tmpDir) => {
  const projectRoot = path.join(tmpDir, 'project')
  const agentsPath = path.join(projectRoot, 'AGENTS.md')
  const claudePath = path.join(projectRoot, 'CLAUDE.md')
  const originalClaudeContent = '# Custom Claude Rules\n'

  writeFile(agentsPath, '# Project Rules\n')
  writeFile(claudePath, originalClaudeContent)

  const result = runLinkClaude(projectRoot)

  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /CLAUDE\.md already exists and is not managed by AIRules/)
  assert.match(result.stderr, /remove or repair CLAUDE\.md/)
  assert.equal(fs.readFileSync(claudePath, 'utf8'), originalClaudeContent)
}))

symlinkIt('init-project link-claude - 错误 CLAUDE.md 软链接停止并报告实际指向', () => withTempDir('airules-link-claude-wrong-link-', (tmpDir) => {
  const projectRoot = path.join(tmpDir, 'project')
  const agentsPath = path.join(projectRoot, 'AGENTS.md')
  const claudePath = path.join(projectRoot, 'CLAUDE.md')
  const readmePath = path.join(projectRoot, 'README.md')

  writeFile(agentsPath, '# Project Rules\n')
  writeFile(readmePath, '# Readme\n')
  fs.symlinkSync('README.md', claudePath, 'file')

  const result = runLinkClaude(projectRoot)

  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /CLAUDE\.md already links to a different target/)
  assert.match(result.stderr, /README\.md/)
  assert.match(result.stderr, /AGENTS\.md/)
  assert.equal(fs.readlinkSync(claudePath), 'README.md')
}))
