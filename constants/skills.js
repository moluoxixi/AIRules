/**
 * Author-facing vendor tree.
 *
 * Shape:
 * - top-level key: target namespace under `vendor/skills/`
 * - top-level key with a `source` field: single vendor entry for that namespace
 * - nested key with a `source` field: vendor entry targeting the current namespace bucket
 * - nested key without a `source` field: child namespace bucket
 */
export const vendors = {
  common: {
    gemini: {
      official: true,
      source: 'https://github.com/google-gemini/gemini-cli.git',
      sourceBaseDir: '.gemini/skills',
      skills: {
        'code-reviewer': 'code-reviewer',
        'pr-creator': 'pr-creator',
      },
    },
    vercelLabs: {
      official: true,
      source: 'https://github.com/vercel-labs/skills.git',
      sourceBaseDir: 'skills',
      skills: {
        'find-skills': 'find-skills',
      },
    },
    react: {
      official: true,
      source: 'https://github.com/facebook/react.git',
      sourceBaseDir: '.claude/skills',
      skills: {
        fix: 'fix',
      },
    },
    vercel: {
      official: true,
      source: 'https://github.com/vercel/next.js.git',
      sourceBaseDir: '.agents/skills',
      skills: {
        'update-docs': 'update-docs',
      },
    },
    awesomeLlmApps: {
      official: false,
      source: 'https://github.com/Shubhamsaboo/awesome-llm-apps.git',
      sourceBaseDir: 'awesome_agent_skills',
      skills: {
        'fullstack-developer': 'fullstack-developer',
      },
    },
    moluoxixi: {
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
  },

  frontend: {
    anthropic: {
      official: true,
      source: 'https://github.com/anthropics/skills.git',
      sourceBaseDir: 'skills',
      skills: {
        'frontend-design': 'frontend-design',
        'webapp-testing': 'webapp-testing',
      },
    },
    vercel: {
      official: true,
      source: 'https://github.com/vercel/next.js.git',
      sourceBaseDir: '.claude-plugin/plugins/cache-components/skills',
      skills: {
        'cache-components': 'cache-components',
      },
    },
    moluoxixi: {
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
  },

  superpowers: {
    official: true,
    source: 'https://github.com/obra/superpowers.git',
    sourceDir: 'skills',
  },
}
