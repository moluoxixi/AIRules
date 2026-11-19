import { execFileSync, spawnSync } from 'node:child_process'
import { appendFileSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
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
const skillNames = [role, 'flow-requirements', 'flow-contracts', 'flow-implement', 'flow-verify', 'flow-review']
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
  throw new Error('Python 3 is required to test the requirement-flow runtime')
}

it('installs the Codex role and upgrades its shared program without replacing either project’s records', async () => {
  const sandbox = mkdtempSync(path.join(os.tmpdir(), 'airules-flow-role-'))
  try {
    const homeDir = path.join(sandbox, 'distribution')
    const userHome = path.join(sandbox, 'user')
    mkdirSync(path.join(userHome, '.codex'), { recursive: true })
    const roles = await resolveRoleInheritance(repo, role)
    expect(roles.map(item => item.role)).toEqual([role])
    const manifestPath = roles[0].manifestPath
    const manifest = await loadVendorManifest(manifestPath)
    expect(manifest.hosts).toEqual(['codex'])
    expect(Object.keys(manifest.vendors)).toEqual(['requirement-flow-role'])
    const vendor = manifest.vendors['requirement-flow-role']
    const checkout = path.join(homeDir, vendor.cloneDir, 'roles', role)
    mkdirSync(path.dirname(checkout), { recursive: true })
    cpSync(roleDirectory, checkout, { recursive: true })
    const installPaths = { ...getDefaultInstallPaths(userHome), moluoHome: homeDir }
    async function projectRole() {
      await rebuildVendorAssets({ homeDir, role, manifestPath, manifest })
      ensureInstallRoot(installPaths)
      ensureGlobalSkillLink(installPaths)
      expect(await verifyGlobalAgentSkills(homeDir, userHome)).toBe(true)
      expect(projectHostById('codex', userHome, homeDir, role).success).toBe(true)
      expect(await verifyHost('codex', homeDir, userHome, role)).toBe(true)
    }
    await projectRole()
    for (const name of skillNames) {
      const relative = path.join('.agents', 'skills', name, 'SKILL.md')
      expect(readFileSync(path.join(userHome, relative))).toEqual(readFileSync(path.join(checkout, 'skills', name, 'SKILL.md')))
    }
    const globalScript = path.join(userHome, skill, 'flow.py')
    const py = python()
    function run(script: string, project: string, ...args: string[]) {
      return execFileSync(py.command, [...py.prefix, script, '--project', project, ...args], {
        cwd: project,
        encoding: 'utf8',
        env: { ...process.env, HOME: userHome, USERPROFILE: userHome, PYTHONUTF8: '1', PYTHONDONTWRITEBYTECODE: '1' },
      })
    }
    const projects = ['first project', '第二项目'].map(name => path.join(sandbox, name))
    const data = projects.map(project => path.join(project, '.requirements', 'active', 'check'))
    for (const project of projects) {
      mkdirSync(project)
      writeFileSync(path.join(project, 'AGENTS.md'), '# Existing project rules\n')
      run(globalScript, project, 'init')
      const localScript = path.join(project, skill, 'flow.py')
      for (const name of skillNames) {
        const relative = path.join('.agents', 'skills', name, 'SKILL.md')
        expect(readFileSync(path.join(project, relative))).toEqual(readFileSync(path.join(userHome, relative)))
      }
      expect(JSON.parse(run(localScript, project, 'list')).active).toEqual([])
      run(localScript, project, 'new', 'check', '--request', path.basename(project), '--outcome', 'research')
    }
    const firstScript = path.join(projects[0], skill, 'flow.py')
    run(firstScript, projects[0], 'task', 'check', 'finish', 'A-intake', '--rev', '1', '--output', 'Reviewed', '--evidence', 'AGENTS.md')
    run(firstScript, projects[0], 'archive', 'check')
    data[0] = path.join(projects[0], '.requirements', 'archive', 'check')

    const snapshots = data.map(folder => ['model.json', 'handbook.html'].map(file => readFileSync(path.join(folder, file))))
    const instructions = projects.map(project => readFileSync(path.join(project, 'AGENTS.md'), 'utf8'))
    expect(snapshots.map(([record]) => JSON.parse(record.toString()).work.raw_request)).toEqual(projects.map(project => path.basename(project)))
    expect(snapshots.map(([record]) => JSON.parse(record.toString()).work.revision)).toEqual([2, 1])
    const reference = path.join('references', 'model.md')
    const changed = path.join(checkout, 'skills', role, reference)
    // Change an asset in the disposable vendor checkout to exercise a real update.
    appendFileSync(changed, '\nUpdated field reference for the projection test.\n')
    await projectRole()
    for (const [index, project] of projects.entries()) {
      run(globalScript, project, 'init')
      run(globalScript, project, 'init')
      expect(readFileSync(path.join(project, skill, reference))).toEqual(readFileSync(changed))
      expect(readFileSync(path.join(project, 'AGENTS.md'), 'utf8')).toBe(instructions[index])
      expect(instructions[index]).toContain('# Existing project rules')
      for (const [fileIndex, file] of ['model.json', 'handbook.html'].entries()) {
        const after = readFileSync(path.join(data[index], file))
        expect(after.equals(snapshots[index][fileIndex]), `upgrade changed ${project}/${file}`).toBe(true)
      }
      run(path.join(project, skill, 'flow.py'), project, 'task', 'check', '--check')
    }
    expect(existsSync(path.join(userHome, '.requirements'))).toBe(false)
  }
  finally {
    rmSync(sandbox, { recursive: true, force: true })
  }
}, 60_000)

it('runs the project and runtime Python regressions in the repository test suite', () => {
  expect(existsSync(path.join(tests, 'test_flow.py'))).toBe(true)
  const py = python()
  execFileSync(py.command, [...py.prefix, '-m', 'unittest', 'discover', '-s', tests, '-p', 'test_*.py'], {
    cwd: repo,
    env: { ...process.env, PYTHONUTF8: '1', PYTHONDONTWRITEBYTECODE: '1' },
    stdio: 'pipe',
  })
}, 90_000)
