#!/usr/bin/env node
import { existsSync, mkdirSync } from 'node:fs'
import path from 'node:path'

// 在用户项目根建立 .airules spec 工作流骨架（第一方契约版，零外部依赖）。
// 借鉴 OpenSpec 的目录约定，但落进纯 .airules/，不带 openspec/ 那层。
// 幂等：已存在的目录跳过。

const projectRoot = path.resolve(process.argv[2] ?? process.cwd())
const airulesDir = path.join(projectRoot, '.airules')

const dirs = [
  path.join(airulesDir, 'specs'),
  path.join(airulesDir, 'changes'),
  path.join(airulesDir, 'changes', 'archive'),
]

const created = []
for (const dir of dirs) {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
    created.push(path.relative(projectRoot, dir).replace(/\\/g, '/'))
  }
}

if (created.length === 0) {
  console.log(`[airules] spec 工作流骨架已存在，跳过：${path.relative(projectRoot, airulesDir).replace(/\\/g, '/')}`)
}
else {
  console.log(`[airules] 已建立 spec 工作流骨架：${created.join(', ')}`)
}
