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
  hoist                       执行领域提升风险扫描（LCA 仅作机械线索）
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

// Compute the nearest shared package path for all usage sites.
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

// Use LCA as a warning signal only; semantic ownership still comes from domain boundaries.
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
    printHoistWarning('抽离目标不在使用点的物理最近公共父级 package 下，请人工确认它是否属于全局基础设施或跨域业务资产', {
      target: targetPath,
      nearestCommonAncestor: ancestor,
    })
  }
  else if (targetSegments.length !== ancestorSegments.length + 1) {
    printHoistWarning('抽离目标位于更深层级，请人工确认它是否应留在局部业务内部或提升为跨域共享资产', {
      target: targetPath,
      nearestCommonAncestor: ancestor,
    })
  }

  printPass('java hoist domain-boundary scan completed', {
    target: targetPath,
    nearestCommonAncestor: ancestor,
    advisory: 'LCA is mechanical only; review domain semantics before changing ownership.',
  })
}

// Verify that this skill package still carries every rule and resource required by repository tests.
function verifySelf() {
  const skill = readSkillFile('SKILL.md')
  const examples = readSkillFile('examples', 'spring-boot-structure.md')
  const reviewExample = readSkillFile('examples', 'review-output.md')
  const checklist = readSkillFile('validation', 'checklist.md')

  assertContains(skill, /用于新建、编写、重构、拆分、优化、评审或校验 Java\/Spring Boot 后端代码/, 'SKILL.md 必须声明完整触发场景')
  assertContains(skill, /Java/, 'SKILL.md 必须覆盖 Java')
  assertContains(skill, /Spring Boot/, 'SKILL.md 必须覆盖 Spring Boot')
  assertContains(skill, /Maven/, 'SKILL.md 必须覆盖 Maven')
  assertContains(skill, /Gradle/, 'SKILL.md 必须覆盖 Gradle')
  assertContains(skill, /唯一规则源/, 'SKILL.md 必须声明唯一规则源')
  assertContains(skill, /examples\/spring-boot-structure\.md/, 'SKILL.md 必须索引结构示例')
  assertContains(skill, /examples\/review-output\.md/, 'SKILL.md 必须索引评审示例')
  assertContains(skill, /validation\/checklist\.md/, 'SKILL.md 必须索引校验清单')
  assertContains(skill, /构造函数注入/, 'SKILL.md 必须覆盖构造函数注入')
  assertContains(skill, /按领域边界提升/, 'SKILL.md 必须覆盖按领域边界提升')
  assertContains(skill, /Bean Validation/, 'SKILL.md 必须覆盖 Bean Validation')
  assertContains(skill, /ControllerAdvice/, 'SKILL.md 必须覆盖 ControllerAdvice')
  assertContains(skill, /Flyway/, 'SKILL.md 必须覆盖 Flyway')
  assertContains(skill, /Liquibase/, 'SKILL.md 必须覆盖 Liquibase')
  assertContains(skill, /scripts\/verify-rules\.mjs/, 'SKILL.md 必须声明自带验证脚本')
  assertContains(skill, /不得用仓库根级共享脚本替代/, 'SKILL.md 必须声明不得用仓库根级共享脚本替代')
  assertContains(examples, /本文件只提供示例，不定义新规则/, '示例文件必须声明不定义新规则')
  assertContains(examples, /src\/main\/java\/com\/example\/order\//, '示例文件必须包含 Spring Boot 结构示例')
  assertContains(examples, /domain\//, '示例文件必须覆盖 domain package')
  assertContains(examples, /application\//, '示例文件必须覆盖 application package')
  assertContains(examples, /infrastructure\//, '示例文件必须覆盖 infrastructure package')
  assertContains(examples, /record CreateOrderRequest/, '示例文件必须覆盖 record request')
  assertContains(examples, /@ConfigurationProperties/, '示例文件必须覆盖配置绑定示例')

  assertContains(reviewExample, /本文件只提供示例，不定义新规则/, '评审示例必须声明不定义新规则')
  assertContains(reviewExample, /目标分类：`application-module`/, '评审示例必须包含目标分类')
  assertContains(reviewExample, /总结论：`FAIL`/, '评审示例必须包含总结论')
  assertContains(reviewExample, /规则点：/, '评审示例必须包含规则点')
  assertContains(reviewExample, /证据：`src\/main\/java\/com\/example\/order/, '评审示例必须包含文件级证据')
  assertContains(reviewExample, /改动建议汇总/, '评审示例必须包含改动建议汇总')

  assertContains(checklist, /本文件只提供校验脚本用法和检查清单，不定义新规则/, '校验清单必须声明不定义新规则')
  assertContains(checklist, /jakarta\.validation/, '校验清单必须覆盖 jakarta.validation')
  assertContains(checklist, /Flyway 或 Liquibase/, '校验清单必须覆盖迁移工具')
  assertContains(checklist, /领域边界/, '校验清单必须覆盖领域边界提升')
  assertContains(checklist, /\[HOIST_WARNING\]/, '校验清单必须覆盖 HOIST_WARNING 人工复核')

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
