#!/usr/bin/env node
// 链式前置门禁的确定性校验器。
// 用法：node scripts/verify-stage-gate.mjs <project-root> <stage> <module>
//   stage: test-design | frontend-plan | backend-plan | consistency | bugfix-fix
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
  // 跨产物一致性门禁（implement 前）：PRD + 测试设计 必须就绪；实现计划按「至少一栈存在」校验
  // （模块可能只有单栈计划，分离索引设计下不强制双栈都在，但不能两栈都缺——否则 impl-plan
  // 环节从未产出，下游无计划可对齐）。group:'plan' 的成员单看都 required:false，组级要求至少
  // 一份就绪，与 consistency-check skill「实现计划为必需上游」口径一致。四向对齐的深度校验由
  // consistency-check skill 承担，本门禁只做上游就绪的确定性兜底。
  'consistency': [
    { label: 'PRD', rel: m => `docs/prds/${m}.md`, required: true },
    { label: '测试设计', rel: m => `docs/test/${m}.md`, required: true },
    { label: '前端实现计划', rel: m => `docs/plan/frontend/${m}.md`, required: false, group: 'plan' },
    { label: '后端实现计划', rel: m => `docs/plan/backend/${m}.md`, required: false, group: 'plan' },
  ],
  // bugfix 链修复前置：根因诊断产物 docs/diagnosis/<bug>.md 必须就绪（复杂/跨栈 bug 由
  // debugger 子代理产出并交接），主代理据此驱动修复编码。
  'bugfix-fix': [
    { label: '根因诊断', rel: m => `docs/diagnosis/${m}.md`, required: true },
  ],
}

// 草案标记：命中即视为未定稿，下游不得消费。
const DRAFT_MARKERS = ['草案', '待确认版', 'DRAFT', 'WIP']
// 单文档 MISSING 占比上限：超过则认为关键事实未补齐，按未就绪处理。
const MISSING_LINE_RATIO_LIMIT = 0.25

const [projectRootArg, stageArg, moduleArg] = process.argv.slice(2)

if (!projectRootArg || !stageArg || !moduleArg) {
  console.error('用法：node scripts/verify-stage-gate.mjs <project-root> <stage> <module>')
  console.error(`stage 可选值：${Object.keys(STAGE_DEPENDENCIES).join(' | ')}`)
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

// 组级「至少一份就绪」累计：键为 group 名，值为该组是否已有成员 PASS。
const groupReady = new Map()
const groupLabels = new Map()

console.log(`[stage-gate] 校验环节：${stageArg}，模块：${moduleArg}`)

for (const dependency of dependencies) {
  const relPath = dependency.rel(moduleArg)
  const absolutePath = path.join(projectRoot, relPath)
  const result = assessDocument(absolutePath)

  if (dependency.group && !groupReady.has(dependency.group)) {
    groupReady.set(dependency.group, false)
    groupLabels.set(dependency.group, [])
  }
  if (dependency.group)
    groupLabels.get(dependency.group).push(dependency.label)

  if (result.status === 'PASS') {
    if (dependency.group)
      groupReady.set(dependency.group, true)
    console.log(`  PASS  ${dependency.label}（${relPath}）：${result.reason}`)
    continue
  }

  // 组成员的「文件不存在」不单独 blocked，由组级「至少一份就绪」统一裁决；
  // 但草案/空/MISSING 超阈值这类「存在但未就绪」仍即时 blocked。
  if (dependency.group && result.reason === '文件不存在') {
    console.log(`  N/A   ${dependency.label}（${relPath}）：组「${dependency.group}」成员，未提供`)
    continue
  }

  if (!dependency.required && result.reason === '文件不存在') {
    console.log(`  N/A   ${dependency.label}（${relPath}）：可选上游，未提供`)
    continue
  }

  blocked = true
  console.error(`  ${result.status}  ${dependency.label}（${relPath}）：${result.reason}`)
}

// 组级裁决：每个声明了 group 的依赖组必须至少有一名成员就绪。
for (const [group, ready] of groupReady) {
  if (!ready) {
    blocked = true
    const labels = groupLabels.get(group).join(' / ')
    console.error(`  MISSING blocked  组「${group}」（${labels}）：至少需一份就绪，当前全部缺失`)
  }
}

if (blocked) {
  console.error('[stage-gate] FAIL：上游产物未就绪，下游环节必须停止并报告 MISSING blocked。')
  process.exit(1)
}

console.log('[stage-gate] PASS：上游产物已就绪，可进入下游环节。')
