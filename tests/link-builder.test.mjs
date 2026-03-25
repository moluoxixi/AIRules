import test from 'node:test';
import assert from 'node:assert/strict';

import { buildLinkPlan } from '../scripts/lib/links.mjs';

const sampleManifest = {
  vendors: {
    superpowers: {
      cloneDir: 'vendors/superpowers',
      links: [
        {
          source: 'skills',
          target: 'skills/superpowers'
        }
      ]
    },
    anthropicSkills: {
      cloneDir: 'vendors/anthropic-skills',
      links: [
        {
          source: 'skills/frontend-design',
          target: 'skills/frontend-design'
        }
      ]
    }
  }
};

test('buildLinkPlan returns a superpowers namespace link and selected skill links', () => {
  const plan = buildLinkPlan(sampleManifest, 'C:/Users/demo/.moluoxixi');

  assert.equal(plan.some((entry) => entry.target.endsWith('/skills/superpowers')), true);
  assert.equal(plan.some((entry) => entry.target.endsWith('/skills/frontend-design')), true);
  assert.equal(plan.find((entry) => entry.target.endsWith('/skills/superpowers')).source.endsWith('/vendors/superpowers/skills'), true);
});
