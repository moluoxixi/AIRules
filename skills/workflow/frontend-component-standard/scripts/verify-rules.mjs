#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const skillRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const PUBLIC_ENTRY_FILENAMES = ['index.ts', 'index.js']
const MODULE_IMPLEMENTATION_FILENAMES = ['index.vue', 'index.tsx', 'index.jsx']
const STYLE_ENTRY_FILENAMES = ['index.css', 'index.scss', 'index.less']

function readSkillFile(...segments) {
  return fs.readFileSync(path.join(skillRoot, ...segments), 'utf8')
}

function assertContains(content, pattern, message) {
  if (!pattern.test(content))
    throw new Error(message)
}

function findExistingFiles(directory, filenames) {
  return filenames.filter(filename => fs.existsSync(path.join(directory, filename)))
}

function relativeDirectory(root, directory) {
  const relative = path.relative(root, directory)

  return relative === '' ? '.' : relative.split(path.sep).join('/')
}

function assertSingleExistingFile(directory, filenames, label) {
  const existingFiles = findExistingFiles(directory, filenames)

  if (existingFiles.length === 0)
    throw new Error(`${label} 缺少唯一入口：${filenames.join('、')}`)

  if (existingFiles.length > 1)
    throw new Error(`${label} 只能存在一个入口：${filenames.join('、')}`)

  return existingFiles[0]
}

function printPass(message, details = {}) {
  console.log(`PASS ${message}`)

  for (const [key, value] of Object.entries(details))
    console.log(`${key}: ${value}`)
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

function assertCodeDirectoryEntries(directory, root) {
  const entries = fs.readdirSync(directory, { withFileTypes: true })
  const parentHasPublicEntry = findExistingFiles(directory, PUBLIC_ENTRY_FILENAMES).length > 0

  for (const entry of entries) {
    if (!entry.isDirectory())
      continue

    const childDirectory = path.join(directory, entry.name)
    const relative = relativeDirectory(root, childDirectory)
    const childPublicEntries = findExistingFiles(childDirectory, PUBLIC_ENTRY_FILENAMES)
    const childImplementationEntries = findExistingFiles(childDirectory, MODULE_IMPLEMENTATION_FILENAMES)
    const isImplementationSrc = entry.name === 'src' && parentHasPublicEntry && childImplementationEntries.length === 1

    if (entry.name === 'styles')
      assertSingleExistingFile(childDirectory, STYLE_ENTRY_FILENAMES, `样式目录 ${relative}/ 入口`)
    else if (!isImplementationSrc)
      assertSingleExistingFile(childDirectory, PUBLIC_ENTRY_FILENAMES, `目录 ${relative}/ 聚合入口`)

    if (childPublicEntries.length > 0 || isImplementationSrc)
      assertCodeDirectoryEntries(childDirectory, root)
  }
}

function assertComponentPackage(root) {
  const componentRoot = path.resolve(process.cwd(), root)
  const readmePath = path.join(componentRoot, 'README.md')
  const srcPath = path.join(componentRoot, 'src')
  const publicEntry = assertSingleExistingFile(componentRoot, PUBLIC_ENTRY_FILENAMES, '复杂组件包根目录公共入口')
  const rootImplementationEntries = findExistingFiles(componentRoot, MODULE_IMPLEMENTATION_FILENAMES)

  if (!fs.existsSync(readmePath))
    throw new Error('复杂组件包根目录缺少 README.md')

  if (!fs.existsSync(srcPath) || !fs.statSync(srcPath).isDirectory())
    throw new Error('复杂组件包根目录缺少 src/ 实现目录')

  if (rootImplementationEntries.length > 0)
    throw new Error(`复杂组件包根目录不得放置实现入口：${rootImplementationEntries.join('、')}`)

  const srcImplementationEntry = assertSingleExistingFile(srcPath, MODULE_IMPLEMENTATION_FILENAMES, '复杂组件包 src/ 实现入口')
  const readme = fs.readFileSync(readmePath, 'utf8').trim()

  if (readme.length === 0)
    throw new Error('复杂组件 README.md 不得为空，必须描述组件如何使用')

  if (!/(使用|用法|Usage|Props|Events|Emits|Expose|Slots|API)/.test(readme))
    throw new Error('复杂组件 README.md 必须包含使用方式或接口契约说明')

  assertCodeDirectoryEntries(componentRoot, componentRoot)

  printPass('frontend component package structure is valid', {
    componentRoot,
    entry: publicEntry,
    implementationEntry: srcImplementationEntry,
  })
}

function assertSimpleComponent(root) {
  const componentPath = path.resolve(process.cwd(), root)
  const filename = path.basename(componentPath)

  if (!/^[A-Z][\w-]*\.(vue|tsx|jsx)$/.test(filename))
    throw new Error('简单组件必须使用 ComponentName.vue、ComponentName.tsx 或 ComponentName.jsx 文件')

  if (!fs.existsSync(componentPath) || !fs.statSync(componentPath).isFile())
    throw new Error('简单组件路径必须指向真实文件')

  printPass('frontend simple component structure is valid', {
    componentPath,
  })
}

function verifySelf() {
  const skill = readSkillFile('SKILL.md')
  const componentExample = readSkillFile('examples', 'component.md')
  const typesAndImportsExample = readSkillFile('examples', 'types-and-imports.md')
  const checklist = readSkillFile('validation', 'checklist.md')

  assertContains(skill, /允许直接重写旧实现/, 'SKILL.md 必须声明允许直接重写旧实现')
  assertContains(skill, /不为历史兼容保留冗余结构/, 'SKILL.md 必须声明不保留历史兼容壳层')
  assertContains(skill, /simple-component/, 'SKILL.md 必须覆盖 simple-component')
  assertContains(skill, /component-package/, 'SKILL.md 必须覆盖 component-package')
  assertContains(skill, /Vue 3 标准/, 'SKILL.md 必须覆盖 Vue 3 标准')
  assertContains(skill, /React 标准/, 'SKILL.md 必须覆盖 React 标准')
  assertContains(skill, /类型出口优先使用 type-only re-export/, 'SKILL.md 必须覆盖类型出口规则')
  assertContains(skill, /禁止 deep import/, 'SKILL.md 必须覆盖 deep import 约束')
  assertContains(skill, /scripts\/verify-rules\.mjs/, 'SKILL.md 必须声明本 skill 自带的验证脚本')
  assertContains(componentExample, /Sparkline\.jsx/, '组件示例必须覆盖 JSX 文件形态')
  assertContains(componentExample, /DataTableReact\//, '组件示例必须覆盖 React 复杂组件包')
  assertContains(componentExample, /公共 props 表达调用契约/, '组件示例必须体现公共契约')
  assertContains(typesAndImportsExample, /@\/components\/DataTable\/src\/utils\/date/, '导入示例必须覆盖 src deep import 禁止项')
  assertContains(typesAndImportsExample, /DataTableProps/, '导入示例必须覆盖类型公共入口')
  assertContains(checklist, /只为兼容旧实现存在的目录、双入口或冗余 wrapper/, '校验文件必须覆盖兼容壳层检查')
  assertContains(checklist, /脚本 `PASS` 只代表结构通过，不代表实现整体通过/, '校验文件必须声明脚本边界')

  printPass('frontend-component-standard self rules are valid')
}

function main() {
  const [command = 'self', ...args] = process.argv.slice(2)

  if (command === 'self')
    return verifySelf()

  if (command === 'simple-component' || command === 'simple')
    return assertSimpleComponent(getOption(args, '--root'))

  if (command === 'component' || command === 'package' || command === 'project')
    return assertComponentPackage(getOption(args, '--root'))

  throw new Error(`未知命令：${command}`)
}

try {
  main()
}
catch (error) {
  console.error(`FAIL ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
}
