import { expect, it } from 'vitest'
import { resolveRoleInheritance } from '../../../scripts/lib/roles.js'
import { loadVendorManifest } from '../../../scripts/lib/vendors.js'

it('discovers a standalone role without unrelated core dependencies', async () => {
  const roles = await resolveRoleInheritance(process.cwd(), 'memory-superpowers')
  expect(roles.map(role => role.role)).toEqual(['memory-superpowers'])
  const manifest = await loadVendorManifest(roles[0].manifestPath)
  expect(manifest.hosts).toEqual(['claude', 'codex', 'cursor'])
  expect(Object.keys(manifest.vendors)).toHaveLength(1)
})
