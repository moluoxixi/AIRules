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
              setup: [{ command: 'some-cli-installer', args: ['--global'] }],
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
    [{ command: 'some-cli-installer', args: ['--global'] }],
    'cli-skill 应携带 setup 命令',
  )

  // 无 setup 的 skill
  assert.strictEqual(links[1].target, 'vendor/skills/plain-utils')
  assert.strictEqual(links[1].setup, undefined, 'plain-utils 不应有 setup')
})

it('walkVendorTree - 供应商级 setup 透传到 Vendor', () => {
  const vendors: Record<string, any> = {}
  const mockConfig: VendorsConfig = [
    {
      name: 'tool-vendor',
      official: true,
      source: 'https://github.com/tool-vendor.git',
      setup: [
        { command: 'npm', args: ['install', '--global', '@tool/vendor'] },
        { command: 'tool', args: ['install'] },
      ],
      projections: [
        {
          kind: 'skills',
          sourceBaseDir: 'skills',
          skills: ['plain-utils'],
        },
      ],
    },
  ]

  walkVendorTree(mockConfig, [], vendors)

  assert.deepStrictEqual(
    vendors['tool-vendor'].setup,
    [
      { command: 'npm', args: ['install', '--global', '@tool/vendor'] },
      { command: 'tool', args: ['install'] },
    ],
    '供应商级 setup 应保留到 Vendor manifest',
  )
  assert.strictEqual(vendors['tool-vendor'].links[0].setup, undefined, '供应商级 setup 不应污染 skill link')
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
            { name: 'cli-skill', setup: [{ command: 'my-cli-installer', args: ['--global'] }] }, // 有 setup
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
  assert.deepStrictEqual(links[1].setup, [{ command: 'my-cli-installer', args: ['--global'] }])

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
  assert.strictEqual(vendors['nested-vendor'].links[0].target, 'vendor/skills/n1')
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
    'vendor/skills/deep-skill',
  )
})

it('walkVendorTree - skills projection 嵌套源路径安装为扁平目标', () => {
  const vendors: Record<string, any> = {}
  const mockConfig: VendorsConfig = [
    {
      name: 'nested-source',
      official: true,
      source: 'https://github.com/nested-source.git',
      projections: [
        {
          kind: 'skills',
          sourceBaseDir: 'skills',
          skills: [
            'workflow/deep-skill',
            { name: 'rules/review/code-reviewer' },
          ],
        },
      ],
    },
  ]

  walkVendorTree(mockConfig, [], vendors)

  assert.deepStrictEqual(
    vendors['nested-source'].links.map((link: any) => ({
      source: link.source,
      target: link.target,
    })),
    [
      {
        source: 'skills/workflow/deep-skill',
        target: 'vendor/skills/deep-skill',
      },
      {
        source: 'skills/rules/review/code-reviewer',
        target: 'vendor/skills/code-reviewer',
      },
    ],
  )
})

// ─── namespace projection 递归扫描入口 ───────────────────────────────────────

it('walkVendorTree - namespace projection 保留递归扫描入口', () => {
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
          setup: [{ command: 'superpowers-installer', args: ['--global'] }],
        },
      ],
    },
  ]

  walkVendorTree(mockConfig, [], vendors)

  const link = vendors.superpowers.links[0]
  assert.deepStrictEqual(
    link.setup,
    [{ command: 'superpowers-installer', args: ['--global'] }],
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
  assert.deepStrictEqual(
    vendors.moluoxixi.setup,
    [
      {
        command: 'npm',
        args: ['install', '--global', '@colbymchenry/codegraph'],
      },
      {
        command: 'codegraph',
        args: ['install'],
      },
    ],
    '安装 AIRules 时应同步安装并初始化 CodeGraph',
  )
  assert.ok(
    !vendors.moluoxixi.links.some((link: any) => link.target === 'vendor/skills/workflow'),
    '删除静态 workflow skill 后不应继续安装 workflow namespace',
  )
  assert.deepStrictEqual(
    vendors.moluoxixi.links.map((link: any) => ({
      source: link.source,
      target: link.target,
      setup: link.setup,
    })),
    [{
      source: 'skills/skill-validation-standard',
      target: 'vendor/skills/skill-validation-standard',
      setup: undefined,
    }],
    '第一方 skill 默认只投影 skill-validation-standard',
  )
})

it('vendors 配置 - 仅接入 Anthropic 的前端视觉设计技能', () => {
  const vendors: Record<string, any> = {}

  walkVendorTree(configuredVendors, [], vendors)

  assert.ok(vendors.anthropic, 'Anthropic Skills 供应商应存在')
  assert.strictEqual(vendors.anthropic.repo, 'https://github.com/anthropics/skills.git')
  assert.deepStrictEqual(
    vendors.anthropic.links.map((link: any) => ({
      source: link.source,
      target: link.target,
      setup: link.setup,
    })),
    [
      {
        source: 'skills/frontend-design',
        target: 'vendor/skills/frontend-design',
        setup: undefined,
      },
    ],
    '代码库默认只需要 frontend-design，不应默认安装品牌或主题 artifact 技能',
  )
})

it('vendors 配置 - 默认不接入静态代码规范供应商', () => {
  const vendors: Record<string, any> = {}

  walkVendorTree(configuredVendors, [], vendors)

  assert.strictEqual(vendors.antfu, undefined, '不应默认安装 Antfu 框架/工具链技能')
  assert.strictEqual(vendors.vercelAgentSkills, undefined, '不应默认安装 Vercel React/React Native 代码技能')
})

it('vendors 配置 - Superpowers 只安装代码库常用工作流子集', () => {
  const vendors: Record<string, any> = {}

  walkVendorTree(configuredVendors, [], vendors)

  assert.ok(vendors.superpowers, 'superpowers 供应商应存在')
  assert.strictEqual(vendors.superpowers.repo, 'https://github.com/obra/superpowers.git')
  assert.deepStrictEqual(
    vendors.superpowers.links.map((link: any) => ({
      kind: link.kind,
      source: link.source,
      target: link.target,
      setup: link.setup,
    })),
    [
      {
        kind: 'skill',
        source: 'skills/systematic-debugging',
        target: 'vendor/skills/systematic-debugging',
        setup: undefined,
      },
      {
        kind: 'skill',
        source: 'skills/verification-before-completion',
        target: 'vendor/skills/verification-before-completion',
        setup: undefined,
      },
      {
        kind: 'skill',
        source: 'skills/receiving-code-review',
        target: 'vendor/skills/receiving-code-review',
        setup: undefined,
      },
      {
        kind: 'skill',
        source: 'skills/writing-skills',
        target: 'vendor/skills/writing-skills',
        setup: undefined,
      },
      {
        kind: 'skill',
        source: 'skills/using-git-worktrees',
        target: 'vendor/skills/using-git-worktrees',
        setup: undefined,
      },
      {
        kind: 'skill',
        source: 'skills/writing-plans',
        target: 'vendor/skills/writing-plans',
        setup: undefined,
      },
    ],
    '不应把 using-superpowers、TDD、子代理执行或分支收尾重流程作为默认代码库技能安装',
  )
})
