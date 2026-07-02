#!/usr/bin/env node
import { copyFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

// 在用户项目根建立 .qoder/repowiki/wiki_plan.yaml。
// 让 Qoder wiki 生成时能感知 .airules/knowledge/ 知识库，作为背景事实源。
// 幂等：已存在则跳过，不覆盖团队已维护的配置。
// 若目标项目已存在 .qoder，则把用户根目录 .qoder/AGENTS.md 覆盖注入到项目 .qoder/rules/AGENTS.md。

const projectRoot = path.resolve(process.argv[2] ?? process.cwd())
const qoderDir = path.join(projectRoot, '.qoder')
const wikiPlanDir = path.join(projectRoot, '.qoder', 'repowiki')
const wikiPlanPath = path.join(wikiPlanDir, 'wiki_plan.yaml')

if (existsSync(qoderDir)) {
  const userHome = process.env.AIRULES_TEST_HOME
    ? path.resolve(process.env.AIRULES_TEST_HOME)
    : os.homedir()
  const globalAgentsPath = path.join(userHome, '.qoder', 'AGENTS.md')
  const projectRulesDir = path.join(qoderDir, 'rules')
  const projectRulesPath = path.join(projectRulesDir, 'AGENTS.md')

  if (existsSync(globalAgentsPath)) {
    mkdirSync(projectRulesDir, { recursive: true })
    copyFileSync(globalAgentsPath, projectRulesPath)
    console.log('[airules] 已覆盖注入 .qoder/rules/AGENTS.md')
  }
  else {
    console.warn('[airules] 用户根目录 .qoder/AGENTS.md 不存在，跳过 .qoder/rules 注入')
  }
}

if (existsSync(wikiPlanPath)) {
  console.log('[airules] .qoder/repowiki/wiki_plan.yaml 已存在，跳过')
  process.exit(0)
}

mkdirSync(wikiPlanDir, { recursive: true })

// notes 告知 AI 知识库位置；不设 scope.include 避免遮蔽项目源码。
// 团队可在此基础上追加 documents / scope 等字段。
const content = `version: 1

repowiki:
  notes:
    - text: "项目知识库位于 .airules/knowledge/，生成 Wiki 时必须将.airules/knowledge/，的内容写入"
      author: airules
`

writeFileSync(wikiPlanPath, content, 'utf8')
console.log(`[airules] 已建立 ${path.relative(projectRoot, wikiPlanPath).replace(/\\/g, '/')}`)
