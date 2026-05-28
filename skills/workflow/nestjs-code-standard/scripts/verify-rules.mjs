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
  node scripts/verify-rules.mjs hoist --target src/shared/order-presenter.ts --uses src/modules/orders/controllers/orders.controller.ts src/modules/orders/application/create-order.service.ts src/modules/orders/infrastructure/persistence/typeorm-order.repository.ts
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

  printPass('nestjs hoist domain-boundary scan completed', {
    target: targetPath,
    sharedBoundary: ancestor,
    advisory: 'The boundary signal is mechanical only; review domain semantics before changing ownership.',
  })
}

function verifySelf() {
  const skill = readSkillFile('SKILL.md')

  assertContains(skill, /name: nestjs-code-standard/, 'SKILL.md 必须声明正确的 skill name')
  assertContains(skill, /用于新建、编写、重构、拆分、优化、评审或校验 NestJS 后端代码/, 'SKILL.md 必须声明完整触发场景')
  assertContains(skill, /# Role: 资深 NestJS 后端架构师/, 'SKILL.md 必须使用 Role 标题')
  assertContains(skill, /## Profile/, 'SKILL.md 必须包含 Profile section')
  assertContains(skill, /唯一规则源/, 'SKILL.md 必须声明唯一规则源')
  assertContains(skill, /不要跳转到仓库中的其它 project skills/, 'SKILL.md 必须声明不依赖其它 project skills')
  assertContains(skill, /Contract First.*契约优先/s, 'SKILL.md 必须覆盖 Contract First')
  assertContains(skill, /Fail Fast.*失败显性/s, 'SKILL.md 必须覆盖 Fail Fast')
  assertContains(skill, /Constructor Injection.*构造函数注入/s, 'SKILL.md 必须覆盖构造函数注入')
  assertContains(skill, /Architecture Smell Is Failure Within Current Scope/, 'SKILL.md 必须覆盖当前任务范围内异味即失败')
  assertContains(skill, /@ApiProperty.*@ApiPropertyOptional/s, 'SKILL.md 必须覆盖 OpenAPI DTO 契约')
  assertContains(skill, /@ApiOperation.*@ApiResponse/s, 'SKILL.md 必须覆盖 OpenAPI Controller 契约')
  // Keep NestJS hard red lines from regressing silently.
  assertContains(skill, /ValidationPipe/, 'SKILL.md 必须覆盖 ValidationPipe')
  assertContains(skill, /whitelist: true/, 'SKILL.md 必须强制 whitelist')
  assertContains(skill, /forbidNonWhitelisted: true/, 'SKILL.md 必须强制 forbidNonWhitelisted')
  assertContains(skill, /transform: true/, 'SKILL.md 必须强制 transform')
  assertContains(skill, /Payload Pollution/, 'SKILL.md 必须覆盖 Payload Pollution')
  assertContains(skill, /Query 安全边界/, 'SKILL.md 必须覆盖 Query 安全边界')
  assertContains(skill, /Allowlist/, 'SKILL.md 必须覆盖排序字段白名单')
  assertContains(skill, /class-validator/, 'SKILL.md 必须覆盖 class-validator')
  assertContains(skill, /Zod/, 'SKILL.md 必须覆盖成熟 schema 工具')
  assertContains(skill, /Default Deny Serialization/, 'SKILL.md 必须覆盖默认拒绝序列化')
  assertContains(skill, /ClassSerializerInterceptor/, 'SKILL.md 必须约束 ClassSerializerInterceptor')
  assertContains(skill, /@Expose\(\)/, 'SKILL.md 必须覆盖响应字段显式暴露策略')
  assertContains(skill, /plainToInstance/, 'SKILL.md 必须覆盖响应 DTO 实例化')
  assertContains(skill, /excludeExtraneousValues/, 'SKILL.md 必须覆盖响应字段白名单映射')
  assertContains(skill, /Transaction Anti-Corruption Layer/, 'SKILL.md 必须覆盖事务防腐层')
  assertContains(skill, /EntityManager/, 'SKILL.md 必须限制 EntityManager 泄漏')
  assertContains(skill, /QueryRunner/, 'SKILL.md 必须限制 QueryRunner 泄漏')
  assertContains(skill, /TransactionClient/, 'SKILL.md 必须限制 TransactionClient 泄漏')
  assertContains(skill, /UnitOfWork/, 'SKILL.md 必须覆盖 UnitOfWork')
  assertContains(skill, /Transactional Outbox/, 'SKILL.md 必须覆盖 Transactional Outbox')
  assertContains(skill, /Saga/, 'SKILL.md 必须覆盖 Saga')
  assertContains(skill, /Process Manager/, 'SKILL.md 必须覆盖 Process Manager')
  assertContains(skill, /outbox\.append/, 'SKILL.md 必须示例只写 Outbox')
  assertContains(skill, /Scope\.REQUEST/, 'SKILL.md 必须禁用 Scope.REQUEST 滥用')
  assertContains(skill, /REQUEST/, 'SKILL.md 必须禁用 REQUEST 注入滥用')
  assertContains(skill, /AsyncLocalStorage/, 'SKILL.md 必须覆盖 AsyncLocalStorage')
  assertContains(skill, /RequestContext/, 'SKILL.md 必须覆盖统一 RequestContext')
  assertContains(skill, /forwardRef\(\)/, 'SKILL.md 必须限制 forwardRef')
  assertContains(skill, /DataLoader/, 'SKILL.md 必须覆盖 GraphQL DataLoader 请求隔离')
  assertContains(skill, /Authentication/, 'SKILL.md 必须覆盖认证边界')
  assertContains(skill, /Authorization/, 'SKILL.md 必须覆盖授权边界')
  assertContains(skill, /Tenant-scoped data/, 'SKILL.md 必须覆盖租户隔离')
  assertContains(skill, /process\.env/, 'SKILL.md 必须禁止业务代码直接读取 process.env')
  assertContains(skill, /Typed Config Provider/, 'SKILL.md 必须覆盖 Typed Config Provider')
  assertContains(skill, /Exception Filter/, 'SKILL.md 必须覆盖异常映射 Filter')
  assertContains(skill, /cause/, 'SKILL.md 必须覆盖错误 cause 上下文')
  assertContains(skill, /@nestjs\/cqrs/, 'SKILL.md 必须覆盖官方 CQRS 生态')
  assertContains(skill, /Application Command\/Query Object/, 'SKILL.md 必须区分 Application Command/Query 与 HTTP DTO')
  assertContains(skill, /Domain Service.*@Injectable\(\)/, 'SKILL.md 必须覆盖 Domain Service DI 折中')
  assertContains(skill, /Testcontainers/, 'SKILL.md 必须覆盖真实依赖集成测试')
  assertContains(skill, /E2E Contract Test/, 'SKILL.md 必须覆盖 E2E 契约测试')
  assertContains(skill, /forbidden tenant access/, 'SKILL.md 必须覆盖跨租户越权负例')
  assertContains(skill, /目标分类/, 'SKILL.md 必须包含评审目标分类')
  assertContains(skill, /`PASS` \| `FAIL` \| `MISSING` \| `NOT RUN` \| `N\/A`/, 'SKILL.md 必须约束评审总结论状态')
  assertContains(skill, /关键验证为 `FAIL`、`MISSING` 或 `NOT RUN`.*不得写为 `PASS`/, 'SKILL.md 必须禁止关键验证缺失时整体 PASS')
  assertContains(skill, /验证结果/, 'SKILL.md 必须要求验证结果')
  assertContains(skill, /FAIL > MISSING > NOT RUN > PASS/, 'SKILL.md 必须声明交付状态优先级')
  assertContains(skill, /Review Checklist/, 'SKILL.md 必须包含 Review Checklist')
  assertContains(skill, /## 四、核心代码规范示例/, 'SKILL.md 必须包含示例 section')
  assertContains(skill, /## 七、自校验脚本/, 'SKILL.md 必须包含自校验脚本 section')
  assertContains(skill, /scripts\/verify-rules\.mjs/, 'SKILL.md 必须索引自校验脚本')
  assertContains(skill, /Token 检查/, 'SKILL.md 必须覆盖 Token 检查')
  assertContains(skill, /AST/, 'SKILL.md 必须提及 AST 级规则扩展')
  assertContains(skill, /\[HOIST_BOUNDARY_RISK\]/, 'SKILL.md 必须覆盖共享边界风险扫描')

  printPass('nestjs-code-standard self rules are valid')
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
