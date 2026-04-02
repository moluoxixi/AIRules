import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

test('first-party entry skills exist in skills/', () => {
  assert.equal(existsSync(new URL('../skills/standard-workflow/SKILL.md', import.meta.url)), true);
  assert.equal(existsSync(new URL('../skills/personal-defaults/SKILL.md', import.meta.url)), true);
  assert.equal(existsSync(new URL('../skills/frontend/SKILL.md', import.meta.url)), true);
  assert.equal(existsSync(new URL('../skills/backend/SKILL.md', import.meta.url)), true);
  assert.equal(existsSync(new URL('../skills/javascript/SKILL.md', import.meta.url)), true);
  assert.equal(existsSync(new URL('../skills/typescript/SKILL.md', import.meta.url)), true);
});
