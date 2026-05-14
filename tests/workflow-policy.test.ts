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

it('工作流策略 - 并行子代理规则同时存在于入口和 workflow skill', () => {
  const agents = readProjectFile('AGENTS.md')
  const workflowSkill = readProjectFile('skills', 'workflow', 'software-development-workflow', 'SKILL.md')
  const taskSplitting = readProjectFile('skills', 'workflow', 'software-development-workflow', 'references', 'task-splitting.md')

  assert.match(agents, /## 并行子代理/)
  assert.match(agents, /两个或更多相互独立的问题域/)
  assert.match(workflowSkill, /拆分和并行判断/)
  assert.match(workflowSkill, /task-splitting\.md/)
  assert.match(taskSplitting, /## 并行代理门槛/)
  assert.match(taskSplitting, /两个或更多独立问题域/)
})

it('工作流策略 - 质量检查按场景分级而不是默认全量执行', () => {
  const agents = readProjectFile('AGENTS.md')
  const workflowSkill = readProjectFile('skills', 'workflow', 'software-development-workflow', 'SKILL.md')
  const qualityGate = readProjectFile('skills', 'workflow', 'software-development-workflow', 'references', 'quality-gate.md')
  const deliveryReport = readProjectFile('skills', 'workflow', 'software-development-workflow', 'references', 'delivery-report.md')

  assert.match(agents, /质量检查必须按任务场景和风险分级执行/)
  assert.match(agents, /Superpowers、并行子代理、系统化调试、TDD、全量测试、coverage 和构建不得默认触发/)
  assert.match(workflowSkill, /流程 playbook/)
  assert.match(workflowSkill, /硬约束由这些上层规则管理/)
  assert.match(workflowSkill, /## 场景分级/)
  assert.match(workflowSkill, /避免把所有任务套进同一个重流程/)
  assert.match(qualityGate, /## 验证分级/)
  assert.match(qualityGate, /验证范围选择建议/)
  assert.match(qualityGate, /避免把所有任务默认升级为 Superpowers、全量测试、coverage 或构建/)
  assert.match(qualityGate, /咨询、审查、方案讨论、只读排查/)
  assert.match(qualityGate, /文档、AGENTS、Skill、README、策略规则/)
  assert.match(qualityGate, /多模块、高风险、发布前/)
  assert.match(qualityGate, /`N\/A`/)
  assert.match(deliveryReport, /交付报告建议格式/)
  assert.match(deliveryReport, /只读任务或未修改代码/)
})

it('工作流策略 - workflow skill 自包含语言与注释约束', () => {
  const agents = readProjectFile('AGENTS.md')
  const workflowSkill = readProjectFile('skills', 'workflow', 'software-development-workflow', 'SKILL.md')

  assert.match(agents, /用户本次消息的主要语言/)
  assert.match(workflowSkill, /默认跟随用户当前主要语言/)
  assert.match(workflowSkill, /职责、边界、输入输出约束、副作用或异常语义/)
})

it('工作流策略 - 质量状态统一使用 FAIL 而不是 FAILED', () => {
  const workflowSkill = readProjectFile('skills', 'workflow', 'software-development-workflow', 'SKILL.md')
  const qualityGate = readProjectFile('skills', 'workflow', 'software-development-workflow', 'references', 'quality-gate.md')
  const deliveryReport = readProjectFile('skills', 'workflow', 'software-development-workflow', 'references', 'delivery-report.md')

  for (const content of [workflowSkill, qualityGate, deliveryReport]) {
    assert.match(content, /`FAIL`/)
    assert.doesNotMatch(content, /`FAILED`/)
  }
})

it('工作流策略 - workflow skills 使用中文规范结构', () => {
  const workflowRoot = path.join(rootDir, 'skills', 'workflow')
  const legacySectionPattern = /## (Overview|Load References|Core Rules|Required Testing Dimensions|Related Skills|No Fake Passes)/

  /**
   * 收集 workflow 下所有 Markdown 文件，用于防止入口和 reference 退回英文模板结构。
   */
  function collectMarkdownFiles(dir: string): string[] {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const entryPath = path.join(dir, entry.name)

      if (entry.isDirectory())
        return collectMarkdownFiles(entryPath)

      return entry.name.endsWith('.md') ? [entryPath] : []
    })
  }

  const markdownFiles = collectMarkdownFiles(workflowRoot)
  const skillFiles = markdownFiles.filter(file => path.basename(file) === 'SKILL.md')

  for (const file of skillFiles) {
    const content = fs.readFileSync(file, 'utf8')
    assert.doesNotMatch(content, /description:\s*Use when/)
    assert.match(content, /description:\s*用于/)
  }

  for (const file of markdownFiles) {
    const content = fs.readFileSync(file, 'utf8')
    assert.doesNotMatch(content, legacySectionPattern, `${file} contains legacy English section heading`)
  }
})
