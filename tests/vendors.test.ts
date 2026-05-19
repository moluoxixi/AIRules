import type { VendorsConfig } from '../constants/skills.js'
import assert from 'node:assert'
import { it } from 'vitest'
import { vendors as configuredVendors } from '../constants/skills.js'
import { walkVendorTree } from '../scripts/lib/vendors.js'

// ─── 基础结构测试 ────────────────────────────────────────────────────────────

it('walkVendorTree - skills projection 字符串简写：name === output，无 setup', () => {
  const vendors: Record<string, any> = {}
  const mockConfig: VendorsConfig = [
    {
      name: 'vendor-a',
      official: true,
      source: 'https://github.com/a/a.git',
      projections: [
        {
          kind: 'skills',
          sourceBaseDir: 'skills',
          skills: ['s1', 's2'],
        },
      ],
    },
  ]

  walkVendorTree(mockConfig, [], vendors)

  assert.ok(vendors['vendor-a'], 'vendor-a 应存在')
  assert.strictEqual(vendors['vendor-a'].links.length, 2, '应有 2 个 link')
  assert.strictEqual(vendors['vendor-a'].links[0].target, 'vendor/skills/s1')
  assert.strictEqual(vendors['vendor-a'].links[1].target, 'vendor/skills/s2')
  assert.strictEqual(vendors['vendor-a'].links[0].setup, undefined, '字符串简写不应有 setup')
})

it('walkVendorTree - skills projection 对象：name 必填，output 可选', () => {
  const vendors: Record<string, any> = {}
  const mockConfig: VendorsConfig = [
    {
      name: 'vendor-b',
      official: true,
      source: 'https://github.com/b/b.git',
      projections: [
        {
          kind: 'skills',
          sourceBaseDir: 'skills',
          skills: [
            { name: 'skill-src', output: 'skill-renamed' }, // 重命名
            { name: 'skill-same' }, // output 省略，等于 name
          ],
        },
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

it('walkVendorTree - skills projection setup 透传到 VendorLink', () => {
  const vendors: Record<string, any> = {}
  const mockConfig: VendorsConfig = [
    {
      name: 'cli-vendor',
      official: true,
      source: 'https://github.com/cli-vendor.git',
      projections: [
        {
          kind: 'skills',
          sourceBaseDir: 'skills',
          skills: [
            {
              name: 'cli-skill',
              setup: ['npm install -g some-cli@latest'],
            },
            'plain-utils', // 无 setup 的普通 skill
          ],
        },
      ],
    },
  ]

  walkVendorTree(mockConfig, [], vendors)

  const links = vendors['cli-vendor'].links
  assert.strictEqual(links.length, 2)

  // 有 setup 的 skill
  assert.strictEqual(links[0].target, 'vendor/skills/cli-skill')
  assert.deepStrictEqual(
    links[0].setup,
    ['npm install -g some-cli@latest'],
    'cli-skill 应携带 setup 命令',
  )

  // 无 setup 的 skill
  assert.strictEqual(links[1].target, 'vendor/skills/plain-utils')
  assert.strictEqual(links[1].setup, undefined, 'plain-utils 不应有 setup')
})

it('walkVendorTree - skills projection 混合数组（字符串 + 对象）', () => {
  const vendors: Record<string, any> = {}
  const mockConfig: VendorsConfig = [
    {
      name: 'mixed',
      official: true,
      source: 'https://github.com/mixed.git',
      projections: [
        {
          kind: 'skills',
          sourceBaseDir: 'skills',
          skills: [
            'plain-skill', // 字符串简写
            { name: 'cli-skill', setup: ['npm i -g my-cli'] }, // 有 setup
            { name: 'renamed-skill', output: 'new-name' }, // 重命名无 setup
          ],
        },
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

it('walkVendorTree - 空 skills projection 仅保留配置槽位，不生成 skill link', () => {
  const vendors: Record<string, any> = {}
  const mockConfig: VendorsConfig = [
    {
      name: 'reserved-slot',
      official: true,
      source: 'https://github.com/example/reserved-slot.git',
      projections: [
        {
          kind: 'skills',
          sourceBaseDir: 'skills',
          skills: [],
        },
      ],
    },
  ]

  walkVendorTree(mockConfig, [], vendors)

  assert.ok(vendors['reserved-slot'], 'reserved-slot 应存在')
  assert.deepStrictEqual(vendors['reserved-slot'].links, [], '空 skills projection 不应生成任何 link')
})

// ─── 分类嵌套结构测试 ────────────────────────────────────────────────────────

it('walkVendorTree - 数组中的嵌套分类对象', () => {
  const vendors: Record<string, any> = {}
  const mockConfig: VendorsConfig = [
    {
      name: 'base-vendor',
      official: true,
      source: 'https://github.com/base.git',
      projections: [
        {
          kind: 'skills',
          sourceBaseDir: 'skills',
          skills: ['base'],
        },
      ],
    },
    {
      'category-1': [
        {
          name: 'nested-vendor',
          official: true,
          source: 'https://github.com/nested.git',
          projections: [
            {
              kind: 'skills',
              sourceBaseDir: 'skills',
              skills: ['n1'],
            },
          ],
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

it('walkVendorTree - 深度嵌套递归', () => {
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
              projections: [
                {
                  kind: 'skills',
                  sourceBaseDir: 'skills',
                  skills: [{ name: 'deep', output: 'deep-skill' }],
                },
              ],
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

// ─── namespace projection 整体目录模式 ───────────────────────────────────────

it('walkVendorTree - namespace projection 整体目录作为一个 skill namespace', () => {
  const vendors: Record<string, any> = {}
  const mockConfig: VendorsConfig = [
    {
      name: 'superpowers',
      official: true,
      source: 'https://github.com/obra/superpowers.git',
      projections: [
        {
          kind: 'namespace',
          sourceDir: 'skills',
          output: 'superpowers',
        },
      ],
    },
  ]

  walkVendorTree(mockConfig, [], vendors)

  assert.ok(vendors.superpowers, 'superpowers 应存在')
  const link = vendors.superpowers.links[0]
  assert.strictEqual(link.kind, 'namespace-dir')
  assert.strictEqual(link.source, 'skills')
  assert.strictEqual(link.target, 'vendor/skills/superpowers')
  assert.strictEqual(link.setup, undefined, 'namespace projection 无 setup 时应为 undefined')
})

it('walkVendorTree - namespace projection 带 setup', () => {
  const vendors: Record<string, any> = {}
  const mockConfig: VendorsConfig = [
    {
      name: 'superpowers',
      official: true,
      source: 'https://github.com/obra/superpowers.git',
      projections: [
        {
          kind: 'namespace',
          sourceDir: 'skills',
          output: 'superpowers',
          setup: ['npm install -g superpowers-cli'],
        },
      ],
    },
  ]

  walkVendorTree(mockConfig, [], vendors)

  const link = vendors.superpowers.links[0]
  assert.deepStrictEqual(
    link.setup,
    ['npm install -g superpowers-cli'],
    'namespace projection 的 setup 应透传到 VendorLink',
  )
})

it('walkVendorTree - 单个 vendor 支持 namespace 与 skills projections 混合', () => {
  const vendors: Record<string, any> = {}
  const mockConfig: VendorsConfig = [
    {
      name: 'moluoxixi',
      official: true,
      source: 'https://github.com/moluoxixi/AIRules.git',
      projections: [
        {
          kind: 'namespace',
          sourceDir: 'skills/workflow',
          output: 'workflow',
        },
        {
          kind: 'skills',
          sourceBaseDir: 'skills',
          skills: ['skill-validation-standard'],
        },
      ],
    },
  ]

  walkVendorTree(mockConfig, [], vendors)

  assert.strictEqual(vendors.moluoxixi.links.length, 2)
  assert.deepStrictEqual(
    vendors.moluoxixi.links.map((link: any) => ({ kind: link.kind, source: link.source, target: link.target })),
    [
      {
        kind: 'namespace-dir',
        source: 'skills/workflow',
        target: 'vendor/skills/workflow',
      },
      {
        kind: 'skill',
        source: 'skills/skill-validation-standard',
        target: 'vendor/skills/skill-validation-standard',
      },
    ],
  )
})

// ─── 错误处理 ─────────────────────────────────────────────────────────────────

it('walkVendorTree - 无效节点应抛出错误', () => {
  const vendors: Record<string, any> = {}
  const mockConfig: any = ['not-a-vendor-object']

  assert.throws(
    () => walkVendorTree(mockConfig, [], vendors),
    /在分类 "根目录" 下发现无效的供应商节点定义/,
  )
})

it('walkVendorTree - 多 vendor 扁平结构', () => {
  const vendors: Record<string, any> = {}
  const mockConfig: VendorsConfig = [
    {
      name: 'vendor-a',
      official: true,
      source: 'https://github.com/a/a.git',
      projections: [
        {
          kind: 'skills',
          sourceBaseDir: 'skills',
          skills: ['s1'],
        },
      ],
    },
    {
      name: 'vendor-b',
      official: false,
      source: 'https://github.com/b/b.git',
      projections: [
        {
          kind: 'skills',
          sourceBaseDir: 'skills',
          skills: ['s2'],
        },
      ],
    },
  ]

  walkVendorTree(mockConfig, [], vendors)

  assert.ok(vendors['vendor-a'], 'vendor-a 应存在')
  assert.ok(vendors['vendor-b'], 'vendor-b 应存在')
  assert.strictEqual(vendors['vendor-a'].links[0].target, 'vendor/skills/s1')
  assert.strictEqual(vendors['vendor-b'].links[0].target, 'vendor/skills/s2')
})

it('walkVendorTree - 旧版顶层 sourceDir 或 skills 配置应显式失败', () => {
  const vendors: Record<string, any> = {}
  const mockConfig: any = [
    {
      name: 'legacy',
      official: true,
      source: 'https://github.com/legacy.git',
      sourceDir: 'skills',
      skills: ['legacy-skill'],
    },
  ]

  assert.throws(
    () => walkVendorTree(mockConfig, [], vendors),
    /供应商 "legacy" 必须使用 projections 配置/,
  )
})

it('vendors 配置 - 使用 OpenAI Playwright 并移除过时技能', () => {
  const vendors: Record<string, any> = {}

  walkVendorTree(configuredVendors, [], vendors)

  assert.ok(vendors.openai, 'openai 供应商应存在')
  assert.strictEqual(vendors.openai.repo, 'https://github.com/openai/skills.git')
  assert.deepStrictEqual(
    vendors.openai.links.map((link: any) => ({
      source: link.source,
      target: link.target,
      setup: link.setup,
    })),
    [{
      source: 'skills/.curated/playwright',
      target: 'vendor/skills/playwright',
      setup: undefined,
    }],
    '应从 OpenAI .curated 安装 playwright skill',
  )

  assert.strictEqual(vendors.playwright, undefined, '不应保留 Microsoft playwright-cli 供应商')
  assert.ok(
    !vendors.moluoxixi.links.some((link: any) => link.target.endsWith('/create-handless-skill')),
    '不应继续安装 create-handless-skill',
  )
  assert.ok(
    vendors.moluoxixi.links.some((link: any) => link.target === 'vendor/skills/workflow'),
    'workflow 类技能应作为 namespace 统一安装',
  )
  assert.ok(
    vendors.moluoxixi.links.some((link: any) => link.target === 'vendor/skills/skill-validation-standard'),
    'skill-validation-standard 应作为通用第一方 skill 安装',
  )
})
