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

function runDiscoverComponents(projectRoot: string) {
  return spawnSync(
    process.execPath,
    [
      path.join(process.cwd(), 'skills', 'components-docs', 'scripts', 'discover-components.mjs'),
      projectRoot,
    ],
    {
      cwd: process.cwd(),
      encoding: 'utf8',
    },
  )
}

it('components-docs discover-components - 组件库项目发现所有源码组件', () => withTempDir('airules-components-discover-library-', (tmpDir) => {
  const projectRoot = path.join(tmpDir, 'project')

  writeFile(path.join(projectRoot, 'package.json'), JSON.stringify({
    name: '@demo/ui',
    peerDependencies: {
      vue: '^3.5.0',
    },
  }))
  writeFile(path.join(projectRoot, 'src', 'index.ts'), 'export { default as Button } from "./components/Button.vue"\n')
  writeFile(path.join(projectRoot, 'src', 'components', 'Button.vue'), '<template><button /></template>\n')
  writeFile(path.join(projectRoot, 'src', 'components', 'Input', 'index.vue'), '<template><input /></template>\n')

  const result = runDiscoverComponents(projectRoot)
  const output = JSON.parse(result.stdout)
  const componentNames = output.components.map((component: { name: string }) => component.name)

  assert.equal(result.status, 0, result.stderr)
  assert.equal(output.componentRoots[0].root, '.')
  assert.deepEqual(componentNames, ['Button', 'Input'])
  assert.match(JSON.stringify(output.components), /src\/components\/Button\.vue/)
  assert.match(JSON.stringify(output.components), /src\/components\/Input\/index\.vue/)
}))

it('components-docs discover-components - monorepo 只发现组件库子包组件', () => withTempDir('airules-components-discover-monorepo-', (tmpDir) => {
  const projectRoot = path.join(tmpDir, 'project')
  const webRoot = path.join(projectRoot, 'apps', 'web')
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
  }))
  writeFile(path.join(webRoot, 'src', 'components', 'BusinessPanel.vue'), '<template><section /></template>\n')
  writeFile(path.join(uiRoot, 'package.json'), JSON.stringify({
    name: '@demo/ui',
    peerDependencies: {
      vue: '^3.5.0',
    },
  }))
  writeFile(path.join(uiRoot, 'src', 'index.ts'), 'export { default as UiButton } from "./components/UiButton.vue"\n')
  writeFile(path.join(uiRoot, 'src', 'components', 'UiButton.vue'), '<template><button /></template>\n')

  const result = runDiscoverComponents(projectRoot)
  const output = JSON.parse(result.stdout)
  const componentNames = output.components.map((component: { name: string }) => component.name)

  assert.equal(result.status, 0, result.stderr)
  assert.deepEqual(output.componentRoots.map((root: { root: string }) => root.root), ['packages/ui'])
  assert.deepEqual(componentNames, ['UiButton'])
  assert.doesNotMatch(JSON.stringify(output.components), /BusinessPanel/)
}))
