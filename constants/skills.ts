/**
 * 安装前置命令必须以结构化参数声明，避免把配置内容拼进 shell 字符串。
 */
export interface SetupCommand {
  command: string
  args?: string[]
  /**
   * 当指定命令已存在于 PATH 时跳过当前 setup 命令。
   * 适用于全局工具已安装后不应重复覆盖正在运行二进制的场景。
   */
  skipIfCommandAvailable?: string
}

/**
 * 单个 skill 的详细配置（适用于需要重命名或前置安装命令的场景）
 */
export interface SkillConfig {
  /** 仓库内源目录名 */
  name: string
  /** 安装后目录名，默认与 name 相同 */
  output?: string
  /**
   * 该 skill 的安装前置命令。
   * 在 skill 链接建立后执行，例如安装对应的全局 CLI 工具。
   * 例如：[{ command: 'some-cli-installer', args: ['--global'] }]
   * 命令按顺序执行，任一失败均会抛出错误并中断整体流程。
   */
  setup?: SetupCommand[]
}

/**
 * 技能定义：
 * - 字符串：简写形式，源目录名 === 安装后目录名，无 setup
 * - SkillConfig：对象形式，支持重命名和 per-skill setup 命令
 */
export type SkillDef = string | SkillConfig

/**
 * 单个供应商仓库内的一条安装投影规则。
 * namespace 用于递归扫描目录中的叶子 skills；skills 用于按 skill 精确投影。
 * 两者安装到 vendor/skills 时都只保留叶子 skill 名称，不继承源目录层级。
 */
export type VendorProjection
  = | {
    kind: 'namespace'
    /** 仓库内要递归扫描的目录 */
    sourceDir: string
    /** 清单中的占位名；实际 vendor 目录由叶子 skill 名称决定 */
    output: string
    /** namespace 级安装前置命令 */
    setup?: SetupCommand[]
  }
  | {
    kind: 'skills'
    /** 仓库内技能所在的基准目录 */
    sourceBaseDir: string
    /** 需要精确安装的技能列表 */
    skills: SkillDef[]
  }

/**
 * 代表一个外部供应商的技能仓库
 */
export interface VendorRepo {
  /** 供应商名称，也是克隆到本地后的目录名 */
  name: string
  /** 是否为官方仓库 */
  official: boolean
  /** Git 仓库地址 */
  source: string
  /**
   * workspace 表示该供应商来自当前 AIRules 安装目录，而不是远程 Git checkout。
   * 仅用于 moluoxixi 第一方 skills，避免新增 skill 必须先存在于远程仓库才能通过本地验证。
   */
  sourceMode?: 'git' | 'workspace'
  /**
   * 供应商级安装前置命令。
   * 用于安装与整组 skills 相关的外部工具，不绑定到某个具体 skill 链接。
   */
  setup?: SetupCommand[]
  /** 从该仓库投影到 vendor/skills 的安装规则列表 */
  projections: VendorProjection[]
}

/**
 * 技能节点：可以是一个具体的 VendorRepo 实例，也可以是一个包含多个节点的分类对象。
 * 这种递归结构允许在数组中直接混合使用"扁平技能"和"嵌套分类"。
 */
export type VendorNode = VendorRepo | { [category: string]: VendorNode[] }

/**
 * 供应商配置：必须是一个 VendorNode 数组。
 * 这种结构提供了极大的灵活性：
 * - 如果直接放入 VendorRepo，安装时会扁平化到顶级。
 * - 如果放入 { "category": [...] }，category 只作为配置分组，不进入 vendor/skills 路径。
 */
export type VendorsConfig = VendorNode[]

/**
 * 安装 AIRules 时同步安装 CodeGraph，并执行官方安装初始化。
 * 该工具作为项目代码图谱和知识入口，不绑定到某个具体 skill。
 */
const codegraphSetup: SetupCommand[] = [
  {
    command: 'npm',
    args: ['install', '--global', '@colbymchenry/codegraph'],
    skipIfCommandAvailable: 'codegraph',
  },
  {
    command: 'codegraph',
    args: ['install', '--yes'],
  },
]

/**
 * 安装 AIRules 时同步全局安装 OpenSpec CLI。
 * OpenSpec 提供 spec-driven 的 propose→apply→archive 工作流，承接需求确认到实现的书面契约层。
 * 全局装好命令后，init-project 的 init-openspec 脚本在用户项目里执行
 * `openspec init .airules --tools none`，把 change/spec 工作目录落在 .airules/openspec/，
 * 不向宿主 agent 目录写 slash command、不写机器级注册表。
 * @see https://github.com/Fission-AI/OpenSpec
 */
const openspecSetup: SetupCommand[] = [
  {
    command: 'npm',
    args: ['install', '--global', '@fission-ai/openspec'],
    skipIfCommandAvailable: 'openspec',
  },
]

/**
 * @see https://github.com/Shubhamsaboo/awesome-llm-apps/tree/main/awesome_agent_skills awesome-agent-skills仓库，收集了很多技能
 * @see https://github.com/anthropics/skills.git anthropic（claude）官方技能仓库
 * @see https://github.com/google-gemini/gemini-cli.git gemini官方技能仓库
 * @see https://github.com/openai/skills.git openai官方技能仓库
 * @see https://github.com/obra/superpowers.git superpowers官方技能仓库
 */
export const vendors: VendorsConfig = [
  {
    name: 'gemini',
    official: true,
    source: 'https://github.com/google-gemini/gemini-cli.git',
    projections: [
      {
        kind: 'skills',
        sourceBaseDir: '.gemini/skills',
        skills: [
          { name: 'code-reviewer', output: 'code-reviewer-gemini' },
          { name: 'pr-creator', output: 'pr-creator-gemini' },
        ],
      },
    ],
  },
  {
    name: 'vercelLabs',
    official: true,
    source: 'https://github.com/vercel-labs/skills.git',
    projections: [
      {
        kind: 'skills',
        sourceBaseDir: 'skills',
        skills: [{ name: 'find-skills', output: 'find-skills-vercel' }],
      },
    ],
  },
  {
    name: 'anthropic',
    official: true,
    source: 'https://github.com/anthropics/skills.git',
    projections: [
      {
        kind: 'skills',
        sourceBaseDir: 'skills',
        skills: [
          { name: 'frontend-design', output: 'frontend-design-anthropic' },
        ],
      },
    ],
  },
  {
    name: 'openai',
    official: true,
    source: 'https://github.com/openai/skills.git',
    projections: [
      {
        kind: 'skills',
        sourceBaseDir: 'skills/.curated',
        skills: [{ name: 'playwright', output: 'playwright-openai' }],
      },
    ],
  },
  {
    name: 'superpowers',
    official: true,
    source: 'https://github.com/obra/superpowers.git',
    projections: [
      {
        // Superpowers 的全部方法论已第一方化（抄原文改造、对齐本项目契约后落在 skills/），
        // 见 skills/{brainstorming,writing-plans,test-driven-development,verification-before-completion,
        // systematic-debugging,requesting-code-review,writing-skills,executing-plans,
        // subagent-driven-development,dispatching-parallel-agents,receiving-code-review,
        // using-git-worktrees,finishing-a-development-branch}。
        // 因 vendor/skills 扁平命名空间，superpowers 原版不再分发以避免与第一方撞名/双份。
        // using-superpowers（框架自指胶水）与本项目按需加载机制冲突，弃用。
        // 此处保留 vendor 槽位但空精选：上游若出现新的、无第一方等价物的 skill，在此 skills 数组按需登记。
        kind: 'skills',
        sourceBaseDir: 'skills',
        skills: [],
      },
    ],
  },
  {
    // 产品发现 / 用户故事 / 验收标准 / 边界用例 / ADR 等 PM 方法论由 pm-skills 上游做主。
    // 在 AIRules 链路中，产品/业务需求默认先进入第一方 prd-docs；
    // pm-skills 提供发现与拆解方法论（不绑定项目 docs 结构），作为 prd-docs 的辅助工具箱，
    // prd-docs 负责把确认后的需求事实归一化落盘到 docs/prds/ 标准结构并维护知识源治理与导航。
    name: 'pmSkills',
    official: false,
    source: 'https://github.com/product-on-purpose/pm-skills.git',
    projections: [
      {
        kind: 'skills',
        sourceBaseDir: 'skills',
        skills: [
          'deliver-prd',
          'deliver-user-stories',
          'deliver-acceptance-criteria',
          'deliver-edge-cases',
          'develop-adr',
          'develop-solution-brief',
        ],
      },
    ],
  },
  {
    // 第一方 skill：绑定本项目 docs/ 知识治理结构与子代理评审协议，外部框架不生成这类结构化产物。
    // 文档/计划/架构类（prd-docs/test-docs/*-impl-plan/architecture-*/api-docs/components-docs）
    // 无外部等价替代，由本项目维护；调试/验证/评审 4 个为第一方化版本（剥离 Claude-Code 专用引用、
    // 对齐子代理评审协议），superpowers 原版因扁平命名空间撞名不再分发。
    // pm-skills 的 deliver-* 作为 prd-docs 内部需求侧方法论辅助（方法论 vs docs 结构落盘，分工见上）。
    name: 'moluoxixi',
    official: true,
    source: 'https://github.com/moluoxixi/AIRules.git',
    sourceMode: 'workspace',
    setup: [...codegraphSetup, ...openspecSetup],
    projections: [
      {
        kind: 'skills',
        sourceBaseDir: 'skills',
        skills: [
          // 项目初始化与会话
          'init-project',
          'handoff',
          'session-capture',
          // 需求 → 计划 → 测试设计
          'brainstorming',
          'writing-plans',
          'test-design',
          // 实现与测试方法论
          'test-driven-development',
          'unit-testing',
          'interaction-testing',
          // 验证 / 调试
          'verification-before-completion',
          'systematic-debugging',
          // 评审
          'requesting-code-review',
          'receiving-code-review',
          'consistency-check',
          // 子代理编排 / 计划执行 / worktree / 收尾
          'executing-plans',
          'subagent-driven-development',
          'dispatching-parallel-agents',
          'using-git-worktrees',
          'finishing-a-development-branch',
          // skill 提炼
          'writing-skills',
        ],
      },
    ],
  },
]
