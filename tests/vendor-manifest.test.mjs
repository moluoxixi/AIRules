import test from 'node:test';
import assert from 'node:assert/strict';
import { loadVendorManifest } from '../scripts/lib/vendors.mjs';

test('vendor manifest includes superpowers and external skill sources', () => {
  const manifest = loadVendorManifest(new URL('../manifests/vendors.jsonc', import.meta.url));

  assert.ok(manifest.vendors.superpowers);
  assert.ok(manifest.vendors.anthropicSkills);
  assert.ok(manifest.vendors.vercelSkills);
  assert.match(manifest.vendors.superpowers.description, /工作流|brainstorming|TDD/i);
});
