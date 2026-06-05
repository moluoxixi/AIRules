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
    name: 'anthropic',
    official: true,
    source: 'https://github.com/anthropics/skills.git',
    projections: [
      {
        kind: 'skills',
        sourceBaseDir: 'skills',
        skills: [
          'frontend-design',
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
    setup: codegraphSetup,
    projections: [
      {
        kind: 'skills',
        sourceBaseDir: 'skills',
        skills: [
          'architecture-docs',
          'api-docs',
          'components-docs',
          'init-project',
          'prd-docs',
          'retrospective-correction',
          'skill-validation-standard',
          'test-docs',
        ],
      },
    ],
  },
]
