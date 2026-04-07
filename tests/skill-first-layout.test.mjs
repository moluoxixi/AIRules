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

test('first-party skill descriptions are trigger-oriented', () => {
  const standardWorkflow = readFileSync(new URL('../skills/standard-workflow/SKILL.md', import.meta.url), 'utf8');
  const frontend = readFileSync(new URL('../skills/frontend/SKILL.md', import.meta.url), 'utf8');
  const backend = readFileSync(new URL('../skills/backend/SKILL.md', import.meta.url), 'utf8');
  const javascript = readFileSync(new URL('../skills/javascript/SKILL.md', import.meta.url), 'utf8');
  const typescript = readFileSync(new URL('../skills/typescript/SKILL.md', import.meta.url), 'utf8');
  const react = readFileSync(new URL('../skills/react/SKILL.md', import.meta.url), 'utf8');
  const vue = readFileSync(new URL('../skills/vue/SKILL.md', import.meta.url), 'utf8');
  const testing = readFileSync(new URL('../skills/testing/SKILL.md', import.meta.url), 'utf8');
  const verification = readFileSync(new URL('../skills/verification/SKILL.md', import.meta.url), 'utf8');
  const wrapUp = readFileSync(new URL('../skills/wrap-up/SKILL.md', import.meta.url), 'utf8');

  for (const content of [
    standardWorkflow,
    frontend,
    backend,
    javascript,
    typescript,
    react,
    vue,
    testing,
    verification,
    wrapUp
  ]) {
    assert.match(content, /^description:\s*Use when\b/m);
  }

  assert.match(standardWorkflow, /多个阶段|标准流程/);
  assert.match(frontend, /页面|组件|交互|状态/);
  assert.match(backend, /API|service|校验|副作用/);
  assert.match(javascript, /\.js|\.mjs|异步|运行时/);
  assert.match(typescript, /\.ts|\.tsx|类型|边界/);
  assert.match(react, /React|Next|hooks|server\/client/);
  assert.match(vue, /Vue|Nuxt|composables|store/);
  assert.match(testing, /测试|断言|验证改动/);
  assert.match(verification, /宣称完成|验证证据|汇报完成/);
  assert.match(wrapUp, /最终交接|收尾|汇报结果/);
});

test('first-party skills follow the shared content structure', () => {
  for (const relativePath of [
    '../skills/standard-workflow/SKILL.md',
    '../skills/frontend/SKILL.md',
    '../skills/backend/SKILL.md',
    '../skills/javascript/SKILL.md',
    '../skills/typescript/SKILL.md',
    '../skills/react/SKILL.md',
    '../skills/vue/SKILL.md',
    '../skills/testing/SKILL.md',
    '../skills/verification/SKILL.md',
    '../skills/wrap-up/SKILL.md'
  ]) {
    const content = readFileSync(new URL(relativePath, import.meta.url), 'utf8');
    assert.match(content, /## 概述/);
    assert.match(content, /## 何时使用/);
    assert.match(content, /## 不在这些情况下使用/);
    assert.match(content, /## 核心指导/);
    assert.match(content, /## 常见误区/);
    assert.match(content, /## 相关 Skills/);
  }
});
