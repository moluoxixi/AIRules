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

  assertContains(skill, /name: java-code-standard/, 'SKILL.md 必须保持 java-code-standard 名称')
  assertContains(skill, /用于新建、编写、重构、拆分、优化、评审或校验 Java\/Spring Boot 后端代码/, 'SKILL.md 必须声明完整触发场景')
  assertContains(skill, /Java/, 'SKILL.md 必须覆盖 Java')
  assertContains(skill, /Spring Boot/, 'SKILL.md 必须覆盖 Spring Boot')
  assertContains(skill, /Clean Architecture/, 'SKILL.md 必须覆盖 Clean Architecture')
  assertContains(skill, /DDD 依赖倒置/, 'SKILL.md 必须覆盖 DDD 依赖倒置')
  assertContains(skill, /唯一规则源/, 'SKILL.md 必须声明唯一规则源')
  assertContains(skill, /## 使用场景/, 'SKILL.md 必须包含使用场景 section')
  assertContains(skill, /## 工作顺序/, 'SKILL.md 必须包含工作顺序 section')
  assertContains(skill, /## 检查清单/, 'SKILL.md 必须包含检查清单 section')
  assertContains(skill, /## 自校验脚本/, 'SKILL.md 必须包含自校验脚本 section')
  assertContains(skill, /## 评审输出示例/, 'SKILL.md 必须包含评审输出示例 section')
  assertContains(skill, /domain.*不依赖 Web、JPA 或 Spring/, 'SKILL.md 必须声明 domain 与框架隔离')
  assertContains(skill, /infrastructure.*实现 `domain` 或 `application` 定义的接口/, 'SKILL.md 必须声明 infrastructure 实现内层接口')
  assertContains(skill, /严禁 `domain` 依赖 `infrastructure`/, 'SKILL.md 必须禁止 domain 依赖 infrastructure')
  assertContains(skill, /全局 `utils` 垃圾桶/, 'SKILL.md 必须禁止无语义全局 utils')
  assertContains(skill, /Map/, 'SKILL.md 必须禁止宽泛 Map 契约')
  assertContains(skill, /裸 `JSON`/, 'SKILL.md 必须禁止裸 JSON 契约')
  assertContains(skill, /Object/, 'SKILL.md 必须禁止 Object 契约')
  assertContains(skill, /List\.copyOf\(\)/, 'SKILL.md 必须覆盖集合防泄漏复制')
  assertContains(skill, /Collections\.unmodifiableList\(\)/, 'SKILL.md 必须覆盖领域集合不可变视图')
  assertContains(skill, /java\.util\.Date/, 'SKILL.md 必须禁用 java.util.Date')
  assertContains(skill, /java\.util\.Calendar/, 'SKILL.md 必须禁用 java.util.Calendar')
  assertContains(skill, /java\.sql\.Timestamp/, 'SKILL.md 必须禁用 java.sql.Timestamp')
  assertContains(skill, /java\.time/, 'SKILL.md 必须强制使用 java.time')
  assertContains(skill, /fillInStackTrace\(\)/, 'SKILL.md 必须覆盖业务异常禁用堆栈抓取')
  assertContains(skill, /RFC 7807/, 'SKILL.md 必须覆盖 RFC 7807')
  assertContains(skill, /ProblemDetail/, 'SKILL.md 必须覆盖 ProblemDetail 统一错误响应')
  assertContains(skill, /@Autowired/, 'SKILL.md 必须覆盖禁止 @Autowired 字段注入')
  assertContains(skill, /@RequestBody/, 'SKILL.md 必须覆盖 RequestBody 校验触发')
  assertContains(skill, /@ModelAttribute/, 'SKILL.md 必须覆盖 ModelAttribute 校验触发')
  assertContains(skill, /@Valid/, 'SKILL.md 必须覆盖 @Valid')
  assertContains(skill, /@Validated/, 'SKILL.md 必须覆盖 @Validated')
  assertContains(skill, /@Valid @NotNull List<ItemRequest> items/, 'SKILL.md 必须覆盖嵌套 DTO 集合级联校验示例')
  assertContains(skill, /Self-Invocation/, 'SKILL.md 必须覆盖事务 self-invocation')
  assertContains(skill, /this\.xxx\(\)/, 'SKILL.md 必须禁止 this.xxx() 事务自调用')
  assertContains(skill, /AopContext\.currentProxy\(\)/, 'SKILL.md 必须禁止 AopContext.currentProxy() 绕行')
  assertContains(skill, /@Transactional\(readOnly = true\)/, 'SKILL.md 必须覆盖查询只读事务')
  assertContains(skill, /Dirty Checking/, 'SKILL.md 必须说明 Hibernate Dirty Checking 开销')
  assertContains(skill, /@ConfigurationProperties/, 'SKILL.md 必须包含配置绑定示例')
  assertContains(skill, /@Value/, 'SKILL.md 必须覆盖禁止散落 @Value')
  assertContains(skill, /OSIV/, 'SKILL.md 必须覆盖 OSIV')
  assertContains(skill, /spring\.jpa\.open-in-view: false/, 'SKILL.md 必须强制关闭 OSIV')
  assertContains(skill, /懒加载初始化强制收敛/, 'SKILL.md 必须约束懒加载初始化边界')
  assertContains(skill, /循环中执行 SQL/, 'SKILL.md 必须禁止循环 SQL')
  assertContains(skill, /@EntityGraph/, 'SKILL.md 必须覆盖 JPA EntityGraph')
  assertContains(skill, /JOIN FETCH/, 'SKILL.md 必须覆盖 JOIN FETCH')
  assertContains(skill, /Projection/, 'SKILL.md 必须覆盖 DTO Projection')
  assertContains(skill, /JOOQ/, 'SKILL.md 必须覆盖 JOOQ 查询方案')
  assertContains(skill, /MyBatis/, 'SKILL.md 必须覆盖 MyBatis 查询方案')
  assertContains(skill, /Spring Data JDBC/, 'SKILL.md 必须覆盖 Spring Data JDBC 查询方案')
  assertContains(skill, /@Data/, 'SKILL.md 必须覆盖 JPA Entity 禁用 Lombok @Data')
  assertContains(skill, /@EqualsAndHashCode/, 'SKILL.md 必须覆盖 JPA Entity 禁用 Lombok @EqualsAndHashCode')
  assertContains(skill, /@ToString/, 'SKILL.md 必须覆盖 JPA Entity 禁用 Lombok @ToString')
  assertContains(skill, /Business Key/, 'SKILL.md 必须覆盖 JPA Entity equals/hashCode 业务唯一键')
  assertContains(skill, /ApplicationEvent/, 'SKILL.md 必须覆盖跨域事件解耦')
  assertContains(skill, /ArchUnit/, 'SKILL.md 必须覆盖 Architecture Tests')
  assertContains(skill, /Testcontainers/, 'SKILL.md 必须覆盖 Testcontainers')
  assertContains(skill, /Flyway\/Liquibase/, 'SKILL.md 必须覆盖 Flyway/Liquibase')
  assertContains(skill, /org\.springframework/, 'SKILL.md 必须检查 domain 不依赖 Spring')
  assertContains(skill, /jakarta\.persistence/, 'SKILL.md 必须检查 domain 不依赖 JPA')
  assertContains(skill, /Servlet/, 'SKILL.md 必须检查 domain 不依赖 Servlet')
  assertContains(skill, /Jackson/, 'SKILL.md 必须检查 domain 不依赖 Jackson')
  assertContains(skill, /目标分类：`application-module`/, 'SKILL.md 必须包含评审示例目标分类')
  assertContains(skill, /总结论：`FAIL`/, 'SKILL.md 必须包含评审示例总结论')
  assertContains(skill, /scripts\/verify-rules\.mjs/, 'SKILL.md 必须声明自带验证脚本')
  assertContains(skill, /MISSING/, 'SKILL.md 必须覆盖 MISSING 状态')
  assertContains(skill, /NOT RUN/, 'SKILL.md 必须覆盖 NOT RUN 状态')
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
  console.error(`FAIL ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
}
