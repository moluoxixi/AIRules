import type { VendorsConfig } from '../constants/skills.js'
import assert from 'node:assert'
import { test } from 'vitest'
import { walkVendorTree } from '../scripts/lib/vendors.js'

// ─── 基础结构测试 ────────────────────────────────────────────────────────────

test('walkVendorTree - 字符串简写：name === output，无 setup', () => {
  const vendors: Record<string, any> = {}
  const mockConfig: VendorsConfig = [
    {
      name: 'vendor-a',
      official: true,
      source: 'https://github.com/a/a.git',
      skills: ['s1', 's2'],
    },
  ]

  walkVendorTree(mockConfig, [], vendors)

  assert.ok(vendors['vendor-a'], 'vendor-a 应存在')
  assert.strictEqual(vendors['vendor-a'].links.length, 2, '应有 2 个 link')
  assert.strictEqual(vendors['vendor-a'].links[0].target, 'vendor/skills/s1')
  assert.strictEqual(vendors['vendor-a'].links[1].target, 'vendor/skills/s2')
  assert.strictEqual(vendors['vendor-a'].links[0].setup, undefined, '字符串简写不应有 setup')
})

test('walkVendorTree - SkillConfig 对象：name 必填，output 可选', () => {
  const vendors: Record<string, any> = {}
  const mockConfig: VendorsConfig = [
    {
      name: 'vendor-b',
      official: true,
      source: 'https://github.com/b/b.git',
      skills: [
        { name: 'skill-src', output: 'skill-renamed' }, // 重命名
        { name: 'skill-same' }, // output 省略，等于 name
      ],
    },
  ]

  walkVendorTree(mockConfig, [], vendors)

  const links = vendors['vendor-b'].links
  assert.strictEqual(links[0].source, 'skills/skill-src')
  assert.strictEqual(links[0].target, 'vendor/skills/skill-renamed', '重命名应生效')
  assert.strictEqual(links[1].source, 'skills/skill-same')
  assert.strictEqual(links[1].target, 'vendor/skills/skill-same', 'output 省略时应等于 name')
})

test('walkVendorTree - SkillConfig.setup 透传到 VendorLink', () => {
  const vendors: Record<string, any> = {}
  const mockConfig: VendorsConfig = [
    {
      name: 'playwright',
      official: true,
      source: 'https://github.com/microsoft/playwright-cli.git',
      sourceBaseDir: 'skills',
      skills: [
        {
          name: 'playwright-cli',
          setup: ['npm install -g @playwright/cli@latest'],
        },
        'playwright-utils', // 无 setup 的普通 skill
      ],
    },
  ]

  walkVendorTree(mockConfig, [], vendors)

  const links = vendors.playwright.links
  assert.strictEqual(links.length, 2)

  // 有 setup 的 skill
  assert.strictEqual(links[0].target, 'vendor/skills/playwright-cli')
  assert.deepStrictEqual(
    links[0].setup,
    ['npm install -g @playwright/cli@latest'],
    'playwright-cli 应携带 setup 命令',
  )

  // 无 setup 的 skill
  assert.strictEqual(links[1].target, 'vendor/skills/playwright-utils')
  assert.strictEqual(links[1].setup, undefined, 'playwright-utils 不应有 setup')
})

test('walkVendorTree - 混合数组（字符串 + 对象）', () => {
  const vendors: Record<string, any> = {}
  const mockConfig: VendorsConfig = [
    {
      name: 'mixed',
      official: true,
      source: 'https://github.com/mixed.git',
      skills: [
        'plain-skill', // 字符串简写
        { name: 'cli-skill', setup: ['npm i -g my-cli'] }, // 有 setup
        { name: 'renamed-skill', output: 'new-name' }, // 重命名无 setup
      ],
    },
  ]

  walkVendorTree(mockConfig, [], vendors)

  const links = vendors.mixed.links
  assert.strictEqual(links.length, 3)

  assert.strictEqual(links[0].target, 'vendor/skills/plain-skill')
  assert.strictEqual(links[0].setup, undefined)

  assert.strictEqual(links[1].target, 'vendor/skills/cli-skill')
  assert.deepStrictEqual(links[1].setup, ['npm i -g my-cli'])

  assert.strictEqual(links[2].target, 'vendor/skills/new-name')
  assert.strictEqual(links[2].setup, undefined)
})

// ─── 分类嵌套结构测试 ────────────────────────────────────────────────────────

test('walkVendorTree - 数组中的嵌套分类对象', () => {
  const vendors: Record<string, any> = {}
  const mockConfig: VendorsConfig = [
    {
      name: 'base-vendor',
      official: true,
      source: 'https://github.com/base.git',
      skills: ['base'],
    },
    {
      'category-1': [
        {
          name: 'nested-vendor',
          official: true,
          source: 'https://github.com/nested.git',
          skills: ['n1'],
        },
      ],
    },
  ]

  walkVendorTree(mockConfig, [], vendors)

  assert.ok(vendors['base-vendor'], 'base-vendor 应在根级别')
  assert.ok(vendors['nested-vendor'], 'nested-vendor 应被提取')
  assert.strictEqual(vendors['base-vendor'].links[0].target, 'vendor/skills/base')
  assert.strictEqual(vendors['nested-vendor'].links[0].target, 'vendor/skills/category-1/n1')
})

test('walkVendorTree - 深度嵌套递归', () => {
  const vendors: Record<string, any> = {}
  const mockConfig: any = [
    {
      'level-1': [
        {
          'level-2': [
            {
              name: 'deep-vendor',
              official: true,
              source: 'https://github.com/deep.git',
              skills: [{ name: 'deep', output: 'deep-skill' }],
            },
          ],
        },
      ],
    },
  ]

  walkVendorTree(mockConfig, [], vendors)

  assert.ok(vendors['deep-vendor'], '深度嵌套的 vendor 应被找到')
  assert.strictEqual(
    vendors['deep-vendor'].links[0].target,
    'vendor/skills/level-1/level-2/deep-skill',
  )
})

// ─── sourceDir 整体 skill 模式 ───────────────────────────────────────────────

test('walkVendorTree - sourceDir 模式（整体目录作为一个 skill）', () => {
  const vendors: Record<string, any> = {}
  const mockConfig: VendorsConfig = [
    {
      name: 'superpowers',
      official: true,
      source: 'https://github.com/obra/superpowers.git',
      sourceDir: 'skills',
    },
  ]

  walkVendorTree(mockConfig, [], vendors)

  assert.ok(vendors.superpowers, 'superpowers 应存在')
  const link = vendors.superpowers.links[0]
  assert.strictEqual(link.kind, 'namespace-dir')
  assert.strictEqual(link.source, 'skills')
  assert.strictEqual(link.target, 'vendor/skills/superpowers')
  assert.strictEqual(link.setup, undefined, 'sourceDir 模式无 setup 时应为 undefined')
})

test('walkVendorTree - sourceDir 模式带 setup', () => {
  const vendors: Record<string, any> = {}
  const mockConfig: VendorsConfig = [
    {
      name: 'superpowers',
      official: true,
      source: 'https://github.com/obra/superpowers.git',
      sourceDir: 'skills',
      setup: ['npm install -g superpowers-cli'],
    },
  ]

  walkVendorTree(mockConfig, [], vendors)

  const link = vendors.superpowers.links[0]
  assert.deepStrictEqual(
    link.setup,
    ['npm install -g superpowers-cli'],
    'sourceDir 模式的 setup 应透传到 VendorLink',
  )
})

// ─── 错误处理 ─────────────────────────────────────────────────────────────────

test('walkVendorTree - 无效节点应抛出错误', () => {
  const vendors: Record<string, any> = {}
  const mockConfig: any = ['not-a-vendor-object']

  assert.throws(
    () => walkVendorTree(mockConfig, [], vendors),
    /在分类 "根目录" 下发现无效的供应商节点定义/,
  )
})

test('walkVendorTree - 多 vendor 扁平结构', () => {
  const vendors: Record<string, any> = {}
  const mockConfig: VendorsConfig = [
    {
      name: 'vendor-a',
      official: true,
      source: 'https://github.com/a/a.git',
      skills: ['s1'],
    },
    {
      name: 'vendor-b',
      official: false,
      source: 'https://github.com/b/b.git',
      skills: ['s2'],
    },
  ]

  walkVendorTree(mockConfig, [], vendors)

  assert.ok(vendors['vendor-a'], 'vendor-a 应存在')
  assert.ok(vendors['vendor-b'], 'vendor-b 应存在')
  assert.strictEqual(vendors['vendor-a'].links[0].target, 'vendor/skills/s1')
  assert.strictEqual(vendors['vendor-b'].links[0].target, 'vendor/skills/s2')
})
