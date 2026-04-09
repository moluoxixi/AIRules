import test from 'node:test';
import assert from 'node:assert/strict';
import { loadVendorManifest } from '../scripts/lib/vendors.mjs';

test('vendor manifest includes aggregated vendor skill targets', async () => {
  const manifest = await loadVendorManifest(new URL('../constants/skills.js', import.meta.url));

  assert.ok(manifest.vendors.superpowers);
  assert.ok(manifest.vendors.anthropic);
  assert.ok(manifest.vendors.vercel);
  assert.ok(manifest.vendors.moluoxixi);
  assert.equal(manifest.vendors.superpowers.cloneDir, 'vendor/repos/superpowers');
  assert.equal(manifest.vendors.anthropic.cloneDir, 'vendor/repos/anthropic');
  assert.equal(manifest.vendors.vercel.cloneDir, 'vendor/repos/vercel');
  assert.equal(manifest.vendors.moluoxixi.cloneDir, 'vendor/repos/moluoxixi');
  assert.equal(
    manifest.vendors.superpowers.links.some((entry) => entry.target === 'vendor/skills/superpowers'),
    true
  );
  assert.equal(
    manifest.vendors.anthropic.links.some((entry) => entry.target === 'vendor/skills/frontend/frontend-design'),
    true
  );
  assert.equal(
    manifest.vendors.vercel.links.some((entry) => entry.target === 'vendor/skills/common/update-docs'),
    true
  );
  assert.equal(
    manifest.vendors.vercel.links.some((entry) => entry.target === 'vendor/skills/frontend/cache-components'),
    true
  );
  assert.equal(
    manifest.vendors.moluoxixi.links.some((entry) => entry.target === 'vendor/skills/common/antfu'),
    true
  );
  assert.equal(
    manifest.vendors.moluoxixi.links.some((entry) => entry.target === 'vendor/skills/frontend/vue'),
    true
  );
});
