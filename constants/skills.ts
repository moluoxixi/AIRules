/**
 * 单个 skill 的详细配置（适用于需要重命名或前置安装命令的场景）
 */
export interface SkillConfig {
  /** 仓库内源目录名 */
  name: string;
  /** 安装后目录名，默认与 name 相同 */
  output?: string;
  /**
   * 该 skill 的安装前置命令。
   * 在 skill 链接建立后执行，例如安装对应的全局 CLI 工具。
   * 例如：['npm install -g @playwright/cli@latest']
   * 命令按顺序执行，任一失败均会输出警告但不中断整体流程。
   */
  setup?: string[];
}

/**
 * 技能定义：
 * - 字符串：简写形式，源目录名 === 安装后目录名，无 setup
 * - SkillConfig：对象形式，支持重命名和 per-skill setup 命令
 */
export type SkillDef = string | SkillConfig;

/**
 * 代表一个外部供应商的技能仓库
 */
export interface VendorRepo {
  /** 供应商名称，也是克隆到本地后的目录名 */
  name: string;
  /** 是否为官方仓库 */
  official: boolean;
  /** Git 仓库地址 */
  source: string;
  /** 仓库内技能所在的基准目录（默认为 'skills'） */
  sourceBaseDir?: string;
  /**
   * 如果指定了 sourceDir，则表示整个目录作为一个整体技能安装，
   * 对应安装后的目录名由 VendorRepo 的 name 决定。
   */
  sourceDir?: string;
  /**
   * 技能安装列表。
   * - 字符串简写：源目录名与安装后目录名相同，无需额外配置
   * - SkillConfig 对象：支持自定义安装目录名（output）和安装前置命令（setup）
   */
  skills?: SkillDef[];
  /**
   * 整体 skill 模式（sourceDir）的安装前置命令列表。
   * 仅适用于 sourceDir 字段存在的场景；skill 级别的命令请使用 SkillConfig.setup。
   * 命令按顺序执行，任一失败均会输出警告但不中断整体流程。
   */
  setup?: string[];
}

/**
 * 技能节点：可以是一个具体的 VendorRepo 实例，也可以是一个包含多个节点的分类对象。
 * 这种递归结构允许在数组中直接混合使用"扁平技能"和"嵌套分类"。
 */
export type VendorNode = VendorRepo | { [category: string]: VendorNode[] };

/**
 * 供应商配置：必须是一个 VendorNode 数组。
 * 这种结构提供了极大的灵活性：
 * - 如果直接放入 VendorRepo，安装时会扁平化到顶级。
 * - 如果放入 { "category": [...] }，安装时会创建分类文件夹。
 */
export type VendorsConfig = VendorNode[];

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
    sourceBaseDir: '.gemini/skills',
    skills: ['code-reviewer', 'pr-creator'],
  },
  {
    name: 'vercelLabs',
    official: true,
    source: 'https://github.com/vercel-labs/skills.git',
    sourceBaseDir: 'skills',
    skills: ['find-skills'],
  },
  {
    name: 'antfu',
    official: true,
    source: 'https://github.com/antfu/skills.git',
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
    ],
  },
  {
    name: 'superpowers',
    official: true,
    source: 'https://github.com/obra/superpowers.git',
    sourceDir: 'skills',
  },
];
