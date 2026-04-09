import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { loadVendorManifest } from '../scripts/lib/vendors.mjs';

test('loadVendorManifest reads leaf vendor arrays and uses entry name as vendor id', async () => {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), 'ai-rules-vendor-format-'));
  const manifestPath = path.join(tempDir, 'skills.js');

  try {
    writeFileSync(manifestPath, `
      export const vendors = {
        common: [
          {
            name: 'gemini',
            official: true,
            source: 'https://example.com/gemini.git',
            sourceBaseDir: 'skills',
            skills: {
              reviewer: 'reviewer',
            },
          },
        ],
        frontend: [
          {
            name: 'vercel',
            official: true,
            source: 'https://example.com/vercel.git',
            sourceBaseDir: 'frontend-skills',
            skills: {
              cache: 'cache',
            },
          },
          {
            name: 'vercel',
            official: true,
            source: 'https://example.com/vercel.git',
            sourceBaseDir: 'more-frontend-skills',
            skills: {
              image: 'image',
            },
          },
        ],
      };
    `, 'utf8');

    const manifest = await loadVendorManifest(manifestPath);

    assert.ok(manifest.vendors.gemini);
    assert.ok(manifest.vendors.vercel);
    assert.equal(manifest.vendors.gemini.cloneDir, 'vendor/repos/gemini');
    assert.equal(manifest.vendors.vercel.cloneDir, 'vendor/repos/vercel');
    assert.equal(
      manifest.vendors.gemini.links.some((entry) => entry.target === 'vendor/skills/common/reviewer'),
      true
    );
    assert.equal(
      manifest.vendors.vercel.links.some((entry) => entry.target === 'vendor/skills/frontend/cache'),
      true
    );
    assert.equal(
      manifest.vendors.vercel.links.some((entry) => entry.target === 'vendor/skills/frontend/image'),
      true
    );
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test('loadVendorManifest rejects local flags in vendor entries', async () => {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), 'ai-rules-vendor-local-flag-'));
  const manifestPath = path.join(tempDir, 'skills.js');

  try {
    writeFileSync(manifestPath, `
      export const vendors = {
        common: [
          {
            name: 'gemini',
            official: true,
            local: true,
            source: 'https://example.com/gemini.git',
            sourceBaseDir: 'skills',
            skills: {
              reviewer: 'reviewer',
            },
          },
        ],
      };
    `, 'utf8');

    await assert.rejects(
      () => loadVendorManifest(manifestPath),
      /local vendor entries are not supported/i
    );
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});
