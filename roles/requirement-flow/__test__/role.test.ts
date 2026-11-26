import { execFileSync, spawnSync } from 'node:child_process'
import { appendFileSync, cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, it } from 'vitest'
import { ensureGlobalSkillLink, ensureInstallRoot, getDefaultInstallPaths, projectHostById } from '../../../scripts/lib/install.js'
import { resolveRoleInheritance } from '../../../scripts/lib/roles.js'
import { rebuildVendorAssets } from '../../../scripts/lib/vendor-staging.js'
import { loadVendorManifest } from '../../../scripts/lib/vendors.js'
import { verifyGlobalAgentSkills, verifyHost } from '../../../scripts/lib/verify.js'

const role = 'requirement-flow'
const tests = fileURLToPath(new URL('.', import.meta.url))
const roleDirectory = path.resolve(tests, '..')
const repo = path.resolve(roleDirectory, '../..')
const skill = path.join('.agents', 'skills', role)

function python() {
  const candidates = process.platform === 'win32' ? [['py', '-3'], ['python'], ['python3']] : [['python3'], ['python']]
  for (const [command, ...prefix] of candidates) {
    if (spawnSync(command, [...prefix, '-c', 'import sys; sys.exit(sys.version_info.major != 3)']).status === 0)
      return { command, prefix }
  }
  throw new Error('Python 3 is required to test the optional requirement-flow evidence helper')
}

function snapshot(root: string): Record<string, string> {
  const files: Record<string, string> = {}
  function walk(directory: string) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const target = path.join(directory, entry.name)
      if (entry.isDirectory())
        walk(target)
      else
        files[path.relative(root, target)] = readFileSync(target).toString('base64')
    }
  }
  walk(root)
  return files
}

it('projects one Codex skill and updates it without changing project documentation or instructions', async () => {
  const sandbox = mkdtempSync(path.join(os.tmpdir(), 'airules-flow-role-'))
  try {
    const homeDir = path.join(sandbox, 'distribution')
    const userHome = path.join(sandbox, 'user')
    mkdirSync(path.join(userHome, '.codex'), { recursive: true })
    const projects = ['first project', '第二项目'].map(name => path.join(sandbox, name))
    for (const project of projects) {
      mkdirSync(path.join(project, 'docs', 'business'), { recursive: true })
      mkdirSync(path.join(project, 'docs', 'changes'), { recursive: true })
      writeFileSync(path.join(project, 'AGENTS.md'), '# Existing project rules\n')
      writeFileSync(path.join(project, 'docs', 'business', 'index.md'), '# Current business\n')
      writeFileSync(path.join(project, 'docs', 'changes', 'check.md'), '# Proposed change\nVerification pending.\n')
    }
    const before = projects.map(snapshot)
    const roles = await resolveRoleInheritance(repo, role)
    expect(roles.map(item => item.role)).toEqual([role])
    const manifestPath = roles[0].manifestPath
    const manifest = await loadVendorManifest(manifestPath)
    expect(manifest.hosts).toEqual(['codex'])
    expect(manifest.packages).toEqual([])
    expect(Object.keys(manifest.vendors)).toEqual(['requirement-flow-role'])
    expect(Object.values(manifest.vendors).every(vendor => vendor.setup === undefined)).toBe(true)
    const vendor = manifest.vendors['requirement-flow-role']
    const checkout = path.join(homeDir, vendor.cloneDir, 'roles', role)
    mkdirSync(path.dirname(checkout), { recursive: true })
    cpSync(roleDirectory, checkout, { recursive: true })
    const installPaths = { ...getDefaultInstallPaths(userHome), moluoHome: homeDir }
    async function projectRole() {
      const inventory = await rebuildVendorAssets({ homeDir, role, manifestPath, manifest })
      expect(inventory.skills).toEqual([role])
      ensureInstallRoot(installPaths)
      ensureGlobalSkillLink(installPaths)
      expect(await verifyGlobalAgentSkills(homeDir, userHome)).toBe(true)
      expect(projectHostById('codex', userHome, homeDir, role).success).toBe(true)
      expect(await verifyHost('codex', homeDir, userHome, role)).toBe(true)
    }
    await projectRole()
    expect(readdirSync(path.join(userHome, '.agents', 'skills'))).toEqual([role])
    const assets = [
      'SKILL.md',
      path.join('scripts', 'evidence.py'),
      path.join('scripts', 'reader.py'),
      path.join('reader', 'index.html'),
      ...['reader.js', 'reader.css', 'vendor/marked.umd.js', 'vendor/purify.min.js', 'vendor/mermaid.tiny.js'].map(name => path.join('reader', 'assets', name)),
      ...['business', 'work', 'verification', 'reader'].map(name => path.join('references', `${name}.md`)),
    ]
    for (const relative of assets) {
      expect(readFileSync(path.join(userHome, skill, relative))).toEqual(readFileSync(path.join(checkout, 'skills', role, relative)))
    }

    const changed = path.join(checkout, 'skills', role, 'SKILL.md')
    appendFileSync(changed, '\nUpdated guidance for the projection test.\n')
    await projectRole()
    await projectRole()
    expect(readFileSync(path.join(userHome, skill, 'SKILL.md'))).toEqual(readFileSync(changed))
    for (const [index, project] of projects.entries()) {
      expect(snapshot(project)).toEqual(before[index])
      expect(readdirSync(project).sort()).toEqual(['AGENTS.md', 'docs'])
    }
    expect(existsSync(path.join(userHome, '.requirements'))).toBe(false)
  }
  finally {
    rmSync(sandbox, { recursive: true, force: true })
  }
}, 60_000)

it.each(['test_evidence.py', 'test_second_projects.py', 'test_reader.py'])('runs the role regressions in %s', (name) => {
  expect(existsSync(path.join(tests, name))).toBe(true)
  const py = python()
  execFileSync(py.command, [...py.prefix, '-m', 'unittest', 'discover', '-s', tests, '-p', name], {
    cwd: repo,
    env: { ...process.env, PYTHONUTF8: '1', PYTHONDONTWRITEBYTECODE: '1' },
    stdio: 'pipe',
    timeout: 60_000,
  })
}, 65_000)
