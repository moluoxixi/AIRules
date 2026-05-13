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
   * 例如：['npm install -g some-cli@latest']
   * 命令按顺序执行，任一失败均会输出警告但不中断整体流程。
   */
  setup?: string[]
}

/**
 * 技能定义：
 * - 字符串：简写形式，源目录名 === 安装后目录名，无 setup
 * - SkillConfig：对象形式，支持重命名和 per-skill setup 命令
 */
export type SkillDef = string | SkillConfig

/**
 * 单个供应商仓库内的一条安装投影规则。
 * namespace 用于整体目录投影；skills 用于按 skill 精确投影。
 */
export type VendorProjection
  = | {
    kind: 'namespace'
    /** 仓库内要整体投影的目录 */
    sourceDir: string
    /** 安装后的 namespace 目录名 */
    output: string
    /** namespace 级安装前置命令 */
    setup?: string[]
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
 * - 如果放入 { "category": [...] }，安装时会创建分类文件夹。
 */
export type VendorsConfig = VendorNode[]

/**
 * @see https://github.com/vercel/next.js.git next.js官方仓库
 * @see https://github.com/vercel/next.js/tree/canary/.claude-plugin/plugins/cache-components/skills next.js官方用于calude的skills
 * @see https://github.com/facebook/react.git react官方仓库
 * @see https://github.com/antfu/skills.git antfu的技能仓库，收集了很多前端技能
 * @see https://github.com/facebook/react/tree/main/.claude/skills react官方用于claude的skills
 * @see https://github.com/Shubhamsaboo/awesome-llm-apps/tree/main/awesome_agent_skills awesome-agent-skills仓库，收集了很多技能
 * @see https://github.com/anthropics/skills.git anthropic（calude）官方技能仓库
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
        skills: ['code-reviewer', 'pr-creator'],
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
        skills: ['find-skills'],
      },
    ],
  },
  {
    name: 'antfu',
    official: true,
    source: 'https://github.com/antfu/skills.git',
    projections: [
      {
        kind: 'skills',
        sourceBaseDir: 'skills',
        skills: [
          'antfu',
          'pnpm',
          'slidev',
          'tsdown',
          'turborepo',
          'vitest',
          'nuxt',
          'pinia',
          'unocss',
          'vite',
          'vitepress',
          'vue',
          'vue-best-practices',
          'vue-router-best-practices',
          'vue-testing-best-practices',
          'vueuse-functions',
          'web-design-guidelines',
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
        skills: ['playwright'],
      },
    ],
  },
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
        skills: [
          'skill-creator-pro',
          'skill-seekers',
        ],
      },
    ],
  },
]
