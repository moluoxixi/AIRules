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

function createHoistBoundaryError(message, details) {
  // Hoist risk signals are explicit failures so automated checks cannot report a risky scan as PASS.
  const detailLines = Object.entries(details)
    .map(([key, value]) => `${key}: ${value}`)
    .join('\n')

  return new Error(`[HOIST_BOUNDARY_RISK] ${message}\n${detailLines}`)
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

// Use the mechanical boundary as an explicit failure signal; semantic ownership still needs human review.
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
    throw createHoistBoundaryError('抽离目标不在允许的共享边界内，请人工确认它是否应该进入全局共享层或独立共享包', {
      target: targetPath,
      sharedBoundary: ancestor,
    })
  }
  else if (targetSegments.length !== ancestorSegments.length + 1) {
    throw createHoistBoundaryError('抽离目标位于更深层级，请人工确认它是否应留在局部业务内部，或者提升到全局共享层', {
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
  assertContains(skill, /触发时机：当用户要求新建、编写、重构、拆分、优化、评审非 NestJS 的 Node\.js\/TypeScript 后端代码时触发/, 'SKILL.md 必须声明用户给定的触发场景')
  assertContains(skill, /# Node\.js 后端工程架构与代码规范/, 'SKILL.md 必须使用用户给定的标题')
  assertContains(skill, /分层架构与防腐红线/, 'SKILL.md 必须覆盖分层架构与防腐红线')
  assertContains(skill, /依赖倒置/, 'SKILL.md 必须覆盖依赖倒置')
  assertContains(skill, /Domain.*HTTP 框架.*ORM.*SDK/s, 'SKILL.md 必须禁止 Domain 依赖基础设施')
  assertContains(skill, /Infrastructure.*封装数据库和 SDK/s, 'SKILL.md 必须约束 Infrastructure 责任')
  assertContains(skill, /Transport 层 \(Router\/Controller\)/, 'SKILL.md 必须覆盖 Transport 层职责')
  assertContains(skill, /严禁在此直接编写业务逻辑或操作数据库/, 'SKILL.md 必须禁止 Transport 层写业务或数据库逻辑')
  assertContains(skill, /Application 层 \(UseCase\)/, 'SKILL.md 必须覆盖 Application 层职责')
  assertContains(skill, /req.*res.*reply/s, 'SKILL.md 必须禁止向 Application 层透传 HTTP 对象')
  assertContains(skill, /禁止垃圾桶/, 'SKILL.md 必须覆盖 shared utils 防腐')
  assertContains(skill, /契约边界与强类型安全/, 'SKILL.md 必须覆盖契约边界与强类型安全')
  assertContains(skill, /Schema 唯一真实源/, 'SKILL.md 必须覆盖 Schema 唯一真实源')
  assertContains(skill, /Zod.*TypeBox/s, 'SKILL.md 必须覆盖成熟 Schema 工具')
  assertContains(skill, /z\.infer/, 'SKILL.md 必须覆盖由 schema 推导 TypeScript 类型')
  assertContains(skill, /严禁手写同名 Interface/, 'SKILL.md 必须禁止 schema 和 interface 双写漂移')
  assertContains(skill, /校验边界隔离/, 'SKILL.md 必须覆盖校验边界隔离')
  assertContains(skill, /typeof/, 'SKILL.md 必须禁止内部重复防御性类型判断')
  assertContains(skill, /领域纯粹性/, 'SKILL.md 必须覆盖领域纯粹性')
  assertContains(skill, /禁止直接复用或被迫继承自 Transport 层的 Schema 推导类型/, 'SKILL.md 必须禁止领域类型继承 Transport Schema')
  assertContains(skill, /事务与错误传播/, 'SKILL.md 必须覆盖事务与错误传播')
  assertContains(skill, /事务防腐/, 'SKILL.md 必须覆盖事务防腐')
  assertContains(skill, /Knex\.Transaction/, 'SKILL.md 必须禁止 Knex 事务句柄泄漏')
  assertContains(skill, /Prisma\.TransactionClient/, 'SKILL.md 必须禁止 Prisma 事务句柄泄漏')
  assertContains(skill, /EntityManager/, 'SKILL.md 必须禁止 TypeORM 事务句柄泄漏')
  assertContains(skill, /UnitOfWork/, 'SKILL.md 必须覆盖 UnitOfWork 事务封装')
  assertContains(skill, /AsyncLocalStorage/, 'SKILL.md 必须覆盖 AsyncLocalStorage')
  assertContains(skill, /长事务隔离/, 'SKILL.md 必须覆盖长事务隔离')
  assertContains(skill, /Outbox 模式/, 'SKILL.md 必须覆盖 Outbox 模式')
  assertContains(skill, /框架级错误传播/, 'SKILL.md 必须覆盖框架级错误传播')
  assertContains(skill, /Express 4 降级防线/, 'SKILL.md 必须覆盖 Express 4 async handler 约束')
  assertContains(skill, /asyncHandler/, 'SKILL.md 必须覆盖 Express asyncHandler 示例')
  assertContains(skill, /Promise Rejection/, 'SKILL.md 必须覆盖 Promise Rejection 转发')
  assertContains(skill, /Fastify 全局收口/, 'SKILL.md 必须覆盖 Fastify 错误收口')
  assertContains(skill, /setErrorHandler/, 'SKILL.md 必须覆盖 Fastify setErrorHandler')
  assertContains(skill, /Global Error Middleware/, 'SKILL.md 必须覆盖 Express Global Error Middleware')
  assertContains(skill, /伪装的 200\/成功状态/, 'SKILL.md 必须禁止吞错后返回伪成功')
  assertContains(skill, /运行时性能与安全底线/, 'SKILL.md 必须覆盖运行时性能与安全底线')
  assertContains(skill, /Event Loop 保护/, 'SKILL.md 必须覆盖事件循环保护')
  assertContains(skill, /ReDoS/, 'SKILL.md 必须覆盖 ReDoS 风险')
  assertContains(skill, /Graceful Shutdown/, 'SKILL.md 必须覆盖优雅退出')
  assertContains(skill, /SIGINT\/SIGTERM/, 'SKILL.md 必须覆盖进程信号处理')
  assertContains(skill, /数据库\/Redis 连接/, 'SKILL.md 必须覆盖数据库和 Redis 连接释放')
  assertContains(skill, /ALS 传递/, 'SKILL.md 必须覆盖 ALS 传递')
  assertContains(skill, /强制验证与交付动作/, 'SKILL.md 必须覆盖强制验证与交付动作')
  assertContains(skill, /执行自校验/, 'SKILL.md 必须覆盖执行自校验')
  assertContains(skill, /lint.*typecheck/s, 'SKILL.md 必须要求尝试 lint 或 typecheck')
  assertContains(skill, /代码合规自校验报告/, 'SKILL.md 必须包含用户给定的交付模板')
  assertContains(skill, /执行结果 \(Status: PASS \/ FAIL \/ MISSING \/ NOT RUN\)/, 'SKILL.md 必须覆盖四类执行状态')
  assertContains(skill, /评审异常点/, 'SKILL.md 必须覆盖评审异常点')
  assertContains(skill, /Critical\/Major\/Minor/, 'SKILL.md 必须覆盖问题严重级别')

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
  console.error(`FAIL ${error.message}`)
  process.exitCode = 1
}
