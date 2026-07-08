import type { VendorsConfig } from '../vendors.js'
import assert from 'node:assert'
import { it } from 'vitest'
import { vendors as openspecDevelopmentVendors } from '../../../roles/openspec-development/constants/skills.js'
import { vendors as productVendors } from '../../../roles/product/constants/skills.js'
import { vendors as speckitDevelopmentVendors } from '../../../roles/speckit-development/constants/skills.js'
import { walkVendorTree } from '../vendors.js'

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

it('walkVendorTree - agents 与 mcp projection 映射到通用 vendor 分发面', () => {
  const vendors: Record<string, any> = {}
  const mockConfig: VendorsConfig = [
    {
      name: 'platform-vendor',
      official: true,
      source: 'https://github.com/example/platform.git',
      projections: [
        {
          kind: 'agents',
          sourceDir: 'agents',
        },
        {
          kind: 'mcp',
          sourceFile: 'mcp-configs/mcp-servers.json',
        },
      ],
    },
  ]

  walkVendorTree(mockConfig, [], vendors)

  assert.deepStrictEqual(
    vendors['platform-vendor'].links.map((link: any) => ({
      kind: link.kind,
      source: link.source,
      target: link.target,
    })),
    [
      {
        kind: 'agents-dir',
        source: 'agents',
        target: 'vendor/agents',
      },
      {
        kind: 'mcp-file',
        source: 'mcp-configs/mcp-servers.json',
        target: 'vendor/mcp/mcp.json',
      },
    ],
  )
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

  walkVendorTree(openspecDevelopmentVendors, [], vendors)

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
  assert.deepStrictEqual(
    vendors.superpowers.links.map((link: any) => ({
      kind: link.kind,
      source: link.source,
      target: link.target,
    })),
    [{
      kind: 'namespace-dir',
      source: 'skills',
      target: 'vendor/skills/superpowers',
    }],
    'Superpowers 应以 skills 版 namespace 接入，后续同步按叶子 skill 名展平',
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

  walkVendorTree(openspecDevelopmentVendors, [], vendors)

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
      {
        command: 'npm',
        args: ['install', '--global', '@fission-ai/openspec'],
        skipIfCommandAvailable: 'openspec',
      },
    ],
    '安装 AIRules openspec-development 角色时只需要同步 CodeGraph 与 OpenSpec CLI；BMAD 通过 vendor skills projection 接入，不安装 bmad-method CLI',
  )
  assert.ok(
    !vendors.moluoxixi.links.some((link: any) => link.target === 'vendor/skills/workflow'),
    '删除静态 workflow skill 后不应继续安装 workflow namespace',
  )
  assert.ok(
    !vendors.moluoxixi.links.some((link: any) => link.target.endsWith('/caveman')),
    'caveman 超压缩模式不在默认分发中',
  )
})

it('vendors 配置 - openspec-development 角色接入 BMAD 文档拆分、gstack 评审 QA 与 Matt 按需工程技能', () => {
  const vendors: Record<string, any> = {}

  walkVendorTree(openspecDevelopmentVendors, [], vendors)

  assert.ok(vendors.bmadMethod, 'openspec-development 角色应接入 BMAD Method')
  assert.strictEqual(vendors.bmadMethod.repo, 'https://github.com/bmad-code-org/BMAD-METHOD.git')
  assert.deepStrictEqual(
    vendors.bmadMethod.links.map((link: any) => ({
      source: link.source,
      target: link.target,
    })),
    [
      {
        source: 'src/bmm-skills/2-plan-workflows/bmad-prd',
        target: 'vendor/skills/bmad-prd',
      },
      {
        source: 'src/bmm-skills/3-solutioning/bmad-create-epics-and-stories',
        target: 'vendor/skills/bmad-create-epics-and-stories',
      },
      {
        source: 'src/bmm-skills/3-solutioning/bmad-generate-project-context',
        target: 'vendor/skills/bmad-generate-project-context',
      },
      {
        source: 'src/core-skills/bmad-shard-doc',
        target: 'vendor/skills/bmad-shard-doc',
      },
    ],
    'openspec-development 角色应接入 BMAD PRD 校验、epic/story 拆分、项目上下文与长文档分片',
  )

  assert.ok(vendors.gstack, 'openspec-development 角色应接入 gstack')
  assert.strictEqual(vendors.gstack.repo, 'https://github.com/garrytan/gstack.git')
  assert.deepStrictEqual(
    vendors.gstack.links.map((link: any) => ({
      source: link.source,
      target: link.target,
    })),
    [
      { source: 'plan-ceo-review', target: 'vendor/skills/gstack-plan-ceo-review' },
      { source: 'plan-eng-review', target: 'vendor/skills/gstack-plan-eng-review' },
      { source: 'plan-design-review', target: 'vendor/skills/gstack-plan-design-review' },
      { source: 'plan-devex-review', target: 'vendor/skills/gstack-plan-devex-review' },
      { source: 'review', target: 'vendor/skills/gstack-review' },
      { source: 'qa-only', target: 'vendor/skills/gstack-qa-only' },
      { source: 'qa', target: 'vendor/skills/gstack-qa' },
      { source: 'design-review', target: 'vendor/skills/gstack-design-review' },
      { source: 'devex-review', target: 'vendor/skills/gstack-devex-review' },
      { source: 'document-release', target: 'vendor/skills/gstack-document-release' },
    ],
    'gstack 评审与 QA 技能必须带来源前缀，避免抢占通用 review/qa 名称',
  )

  assert.ok(vendors.mattPocock, 'openspec-development 角色应接入 Matt Pocock 精选技能')
  assert.strictEqual(vendors.mattPocock.repo, 'https://github.com/mattpocock/skills.git')
  assert.deepStrictEqual(
    vendors.mattPocock.links.map((link: any) => ({
      source: link.source,
      target: link.target,
    })),
    [
      { source: 'skills/engineering/grill-with-docs', target: 'vendor/skills/matt-grill-with-docs' },
      { source: 'skills/engineering/domain-modeling', target: 'vendor/skills/matt-domain-modeling' },
      { source: 'skills/engineering/codebase-design', target: 'vendor/skills/matt-codebase-design' },
      { source: 'skills/engineering/to-spec', target: 'vendor/skills/matt-to-spec' },
      { source: 'skills/engineering/to-tickets', target: 'vendor/skills/matt-to-tickets' },
      { source: 'skills/engineering/tdd', target: 'vendor/skills/matt-tdd' },
      { source: 'skills/engineering/diagnosing-bugs', target: 'vendor/skills/matt-diagnosing-bugs' },
      { source: 'skills/engineering/code-review', target: 'vendor/skills/matt-code-review' },
    ],
    'Matt Pocock 技能按需精选接入并统一加 matt- 前缀',
  )

  assert.deepStrictEqual(
    vendors.moluoxixi.links.map((link: any) => ({
      source: link.source,
      target: link.target,
    })),
    [
      {
        source: 'roles/openspec-development/skills/init-project',
        target: 'vendor/skills/init-project',
      },
    ],
    'openspec-development 专属一方 skill 只保留 init-project；handoff 与 frontend-testing 由 common overlay 分发',
  )
})

it('vendors 配置 - 仅接入 Anthropic 的前端视觉设计技能', () => {
  const vendors: Record<string, any> = {}

  walkVendorTree(openspecDevelopmentVendors, [], vendors)

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

it('vendors 配置 - speckit-development 接入 Spec Kit + Superpowers bridge，但不接入静态代码规范供应商', () => {
  const vendors: Record<string, any> = {}

  walkVendorTree(speckitDevelopmentVendors, [], vendors)

  assert.ok(vendors.speckitSuperpowersBridge, 'speckit-development 应接入 speckit-superpowers-bridge')
  assert.strictEqual(vendors.speckitSuperpowersBridge.repo, 'https://github.com/lihan3238/speckit-superpowers-bridge.git')
  assert.deepStrictEqual(
    vendors.speckitSuperpowersBridge.links.map((link: any) => ({
      kind: link.kind,
      source: link.source,
      target: link.target,
      setup: link.setup,
    })),
    [
      {
        kind: 'skill',
        source: '.agents/skills/speckit-superpowers-bridge',
        target: 'vendor/skills/speckit-superpowers-bridge',
        setup: undefined,
      },
    ],
    'speckit-development 可选角色应直接采用社区 bridge 的 Codex skill surface，而不是复制一方实现',
  )
  assert.ok(vendors.superpowers, 'bridge 执行阶段仍需要官方 Superpowers skills namespace')
  assert.deepStrictEqual(
    vendors.moluoxixi.links.map((link: any) => ({
      source: link.source,
      target: link.target,
    })),
    [
      {
        source: 'roles/speckit-development/skills/init-project',
        target: 'vendor/skills/init-project',
      },
    ],
    'speckit-development 分发完整 init-project，用于项目规则、Spec Kit、bridge 与 CodeGraph 初始化',
  )
  assert.strictEqual(vendors.antfu, undefined, '不应默认安装 Antfu 框架/工具链技能')
  assert.strictEqual(vendors.vercelAgentSkills, undefined, '不应默认安装 Vercel React/React Native 代码技能')
})

it('vendors 配置 - PM skills 由 product 角色接入 pmSkills 上游', () => {
  const vendors: Record<string, any> = {}

  walkVendorTree(productVendors, [], vendors)

  assert.ok(vendors.pmSkills, 'product 角色应接入 pmSkills 上游')
  assert.strictEqual(vendors.pmSkills.repo, 'https://github.com/product-on-purpose/pm-skills.git')
  assert.deepStrictEqual(
    vendors.pmSkills.links
      .map((link: any) => ({
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
    'product 角色从 pmSkills 上游提供 PRD、用户故事、验收标准、边界用例、ADR、解决方案简报等 PM 方法论',
  )

  assert.ok(vendors.bmadMethod, 'product 角色应接入 BMAD Method')
  assert.strictEqual(vendors.bmadMethod.repo, 'https://github.com/bmad-code-org/BMAD-METHOD.git')
  assert.strictEqual(
    vendors.bmadMethod.setup,
    undefined,
    'BMAD CLI 安装由 product 角色的一方 setup 负责，不在 bmadMethod vendor 上重复声明',
  )
  assert.deepStrictEqual(
    vendors.bmadMethod.links.map((link: any) => ({
      source: link.source,
      target: link.target,
    })),
    [
      {
        source: 'src/bmm-skills/2-plan-workflows/bmad-prd',
        target: 'vendor/skills/bmad-prd',
      },
      {
        source: 'src/bmm-skills/3-solutioning/bmad-create-epics-and-stories',
        target: 'vendor/skills/bmad-create-epics-and-stories',
      },
      {
        source: 'src/bmm-skills/3-solutioning/bmad-generate-project-context',
        target: 'vendor/skills/bmad-generate-project-context',
      },
      {
        source: 'src/core-skills/bmad-shard-doc',
        target: 'vendor/skills/bmad-shard-doc',
      },
    ],
    'product 角色应接入 BMAD PRD 校验、epic/story 拆分、项目上下文与长文档分片',
  )

  assert.deepStrictEqual(
    vendors.moluoxixi.links.map((link: any) => ({
      source: link.source,
      target: link.target,
    })),
    [
      {
        source: 'roles/product/skills/init-project',
        target: 'vendor/skills/init-project',
      },
    ],
    'product 一方只维护 init-project，PM 方法论不复制到 AIRules 源目录',
  )
})

it('vendors 配置 - ecc-development 角色以 ECC 作为主编排来源', async () => {
  const { vendors: eccDevelopmentVendors } = await import('../../../roles/ecc-development/constants/skills.js')
  const vendors: Record<string, any> = {}

  walkVendorTree(eccDevelopmentVendors, [], vendors)

  assert.ok(vendors.ecc, 'ecc-development 角色应接入 ECC 上游')
  assert.strictEqual(vendors.ecc.repo, 'https://github.com/affaan-m/ECC.git')
  assert.strictEqual(
    vendors.ecc.setup,
    undefined,
    'ECC 角色不应通过 vendor setup 安装 CLI；官方全局 target 由 sync 阶段 npx --package ecc-universal ecc install 执行',
  )
  const eccLinks = vendors.ecc.links.map((link: any) => ({
    kind: link.kind,
    source: link.source,
    target: link.target,
    setup: link.setup,
  }))
  assert.equal(
    eccLinks.filter((link: any) => link.kind === 'skill' && link.source.startsWith('skills/')).length,
    21,
    'ECC fallback 应承接官方 core skills/ecc 的 21 个 core skills',
  )
  assert.equal(
    eccLinks.filter((link: any) => link.kind === 'skill' && link.source.startsWith('.agents/skills/')).length,
    26,
    'ECC fallback 应承接官方 .agents/skills 共享集合，并排除与 core skills 重名的条目',
  )
  assert.ok(
    eccLinks.some((link: any) => link.kind === 'agents-dir' && link.source === 'agents' && link.target === 'vendor/agents'),
    'ECC fallback 应从上游在线 agents/ 投影 subagents',
  )
  assert.ok(
    eccLinks.some((link: any) => link.source === '.agents/skills/api-design' && link.target === 'vendor/skills/api-design'),
    'ECC fallback 应接入 .agents/skills 的共享在线 skill',
  )
  assert.equal(
    eccLinks.some((link: any) => link.kind === 'mcp-file'),
    false,
    'ECC fallback MCP 使用 roles/ecc-development/mcp/mcp.json 的可审计清单，不直接激活上游全量 MCP catalog',
  )
  assert.equal(
    vendors.ecc.links.some((link: any) => /(?:typescript|python|golang|vue|react|django|springboot|rust)-/.test(link.source)),
    false,
    'ECC fallback 不应默认分发语言或框架 skill；语言能力交给项目扫描后的 --with lang:* / framework:*',
  )

  assert.strictEqual(vendors.superpowers, undefined, 'ecc-development 不应混入 Superpowers 上游')
  assert.strictEqual(vendors.gstack, undefined, 'ecc-development 不应混入 gstack 上游')
  assert.strictEqual(vendors.bmadMethod, undefined, 'ecc-development 不应混入 BMAD 上游')
  assert.strictEqual(vendors.moluoxixi, undefined, 'ecc-development 初始不维护第一方开发 skill')
})
