import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { loadVendorManifest } from '../scripts/lib/vendors.mjs';

test('loadVendorManifest rejects local vendor entries', async () => {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), 'ai-rules-local-vendor-'));
  const manifestPath = path.join(tempDir, 'skills.js');

  try {
    writeFileSync(manifestPath, `
      export const vendors = {
        workflow: [
          {
            name: 'first-party',
            official: true,
            local: true,
            source: '.',
            sourceBaseDir: 'skills',
            skills: {
              'standard-workflow': 'standard-workflow',
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
