import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

test('first-party skills exist in skills/', () => {
  assert.equal(existsSync(new URL('../skills/standard-workflow/SKILL.md', import.meta.url)), true);
  assert.equal(existsSync(new URL('../skills/personal-defaults/SKILL.md', import.meta.url)), true);
  assert.equal(existsSync(new URL('../skills/frontend/SKILL.md', import.meta.url)), true);
  assert.equal(existsSync(new URL('../skills/backend/SKILL.md', import.meta.url)), true);
  assert.equal(existsSync(new URL('../skills/javascript/SKILL.md', import.meta.url)), true);
  assert.equal(existsSync(new URL('../skills/typescript/SKILL.md', import.meta.url)), true);
  assert.equal(existsSync(new URL('../skills/react/SKILL.md', import.meta.url)), true);
  assert.equal(existsSync(new URL('../skills/vue/SKILL.md', import.meta.url)), true);
  assert.equal(existsSync(new URL('../skills/testing/SKILL.md', import.meta.url)), true);
  assert.equal(existsSync(new URL('../skills/verification/SKILL.md', import.meta.url)), true);
  assert.equal(existsSync(new URL('../skills/wrap-up/SKILL.md', import.meta.url)), true);
});

test('task-2 skill files keep required boundary and language invariants', () => {
  const frontend = readFileSync(new URL('../skills/frontend/SKILL.md', import.meta.url), 'utf8');
  const backend = readFileSync(new URL('../skills/backend/SKILL.md', import.meta.url), 'utf8');
  const javascript = readFileSync(new URL('../skills/javascript/SKILL.md', import.meta.url), 'utf8');
  const typescript = readFileSync(new URL('../skills/typescript/SKILL.md', import.meta.url), 'utf8');

  assert.match(frontend, /cross-framework/i);
  assert.match(frontend, /framework-specific details/i);
  assert.match(frontend, /loading,\s*empty,\s*and error states/i);
  assert.match(frontend, /Interactive behavior must be complete/i);

  assert.match(backend, /stack-agnostic/i);
  assert.match(backend, /framework-specific patterns/i);
  assert.match(backend, /API\/contract shapes/i);
  assert.match(backend, /validation/i);
  assert.match(backend, /side effects/i);

  assert.match(javascript, /runtime/i);
  assert.match(javascript, /(async|asynchronous|promise)/i);
  assert.match(javascript, /module boundaries/i);
  assert.match(javascript, /readable/i);
  assert.match(javascript, /errors?/i);

  assert.match(typescript, /`javascript`/i);
  assert.match(typescript, /type/i);
  assert.match(typescript, /Avoid `any`/i);
  assert.match(typescript, /invalid states?/i);
});
