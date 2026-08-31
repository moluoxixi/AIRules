import type { CapabilityDefinition } from './types.js'

export const ANTHROPIC_SKILLS_SOURCE = 'https://github.com/anthropics/skills.git'
export const ANTHROPIC_SKILLS_REVISION = '3b3fad96af16a10759d930941b4520ba0c40edae'

export const frontendCapability = {
  roleProjections: [
    {
      kind: 'mcp',
      sourceFile: 'mcps/frontend/mcps.json',
      output: 'mcps/frontend/mcp.json',
    },
  ],
  vendors: [
    {
      name: 'anthropic-skills',
      source: ANTHROPIC_SKILLS_SOURCE,
      revision: ANTHROPIC_SKILLS_REVISION,
      projections: [
        {
          kind: 'skills',
          sourceBaseDir: 'skills',
          skills: ['frontend-design'],
        },
      ],
    },
  ],
} satisfies CapabilityDefinition
