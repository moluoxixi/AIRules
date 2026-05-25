#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Resolve the skill root once so every file check stays anchored to this skill package.
const skillRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function readSkillFile(...segments) {
  return fs.readFileSync(path.join(skillRoot, ...segments), 'utf8')
}

function assertContains(content, pattern, message) {
  if (!pattern.test(content))
    throw new Error(message)
}

function printPass(message, details = {}) {
  console.log(`PASS ${message}`)

  for (const [key, value] of Object.entries(details))
    console.log(`${key}: ${value}`)
}

function printHoistWarning(message, details = {}) {
  console.log(`WARN [HOIST_WARNING] ${message}`)

  for (const [key, value] of Object.entries(details))
    console.log(`${key}: ${value}`)
}

function printHelp() {
  console.log(`用法: node verify-rules.mjs [command] [options]

命令:
  self                        校验本 skill 的规则完整性（默认）
  hoist                       执行共享边界风险扫描（只作机械线索）
  --help                      显示帮助信息

选项:
  --target <path>             指定抽离目标目录
  --uses <path1> <path2> ...  指定至少 2 个使用点路径

示例:
  node scripts/verify-rules.mjs
  node scripts/verify-rules.mjs hoist --target src/shared/order-formatters --uses src/modules/orders/create/create-order.service.ts src/modules/orders/update/update-order.service.ts src/modules/orders/cancel/cancel-order.service.ts
`)
}

function getOption(args, name) {
  const index = args.indexOf(name)

  if (index === -1)
    throw new Error(`缺少参数 ${name}`)

  const value = args[index + 1]

  if (!value || value.startsWith('--'))
    throw new Error(`参数 ${name} 必须提供值`)

  return value
}

function normalizeSegments(filePath) {
  return path.resolve(process.cwd(), filePath).split(path.sep)
}

// Compute the nearest shared boundary for all usage sites.
function nearestCommonAncestor(paths) {
  const segmentsList = paths.map(normalizeSegments)
  const first = segmentsList[0]
  const shared = []

  for (let index = 0; index < first.length; index += 1) {
    const segment = first[index]

    if (segmentsList.every(segments => segments[index] === segment))
      shared.push(segment)
    else
      break
  }

  return shared
}

function isUnderAncestor(targetSegments, ancestorSegments) {
  if (targetSegments.length < ancestorSegments.length)
    return false

  return ancestorSegments.every((segment, index) => targetSegments[index] === segment)
}

// Use the mechanical boundary as a warning signal only; semantic ownership still comes from architecture boundaries.
function scanHoistTarget(args) {
  const target = getOption(args, '--target')
  const usesIndex = args.indexOf('--uses')

  if (usesIndex === -1)
    throw new Error('缺少参数 --uses')

  const uses = args.slice(usesIndex + 1)

  if (uses.length < 2)
    throw new Error('--uses 至少需要两个使用点')

  const ancestorSegments = nearestCommonAncestor(uses)
  const targetSegments = normalizeSegments(target)
  const targetPath = path.resolve(process.cwd(), target)
  const ancestor = ancestorSegments.join('/')

  if (!isUnderAncestor(targetSegments, ancestorSegments)) {
    printHoistWarning('抽离目标不在允许的共享边界内，请人工确认它是否应该进入全局共享层或独立共享包', {
      target: targetPath,
      sharedBoundary: ancestor,
    })
  }
  else if (targetSegments.length !== ancestorSegments.length + 1) {
    printHoistWarning('抽离目标位于更深层级，请人工确认它是否应留在局部业务内部，或者提升到全局共享层', {
      target: targetPath,
      sharedBoundary: ancestor,
    })
  }

  printPass('backend hoist domain-boundary scan completed', {
    target: targetPath,
    sharedBoundary: ancestor,
    advisory: 'The boundary signal is mechanical only; review domain semantics before changing ownership.',
  })
}

function verifySelf() {
  const skill = readSkillFile('SKILL.md')

  assertContains(skill, /name: node-code-standard/, 'SKILL.md 必须声明正确的 skill name')
  assertContains(skill, /用于新建、编写、重构、拆分、优化、评审或校验非 NestJS 的 Node\.js\/TypeScript\/JavaScript 后端代码/, 'SKILL.md 必须声明完整触发场景')
  assertContains(skill, /唯一规则源/, 'SKILL.md 必须声明唯一规则源')
  assertContains(skill, /不要跳转到仓库中的其它 project skills/, 'SKILL.md 必须声明不依赖其它 project skills')
  assertContains(skill, /# Role: 资深 Node 后端架构师 \(Strict Node Backend Architect\)/, 'SKILL.md 必须声明 Node 架构师 Role')
  assertContains(skill, /## Profile/, 'SKILL.md 必须包含 Profile section')
  assertContains(skill, /严苛且务实的 Node\.js 后端架构师/, 'SKILL.md 必须明确角色职责')
  assertContains(skill, /核心架构纪律/, 'SKILL.md 必须覆盖核心架构纪律')
  assertContains(skill, /Feature-First/, 'SKILL.md 必须覆盖 Feature-First 目录组织')
  assertContains(skill, /Dependency Inversion/, 'SKILL.md 必须覆盖依赖倒置')
  assertContains(skill, /Transport -> Application -> Domain/, 'SKILL.md 必须覆盖静态依赖方向')
  assertContains(skill, /Composition Root/, 'SKILL.md 必须覆盖装配入口')
  assertContains(skill, /Infrastructure.*Application.*Domain.*Port\/Adapter/s, 'SKILL.md 必须覆盖 Infrastructure 通过端口适配')
  assertContains(skill, /业务 Helper 默认必须留在 Feature 模块内部/, 'SKILL.md 必须覆盖 Utility 收敛防腐')
  assertContains(skill, /Error Boundary/, 'SKILL.md 必须覆盖统一错误边界')
  assertContains(skill, /Contract Boundary/, 'SKILL.md 必须覆盖外部契约边界')
  assertContains(skill, /SSOT/, 'SKILL.md 必须覆盖契约单一规则源')
  assertContains(skill, /z\.infer/, 'SKILL.md 必须覆盖由 schema 推导 TypeScript 类型')
  assertContains(skill, /绝对禁止手写同名 Interface/, 'SKILL.md 必须禁止 schema 和 interface 双写漂移')
  assertContains(skill, /不应强制从 Transport Schema 推导/, 'SKILL.md 必须声明业务语义类型不强制从 Transport Schema 推导')
  assertContains(skill, /失败显性化/, 'SKILL.md 必须覆盖失败显性化')
  assertContains(skill, /UseCase 级事务/, 'SKILL.md 必须覆盖 UseCase 级事务边界')
  assertContains(skill, /Knex\.Transaction/, 'SKILL.md 必须禁止 Knex 事务句柄泄漏')
  assertContains(skill, /Prisma\.TransactionClient/, 'SKILL.md 必须禁止 Prisma 事务句柄泄漏')
  assertContains(skill, /EntityManager/, 'SKILL.md 必须禁止 TypeORM 事务句柄泄漏')
  assertContains(skill, /UnitOfWork/, 'SKILL.md 必须覆盖 UnitOfWork 事务封装')
  assertContains(skill, /Outbox Pattern/, 'SKILL.md 必须覆盖 Outbox Pattern')
  assertContains(skill, /Async & Error Propagation|Async Error Propagation/, 'SKILL.md 必须覆盖异步错误传播')
  assertContains(skill, /Express 4/, 'SKILL.md 必须覆盖 Express 4 async handler 约束')
  assertContains(skill, /Express 5/, 'SKILL.md 必须覆盖 Express 5 Promise Rejection 语义')
  assertContains(skill, /asyncHandler/, 'SKILL.md 必须覆盖 Express asyncHandler 示例')
  assertContains(skill, /Promise Rejection/, 'SKILL.md 必须覆盖 Promise Rejection 转发')
  assertContains(skill, /Error Middleware/, 'SKILL.md 必须覆盖 Express Error Middleware')
  assertContains(skill, /setErrorHandler/, 'SKILL.md 必须覆盖 Fastify setErrorHandler')
  assertContains(skill, /Supertest/, 'SKILL.md 必须覆盖协议级集成测试')
  assertContains(skill, /Event Loop Unblocking/, 'SKILL.md 必须覆盖事件循环阻塞防护')
  assertContains(skill, /ReDoS/, 'SKILL.md 必须覆盖 ReDoS 风险')
  assertContains(skill, /Backpressure/, 'SKILL.md 必须覆盖 Backpressure')
  assertContains(skill, /worker_threads/, 'SKILL.md 必须覆盖 worker_threads 迁移路径')
  assertContains(skill, /Graceful Shutdown/, 'SKILL.md 必须覆盖优雅退出')
  assertContains(skill, /SIGINT\/SIGTERM/, 'SKILL.md 必须覆盖进程信号处理')
  assertContains(skill, /uncaughtException/, 'SKILL.md 必须覆盖 uncaughtException 处理')
  assertContains(skill, /unhandledRejection/, 'SKILL.md 必须覆盖 unhandledRejection 处理')
  assertContains(skill, /Helmet/, 'SKILL.md 必须覆盖 HTTP 安全头')
  assertContains(skill, /Rate Limiting/, 'SKILL.md 必须覆盖全局限流')
  assertContains(skill, /CORS 白名单/, 'SKILL.md 必须覆盖严格 CORS 策略')
  assertContains(skill, /Pino\/Winston|Pino|Winston/, 'SKILL.md 必须覆盖结构化日志库')
  assertContains(skill, /JSON 日志/, 'SKILL.md 必须覆盖 JSON 日志输出')
  assertContains(skill, /console\.log/, 'SKILL.md 必须禁止 console.log 拼接服务日志')
  assertContains(skill, /Redaction/, 'SKILL.md 必须覆盖日志脱敏规则')
  assertContains(skill, /PII/, 'SKILL.md 必须覆盖核心 PII 保护')
  assertContains(skill, /AsyncLocalStorage/, 'SKILL.md 必须覆盖异步上下文追踪')
  assertContains(skill, /工作流与交付契约/, 'SKILL.md 必须覆盖工作流与交付契约')
  assertContains(skill, /上下文分析/, 'SKILL.md 必须覆盖上下文分析')
  assertContains(skill, /定级与归位/, 'SKILL.md 必须覆盖目标分类归位')
  assertContains(skill, /执行验证/, 'SKILL.md 必须覆盖验证步骤')
  assertContains(skill, /FAIL > MISSING > NOT RUN > PASS/, 'SKILL.md 必须覆盖最终状态优先级')
  assertContains(skill, /`PASS`/, 'SKILL.md 必须约束 PASS 状态')
  assertContains(skill, /`FAIL`/, 'SKILL.md 必须约束 FAIL 状态')
  assertContains(skill, /`MISSING`/, 'SKILL.md 必须约束 MISSING 状态')
  assertContains(skill, /`NOT RUN`/, 'SKILL.md 必须约束 NOT RUN 状态')
  assertContains(skill, /Critical \/ Major \/ Minor/, 'SKILL.md 必须覆盖问题严重级别')

  printPass('node-code-standard self rules are valid')
}

function main() {
  const [command = 'self', ...args] = process.argv.slice(2)

  if (command === '--help' || command === '-h')
    return printHelp()

  if (command === 'self')
    return verifySelf()

  if (command === 'hoist')
    return scanHoistTarget(args)

  throw new Error(`未知命令：${command}，使用 --help 查看帮助`)
}

try {
  main()
}
catch (error) {
  console.error(`FAIL ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
}
