import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

test('first-party skills exist in skills/', () => {
  assert.equal(existsSync(new URL('../skills/standard-workflow/SKILL.md', import.meta.url)), true);
  assert.equal(existsSync(new URL('../skills/frontend/SKILL.md', import.meta.url)), true);
  assert.equal(existsSync(new URL('../skills/backend/SKILL.md', import.meta.url)), true);
  assert.equal(existsSync(new URL('../skills/javascript/SKILL.md', import.meta.url)), true);
  assert.equal(existsSync(new URL('../skills/typescript/SKILL.md', import.meta.url)), true);
  assert.equal(existsSync(new URL('../skills/react/SKILL.md', import.meta.url)), true);
  assert.equal(existsSync(new URL('../skills/vue/SKILL.md', import.meta.url)), true);
  assert.equal(existsSync(new URL('../skills/testing/SKILL.md', import.meta.url)), true);
  assert.equal(existsSync(new URL('../skills/verification/SKILL.md', import.meta.url)), true);
  assert.equal(existsSync(new URL('../skills/wrap-up/SKILL.md', import.meta.url)), true);
  assert.equal(existsSync(new URL('../rules', import.meta.url)), false);
});

test('task-2 skill files keep required boundary and language invariants', () => {
  const frontend = readFileSync(new URL('../skills/frontend/SKILL.md', import.meta.url), 'utf8');
  const backend = readFileSync(new URL('../skills/backend/SKILL.md', import.meta.url), 'utf8');
  const javascript = readFileSync(new URL('../skills/javascript/SKILL.md', import.meta.url), 'utf8');
  const typescript = readFileSync(new URL('../skills/typescript/SKILL.md', import.meta.url), 'utf8');

  assert.match(frontend, /跨框架/);
  assert.match(frontend, /框架特有细节/);
  assert.match(frontend, /加载、空态和错误状态/);
  assert.match(frontend, /交互行为必须完整/);

  assert.match(backend, /技术栈无关/);
  assert.match(backend, /框架特定模式/);
  assert.match(backend, /API\/契约形状/);
  assert.match(backend, /校验/);
  assert.match(backend, /副作用/);

  assert.match(javascript, /运行时/);
  assert.match(javascript, /(async\/await|异步|Promise)/);
  assert.match(javascript, /模块边界/);
  assert.match(javascript, /可读/);
  assert.match(javascript, /错误/);

  assert.match(typescript, /`javascript`/);
  assert.match(typescript, /类型/);
  assert.match(typescript, /避免 `any`/);
  assert.match(typescript, /无效状态/);
});
