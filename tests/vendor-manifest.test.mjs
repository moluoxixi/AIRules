import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('vendor manifest includes superpowers and external skill sources', () => {
  const manifest = JSON.parse(readFileSync(new URL('../manifests/vendors.json', import.meta.url), 'utf8'));

  assert.ok(manifest.vendors.superpowers);
  assert.ok(manifest.vendors.anthropicSkills);
  assert.ok(manifest.vendors.vercelSkills);
});
