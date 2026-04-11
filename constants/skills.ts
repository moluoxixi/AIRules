export interface VendorRepo {
  name: string;
  official: boolean;
  source: string;
  sourceBaseDir?: string;
  sourceDir?: string;
  skills?: Record<string, string>;
}

export const vendors: Record<string, VendorRepo[]> = {
  common: [
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
      name: 'react',
      official: true,
      source: 'https://github.com/facebook/react.git',
      sourceBaseDir: '.claude/skills',
      skills: {
        fix: 'fix',
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
      name: 'awesomeLlmApps',
      official: false,
      source: 'https://github.com/Shubhamsaboo/awesome-llm-apps.git',
      sourceBaseDir: 'awesome_agent_skills',
      skills: {
        'fullstack-developer': 'fullstack-developer',
      },
    },
    {
      name: 'antfu',
      official: true,
      source: 'https://github.com/antfu/skills.git',
      sourceBaseDir: 'skills',
      skills: {
        pnpm: 'pnpm',
        slidev: 'slidev',
        tsdown: 'tsdown',
        turborepo: 'turborepo',
        vitest: 'vitest',
      },
    },
    {
      name: 'moluoxixi',
      official: true,
      source: 'https://github.com/moluoxixi/AIRules.git',
      sourceBaseDir: 'skills',
      skills: {
        'moluoxixi': 'moluoxixi',
        'vue-best-practices': 'vue-best-practices',
      },
    },
  ],

  frontend: [
    {
      name: 'anthropic',
      official: true,
      source: 'https://github.com/anthropics/skills.git',
      sourceBaseDir: 'skills',
      skills: {
        'frontend-design': 'frontend-design',
        'webapp-testing': 'webapp-testing',
      },
    },
    {
      name: 'vercel',
      official: true,
      source: 'https://github.com/vercel/next.js.git',
      sourceBaseDir: '.claude-plugin/plugins/cache-components/skills',
      skills: {
        'cache-components': 'cache-components',
      },
    },
    {
      name: 'antfu',
      official: true,
      source: 'https://github.com/antfu/skills.git',
      sourceBaseDir: 'skills',
      skills: {
        nuxt: 'nuxt',
        pinia: 'pinia',
        unocss: 'unocss',
        vite: 'vite',
        vitepress: 'vitepress',
        vue: 'vue',
        'vue-router-best-practices': 'vue-router-best-practices',
        'vue-testing-best-practices': 'vue-testing-best-practices',
        'vueuse-functions': 'vueuse-functions',
        'web-design-guidelines': 'web-design-guidelines',
      },
    },
  ],

  superpowers: [
    {
      name: 'superpowers',
      official: true,
      source: 'https://github.com/obra/superpowers.git',
      sourceDir: 'skills',
    },
  ],
};
