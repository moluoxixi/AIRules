import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { expect, it } from 'vitest'
import { ensureGlobalSkillLink, ensureInstallRoot, getDefaultInstallPaths, projectHostById } from '../../../scripts/lib/install.js'
import { resolveRoleInheritance } from '../../../scripts/lib/roles.js'
import { rebuildVendorAssets } from '../../../scripts/lib/vendor-staging.js'
import { loadVendorManifest } from '../../../scripts/lib/vendors.js'
import { verifyGlobalAgentSkills, verifyHost } from '../../../scripts/lib/verify.js'

it('discovers a standalone role without unrelated core dependencies', async () => {
  const roles = await resolveRoleInheritance(process.cwd(), 'memory-superpowers')
  expect(roles.map(role => role.role)).toEqual(['memory-superpowers'])
  const manifest = await loadVendorManifest(roles[0].manifestPath)
  expect(manifest.hosts).toEqual(['claude', 'codex', 'cursor'])
  expect(Object.keys(manifest.vendors)).toHaveLength(1)
})

it('distributes the requirements reviewer and its dependencies to all supported hosts', async () => {
  const sandbox = mkdtempSync(path.join(os.tmpdir(), 'airules-review-projection-'))
  try {
    const homeDir = path.join(sandbox, 'distribution')
    const userHome = path.join(sandbox, 'user')
    const role = 'memory-superpowers'
    const manifestPath = path.resolve('roles', role, 'role.yaml')
    const manifest = await loadVendorManifest(manifestPath)
    const vendor = manifest.vendors['memory-superpowers-role']
    // Exercise staging/projection using current files; no Git fixture commits.
    const source = path.join(homeDir, vendor.cloneDir, 'roles', role)
    mkdirSync(path.dirname(source), { recursive: true })
    cpSync(path.dirname(manifestPath), source, { recursive: true })
    for (const host of ['claude', 'codex', 'cursor'])
      mkdirSync(path.join(userHome, `.${host}`), { recursive: true })
    const installPaths = { ...getDefaultInstallPaths(userHome), moluoHome: homeDir }
    for (let attempt = 0; attempt < 2; attempt++) {
      await rebuildVendorAssets({ homeDir, role, manifestPath, manifest })
      ensureInstallRoot(installPaths)
      ensureGlobalSkillLink(installPaths)
      expect(await verifyGlobalAgentSkills(homeDir, userHome)).toBe(true)
      for (const host of ['claude', 'codex', 'cursor']) {
        expect(projectHostById(host, userHome, homeDir, role).success).toBe(true)
        expect(await verifyHost(host, homeDir, userHome, role)).toBe(true)
      }
    }
    const reviewer = path.join(userHome, '.agents/skills/review-requirements')
    for (const file of ['SKILL.md', 'scripts/bmad.py', 'references/review-rubric.md', 'agents/openai.yaml'])
      expect(existsSync(path.join(reviewer, file))).toBe(true)
    expect(readFileSync(path.join(reviewer, 'scripts/bmad.py'), 'utf8')).toBe(
      readFileSync(path.resolve('roles', role, 'skills/review-requirements/scripts/bmad.py'), 'utf8'),
    )
  }
  finally {
    rmSync(sandbox, { recursive: true, force: true })
  }
})
