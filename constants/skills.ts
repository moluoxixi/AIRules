export interface VendorRepo {
  name: string;
  official: boolean;
  source: string;
  sourceBaseDir?: string;
  sourceDir?: string;
  skills?: Record<string, string>;
}


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
export type VendorsConfig = VendorRepo[] | Record<string, VendorRepo[]>;

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
    name: 'vercel',
    official: true,
    source: 'https://github.com/vercel/next.js.git',
    sourceBaseDir: '.agents/skills',
    skills: {
      'update-docs': 'update-docs',
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
    name: 'anthropic',
    official: true,
    source: 'https://github.com/anthropics/skills.git',
    sourceBaseDir: 'skills',
    skills: {
      'webapp-testing': 'webapp-testing',
    },
  },
  {
    name: 'superpowers',
    official: true,
    source: 'https://github.com/obra/superpowers.git',
    sourceDir: 'skills',
  },
];
