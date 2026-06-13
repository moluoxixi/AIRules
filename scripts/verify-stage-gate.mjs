#!/usr/bin/env node
// 链式前置门禁的确定性校验器。
// 用法：node scripts/verify-stage-gate.mjs <project-root> <stage> <module>
//   stage: test-design | frontend-plan | backend-plan
//   module: 业务/需求模块名，对应 docs/prds/<module>.md 等文件名（不含扩展名）。
// 退出码：0 = PASS（上游就绪，可进入下游环节）；1 = blocked/失败（必须停止）。
// 设计意图：把「需求合格→才出测试设计；需求+契约+测试合格→才出实现计划」这条
// 软约定转成可执行门禁，避免下游 skill 在上游仍为草案或大量 MISSING 时就臆造推进。
import { existsSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'

// 每个 stage 声明它依赖哪些上游产物文档。
// required=true 的文件缺失即 blocked；required=false 仅在存在时做就绪校验。
const STAGE_DEPENDENCIES = {
  'test-design': [
    { label: 'PRD', rel: m => `docs/prds/${m}.md`, required: true },
  ],
  'frontend-plan': [
    { label: 'PRD', rel: m => `docs/prds/${m}.md`, required: true },
    { label: '测试设计', rel: m => `docs/test/${m}.md`, required: true },
  ],
  'backend-plan': [
    { label: 'PRD', rel: m => `docs/prds/${m}.md`, required: true },
    { label: '测试设计', rel: m => `docs/test/${m}.md`, required: true },
  ],
}

// 草案标记：命中即视为未定稿，下游不得消费。
const DRAFT_MARKERS = ['草案', '待确认版', 'DRAFT', 'WIP']
// 单文档 MISSING 占比上限：超过则认为关键事实未补齐，按未就绪处理。
const MISSING_LINE_RATIO_LIMIT = 0.25

const [projectRootArg, stageArg, moduleArg] = process.argv.slice(2)

if (!projectRootArg || !stageArg || !moduleArg) {
  console.error('用法：node scripts/verify-stage-gate.mjs <project-root> <stage> <module>')
  console.error('stage 可选值：test-design | frontend-plan | backend-plan')
  process.exit(1)
}

const dependencies = STAGE_DEPENDENCIES[stageArg]
if (!dependencies) {
  console.error(`未知 stage：${stageArg}；可选值：${Object.keys(STAGE_DEPENDENCIES).join(' | ')}`)
  process.exit(1)
}

// 边界校验：module 来自 CLI 入参，会被拼进 docs/<类型>/<module>.md 路径模板。
// 必须拒绝路径分隔符与上跳片段，防止 ../../etc/passwd 之类路径遍历读到项目外文件。
if (/[\\/]/.test(moduleArg) || moduleArg.split(/[\\/]/).includes('..') || moduleArg.includes('..')) {
  console.error(`非法 module：${moduleArg}；module 必须是单段文件名（不含路径分隔符或 ..）`)
  process.exit(1)
}

const projectRoot = path.resolve(projectRootArg)

// 评估单个上游文档的就绪度：存在性、草案标记、MISSING 占比。
function assessDocument(absolutePath) {
  if (!existsSync(absolutePath) || !statSync(absolutePath).isFile())
    return { status: 'MISSING blocked', reason: '文件不存在' }

  const content = readFileSync(absolutePath, 'utf8')

  const draftMarker = DRAFT_MARKERS.find(marker => content.includes(marker))
  if (draftMarker)
    return { status: 'MISSING blocked', reason: `命中草案标记「${draftMarker}」，尚未定稿` }

  const lines = content.split('\n')
  const totalLines = lines.filter(line => line.trim() !== '').length

  if (totalLines === 0)
    return { status: 'MISSING blocked', reason: '文档为空' }

  const missingLines = lines.filter(line => /\bMISSING\b/.test(line)).length
  const ratio = missingLines / totalLines

  if (ratio > MISSING_LINE_RATIO_LIMIT) {
    return {
      status: 'MISSING blocked',
      reason: `MISSING 占比 ${(ratio * 100).toFixed(0)}% 超过阈值 ${(MISSING_LINE_RATIO_LIMIT * 100).toFixed(0)}%，关键事实未补齐`,
    }
  }

  return { status: 'PASS', reason: `就绪（MISSING 占比 ${(ratio * 100).toFixed(0)}%）` }
}

let blocked = false

console.log(`[stage-gate] 校验环节：${stageArg}，模块：${moduleArg}`)

for (const dependency of dependencies) {
  const relPath = dependency.rel(moduleArg)
  const absolutePath = path.join(projectRoot, relPath)
  const result = assessDocument(absolutePath)

  if (result.status === 'PASS') {
    console.log(`  PASS  ${dependency.label}（${relPath}）：${result.reason}`)
    continue
  }

  if (!dependency.required && result.reason === '文件不存在') {
    console.log(`  N/A   ${dependency.label}（${relPath}）：可选上游，未提供`)
    continue
  }

  blocked = true
  console.error(`  ${result.status}  ${dependency.label}（${relPath}）：${result.reason}`)
}

if (blocked) {
  console.error('[stage-gate] FAIL：上游产物未就绪，下游环节必须停止并报告 MISSING blocked。')
  process.exit(1)
}

console.log('[stage-gate] PASS：上游产物已就绪，可进入下游环节。')
