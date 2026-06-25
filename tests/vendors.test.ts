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
          skills: ['knowledge-search'],
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
        source: 'skills/knowledge-search',
        target: 'vendor/skills/knowledge-search',
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

it('vendors 配置 - 精选第三方 skill 使用来源后缀避免跨来源裸名冲突', () => {
  const vendors: Record<string, any> = {}

  walkVendorTree(configuredVendors, [], vendors)

  assert.deepStrictEqual(
    vendors.gemini.links.map((link: any) => link.target),
    ['vendor/skills/code-reviewer-gemini', 'vendor/skills/pr-creator-gemini'],
    'Gemini 精选 skills 应使用来源后缀，避免与 Superpowers 或用户本地裸名冲突',
  )
  assert.deepStrictEqual(
    vendors.vercelLabs.links.map((link: any) => link.target),
    ['vendor/skills/find-skills-vercel'],
    'Vercel 精选 skill 应使用来源后缀，避免裸名冲突',
  )
  assert.deepStrictEqual(
    vendors.anthropic.links.map((link: any) => link.target),
    ['vendor/skills/frontend-design-anthropic'],
    'Anthropic 精选 skill 应使用来源后缀，避免裸名冲突',
  )
  assert.deepStrictEqual(
    vendors.openai.links.map((link: any) => link.target),
    ['vendor/skills/playwright-openai'],
    'OpenAI 精选 skill 应使用来源后缀，避免裸名冲突',
  )

  const bareThirdPartyTargets = new Set([
    'vendor/skills/code-reviewer',
    'vendor/skills/pr-creator',
    'vendor/skills/find-skills',
    'vendor/skills/frontend-design',
    'vendor/skills/playwright',
  ])
  const configuredTargets = Object.values(vendors)
    .flatMap((vendor: any) => vendor.links.map((link: any) => link.target))
  assert.ok(
    configuredTargets.every((target: string) => !bareThirdPartyTargets.has(target)),
    '精选第三方 skill 不应再投影为易冲突裸名',
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
      target: 'vendor/skills/playwright-openai',
      setup: undefined,
    }],
    '应从 OpenAI .curated 安装 playwright skill',
  )

  assert.strictEqual(vendors.playwright, undefined, '不应保留 Microsoft playwright-cli 供应商')
  assert.ok(
    !vendors.moluoxixi.links.some((link: any) => link.target.endsWith('/create-handless-skill')),
    '不应继续安装 create-handless-skill',
  )
  assert.strictEqual(
    vendors.moluoxixi.sourceMode,
    'workspace',
    'AIRules 第一方 skills 应从当前 workspace 同步，避免新增 skill 必须先存在于远程仓库',
  )
  assert.deepStrictEqual(
    vendors.moluoxixi.setup,
    [
      {
        command: 'npm',
        args: ['install', '--global', '@colbymchenry/codegraph'],
        skipIfCommandAvailable: 'codegraph',
      },
      {
        command: 'codegraph',
        args: ['install', '--yes'],
      },
    ],
    '安装 AIRules 时应同步安装并初始化 CodeGraph，不默认安装 OpenSpec CLI',
  )
  assert.ok(
    !vendors.moluoxixi.setup.some((cmd: any) =>
      cmd.args?.includes('@fission-ai/openspec') || cmd.skipIfCommandAvailable === 'openspec',
    ),
    'setup 不应包含 openspec 全局安装命令',
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
    [
      { source: 'skills/prd-docs', target: 'vendor/skills/prd-docs', setup: undefined },
      { source: 'skills/architecture-docs', target: 'vendor/skills/architecture-docs', setup: undefined },
      { source: 'skills/architecture-deepening', target: 'vendor/skills/architecture-deepening', setup: undefined },
      { source: 'skills/api-docs', target: 'vendor/skills/api-docs', setup: undefined },
      { source: 'skills/components-docs', target: 'vendor/skills/components-docs', setup: undefined },
      { source: 'skills/test-docs', target: 'vendor/skills/test-docs', setup: undefined },
      { source: 'skills/frontend-impl-plan', target: 'vendor/skills/frontend-impl-plan', setup: undefined },
      { source: 'skills/backend-impl-plan', target: 'vendor/skills/backend-impl-plan', setup: undefined },
      { source: 'skills/init-project', target: 'vendor/skills/init-project', setup: undefined },
      { source: 'skills/knowledge-search', target: 'vendor/skills/knowledge-search', setup: undefined },
      { source: 'skills/consistency-check', target: 'vendor/skills/consistency-check', setup: undefined },
      { source: 'skills/design-docs', target: 'vendor/skills/design-docs', setup: undefined },
      { source: 'skills/handoff', target: 'vendor/skills/handoff', setup: undefined },
      { source: 'skills/retrospective-correction', target: 'vendor/skills/retrospective-correction', setup: undefined },
      { source: 'skills/systematic-debugging', target: 'vendor/skills/systematic-debugging', setup: undefined },
      { source: 'skills/verification-before-completion', target: 'vendor/skills/verification-before-completion', setup: undefined },
      { source: 'skills/requesting-code-review', target: 'vendor/skills/requesting-code-review', setup: undefined },
      { source: 'skills/receiving-code-review', target: 'vendor/skills/receiving-code-review', setup: undefined },
    ],
    '第一方 skill：文档生成（绑定 docs/ 结构）+ 实现计划 + 项目独有能力 + 第一方化方法论（剥离 Claude-Code 专用引用、对齐子代理评审协议）',
  )
  assert.ok(
    !vendors.moluoxixi.links.some((link: any) => link.target.endsWith('/caveman')),
    'caveman 超压缩模式不在默认分发中',
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
        target: 'vendor/skills/frontend-design-anthropic',
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

it('vendors 配置 - Superpowers 完整方法论 skills 投影（含调试/验证/评审）', () => {
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
      { kind: 'skill', source: 'skills/dispatching-parallel-agents', target: 'vendor/skills/dispatching-parallel-agents', setup: undefined },
      { kind: 'skill', source: 'skills/subagent-driven-development', target: 'vendor/skills/subagent-driven-development', setup: undefined },
      { kind: 'skill', source: 'skills/executing-plans', target: 'vendor/skills/executing-plans', setup: undefined },
      { kind: 'skill', source: 'skills/finishing-a-development-branch', target: 'vendor/skills/finishing-a-development-branch', setup: undefined },
      { kind: 'skill', source: 'skills/using-git-worktrees', target: 'vendor/skills/using-git-worktrees', setup: undefined },
      { kind: 'skill', source: 'skills/writing-plans', target: 'vendor/skills/writing-plans', setup: undefined },
      { kind: 'skill', source: 'skills/writing-skills', target: 'vendor/skills/writing-skills', setup: undefined },
      { kind: 'skill', source: 'skills/test-driven-development', target: 'vendor/skills/test-driven-development', setup: undefined },
    ],
    'Superpowers 只投影通用方法论；systematic-debugging/verification/requesting-review/receiving-review 已第一方化（剥离 Claude-Code 引用、对齐子代理协议），不分发原版避免撞名；brainstorming（与L0/L1冲突）和 using-superpowers（与按需加载重复）也不分发',
  )
  assert.ok(
    !vendors.superpowers.links.some((link: any) =>
      ['systematic-debugging', 'verification-before-completion', 'requesting-code-review', 'receiving-code-review']
        .some(name => link.target.endsWith(`/${name}`)),
    ),
    '第一方化的 4 个方法论 skill 不应再从 superpowers 原版投影，避免 vendor/skills 扁平命名空间撞名',
  )
})

it('vendors 配置 - pm-skills 作为 prd-docs 的需求侧 PM 方法论辅助', () => {
  const vendors: Record<string, any> = {}

  walkVendorTree(configuredVendors, [], vendors)

  assert.ok(vendors.pmSkills, 'pmSkills 供应商应存在')
  assert.strictEqual(vendors.pmSkills.repo, 'https://github.com/product-on-purpose/pm-skills.git')
  assert.deepStrictEqual(
    vendors.pmSkills.links.map((link: any) => ({
      kind: link.kind,
      source: link.source,
      target: link.target,
      setup: link.setup,
    })),
    [
      { kind: 'skill', source: 'skills/deliver-prd', target: 'vendor/skills/deliver-prd', setup: undefined },
      { kind: 'skill', source: 'skills/deliver-user-stories', target: 'vendor/skills/deliver-user-stories', setup: undefined },
      { kind: 'skill', source: 'skills/deliver-acceptance-criteria', target: 'vendor/skills/deliver-acceptance-criteria', setup: undefined },
      { kind: 'skill', source: 'skills/deliver-edge-cases', target: 'vendor/skills/deliver-edge-cases', setup: undefined },
      { kind: 'skill', source: 'skills/develop-adr', target: 'vendor/skills/develop-adr', setup: undefined },
      { kind: 'skill', source: 'skills/develop-solution-brief', target: 'vendor/skills/develop-solution-brief', setup: undefined },
    ],
    'pm-skills 提供 PRD、用户故事、验收标准、边界用例、ADR、解决方案简报等方法论；产品/业务需求事实源仍由 prd-docs 归一化落盘',
  )
})
