import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { it } from 'vitest'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')

/**
 * 读取项目内文本文件，测试策略类规则是否被分发入口和 workflow skill 同时覆盖。
 */
function readProjectFile(...parts: string[]) {
  return fs.readFileSync(path.join(rootDir, ...parts), 'utf8')
}

it('workflow policy - 并行子代理规则同时存在于入口和 workflow skill', () => {
  const agents = readProjectFile('AGENTS.md')
  const workflowSkill = readProjectFile('skills', 'workflow', 'software-development-workflow', 'SKILL.md')
  const taskSplitting = readProjectFile('skills', 'workflow', 'software-development-workflow', 'references', 'task-splitting.md')

  assert.match(agents, /## 并行子代理/)
  assert.match(agents, /两个或更多相互独立的问题域/)
  assert.match(workflowSkill, /dispatching-parallel-agents/)
  assert.match(workflowSkill, /subagent-driven-development/)
  assert.match(taskSplitting, /## Parallel Agent Gate/)
  assert.match(taskSplitting, /two or more independent problem domains/)
})
