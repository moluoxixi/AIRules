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
  assertContains(skill, /契约优先/, 'SKILL.md 必须覆盖契约优先')
  assertContains(skill, /失败显性/, 'SKILL.md 必须覆盖失败显性')
  assertContains(skill, /边界清晰/, 'SKILL.md 必须覆盖边界清晰')
  assertContains(skill, /校验前置/, 'SKILL.md 必须覆盖校验前置')
  assertContains(skill, /依赖显式/, 'SKILL.md 必须覆盖依赖显式')
  assertContains(skill, /异步可追踪/, 'SKILL.md 必须覆盖异步可追踪')
  assertContains(skill, /Awilix/, 'SKILL.md 必须覆盖复杂依赖树的 DI 容器建议')
  assertContains(skill, /事务收敛/, 'SKILL.md 必须覆盖事务收敛')
  assertContains(skill, /持久化封装/, 'SKILL.md 必须覆盖持久化封装')
  assertContains(skill, /按领域边界提升/, 'SKILL.md 必须覆盖按领域边界提升')
  assertContains(skill, /目标分类/, 'SKILL.md 必须包含评审目标分类')
  assertContains(skill, /总结论只能使用 `PASS`、`FAIL`、`MISSING`、`NOT RUN` 或 `N\/A`/, 'SKILL.md 必须约束评审总结论状态')
  assertContains(skill, /## 示例/, 'SKILL.md 必须包含示例 section')
  assertContains(skill, /## 检查清单/, 'SKILL.md 必须包含检查清单 section')
  assertContains(skill, /## 自校验脚本/, 'SKILL.md 必须包含自校验脚本 section')
  assertContains(skill, /src\/modules\/orders\//, 'SKILL.md 必须包含模块结构示例')
  assertContains(skill, /FastifyInstance/, 'SKILL.md 必须包含路由装配示例')
  assertContains(skill, /zod/, 'SKILL.md 必须覆盖运行时契约示例')
  assertContains(skill, /return reply\.code\(201\)\.send\(orderPresenter\.toResponse\(result\)\)/, 'SKILL.md 必须显式返回 Fastify reply')
  assertContains(skill, /Service 只做用例编排与事务边界/, 'SKILL.md 必须覆盖 application service 边界')
  assertContains(skill, /repository 负责持久化访问和映射/, 'SKILL.md 必须覆盖 repository 边界')
  assertContains(skill, /目标分类：`application-module`/, 'SKILL.md 必须包含评审示例目标分类')
  assertContains(skill, /总结论：`FAIL`/, 'SKILL.md 必须包含评审示例总结论')
  assertContains(skill, /schema 方案/, 'SKILL.md 必须覆盖检查清单中的运行时契约')
  assertContains(skill, /构造参数、工厂参数或模块装配/, 'SKILL.md 必须覆盖显式依赖注入')
  assertContains(skill, /SIGINT\/SIGTERM/, 'SKILL.md 必须覆盖进程信号与优雅退出')
  assertContains(skill, /Graceful Shutdown/, 'SKILL.md 必须覆盖优雅退出')
  assertContains(skill, /防阻塞主线程/, 'SKILL.md 必须覆盖主线程阻塞防护')
  assertContains(skill, /worker_threads/, 'SKILL.md 必须覆盖 worker_threads 迁移路径')
  assertContains(skill, /AsyncLocalStorage/, 'SKILL.md 必须覆盖异步上下文追踪')
  assertContains(skill, /uncaughtException/, 'SKILL.md 必须覆盖 uncaughtException 处理')
  assertContains(skill, /unhandledRejection/, 'SKILL.md 必须覆盖 unhandledRejection 处理')
  assertContains(skill, /事务要求/, 'SKILL.md 必须覆盖事务要求')
  assertContains(skill, /\[HOIST_WARNING\]/, 'SKILL.md 必须覆盖共享边界风险扫描')
  assertContains(skill, /process\.env/, 'SKILL.md 必须覆盖环境配置校验')
  assertContains(skill, /Prisma Migrate|Drizzle Kit|Knex migration|TypeORM migration|Sequelize migration/, 'SKILL.md 必须覆盖迁移工具')

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
