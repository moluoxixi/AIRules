/**
 * 面向维护者的 vendor 树定义。
 *
 * 结构说明：
 * - 对象键：`vendor/skills/` 下的目标命名空间
 * - 叶子值：该命名空间下的远程 vendor 条目数组
 * - vendor 别名：存放在每个条目的 `name` 字段中
 */
export const vendors = {
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
      name: 'moluoxixi',
      official: true,
      source: 'https://github.com/moluoxixi/skills.git',
      sourceBaseDir: 'skills',
      skills: {
        antfu: 'antfu',
        pnpm: 'pnpm',
        slidev: 'slidev',
        tsdown: 'tsdown',
        turborepo: 'turborepo',
        vitest: 'vitest',
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
      name: 'moluoxixi',
      official: true,
      source: 'https://github.com/moluoxixi/skills.git',
      sourceBaseDir: 'skills',
      skills: {
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
