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
  assertContains(skill, /触发时机：当用户要求新建、编写、重构、拆分、优化、评审 NestJS 后端代码时触发/, 'SKILL.md 必须声明用户给定的触发时机')
  assertContains(skill, /# NestJS 工程架构与代码规范/, 'SKILL.md 必须使用用户给定的规范标题')
  assertContains(skill, /唯一规则源/, 'SKILL.md 必须声明唯一规则源')

  assertContains(skill, /## 一、 输入防腐与安全边界/, 'SKILL.md 必须包含输入防腐与安全边界章节')
  assertContains(skill, /ValidationPipe/, 'SKILL.md 必须覆盖 ValidationPipe')
  assertContains(skill, /whitelist: true/, 'SKILL.md 必须强制 whitelist')
  assertContains(skill, /forbidNonWhitelisted: true/, 'SKILL.md 必须强制 forbidNonWhitelisted')
  assertContains(skill, /transform: true/, 'SKILL.md 必须强制 transform')
  assertContains(skill, /DTO 纯洁性/, 'SKILL.md 必须覆盖 DTO 纯洁性')
  assertContains(skill, /`any`/, 'SKILL.md 必须禁止 any')
  assertContains(skill, /Record<string, any>/, 'SKILL.md 必须禁止 Record<string, any>')
  assertContains(skill, /分页最大上限/, 'SKILL.md 必须覆盖分页最大上限')
  assertContains(skill, /排序字段白名单/, 'SKILL.md 必须覆盖排序字段白名单')
  assertContains(skill, /Tenant-scoped/, 'SKILL.md 必须覆盖租户隔离')
  assertContains(skill, /tenantId/, 'SKILL.md 必须声明 tenantId 服务端可信来源')

  assertContains(skill, /## 二、 核心架构与事务防腐/, 'SKILL.md 必须包含核心架构与事务防腐章节')
  assertContains(skill, /Controller/, 'SKILL.md 必须覆盖 Controller 边界')
  assertContains(skill, /Application/, 'SKILL.md 必须覆盖 Application 边界')
  assertContains(skill, /Domain/, 'SKILL.md 必须覆盖 Domain 边界')
  assertContains(skill, /Infrastructure/, 'SKILL.md 必须覆盖 Infrastructure 边界')
  assertContains(skill, /@Injectable\(\)/, 'SKILL.md 必须覆盖 Domain Service 的 Injectable 例外')
  assertContains(skill, /EntityManager/, 'SKILL.md 必须限制 EntityManager 泄漏')
  assertContains(skill, /QueryRunner/, 'SKILL.md 必须限制 QueryRunner 泄漏')
  assertContains(skill, /UnitOfWork/, 'SKILL.md 必须覆盖 UnitOfWork')
  assertContains(skill, /Transactional Outbox/, 'SKILL.md 必须覆盖 Transactional Outbox')

  assertContains(skill, /## 三、 依赖注入与作用域安全/, 'SKILL.md 必须包含依赖注入与作用域安全章节')
  assertContains(skill, /构造函数/, 'SKILL.md 必须要求构造函数注入')
  assertContains(skill, /Scope\.REQUEST/, 'SKILL.md 必须禁用 Scope.REQUEST 滥用')
  assertContains(skill, /REQUEST/, 'SKILL.md 必须禁用 REQUEST 注入滥用')
  assertContains(skill, /AsyncLocalStorage/, 'SKILL.md 必须覆盖 AsyncLocalStorage')
  assertContains(skill, /RequestContext/, 'SKILL.md 必须覆盖统一 RequestContext')
  assertContains(skill, /forwardRef\(\)/, 'SKILL.md 必须限制 forwardRef')

  assertContains(skill, /## 四、 序列化脱敏与错误映射/, 'SKILL.md 必须包含序列化脱敏与错误映射章节')
  assertContains(skill, /默认拒绝序列化/, 'SKILL.md 必须覆盖默认拒绝序列化')
  assertContains(skill, /plainToInstance/, 'SKILL.md 必须覆盖响应 DTO 实例化')
  assertContains(skill, /excludeExtraneousValues/, 'SKILL.md 必须覆盖响应字段白名单映射')
  assertContains(skill, /@Expose\(\)/, 'SKILL.md 必须覆盖响应字段显式暴露策略')
  assertContains(skill, /process\.env/, 'SKILL.md 必须禁止业务代码直接读取 process.env')
  assertContains(skill, /Config Provider/, 'SKILL.md 必须覆盖强类型 Config Provider')
  assertContains(skill, /Exception Filter/, 'SKILL.md 必须覆盖异常映射 Filter')
  assertContains(skill, /cause/, 'SKILL.md 必须覆盖错误 cause 上下文')

  assertContains(skill, /## 五、 强制验证与交付动作/, 'SKILL.md 必须包含强制验证与交付动作章节')
  assertContains(skill, /node scripts\/verify-rules\.mjs/, 'SKILL.md 必须要求执行自检脚本')
  assertContains(skill, /### 代码合规自校验报告/, 'SKILL.md 必须包含用户给定的自校验报告模板')
  assertContains(skill, /输入防御/, 'SKILL.md 必须覆盖输入防御报告项')
  assertContains(skill, /依赖与容器/, 'SKILL.md 必须覆盖依赖与容器报告项')
  assertContains(skill, /事务防腐/, 'SKILL.md 必须覆盖事务防腐报告项')
  assertContains(skill, /显式脱敏/, 'SKILL.md 必须覆盖显式脱敏报告项')
  assertContains(skill, /测试覆盖/, 'SKILL.md 必须覆盖测试覆盖报告项')
  assertContains(skill, /Status: PASS \/ FAIL \/ MISSING \/ NOT RUN/, 'SKILL.md 必须声明脚本执行状态枚举')
  assertContains(skill, /评审异常点/, 'SKILL.md 必须包含评审异常点模板')
  assertContains(skill, /Critical\/Major\/Minor/, 'SKILL.md 必须包含异常级别枚举')

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
