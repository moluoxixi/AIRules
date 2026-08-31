import type { CapabilityDefinition } from './types.js'
import { MATT_POCOCK_SKILLS_REVISION, MATT_POCOCK_SKILLS_SOURCE } from './productivity.js'

export const engineeringCapability = {
  vendors: [
    {
      name: 'mattpocock',
      source: MATT_POCOCK_SKILLS_SOURCE,
      revision: MATT_POCOCK_SKILLS_REVISION,
      projections: [
        {
          kind: 'namespace',
          sourceDir: 'skills/engineering',
          output: 'engineering',
        },
      ],
    },
  ],
} satisfies CapabilityDefinition
