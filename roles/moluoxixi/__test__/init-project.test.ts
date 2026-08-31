import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { rebuildVendorAssets } from '../../../scripts/lib/vendor-staging.js'

const roleRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const skillRoot = path.join(roleRoot, 'skills', 'init-project')
const temporaryRoots: string[] = []

afterEach(() => {
  for (const root of temporaryRoots.splice(0))
    fs.rmSync(root, { recursive: true, force: true })
})

function temporaryDirectory(prefix: string): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix))
  temporaryRoots.push(root)
  return root
}

function walkFiles(root: string): string[] {
  const files: string[] = []
  function visit(current: string): void {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const target = path.join(current, entry.name)
      if (entry.isDirectory())
        visit(target)
      else if (entry.isFile())
        files.push(path.relative(root, target).split(path.sep).join('/'))
    }
  }
  visit(root)
  return files.sort()
}

describe('init-project skill', () => {
  it('ships the role-owned extension and its Chinese initialization manual', () => {
    expect(walkFiles(skillRoot)).toEqual([
      'SKILL.md',
      'agents/openai.yaml',
      'assets/project-extension/AGENTS.md',
      'assets/project-extension/bootstrap-prd.md',
      'assets/project-extension/hosts/opencode/moluoxixi-knowledge.js',
      'assets/project-extension/hosts/pi/moluoxixi-knowledge.ts',
      'assets/project-extension/knowledge/gitignore.txt',
      'assets/project-extension/knowledge/index.md',
      'assets/project-extension/runtime/common/knowledge.py',
      'assets/project-extension/runtime/knowledge-hook.py',
      'assets/project-extension/runtime/knowledge.py',
      'assets/project-extension/skill/SKILL.md',
      'assets/project-extension/skill/references/organization.md',
      'references/asset-layout.md',
      'references/platforms.md',
      'scripts/core/extension-transaction.mjs',
      'scripts/install-extension.mjs',
      'scripts/localize-bootstrap.mjs',
      'scripts/run-role-cli.mjs',
    ])
    const skillSource = fs.readFileSync(path.join(skillRoot, 'SKILL.md'), 'utf8')
    const skillBody = skillSource.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/u, '')
    expect(skillBody).toContain('# 初始化 Moluoxixi 项目')
    expect(skillBody).toContain('scripts/run-role-cli.mjs')
    expect(skillBody).toContain('.moluoxixi/knowledge/index.md')
    expect(skillBody).toContain('.moluoxixi/airules-init-manifest.json')
    expect(skillBody).toContain('moluoxixi-spec-bootstrap')
    expect(skillBody).toContain('archive --no-commit 00-bootstrap-guidelines')
    expect(skillBody).toContain('命令不存在或执行失败时，报告错误并停止')
    expect(skillBody).not.toMatch(/npx|npm install --global/iu)
  })

  it('stages the self-contained extension beside the untouched package workspace', async () => {
    const root = temporaryDirectory('airules-package-staging-')
    const homeDir = path.join(root, 'home')
    const repository = path.join(homeDir, 'vendor', 'repos', 'moluoxixi')
    fs.mkdirSync(path.join(repository, 'roles'), { recursive: true })
    fs.cpSync(roleRoot, path.join(repository, 'roles', 'moluoxixi'), {
      recursive: true,
      filter: source => !['.sync', 'node_modules', 'dist'].includes(path.basename(source)),
    })
    const manifestPath = path.join(root, 'manifest.mjs')
    fs.writeFileSync(manifestPath, `export const vendors = ${JSON.stringify([{
      name: 'moluoxixi',
      official: true,
      source: 'https://github.com/moluoxixi/AIRules.git',
      projections: [{ kind: 'role-assets', sourceDir: 'roles/moluoxixi' }],
    }])}\n`)

    const inventory = await rebuildVendorAssets({ homeDir, role: 'moluoxixi', manifestPath })
    const stagedSkill = path.join(homeDir, 'vendor', 'skills', 'init-project')
    const installedRole = path.join(homeDir, 'roles', 'moluoxixi')

    expect(inventory.skills).toEqual(['init-project'])
    expect(walkFiles(stagedSkill)).toEqual(walkFiles(skillRoot))
    expect(fs.existsSync(path.join(stagedSkill, 'scripts', 'install-extension.mjs'))).toBe(true)
    expect(fs.existsSync(path.join(stagedSkill, 'scripts', 'localize-bootstrap.mjs'))).toBe(true)
    expect(fs.existsSync(path.join(stagedSkill, 'assets', 'project-extension', 'skill', 'SKILL.md'))).toBe(true)
    expect(fs.existsSync(path.join(installedRole, 'packages', 'core', 'package.json'))).toBe(true)
    expect(fs.existsSync(path.join(installedRole, 'packages', 'cli', 'bin', 'moluoxixi.js'))).toBe(true)
    expect(fs.existsSync(path.join(installedRole, 'packages', 'cli', 'src', 'templates'))).toBe(true)
    expect(fs.existsSync(path.join(installedRole, '.sync'))).toBe(false)
  }, 120_000)
})
