#!/usr/bin/env node
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'

// 在用户项目根建立 .qoder/repowiki/wiki_plan.yaml。
// 让 Qoder wiki 生成时能感知 .airules/knowledge/ 知识库，作为背景事实源。
// 幂等：已存在则跳过，不覆盖团队已维护的配置。

const projectRoot = path.resolve(process.argv[2] ?? process.cwd())
const wikiPlanDir = path.join(projectRoot, '.qoder', 'repowiki')
const wikiPlanPath = path.join(wikiPlanDir, 'wiki_plan.yaml')

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
    - text: "项目知识库位于 .airules/knowledge/，生成 Wiki 时优先参考其中的架构决策、设计原则与业务背景"
      author: airules
`

writeFileSync(wikiPlanPath, content, 'utf8')
console.log(`[airules] 已建立 ${path.relative(projectRoot, wikiPlanPath).replace(/\\/g, '/')}`)
