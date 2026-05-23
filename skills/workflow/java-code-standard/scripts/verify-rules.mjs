#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Resolve the skill root once so all file checks stay anchored to this skill package.
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
  --target <path>             指定抽离目标 package
  --uses <path1> <path2> ...  指定至少 2 个使用点路径

示例:
  node scripts/verify-rules.mjs
  node scripts/verify-rules.mjs hoist --target src/main/java/com/example/order/shared --uses src/main/java/com/example/order/create/CreateOrderService.java src/main/java/com/example/order/update/UpdateOrderService.java
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

  printPass('java hoist domain-boundary scan completed', {
    target: targetPath,
    sharedBoundary: ancestor,
    advisory: 'The boundary signal is mechanical only; review domain semantics before changing ownership.',
  })
}

function verifySelf() {
  const skill = readSkillFile('SKILL.md')

  assertContains(skill, /用于新建、编写、重构、拆分、优化、评审或校验 Java\/Spring Boot 后端代码/, 'SKILL.md 必须声明完整触发场景')
  assertContains(skill, /Java/, 'SKILL.md 必须覆盖 Java')
  assertContains(skill, /Spring Boot/, 'SKILL.md 必须覆盖 Spring Boot')
  assertContains(skill, /Maven/, 'SKILL.md 必须覆盖 Maven')
  assertContains(skill, /Gradle/, 'SKILL.md 必须覆盖 Gradle')
  assertContains(skill, /唯一规则源/, 'SKILL.md 必须声明唯一规则源')
  assertContains(skill, /## 示例/, 'SKILL.md 必须包含示例 section')
  assertContains(skill, /## 检查清单/, 'SKILL.md 必须包含检查清单 section')
  assertContains(skill, /## 自校验脚本/, 'SKILL.md 必须包含自校验脚本 section')
  assertContains(skill, /src\/main\/java\/com\/example\/order\//, 'SKILL.md 必须包含 Spring Boot 结构示例')
  assertContains(skill, /record CreateOrderRequest/, 'SKILL.md 必须包含 request/response 示例')
  assertContains(skill, /@ConfigurationProperties/, 'SKILL.md 必须包含配置绑定示例')
  assertContains(skill, /目标分类：`application-module`/, 'SKILL.md 必须包含评审示例目标分类')
  assertContains(skill, /总结论：`FAIL`/, 'SKILL.md 必须包含评审示例总结论')
  assertContains(skill, /构造函数注入/, 'SKILL.md 必须覆盖构造函数注入')
  assertContains(skill, /按领域边界提升/, 'SKILL.md 必须覆盖按领域边界提升')
  assertContains(skill, /Bean Validation/, 'SKILL.md 必须覆盖 Bean Validation')
  assertContains(skill, /ControllerAdvice/, 'SKILL.md 必须覆盖 ControllerAdvice')
  assertContains(skill, /ProblemDetail/, 'SKILL.md 必须覆盖 ProblemDetail 统一错误响应')
  assertContains(skill, /HTTP 200 包装业务错误码/, 'SKILL.md 必须覆盖 HTTP 200 业务错误码约束')
  assertContains(skill, /System\.out/, 'SKILL.md 必须覆盖禁止 System.out')
  assertContains(skill, /e\.printStackTrace\(\)/, 'SKILL.md 必须覆盖禁止 e.printStackTrace')
  assertContains(skill, /SLF4J/, 'SKILL.md 必须覆盖统一日志接口')
  assertContains(skill, /MDC\/TraceId/, 'SKILL.md 必须覆盖 MDC/TraceId 追踪上下文')
  assertContains(skill, /OrderRepositoryAdapter/, 'SKILL.md 必须覆盖持久化适配器命名')
  assertContains(skill, /OrderJpaEntity/, 'SKILL.md 必须覆盖 JPA 实体命名')
  assertContains(skill, /OrderSpringDataRepository/, 'SKILL.md 必须覆盖 Spring Data 仓储命名')
  assertContains(skill, /ArchUnit/, 'SKILL.md 必须覆盖 Architecture Tests')
  assertContains(skill, /Testcontainers/, 'SKILL.md 必须覆盖 Testcontainers')
  assertContains(skill, /Flyway/, 'SKILL.md 必须覆盖 Flyway')
  assertContains(skill, /Liquibase/, 'SKILL.md 必须覆盖 Liquibase')
  assertContains(skill, /scripts\/verify-rules\.mjs/, 'SKILL.md 必须声明自带验证脚本')
  assertContains(skill, /不得用仓库根级共享脚本替代/, 'SKILL.md 必须声明不得用仓库根级共享脚本替代')
  assertContains(skill, /jakarta\.validation/, 'SKILL.md 必须覆盖 jakarta.validation')
  assertContains(skill, /Flyway 或 Liquibase/, 'SKILL.md 必须覆盖迁移工具')
  assertContains(skill, /领域边界/, 'SKILL.md 必须覆盖领域边界提升')
  assertContains(skill, /\[HOIST_WARNING\]/, 'SKILL.md 必须覆盖共享边界风险扫描')

  printPass('java-code-standard self rules are valid')
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
