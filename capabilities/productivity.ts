import type { CapabilityDefinition } from './types.js'

export const MATT_POCOCK_SKILLS_SOURCE = 'https://github.com/mattpocock/skills.git'
export const MATT_POCOCK_SKILLS_REVISION = '8b78b531ab965735c5dc74f6f7a219e1e37326df'

export const productivityCapability = {
  vendors: [
    {
      name: 'mattpocock',
      source: MATT_POCOCK_SKILLS_SOURCE,
      revision: MATT_POCOCK_SKILLS_REVISION,
      projections: [
        {
          kind: 'namespace',
          sourceDir: 'skills/productivity',
          output: 'productivity',
        },
      ],
    },
  ],
} satisfies CapabilityDefinition
