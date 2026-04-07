import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('README positions the repo as a superpowers-based, multi-host, skills-first workflow distribution', () => {
  const readme = readFileSync(new URL('../README.md', import.meta.url), 'utf8');

  assert.match(readme, /skills-first workflow distribution/i);
  assert.match(readme, /built on top of .*superpowers/i);
  assert.match(readme, /first-party skills/i);
  assert.match(readme, /vendor skills/i);
  assert.match(readme, /claude/i);
  assert.match(readme, /codex/i);
  assert.match(readme, /qoder/i);
  assert.match(readme, /open(code)?/i);
  assert.doesNotMatch(readme, /core architecture.*rules\//i);
});
