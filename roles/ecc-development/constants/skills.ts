import type { SkillDef, VendorsConfig } from '../../../scripts/lib/vendors.js'

/**
 * ecc-development 角色把成熟上游 ECC 作为主编排来源。
 * 原生宿主安装走 ECC 官方 core profile；fallback 则用上游在线
 * skills / agents 承接 ECC core 的稳定安装面；MCP 和 role rules 由
 * AIRules 保持可审计的项目级资产，避免把上游全量 catalog 直接激活。
 * 不默认铺开 ECC 的语言/框架 skills。语言能力由目标项目扫描后通过
 * ECC --with lang:* / framework:* 按需安装。
 */
const eccCoreFallbackSkills: SkillDef[] = [
  'agent-introspection-debugging',
  'agent-sort',
  'ai-regression-testing',
  'code-tour',
  'configure-ecc',
  'continuous-learning',
  'continuous-learning-v2',
  'council',
  'e2e-testing',
  'error-handling',
  'eval-harness',
  'hookify-rules',
  'iterative-retrieval',
  'plankton-code-quality',
  'production-audit',
  'skill-scout',
  'skill-stocktake',
  'strategic-compact',
  'tdd-workflow',
  'verification-loop',
  'windows-desktop-e2e',
]

const eccSharedAgentSkills: SkillDef[] = [
  'api-design',
  'article-writing',
  'backend-patterns',
  'brand-voice',
  'bun-runtime',
  'coding-standards',
  'content-engine',
  'crosspost',
  'deep-research',
  'dmux-workflows',
  'documentation-lookup',
  'everything-claude-code',
  'exa-search',
  'fal-ai-media',
  'frontend-patterns',
  'frontend-slides',
  'investor-materials',
  'investor-outreach',
  'market-research',
  'mcp-server-patterns',
  'mle-workflow',
  'nextjs-turbopack',
  'product-capability',
  'security-review',
  'video-editing',
  'x-api',
]

export const extendsRoles = ['common']

export const vendors: VendorsConfig = [
  {
    name: 'ecc',
    official: true,
    source: 'https://github.com/affaan-m/ECC.git',
    projections: [
      {
        kind: 'skills',
        sourceBaseDir: 'skills',
        skills: eccCoreFallbackSkills,
      },
      {
        kind: 'skills',
        sourceBaseDir: '.agents/skills',
        skills: eccSharedAgentSkills,
      },
      {
        kind: 'agents',
        sourceDir: 'agents',
      },
    ],
  },
]
