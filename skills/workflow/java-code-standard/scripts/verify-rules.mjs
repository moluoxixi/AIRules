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
  --target <path>             指定抽离目标 package
  --uses <path1> <path2> ...  指定至少 2 个使用点路径

示例:
  cd skills/workflow/java-code-standard
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

  printPass('java hoist domain-boundary scan completed', {
    target: targetPath,
    sharedBoundary: ancestor,
    advisory: 'The boundary signal is mechanical only; review domain semantics before changing ownership.',
  })
}

function verifySelf() {
  const skill = readSkillFile('SKILL.md')

  assertContains(skill, /name: java-code-standard/, 'SKILL.md 必须保持 java-code-standard 名称')
  assertContains(skill, /触发时机：当用户要求新建、编写、重构、拆分、优化、评审或校验 Java\/Spring Boot 后端代码时触发/, 'SKILL.md 必须声明完整触发场景')
  assertContains(skill, /# Java & Spring Boot 工程架构与代码规范/, 'SKILL.md 必须使用 Java 规范标题')
  assertContains(skill, /当前任务目标与改动范围内严格遵守/, 'SKILL.md 必须限定任务范围')
  assertContains(skill, /本文件是唯一规则源/, 'SKILL.md 必须声明唯一规则源')
  assertContains(skill, /Java/, 'SKILL.md 必须覆盖 Java')
  assertContains(skill, /Spring Boot/, 'SKILL.md 必须覆盖 Spring Boot')
  assertContains(skill, /## 一、核心架构与设计纪律/, 'SKILL.md 必须包含核心架构 section')
  assertContains(skill, /## 二、Spring Boot 框架强制约束/, 'SKILL.md 必须包含 Spring Boot section')
  assertContains(skill, /## 三、数据与持久化契约 \(JPA\/Hibernate\)/, 'SKILL.md 必须包含 JPA/Hibernate section')
  assertContains(skill, /## 四、强制验证与交付动作 \(Mandatory Actions\)/, 'SKILL.md 必须包含交付动作 section')
  assertContains(skill, /domain.*org\.springframework/, 'SKILL.md 必须声明 domain 与 Spring 隔离')
  assertContains(skill, /domain.*jakarta\.persistence/, 'SKILL.md 必须声明 domain 与 JPA 隔离')
  assertContains(skill, /拆分领域模型与持久化实体/, 'SKILL.md 必须说明旧 JPA domain 模型的拆分语义')
  assertContains(skill, /严禁 `domain` 依赖 `infrastructure`/, 'SKILL.md 必须禁止 domain 依赖 infrastructure')
  assertContains(skill, /全局 `utils` 目录/, 'SKILL.md 必须禁止无语义全局 utils')
  assertContains(skill, /Map/, 'SKILL.md 必须禁止宽泛 Map 契约')
  assertContains(skill, /裸 `JSON`/, 'SKILL.md 必须禁止裸 JSON 契约')
  assertContains(skill, /Object/, 'SKILL.md 必须禁止 Object 契约')
  assertContains(skill, /List\.copyOf\(\)/, 'SKILL.md 必须覆盖集合防泄漏复制')
  assertContains(skill, /Collections\.unmodifiableList\(\)/, 'SKILL.md 必须覆盖领域集合不可变视图')
  assertContains(skill, /java\.util\.Date/, 'SKILL.md 必须禁用 java.util.Date')
  assertContains(skill, /Calendar/, 'SKILL.md 必须禁用 Calendar')
  assertContains(skill, /java\.sql\.Timestamp/, 'SKILL.md 必须禁用 java.sql.Timestamp')
  assertContains(skill, /java\.time/, 'SKILL.md 必须强制使用 java.time')
  assertContains(skill, /@Autowired/, 'SKILL.md 必须覆盖禁止 @Autowired 字段注入')
  assertContains(skill, /final/, 'SKILL.md 必须要求依赖 final')
  assertContains(skill, /@Valid/, 'SKILL.md 必须覆盖 @Valid')
  assertContains(skill, /@Validated/, 'SKILL.md 必须覆盖 @Validated')
  assertContains(skill, /this\.xxx\(\)/, 'SKILL.md 必须禁止 this.xxx() 事务自调用')
  assertContains(skill, /AopContext\.currentProxy\(\)/, 'SKILL.md 必须禁止 AopContext.currentProxy() 绕行')
  assertContains(skill, /@Transactional\(readOnly = true\)/, 'SKILL.md 必须覆盖查询只读事务')
  assertContains(skill, /Dirty Checking/, 'SKILL.md 必须说明 Hibernate Dirty Checking 开销')
  assertContains(skill, /OSIV/, 'SKILL.md 必须覆盖 OSIV')
  assertContains(skill, /spring\.jpa\.open-in-view: false/, 'SKILL.md 必须强制关闭 OSIV')
  assertContains(skill, /循环体内执行 SQL/, 'SKILL.md 必须禁止循环 SQL')
  assertContains(skill, /@EntityGraph/, 'SKILL.md 必须覆盖 JPA EntityGraph')
  assertContains(skill, /JOIN FETCH/, 'SKILL.md 必须覆盖 JOIN FETCH')
  assertContains(skill, /Projection/, 'SKILL.md 必须覆盖 DTO Projection')
  assertContains(skill, /@Data/, 'SKILL.md 必须覆盖 JPA Entity 禁用 Lombok @Data')
  assertContains(skill, /@EqualsAndHashCode/, 'SKILL.md 必须覆盖 JPA Entity 禁用 Lombok @EqualsAndHashCode')
  assertContains(skill, /@ToString/, 'SKILL.md 必须覆盖 JPA Entity 禁用 Lombok @ToString')
  assertContains(skill, /Business Key/, 'SKILL.md 必须覆盖 JPA Entity equals/hashCode 业务唯一键')
  assertContains(skill, /Repository 仅限持久化存取/, 'SKILL.md 必须约束 Repository 职责')
  assertContains(skill, /### 代码合规自校验报告/, 'SKILL.md 必须包含代码合规自校验报告模板')
  assertContains(skill, /### 脚本执行结果 \(Status: PASS \/ FAIL \/ MISSING \/ NOT RUN\)/, 'SKILL.md 必须包含脚本状态模板')
  assertContains(skill, /### 评审异常点/, 'SKILL.md 必须包含评审异常点模板')
  assertContains(skill, /scripts\/verify-rules\.mjs/, 'SKILL.md 必须声明自带验证脚本')
  assertContains(skill, /不得用 Skill 自检脚本替代目标项目自身/, 'SKILL.md 必须禁止用 skill 自检替代项目测试')
  assertContains(skill, /MISSING/, 'SKILL.md 必须覆盖 MISSING 状态')
  assertContains(skill, /NOT RUN/, 'SKILL.md 必须覆盖 NOT RUN 状态')
  assertContains(skill, /PASS/, 'SKILL.md 必须覆盖 PASS 状态')
  assertContains(skill, /FAIL/, 'SKILL.md 必须覆盖 FAIL 状态')

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
  console.error(`FAIL ${error.message}`)
  process.exitCode = 1
}
