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
   * 技能显式映射表：[源目录名]: [安装后的目录名]。
   * 如果提供了此项，则只安装映射表中的技能。
   */
  skills?: Record<string, string>;
}

/**
 * 技能节点：可以是一个具体的 VendorRepo 实例，也可以是一个包含多个节点的分类对象。
 * 这种递归结构允许在数组中直接混合使用“扁平技能”和“嵌套分类”。
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
    skills: {
      'code-reviewer': 'code-reviewer',
      'pr-creator': 'pr-creator',
    },
  },
  {
    name: 'vercelLabs',
    official: true,
    source: 'https://github.com/vercel-labs/skills.git',
    sourceBaseDir: 'skills',
    skills: {
      'find-skills': 'find-skills',
    },
  },

  {
    name: 'antfu',
    official: true,
    source: 'https://github.com/antfu/skills.git',
    sourceBaseDir: 'skills',
    skills: {
      antfu: 'antfu',
      pnpm: 'pnpm',
      slidev: 'slidev',
      tsdown: 'tsdown',
      turborepo: 'turborepo',
      vitest: 'vitest',
      nuxt: 'nuxt',
      pinia: 'pinia',
      unocss: 'unocss',
      vite: 'vite',
      vitepress: 'vitepress',
      vue: 'vue',
      'vue-best-practices': 'vue-best-practices',
      'vue-router-best-practices': 'vue-router-best-practices',
      'vue-testing-best-practices': 'vue-testing-best-practices',
      'vueuse-functions': 'vueuse-functions',
      'web-design-guidelines': 'web-design-guidelines',
    },
  },
  {
    name: 'playwright',
    official: true,
    source: 'https://github.com/microsoft/playwright-cli.git',
    sourceBaseDir: 'skills',
    skills: {
      'playwright-cli': 'playwright-cli',
    },
  },
  {
    name: 'superpowers',
    official: true,
    source: 'https://github.com/obra/superpowers.git',
    sourceDir: 'skills',
  },
];
