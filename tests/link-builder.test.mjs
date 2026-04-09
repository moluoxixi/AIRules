import test from 'node:test';
import assert from 'node:assert/strict';

import { buildLinkPlan } from '../scripts/lib/links.mjs';

const sampleManifest = {
  vendors: {
    superpowers: {
      cloneDir: 'vendor/repos/superpowers',
      links: [
        {
          source: 'skills',
          target: 'vendor/skills/superpowers'
        }
      ]
    },
    anthropic: {
      cloneDir: 'vendor/repos/anthropic',
      links: [
        {
          source: 'skills/frontend-design',
          target: 'vendor/skills/frontend/frontend-design'
        }
      ]
    }
  }
};

test('buildLinkPlan returns a superpowers namespace link and selected skill links', () => {
  const plan = buildLinkPlan(sampleManifest, 'C:/Users/demo/.moluoxixi');

  assert.equal(plan.some((entry) => entry.target.endsWith('/vendor/skills/superpowers')), true);
  assert.equal(plan.some((entry) => entry.target.endsWith('/vendor/skills/frontend/frontend-design')), true);
  assert.equal(plan.find((entry) => entry.target.endsWith('/vendor/skills/superpowers')).source.endsWith('/vendor/repos/superpowers/skills'), true);
});
